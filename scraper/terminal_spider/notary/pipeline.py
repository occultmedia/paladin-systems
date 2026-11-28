"""
From notices to notary_auctions: read the facts, place the pin, work out the
status, and upsert one row per auction (idempotent: the row's key is the
office and the auction's page, so a nightly re-run updates, never duplicates).

Status:
  completed               the auction date has passed (or the site files it as closed)
  postponed_or_cancelled  the notice says so, or the auction left the site before its date
  suspended_private_bid   the notice says a private bid was accepted / the auction is suspended
  upcoming                otherwise
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

from ..normalise import DISTRICT_CENTERS, approx_pin, district_of
from .parse import AST, Notice, read_facts, street_address

log = logging.getLogger(__name__)

# Baseline's map districts folded into Aruba's six regions (notary_auctions.district).
REGION = {
    "Arashi": "Noord", "Tierra del Sol": "Noord", "Malmok": "Noord", "Boca Catalina": "Noord", "Gold Coast": "Noord",
    "Palm Beach": "Noord", "Noord": "Noord", "Eagle Beach": "Noord", "Oranjestad": "Oranjestad", "Pos Chiquito": "Savaneta",
    "Savaneta": "Savaneta", "Santa Cruz": "Santa Cruz", "Paradera": "Paradera", "San Nicolas": "San Nicolas",
}
# Places notary notices name that agency listings rarely do.
PLACES = {
    "bloemond": "Oranjestad", "rooi afo": "Paradera", "matadera": "Noord", "seroe patrishi": "San Nicolas",
    "sero patrishi": "San Nicolas", "neptunesstraat": "Oranjestad", "elleboogstraat": "Oranjestad", "betico croes": "Oranjestad",
    "meiveld": "Oranjestad", "papaya": "Oranjestad", "wayaca": "Oranjestad", "sabana liber": "Noord",
}
ARUBA_BBOX = "-70.10,12.38,-69.83,12.68"


def area_of(title: str, text: str) -> str | None:
    """Baseline map district for the auction (Palm Beach, Oranjestad...), None when unknown."""
    low = f"{title} {text[:600]}".lower()
    for place, area in PLACES.items():
        if place in low:
            return area
    d = district_of(title, None, None, text[:1500])
    if d in DISTRICT_CENTERS:
        return d
    m = re.search(r"\b(?:located|gelegen)\s+(?:in|at|te|aan)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)", text)
    if m:
        d = district_of(m.group(1), None, None, "")
        if d in DISTRICT_CENTERS:
            return d
    return None


def sha(data: Any) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def auction_key(n: Notice) -> str:
    """One auction: its office and page; on one-page sites also its heading (normalised)."""
    title = re.sub(r"[^a-z0-9]+", " ", n.title.lower()).strip()
    return sha([n.slug, n.source_url.rstrip("/"), title])[:40]


class Geocoder:
    """
    Pins, cheapest first:
      1. a Baseline listing at the same address (its pin is already ours);
      2. Mapbox permanent geocoding (results may be stored; billed per request,
         needs MAPBOX_GEOCODING_TOKEN in scraper/.env);
      3. near the district centre (pin_source 'district', shown as approximate).
    """

    def __init__(self, db: Any) -> None:
        self.db = db
        self.token = os.environ.get("MAPBOX_GEOCODING_TOKEN")
        if not self.token:
            log.info("MAPBOX_GEOCODING_TOKEN not set: auction pins come from listings or district centres")

    def from_listing(self, address: str) -> tuple[float, float] | None:
        if not self.db or len(address) < 5:
            return None
        like = f"%{address}%"
        rows = (
            self.db.table("property_master").select("lat,lng,asset_name,address").eq("status", "active")
            .or_(f"address.ilike.{like},asset_name.ilike.{like}").limit(3).execute().data or []
        )
        return (rows[0]["lat"], rows[0]["lng"]) if len(rows) == 1 else None

    def from_mapbox(self, address: str) -> tuple[float, float] | None:
        if not self.token:
            return None
        import httpx

        url = (
            "https://api.mapbox.com/search/geocode/v6/forward"
            f"?q={quote(address + ', Aruba')}&country=aw&bbox={ARUBA_BBOX}&limit=1&permanent=true&access_token={self.token}"
        )
        try:
            r = httpx.get(url, timeout=20)
            if r.status_code != 200:
                log.warning("Mapbox geocoding HTTP %s for %r", r.status_code, address)
                return None
            feats = r.json().get("features") or []
        except Exception as exc:  # noqa: BLE001
            log.warning("Mapbox geocoding failed for %r: %s", address, exc)
            return None
        if not feats:
            return None
        f = feats[0]
        conf = ((f.get("properties") or {}).get("match_code") or {}).get("confidence")
        kind = (f.get("properties") or {}).get("feature_type")
        if conf not in ("exact", "high", "medium") and kind not in ("address", "street"):
            return None
        lng, lat = f["geometry"]["coordinates"]
        return (lat, lng) if 12.38 <= lat <= 12.68 and -70.10 <= lng <= -69.83 else None

    def pin(self, address: str, area: str | None, key: str) -> tuple[float | None, float | None, str | None]:
        if hit := self.from_listing(address):
            return hit[0], hit[1], "listing"
        if hit := self.from_mapbox(address):
            return hit[0], hit[1], "mapbox"
        if area:
            lat, lng = approx_pin(area, key)
            return lat, lng, "district"
        return None, None, None


def build_row(n: Notice, prev: dict[str, Any] | None, geo: Geocoder, now: datetime) -> dict[str, Any]:
    f = read_facts(n)
    key = auction_key(n)
    area = area_of(n.title, n.text)
    address = street_address(n.title)
    adate: datetime | None = f["auction_date"]

    if n.listed_status == "closed" or (adate and adate < now - timedelta(hours=12) and f["status_cue"] != "postponed_or_cancelled"):
        status = "completed"
    elif f["status_cue"]:
        status = f["status_cue"]
    else:
        status = "upcoming"

    content = {k: v for k, v in f.items() if k != "status_cue"} | {
        "title": n.title, "documents": n.documents, "brochure": n.brochure_url, "status": status, "area": area,
    }
    row: dict[str, Any] = {
        "auction_key": key,
        "content_hash": sha(content),
        "notary_office": n.office,
        "notary_slug": n.slug,
        "source_url": n.source_url,
        "pdf_brochure_url": n.brochure_url,
        "documents": n.documents,
        "title": n.title[:300],
        "address": address or None,
        "district": REGION.get(area or ""),
        "area": area,
        "property_type": f["property_type"],
        "land_tenure": f["land_tenure"],
        "kadaster_id": f["kadaster_id"],
        "land_m2": f["land_m2"],
        "sale_type": f["sale_type"],
        "auction_date": adate.isoformat() if adate else None,
        "auction_place": f["auction_place"],
        "private_bids_allowed": f["private_bids_allowed"],
        "private_bid_deadline": f["private_bid_deadline"].isoformat() if f["private_bid_deadline"] else None,
        "private_bid_deadline_estimated": f["private_bid_deadline_estimated"],
        "starting_bid_awg": f["starting_bid_awg"],
        "status": status,
        "last_seen_at": now.isoformat(),
    }
    # place the pin once per address
    if prev and prev.get("geocoded_address") == address and prev.get("lat") is not None:
        row.update(lat=prev["lat"], lng=prev["lng"], pin_source=prev["pin_source"], geocoded_address=address)
    else:
        lat, lng, src = geo.pin(address, area, key)
        row.update(lat=lat, lng=lng, pin_source=src, geocoded_address=address if src else None)
    return row


PREV_COLS = "id,auction_key,status,auction_date,lat,lng,pin_source,geocoded_address,notary_slug,title"


def store(db: Any, slug: str, notices: list[Notice], site_ok: bool, *, dry_run: bool = False) -> dict[str, int]:
    """Upsert one office's notices; settle the auctions it no longer shows."""
    now = datetime.now(timezone.utc).astimezone(AST)
    prev_rows = db.table("notary_auctions").select(PREV_COLS).eq("notary_slug", slug).execute().data if db else []
    prev = {r["auction_key"]: r for r in prev_rows}
    geo = Geocoder(db)
    stats = {"seen": len(notices), "new": 0, "updated": 0, "removed": 0, "completed": 0}
    rows = []
    for n in notices:
        r = build_row(n, prev.get(auction_key(n)), geo, now)
        rows.append(r)
        stats["new" if r["auction_key"] not in prev else "updated"] += 1
        log.info("[%s] %s | %s | %s | Afl. %s | %s | pin: %s", slug, r["title"][:50], r["auction_date"], r["status"],
                 r["starting_bid_awg"], r["kadaster_id"], r["pin_source"])
    if dry_run or not db:
        return stats | {"rows": rows}  # type: ignore[dict-item]
    if rows:
        db.table("notary_auctions").upsert(rows, on_conflict="auction_key").execute()

    # Auctions this office no longer shows. Only when its page loaded: a site that is down removes nothing.
    seen = {r["auction_key"] for r in rows}
    for key, p in prev.items():
        if key in seen or p["status"] not in ("upcoming", "suspended_private_bid"):
            continue
        adate = datetime.fromisoformat(p["auction_date"]) if p.get("auction_date") else None
        if adate and adate < now - timedelta(hours=12):
            db.table("notary_auctions").update({"status": "completed"}).eq("id", p["id"]).execute()
            stats["completed"] += 1
        elif site_ok:
            db.table("notary_auctions").update({"status": "postponed_or_cancelled"}).eq("id", p["id"]).execute()
            db.table("notary_auction_events").insert({"auction_id": p["id"], "event": "removed", "old_value": p["status"]}).execute()
            stats["removed"] += 1
            log.info("[%s] no longer listed before its date: %s", slug, p["title"])
    return stats


def settle_past(db: Any) -> int:
    """Any office: upcoming auctions whose date passed become completed (also when a site was not read tonight)."""
    if not db:
        return 0
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
    done = (
        db.table("notary_auctions").update({"status": "completed"})
        .in_("status", ["upcoming", "suspended_private_bid"]).lt("auction_date", cutoff).execute().data or []
    )
    return len(done)
