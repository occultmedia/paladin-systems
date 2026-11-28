"""
Level 2: the normaliser. raw_listings -> property_master (what the dashboard reads).

    python -m terminal_spider.normalise              # process every waiting raw row
    python -m terminal_spider.normalise --dry-run    # show what it would write, write nothing
    python -m terminal_spider.normalise --limit 5
    python -m terminal_spider.normalise --all        # re-read every raw row (after changing the rules below)

It runs automatically at the end of a spider run (python -m terminal_spider),
and can be run on its own.

For each raw row that is new or changed (the `raw_listing_deltas` queue):

  1. Read the raw text into Terminal's fields: category and property type,
     district, USD price, beds, baths, sizes in sq ft, pool, tenure, status,
     map pin, agent, main photo. A page without a pin borrows the pin of the
     same building project listed elsewhere, else gets a spot near the
     district centre.
  2. Find its golden record:
       - the one it was merged into before (raw.property_id), else
       - the same property already listed by ANOTHER agency (same match score
         as the duplicate watch in the app: 70+ = same property). Only pins
         printed on the page count as a location; flats must name the same
         unit (Waykiri C12 is not Waykiri C-09, nor "Waykiri"); and each
         agency can have one listing in it, else
       - a new property_master row with a fresh public ref (AW-XXXXX).
  3. Write it. Only the agency that first listed a property (its primary
     source) updates the details; other agencies' copies just keep it
     "found" (the database trigger bumps last_scraped_at).
  4. mark_raw_processed(): the raw row leaves the queue, or keeps the error.

Then the comps pass recomputes the value signal of every active listing; the
rules are in signals.py.

The database does the rest itself: listing_events (Listed, Price drop,
Status change) and price history come from triggers on property_master.
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from .colisting import same_home, why_not
from .parsing import clean, parse_number

log = logging.getLogger("terminal_spider.normalise")

MARKET_ID = "aw-lux"
SQM_TO_SQFT = 10.7639
AWG_PER_USD = 1.79  # the florin is pegged to the dollar

# Map centres used when a listing page has no pin (same as src/lib/aruba-data.ts DISTRICT_CENTERS).
DISTRICT_CENTERS: dict[str, tuple[float, float]] = {
    "Arashi": (12.6105, -70.048),
    "Tierra del Sol": (12.6051, -70.0401),
    "Malmok": (12.6017, -70.0453),
    "Boca Catalina": (12.5979, -70.0441),
    "Gold Coast": (12.6005, -70.0395),
    "Palm Beach": (12.5735, -70.041),
    "Noord": (12.58, -70.031),
    "Eagle Beach": (12.5545, -70.051),
    "Oranjestad": (12.521, -70.0335),
    "Pos Chiquito": (12.476, -69.97),
    "Savaneta": (12.4545, -69.945),
    "Santa Cruz": (12.506, -69.984),
    "Paradera": (12.533, -70.005),
    "San Nicolas": (12.4335, -69.9065),
}
# Neighbourhood names agencies use, folded into Terminal's districts.
DISTRICT_ALIASES = {
    "bubali": "Noord", "salina cerca": "Noord", "alto vista": "Noord", "moko": "Noord", "tanki leendert": "Noord",
    "tanki flip": "Noord", "palm beach area": "Palm Beach", "eagle": "Eagle Beach", "punta brabo": "Eagle Beach",
    "sabana liber": "Noord", "westpunt": "Arashi", "sero colorado": "San Nicolas", "seroe colorado": "San Nicolas",
    "san nicolaas": "San Nicolas", "pos chikito": "Pos Chiquito", "brasil": "Pos Chiquito",
    "spaans lagoen": "Pos Chiquito", "balashi": "Pos Chiquito", "piedra plat": "Paradera", "ayo": "Paradera",
    "jamanota": "Santa Cruz", "cunucu abao": "Oranjestad", "dakota": "Oranjestad", "madiki": "Oranjestad",
    "wayaca": "Oranjestad", "bushiri": "Oranjestad", "barcadera": "Pos Chiquito", "ponton": "Oranjestad",
    "weststraat": "Oranjestad", "pos abou": "Eagle Beach", "pos abao": "Eagle Beach", "sero pita": "Paradera",
    "seroe pita": "Paradera", "rooi santo": "Noord", "opal": "Noord", "nanki beach": "San Nicolas",
    "rodgers beach": "San Nicolas", "rodger's beach": "San Nicolas", "baby beach": "San Nicolas",
    "sta cruz": "Santa Cruz", "sta. cruz": "Santa Cruz", "bakval": "Malmok",
}
# Place names: shared by unrelated listings, so never a sign of one building project.
PLACE_WORDS = {w for name in [*DISTRICT_CENTERS, *DISTRICT_ALIASES] for w in re.findall(r"[a-zà-ÿ]{3,}", name.lower())}
ISLAND_CENTER = (12.52, -70.0)
# Where the map in KW's and RE/MAX's sites stands until someone sets the pin.
DEFAULT_PIN = (12.5092044, -70.0086306)
ARUBA_BOUNDS = ((12.3, 12.7), (-70.2, -69.8))

STATUS_MAP = {
    "for sale": "For sale",
    "under contract": "Under contract",
    "sale in progress": "Under contract",
    "on hold": "Under contract",
    "under offer": "Under contract",
    "sold": "Sold",
}
UNIT_TYPES = {"Condo", "Apartment", "Townhouse"}
DUP_LIKELY = 70


# ── raw text -> fields ────────────────────────────────────────────────────


def to_sqft(text: str | None) -> int | None:
    """'1078 m² (11.604 Sq Ft)' -> 11603; '2,400 sq ft' -> 2400; ' m² (0 Sq Ft)' -> None."""
    if not text:
        return None
    if m := re.search(r"([\d.,]+)\s*(m²|m2|sqm|square met)", text, re.I):
        value = parse_number(m.group(1))
        sqft = value * SQM_TO_SQFT if value else None
    elif m := re.search(r"([\d.,]+)\s*(sq\.?\s*ft|ft²|square f)", text, re.I):
        sqft = parse_number(m.group(1))
    else:
        sqft = None
    return round(sqft) if sqft and sqft > 0 else None


def _has_word(words: str, text: str) -> bool:
    return re.search(rf"(?<![a-z]){re.escape(words)}(?![a-z])", text) is not None


def district_of(raw: str | None, lat: float | None, lng: float | None, description: str = "") -> str:
    """Terminal district for an agency's location text, else the one the description says it is in."""
    text = (clean(raw) or "").strip()
    low = text.lower()
    for name in DISTRICT_CENTERS:
        if name.lower() == low:
            return name
    for alias, name in DISTRICT_ALIASES.items():
        if _has_word(alias, low):
            return name
    for name in DISTRICT_CENTERS:
        if _has_word(name.lower(), low):
            return name
    said = re.search(rf"\b(?:in|heart of|located at)\s+(?:the\s+)?({'|'.join(DISTRICT_CENTERS)})\b", re.sub(r"\s+", " ", description), re.I)
    if said:
        return next(n for n in DISTRICT_CENTERS if n.lower() == said.group(1).lower())
    if lat is not None and lng is not None and not text:
        return min(DISTRICT_CENTERS, key=lambda n: (DISTRICT_CENTERS[n][0] - lat) ** 2 + (DISTRICT_CENTERS[n][1] - lng) ** 2)
    # a street address is not a district
    return text.title()[:60] if text and not re.search(r"\d", text) else "Aruba"


def approx_pin(district: str, key: str) -> tuple[float, float]:
    """No pin on the page: a stable spot near the district centre."""
    lat, lng = DISTRICT_CENTERS.get(district, ISLAND_CENTER)
    h = int(hashlib.sha1(key.encode()).hexdigest()[:8], 16)
    a = (h % 1000) / 1000 * math.tau
    r = 0.002 + ((h >> 10) % 100) / 100 * 0.003
    return lat + math.sin(a) * r, lng + math.cos(a) * r * 0.6


def in_aruba(lat: Any, lng: Any) -> bool:
    try:
        return ARUBA_BOUNDS[0][0] <= float(lat) <= ARUBA_BOUNDS[0][1] and ARUBA_BOUNDS[1][0] <= float(lng) <= ARUBA_BOUNDS[1][1]
    except (TypeError, ValueError):
        return False


def printed_pin(lat: Any, lng: Any) -> bool:
    """A pin someone placed: on the island, and not the map's default spot."""
    return in_aruba(lat, lng) and distance_m(float(lat), float(lng), *DEFAULT_PIN) > 60


def classify(raw_type: str | None, title: str, desc: str, beds: float | None = None) -> tuple[str, str, str | None]:
    """(asset_class, property_type, commercial_use) from the agency's type and the listing text."""
    t = (raw_type or "").lower()
    name = title.lower()
    text = f"{name} {desc[:600].lower()}"
    if "land" in t or (not t and re.search(r"\b(lot|plot|land)\b", name)):
        return "Land", "Land", None
    if "commercial" in t or "business" in t:
        use = (
            "Office" if re.search(r"\boffice", text)
            else "Retail" if re.search(r"\b(retail|shop|store|showroom)", text)
            else "Hospitality" if re.search(r"\b(hotel|resort|guest ?house|restaurant|hospitality|bar\b)", text)
            else "Warehouse" if re.search(r"\b(warehouse|storage|industrial)", text)
            else "Mixed-use" if re.search(r"mixed", text)
            else None
        )
        return "Commercial", "Commercial", use

    # The agency says it is a unit (or a new project, which usually sells
    # units). "House" and "Residence" in a building's name then say nothing:
    # Harbour House and Azure Beach Residences are condos.
    unit = bool(re.search(r"condo|town ?house|apartment", t))
    project = "development" in t
    for words, kind in (
        (r"penthouse", "Penthouse"),
        (r"beach ?house", "Beach House"),
        (r"town ?house|duplex", "Townhouse"),
        # "Gold Coast Villas | Diamante 194A" is a condo when its own text says so
        (r"\bvillas?\b" if (unit or project) and not re.search(r"\bcondo", desc[:300], re.I) else r"$^", "Villa"),
        (r"apartment|studio|\bapt\b", "Apartment"),
        (r"condo", "Condo"),
        (r"estate\b", "Estate"),
        (r"$^" if unit or project else r"villa|house|home|residence|bungalow|cunucu", "Villa"),
    ):
        if re.search(words, name):
            return "Property", kind, None
    if unit:
        if re.search(r"condo", text):
            return "Property", "Condo", None
        if re.search(r"town ?house|duplex", text):
            return "Property", "Townhouse", None
        return "Property", "Apartment" if re.search(r"apartment|studio", text) else "Condo", None
    if project:
        if re.search(r"condo", text):
            return "Property", "Condo", None
        if re.search(r"apartment|studio", text) or (beds is not None and beds <= 2):
            return "Property", "Apartment" if re.search(r"apartment|studio", text) else "Condo", None
        return "Property", "Villa", None
    if re.search(r"condo", text):
        return "Property", "Condo", None
    return "Property", "Villa", None


# "Property land" and "full ownership land" are how Aruba's agents write eigendom.
OWNED = re.compile(r"eigendom|freehold|property[ -]?land|owned[ -]land|ownership land|fee simple")
LEASED = re.compile(r"erfpacht|long[- ]?lease\b|lease[ -]?land|leasehold|government lease")


def tenure_of(title: str, desc: str) -> tuple[str | None, int | None]:
    """('Erfpacht' | 'Eigendom' | None, lease years left). None when the page does not say, or says both."""
    text = f"{title}\n{desc}".lower()
    owned, leased = bool(OWNED.search(text)), bool(LEASED.search(text))
    if owned == leased:
        return None, None
    if owned:
        return "Eigendom", None
    years = re.search(r"(\d{2})\s*(?:years?|yrs?)\s*(?:left|remaining)", text)
    return "Erfpacht", int(years.group(1)) if years else None


def pool_of(features: dict[str, str]) -> str | None:
    kind = (features.get("pool type") or "").lower()
    has = (features.get("pool") or "").lower()
    if "shared" in kind or "communal" in kind or "community" in kind:
        return "Shared pool"
    if "private" in kind or has in ("yes", "private"):
        return "Private pool"
    if has in ("no", "none"):
        return "No pool"
    return None


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "agent"


def public_ref(source_url: str, length: int = 5) -> str:
    """Stable public ref from the source URL: AW- + base36."""
    n = int(hashlib.sha1(source_url.encode()).hexdigest(), 16)
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    out = ""
    while len(out) < length:
        n, r = divmod(n, 36)
        out += chars[r]
    return f"AW-{out}"


@dataclass
class Fields:
    """One raw row read into property_master columns (without ids and lifecycle)."""
    row: dict[str, Any]
    agent: dict[str, Any] | None
    pin_exact: bool  # the pin was printed on the listing page


def read_raw(raw: dict[str, Any]) -> Fields:
    """Turn a raw_listings row into property_master fields. Raises ValueError when it can't be listed."""
    payload = raw.get("raw_payload") or {}
    features = {k.lower(): (v or "") for k, v in (payload.get("features") or {}).items()}
    title = clean(raw.get("raw_title")) or clean(raw.get("raw_address")) or ""
    desc = raw.get("raw_description") or ""
    if not title:
        raise ValueError("no title or address")

    price = parse_number(raw.get("raw_price"))
    currency = (raw.get("raw_currency") or "USD").upper()
    if not price or price <= 0:
        raise ValueError(f"no price ({payload.get('price_text') or raw.get('raw_price')!r})")
    if currency == "AWG":
        price = price / AWG_PER_USD
    elif currency != "USD":
        raise ValueError(f"price in {currency}, not converted")

    beds = parse_number(raw.get("raw_beds"))
    asset_class, ptype, use = classify(raw.get("raw_property_type"), title, desc, beds)
    baths = parse_number(raw.get("raw_baths"))
    # Sizes below these are typos on the source page ("3 m²"): treat them as unknown.
    built = to_sqft(raw.get("raw_built_area"))
    # (a home with a bedroom is never under 25 m²)
    built = built if built and built >= (269 if asset_class == "Property" and beds else 150) else None
    lot = to_sqft(raw.get("raw_lot_area"))
    lot = lot if lot and lot >= 300 else None
    if asset_class == "Property" and beds is None:
        raise ValueError("home without a bedroom count")
    if asset_class == "Land" and not lot:
        raise ValueError("land without a lot size")

    lat, lng = raw.get("raw_lat"), raw.get("raw_lng")
    district = district_of(raw.get("raw_district"), lat, lng, desc)
    pin_exact = printed_pin(lat, lng)
    if not pin_exact:
        lat, lng = approx_pin(district, raw["source_url"])

    tenure, lease_left = tenure_of(title, desc)
    status = STATUS_MAP.get((raw.get("raw_status") or "for sale").strip().lower(), "For sale")
    photos = [p for p in (raw.get("raw_photos") or []) if p][:1]

    agent = None
    a = raw.get("raw_agent") or None
    if a and clean(a.get("name")):
        agent = {
            "id": f"{raw['agency_id']}-{slug(a['name'])}",
            "agency_id": raw["agency_id"],
            "name": clean(a["name"])[:120],
            "title": (clean(a.get("title")) or None) and clean(a.get("title"))[:120],
            "phone": (clean(a.get("phone")) or None) and clean(a.get("phone"))[:40],
            "whatsapp": False,
            "email": (clean(a.get("email")) or None) and clean(a.get("email"))[:160],
            "photo_url": a.get("photo") or None,
        }

    row = {
        "asset_class": asset_class,
        "property_type": ptype,
        "commercial_use": use,
        "zoning": None,
        "asset_name": title[:160],
        "bedrooms": None if asset_class == "Land" or beds is None else min(60, int(beds)),
        "bathrooms": None if asset_class == "Land" or baths is None else min(60.0, round(baths, 1)),
        "built_sqft": None if asset_class == "Land" else built,
        "lot_sqft": lot,
        "pool": None if asset_class == "Land" else pool_of(features),
        "tenure": tenure,
        "lease_years_left": lease_left,
        "district": district,
        "address": clean(raw.get("raw_address")),
        "lat": float(lat),
        "lng": float(lng),
        "asking_price_usd": round(price, 2),
        "agency_id": raw["agency_id"],
        "agent_id": agent["id"] if agent else None,
        "source_url": raw["source_url"],
        "photo_url": photos[0] if photos else None,
        "photos": photos,
        "listing_status": status,
        "last_scraped_at": raw.get("last_scraped_at"),
        "last_run_id": raw.get("last_run_id"),
    }
    return Fields(row, agent, pin_exact)


# ── duplicate match (same scoring as src/lib/duplicates.ts and SQL listing_match_score) ──


def _trigrams(s: str) -> set[str]:
    out: set[str] = set()
    for w in [w for w in re.split(r"[^a-z0-9]+", s.lower()) if w]:
        p = f"  {w} "
        out.update(p[i : i + 3] for i in range(len(p) - 2))
    return out


def similarity(a: str, b: str) -> float:
    x, y = _trigrams(a), _trigrams(b)
    if not x or not y:
        return 0.0
    both = len(x & y)
    return both / (len(x) + len(y) - both)


def distance_m(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    dy = (b_lat - a_lat) * 111_320
    dx = (b_lng - a_lng) * 111_320 * math.cos(math.radians((a_lat + b_lat) / 2))
    return math.hypot(dx, dy)


def unit_tokens(name: str) -> set[str]:
    """Unit and house numbers in a name: "Waykiri C-08" -> {"c8"}, "Harbour House 613S" -> {"613s"}."""
    found = re.findall(r"(?<![a-z0-9])([a-z]{0,2})-?0*(\d{1,4})([a-z]{0,2})(?![a-z0-9])", name.lower())
    # "2BR 1BA" is what the flat has, not which flat it is
    return {f"{a}{n}{b}" for a, n, b in found if not (b in ("br", "ba", "bd") and not a)}


# Words in a project's name that say nothing about which project it is.
GENERIC = set("""a an and at by de del in near of on the to with aruba luxury living residence residences condo condos condominium condominiums
apartment apartments villa villas unit units resort boutique branded new home homes house beach ocean sea view views property for sale""".split())


def project_key(name: str) -> set[str]:
    """The words that identify a building project: "L'Aquila Residences – Eagle Beach" -> {"aquila", "eagle"}."""
    words = re.findall(r"[a-zà-ÿ]{3,}", re.sub(r"\b[ld]['’]", " ", name.lower()))
    return {w for w in words if w not in GENERIC}


def project_pin(row: dict[str, Any], masters: list[dict[str, Any]], exact: set[str]) -> dict[str, Any] | None:
    """A listing of the same building project whose page prints a pin. Units only: houses do not share a name."""
    key = project_key(row["asset_name"])
    if row["property_type"] not in UNIT_TYPES or not key or max(map(len, key)) < 4:
        return None
    for m in masters:
        if m["id"] in exact and m.get("property_type") in UNIT_TYPES and key <= project_key(m["asset_name"]):
            return m
    return None


def match_score(a: dict[str, Any], b: dict[str, Any]) -> int:
    if a["asset_class"] != b["asset_class"]:
        return 0
    ua, ub = unit_tokens(a["asset_name"]), unit_tokens(b["asset_name"])
    if ua and ub and not ua & ub:
        return 0  # both name a unit, and not the same one
    if a.get("property_type") in UNIT_TYPES and (not ua or ua != ub):
        return 0  # flats in one building look alike: only the same unit number makes them the same flat
    if bool(ua) != bool(ub) and (project_key(a["asset_name"]) & project_key(b["asset_name"])) - PLACE_WORDS:
        # The same project, but only one names a unit: "Villa Nevis 5811 ... Caribbean Town" is one house,
        # "Caribbean Town - Villa Nassau" a model sold many times over. Places ("Savaneta") do not count.
        return 0
    s = 0
    if None not in (a["lat"], a["lng"], b["lat"], b["lng"]):
        d = distance_m(a["lat"], a["lng"], b["lat"], b["lng"])
        if d > 1000:
            return 0
        s += 40 if d <= 40 else 28 if d <= 120 else 12 if d <= 300 else 0
    elif a["district"].strip().lower() == b["district"].strip().lower():
        s += 25
    else:
        return 0
    pa, pb = float(a["asking_price_usd"] or 0), float(b["asking_price_usd"] or 0)
    same_project = bool((project_key(a["asset_name"]) & project_key(b["asset_name"])) - PLACE_WORDS)
    if (
        ua and ua == ub and same_project
        and a.get("bedrooms") == b.get("bedrooms")
        and pa > 0 and pb > 0 and abs(pa - pb) <= 0.03 * max(pa, pb)
    ):
        # "The Reef 2B" at $1,629,999 and "The Reef 2B | Partial Ocean View ..." at $1,630,000:
        # agencies measure a flat differently (with or without the terrace), but the same
        # project, unit, bedrooms and price is one flat.
        return 95
    diff = None
    if a.get("built_sqft") and b.get("built_sqft"):
        diff = abs(a["built_sqft"] - b["built_sqft"]) / max(a["built_sqft"], b["built_sqft"])
    elif a.get("lot_sqft") and b.get("lot_sqft"):
        diff = abs(a["lot_sqft"] - b["lot_sqft"]) / max(a["lot_sqft"], b["lot_sqft"])
    if diff is not None:
        s += 30 if diff <= 0.02 else 20 if diff <= 0.06 else 8 if diff <= 0.12 else -20 if diff > 0.25 else 0
    if a.get("bedrooms") is not None and b.get("bedrooms") is not None:
        s += 10 if a["bedrooms"] == b["bedrooms"] else -15
    if pa > 0 and pb > 0:
        p = abs(pa - pb) / max(pa, pb)
        s += 12 if p <= 0.03 else 7 if p <= 0.1 else 0
    sim = similarity(a.get("address") or a["asset_name"], b.get("address") or b["asset_name"])
    s += 15 if sim >= 0.55 else 7 if sim >= 0.35 else 0
    return max(0, min(100, s))


# ── database work ─────────────────────────────────────────────────────────

MATCH_COLS = "id,listing_id,agency_id,source_url,asset_class,property_type,lat,lng,district,bedrooms,bathrooms,built_sqft,lot_sqft,asking_price_usd,asset_name,address"
RAW_COLS = (
    "id,agency_id,source_url,raw_title,raw_price,raw_currency,raw_beds,raw_baths,raw_built_area,raw_lot_area,"
    "raw_property_type,raw_status,raw_address,raw_district,raw_description,raw_agent,raw_photos,raw_lat,raw_lng,"
    "raw_payload,last_scraped_at,last_run_id,property_id"
)


def _all(query_fn, page: int = 1000) -> list[dict[str, Any]]:
    """Read every row of a query, 1000 at a time."""
    out: list[dict[str, Any]] = []
    start = 0
    while True:
        data = query_fn().range(start, start + page - 1).execute().data or []
        out.extend(data)
        if len(data) < page:
            return out
        start += page


def _same(a: Any, b: Any) -> bool:
    """Equal, treating numbers from the database (int, float or numeric string) by value."""
    if a is None or b is None:
        return a is None and b is None
    if isinstance(b, (int, float)):
        try:
            return abs(float(a) - float(b)) < 0.005
        except (TypeError, ValueError):
            return False
    return a == b


class Normaliser:
    def __init__(self, db: Any, *, dry_run: bool = False, limit: int | None = None, everything: bool = False) -> None:
        self.db = db
        self.everything = everything
        self.dry_run = dry_run
        self.limit = limit
        self.stats = {"read": 0, "inserted": 0, "updated": 0, "merged": 0, "failed": 0, "skipped": 0, "signals": 0}
        self.failures: list[str] = []
        self.planned: list[dict[str, Any]] = []

    def _new_ref(self, url: str, taken: set[str]) -> str:
        for length in (5, 6, 7, 8):
            ref = public_ref(url, length)
            if ref not in taken:
                return ref
        raise ValueError("could not pick a free public ref")

    def _upsert_agent(self, agent: dict[str, Any] | None) -> None:
        if agent and not self.dry_run:
            self.db.table("listing_agents").upsert(agent, on_conflict="id").execute()

    def _mark(self, raw_id: int, property_id: str | None, error: str | None = None, price_usd: float | None = None) -> None:
        if not self.dry_run:
            args = {"p_raw_id": raw_id, "p_property_id": property_id, "p_error": error}
            if price_usd:
                args["p_price_usd"] = round(float(price_usd), 2)  # this agency's own asking price (offers)
            self.db.rpc("mark_raw_processed", args).execute()

    def process_queue(self) -> None:
        source = "raw_listings" if self.everything else "raw_listing_deltas"
        q = lambda: self.db.table(source).select(RAW_COLS).order("id")  # noqa: E731
        raws = _all(q)
        if self.limit:
            raws = raws[: self.limit]
        masters = _all(lambda: self.db.table("property_master").select(MATCH_COLS).eq("status", "active"))
        by_id = {m["id"]: m for m in masters}
        # Listings whose own page prints a map pin. The others sit near their
        # district centre, which must not count as "the same spot".
        pinned_urls = {
            r["source_url"]
            for r in _all(lambda: self.db.table("raw_listings").select("source_url,raw_lat,raw_lng").not_.is_("raw_lat", "null").order("id"))
            if printed_pin(r["raw_lat"], r["raw_lng"])
        }
        # a property holds one listing per agency: two flats of the same agency are two flats
        held = {(r["property_id"], r["agency_id"]) for r in _all(lambda: self.db.table("raw_listings").select("property_id,agency_id").not_.is_("property_id", "null").order("id"))}
        exact = {m["id"] for m in masters if m["source_url"] in pinned_urls}

        def located(m: dict[str, Any], is_exact: bool) -> dict[str, Any]:
            return m if is_exact else {**m, "lat": None, "lng": None}

        # pages with a pin first, so the ones without can borrow from them
        raws.sort(key=lambda r: r.get("raw_lat") is None)
        taken = {r["listing_id"] for r in _all(lambda: self.db.table("property_master").select("listing_id"))}
        log.info("normalising %s raw rows (%s listings on the market)", len(raws), len(masters))

        for raw in raws:
            self.stats["read"] += 1
            if raw.get("raw_status") == "Skipped":
                # not an Aruba sale (a rental, another island): nothing to list
                self.stats["skipped"] += 1
                self._mark(raw["id"], raw.get("property_id"), f"skipped: {(raw.get('raw_payload') or {}).get('skipped', '')}"[:500])
                continue
            try:
                f = read_raw(raw)
            except Exception as exc:  # noqa: BLE001 - keep the error on the raw row, carry on
                self.stats["failed"] += 1
                self.failures.append(f"{raw['source_url']}: {exc}")
                log.warning("skip %s: %s", raw["source_url"], exc)
                self._mark(raw["id"], None, str(exc)[:500])
                continue

            try:
                if not f.pin_exact:
                    near = project_pin(f.row, masters, exact)
                    if near:
                        f.row.update(lat=near["lat"], lng=near["lng"], district=near["district"])
                        log.info("pin of %s borrowed from %s", f.row["asset_name"], near["listing_id"])
                pid = raw.get("property_id")
                master = by_id.get(pid) if pid else None
                if master is None and not pid:
                    # Same property already listed by another agency?
                    cand = located({**f.row, "id": None}, f.pin_exact)
                    best = max(
                        ((match_score(cand, located(m, m["id"] in exact)), m) for m in masters if (m["id"], raw["agency_id"]) not in held and m["agency_id"] != raw["agency_id"]),
                        key=lambda x: x[0],
                        default=(0, None),
                    )
                    # Without a printed pin on both sides the location is only a district,
                    # so the asking prices must also agree (within 15%) to call it one property.
                    if best[0] >= DUP_LIKELY and not (f.pin_exact and best[1]["id"] in exact):
                        theirs, ours = float(best[1]["asking_price_usd"]), f.row["asking_price_usd"]
                        if abs(theirs - ours) > 0.15 * max(theirs, ours):
                            log.info("no merge of %s into %s (score %s): no pin and the prices differ", raw["source_url"], best[1]["listing_id"], best[0])
                            best = (0, None)
                    # Both must agree: the score above and the co-listing check (colisting.py).
                    if best[0] >= DUP_LIKELY and not same_home(f.row, best[1], pins_exact=f.pin_exact and best[1]["id"] in exact):
                        log.info("no merge of %s into %s (score %s): co-listing check says %s", raw["source_url"], best[1]["listing_id"], best[0],
                                 why_not(f.row, best[1], pins_exact=f.pin_exact and best[1]["id"] in exact))
                        best = (0, None)
                    if best[0] >= DUP_LIKELY:
                        master = best[1]
                        self.stats["merged"] += 1
                        log.info("merge %s into %s (score %s)", raw["source_url"], master["listing_id"], best[0])
                        self.planned.append({"action": "merge", "into": master["listing_id"], **f.row})
                        held.add((master["id"], raw["agency_id"]))
                        self._mark(raw["id"], master["id"], price_usd=f.row["asking_price_usd"])
                        continue

                self._upsert_agent(f.agent)
                if master or pid:
                    pid = pid or master["id"]
                    primary = (master or {}).get("agency_id", raw["agency_id"]) == raw["agency_id"]
                    if primary:
                        self.planned.append({"action": "update", **f.row})
                        if not self.dry_run:
                            self.db.table("property_master").update(f.row).eq("id", pid).execute()
                        self.stats["updated"] += 1
                    self._mark(raw["id"], pid, price_usd=f.row["asking_price_usd"])
                else:
                    ref = self._new_ref(raw["source_url"], taken)
                    taken.add(ref)
                    row = {**f.row, "listing_id": ref, "market_id": MARKET_ID, "first_price_usd": f.row["asking_price_usd"]}
                    self.planned.append({"action": "insert", **row})
                    if self.dry_run:
                        new_id = f"dry-{ref}"
                    else:
                        new_id = self.db.table("property_master").insert(row).execute().data[0]["id"]
                    self.stats["inserted"] += 1
                    m = {k: row.get(k) for k in MATCH_COLS.split(",")} | {"id": new_id}
                    masters.append(m)
                    by_id[new_id] = m
                    if f.pin_exact:
                        exact.add(new_id)
                    self._mark(raw["id"], None if self.dry_run else new_id, price_usd=f.row["asking_price_usd"])
                log.info("%s  %s | %s %s | %s | USD %s", ref if not (master or pid) else "update", f.row["asset_name"], f.row["asset_class"], f.row["property_type"], f.row["district"], f"{f.row['asking_price_usd']:,.0f}")
            except Exception as exc:  # noqa: BLE001
                self.stats["failed"] += 1
                self.failures.append(f"{raw['source_url']}: {exc}")
                log.exception("failed %s", raw["source_url"])
                self._mark(raw["id"], None, str(exc)[:500])

    def comps_pass(self) -> None:
        """Recompute the signals of every active listing (see signals.py)."""
        from .signals import score

        rows = _all(lambda: self.db.table("property_master").select(
            "id,listing_id,asset_name,asset_class,property_type,district,listing_status,source_url,asking_price_usd,built_sqft,lot_sqft,"
            "bedrooms,pool,tenure,lat,lng,signal,comps_psf_usd,comps_count,price_vs_comps_pct,district_psf_usd,price_vs_district_pct"
        ).eq("status", "active").order("id"))
        texts = {r["source_url"]: r["raw_description"] or "" for r in _all(lambda: self.db.table("raw_listings").select("source_url,raw_description").order("id"))}
        new, why = score(rows, texts)
        now = datetime.now(timezone.utc).isoformat()
        self.signal_counts = Counter(new[r["id"]]["signal"] if r["id"] not in why else f"none: {why[r['id']]}" for r in rows)
        log.info("signals: %s", ", ".join(f"{k} {v}" for k, v in self.signal_counts.most_common()))
        for r in rows:
            upd = new[r["id"]]
            if any(not _same(r.get(k), v) for k, v in upd.items()):
                self.stats["signals"] += 1
                if not self.dry_run:
                    self.db.table("property_master").update({**upd, "signal_updated_at": now}).eq("id", r["id"]).execute()

    def run(self) -> dict[str, int]:
        from . import projects

        self.process_queue()
        self.comps_pass()
        if not self.dry_run:
            projects.run(self.db)  # group flats into building projects (projects.py)
        log.info("normaliser: %s", ", ".join(f"{k} {v}" for k, v in self.stats.items()))
        return self.stats


def main() -> int:
    from .__main__ import make_client

    ap = argparse.ArgumentParser(prog="terminal_spider.normalise", description="raw_listings -> property_master")
    ap.add_argument("--dry-run", action="store_true", help="read and print, write nothing")
    ap.add_argument("--limit", type=int, help="process at most N raw rows")
    ap.add_argument("--all", action="store_true", help="re-read every raw row, not only new and changed ones")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    n = Normaliser(make_client(), dry_run=args.dry_run, limit=args.limit, everything=args.all)
    n.run()
    if args.dry_run:
        for p in n.planned:
            print({k: p.get(k) for k in ("action", "listing_id", "asset_name", "asset_class", "property_type", "district", "bedrooms",
                                        "bathrooms", "built_sqft", "lot_sqft", "pool", "tenure", "asking_price_usd", "listing_status", "lat", "lng")})
    for f in n.failures:
        print("FAILED", f)
    return 1 if n.failures and not n.stats["inserted"] + n.stats["updated"] + n.stats["merged"] else 0


if __name__ == "__main__":
    sys.exit(main())
