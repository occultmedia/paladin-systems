"""
Weichert Aruba Realty (https://www.weichertaruba.com) — site-specific code only.

Terms (checked 26 November 2026): the "Terms and Conditions" page is still
the theme's placeholder text (lorem ipsum, last changed 2016); there are no
terms. robots.txt allows everything except a WP Defender trap path.

How the site is built (checked 26 November 2026):

  * WordPress with the Houzez property theme. Its public REST API lists every
    property with its facts in one request, so that is the index:
        /wp-json/wp/v2/properties?per_page=100
    Statuses, types, areas and cities are numbers there; their names come
    from /wp-json/wp/v2/property_status (and _type, _area, _city, _label),
    and agents from /wp-json/wp/v2/agents. Those six are read once per run.
  * The listing page itself is opened only for the main photo (og:image),
    and to confirm it is still online. Newer listings have no og:image:
    their photos are only ids in fave_property_images, so the first photo
    of every listing is looked up in one /wp-json/wp/v2/media?include=...
    request per run.
  * Prices: "Awg 4,356,051.60" (florins, often with "USD $2,447,200.00" as
    the second price), "$2,000,000", or a bare "295000", which the page
    shows as "$295,000" (US dollars).
  * Sizes: "183 Sq M", "252.1 m2", "131" (no unit: m²), land "26.463 m²"
    (a dot for thousands), "200" (m²), or "796 Sq Ft".
  * Some map pins are the theme's default in Miami (25.69, -80.43): pins
    outside Aruba are dropped.

Fields used (property_meta)
---------------------------
fave_property_price, fave_property_sec_price, fave_property_size (+ _prefix),
fave_property_land (+ _postfix), fave_property_bedrooms, fave_property_bathrooms
("4 1/2"), fave_property_year, fave_property_address, houzez_geolocation_lat/_long,
fave_agents (agent id). Description: content.rendered.
"""

from __future__ import annotations

import html
import json
import re
from typing import Any

from .base import BaseSpider
from .doc import Doc
from .normalise import DISTRICT_CENTERS
from .parsing import clean, parse_int, parse_number

API = "https://www.weichertaruba.com/wp-json/wp/v2"
TAXONOMIES = ("property_status", "property_type", "property_area", "property_city", "property_label")
# Aruba's bounding box, a little generous
LAT, LNG = (12.38, 12.68), (-70.10, -69.83)

FOR_SALE = {"for sale", "new listing", "new costruction", "new construction", "reduced price", "resale", "open house", "foreclosures"}


def meta(item: dict[str, Any], key: str) -> str:
    value = (item.get("property_meta") or {}).get(key) or [""]
    return str(value[0] if isinstance(value, list) else value).strip()


def size_m2(value: str, unit: str = "") -> str | None:
    """A size as "<n> m²" or "<n> sq ft"; a bare number is m² (how this site types it)."""
    text = f"{value} {unit}".strip()
    n = parse_number(text)
    if not n or n < 2:
        return None
    if re.search(r"sq\.?\s*ft|ft²|square f", text, re.I):
        return f"{n:.0f} sq ft"
    return f"{n:g} m²"


def baths_of(text: str) -> float | None:
    """'4 1/2' -> 4.5, '3' -> 3, '' -> None."""
    m = re.match(r"\s*(\d+(?:[.,]\d+)?)(?:\s+(\d)/(\d))?", text or "")
    if not m:
        return None
    n = float(m.group(1).replace(",", "."))
    if m.group(2):
        n += int(m.group(2)) / int(m.group(3))
    return n or None


def price_of(item: dict[str, Any]) -> tuple[float | None, str | None, str | None]:
    """(price, currency, the text it came from). Prefers the USD price when both are given."""
    main, second = meta(item, "fave_property_price"), meta(item, "fave_property_sec_price")
    for text in (second, main):
        if text and re.search(r"usd|\$", text, re.I) and parse_number(text):
            return parse_number(text), "USD", text
    if main and re.search(r"\bawg\b|afl|ƒ", main, re.I) and parse_number(main):
        return parse_number(main), "AWG", main
    if main and parse_number(main):
        return parse_number(main), "USD", main  # a bare number: the page shows it with "$"
    return None, None, main or None


class WeichertArubaSpider(BaseSpider):
    agency_id = "weichert-aruba"
    agency_name = "Weichert Aruba Realty"
    website = "https://www.weichertaruba.com"
    logo_url = "https://www.weichertaruba.com/wp-content/uploads/2026/02/Weichert-favicon.png"
    start_urls = [f"{API}/properties?per_page=100&page=1"]
    min_delay = 4.0

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.names: dict[str, dict[int, str]] = {}
        self.agents: dict[int, dict[str, Any]] = {}
        self.items: dict[str, dict[str, Any]] = {}  # the API item per listing URL (kept out of the card: it has view counters)
        self.media: dict[int, str] = {}  # photo id -> URL
        self._index_page = 1
        self._index_size = 0

    @staticmethod
    def _json(page: Doc) -> Any:
        return json.loads(page.html)

    async def prepare(self) -> None:
        for tax in TAXONOMIES:
            page = await self.load(f"{API}/{tax}?per_page=100&_fields=id,name")
            self.names[tax] = {t["id"]: t["name"] for t in self._json(page)} if page else {}
            if not page:
                self._miss(f"{tax} names")
        page = await self.load(f"{API}/agents?per_page=100")
        for a in self._json(page) if page else []:
            m = a.get("agent_meta") or {}
            first = lambda k: clean((m.get(k) or [""])[0]) or None  # noqa: E731
            email = first("fave_agent_email")
            self.agents[a["id"]] = {
                "name": clean(re.sub(r"<[^>]+>", "", a["title"]["rendered"])),
                "title": first("fave_agent_position"),
                "phone": first("fave_agent_mobile") or first("fave_agent_office_num"),
                "email": email if email and "@" in email else None,
                "photo": None,
                "profile_url": a.get("link"),
            }

    # ── index (the REST API) ─────────────────────────────────────────────

    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        items = self._json(page)
        self._index_size = len(items)
        out = []
        for it in items:
            if it.get("status") != "publish":
                continue
            facts = {k: v for k, v in (it.get("property_meta") or {}).items() if k.startswith("fave_property_") and k != "fave_property_images"}
            self.items[it["link"]] = it
            out.append({
                "source_url": it["link"],
                # what tells whether the listing changed (not the view counters)
                "facts": facts,
                "terms": {t: it.get(t) for t in TAXONOMIES},
                "title": it["title"]["rendered"],
                "modified": it.get("modified"),
            })
        return out

    def next_page_url(self, page: Doc) -> str | None:
        """A full page (100) means there may be more."""
        if self._index_size < 100:
            return None
        self._index_page += 1
        return f"{API}/properties?per_page=100&page={self._index_page}"

    def is_closed(self, card: dict[str, Any]) -> bool:
        return "Sold" in self._names("property_label", {"property_label": card["terms"].get("property_label")})

    def _names(self, tax: str, item: dict[str, Any]) -> list[str]:
        return [self.names.get(tax, {}).get(i, "") for i in item.get(tax) or []]

    # ── listing ──────────────────────────────────────────────────────────

    @staticmethod
    def _first_photo_id(it: dict[str, Any]) -> int | None:
        ids = [*((it.get("property_meta") or {}).get("fave_property_images") or []), it.get("featured_media")]
        return next((int(i) for i in ids if str(i).isdigit() and int(i) > 0), None)

    async def load(self, url: str) -> Doc | None:
        # Before the first listing page: one request for the first photo of every listing.
        if self.items and not self.media and "/property/" in url:
            self.media[0] = ""  # only once
            ids = sorted({i for it in self.items.values() for i in (self._first_photo_id(it), it.get("featured_media")) if i})
            for n in range(0, len(ids), 100):
                chunk = ",".join(map(str, ids[n : n + 100]))
                page = await super().load(f"{API}/media?include={chunk}&per_page=100&_fields=id,source_url,media_details")
                for m in self._json(page) if page else []:
                    sizes = (m.get("media_details") or {}).get("sizes") or {}
                    self.media[m["id"]] = (sizes.get("medium_large") or sizes.get("large") or sizes.get("full") or {}).get("source_url") or m.get("source_url") or ""  # 768 px wide
        return await super().load(url)

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        it = self.items[card["source_url"]]
        statuses = [s.lower() for s in self._names("property_status", it)]
        labels = self._names("property_label", it)
        types = [t for t in self._names("property_type", it) if t]
        if any("rent" in s for s in statuses):
            return {"skip": f"status {', '.join(statuses)}"}
        status = (
            "Sold" if "Sold" in labels
            else "Under contract" if "under contract" in statuses
            else "For sale" if not statuses or any(s in FOR_SALE for s in statuses)  # pre-construction has no status
            else None
        )
        if status is None:
            return {"skip": f"status {', '.join(statuses)}"}

        title = clean(html.unescape(re.sub(r"<[^>]+>", "", it["title"]["rendered"])))
        body = (it.get("content") or {}).get("rendered") or ""
        text = Doc.parse(f"<div id='d'>{body}</div>").block_text("#d") or "" if body else ""
        # "Fixer Upper" is a condition, not a kind of home
        kind = next((t for t in types if t.lower() not in {"fixer upper", "residential"}), "Residential" if types else None)
        is_land = (kind or "").lower() == "land"

        price, currency, price_text = price_of(it)
        try:
            lat, lng = float(meta(it, "houzez_geolocation_lat")), float(meta(it, "houzez_geolocation_long"))
        except ValueError:
            lat = lng = None
        if not (lat and lng and LAT[0] <= lat <= LAT[1] and LNG[0] <= lng <= LNG[1]):
            lat = lng = None  # missing, or the theme's default pin in Miami

        city, area = self._names("property_city", it), self._names("property_area", it)
        address = clean(html.unescape(meta(it, "fave_property_address"))) or None
        places = [p for p in [*area, *city] if p]
        # The city is coarse ("Noord"); a title that says "in Eagle Beach" is more precise.
        said = next((d for d in DISTRICT_CENTERS if d not in places and re.search(rf"\b{re.escape(d)}\b", title, re.I)), None)
        if said:
            places.insert(0, said)
        agent_ids = (it.get("property_meta") or {}).get("fave_agents") or []
        agent = next((self.agents[int(a)] for a in agent_ids if str(a).isdigit() and int(a) in self.agents), None)
        if not agent:
            self._miss("agent")

        photo = page.attr('meta[property="og:image"]', "content")
        resized = self.media.get(it.get("featured_media") or 0) or self.media.get(self._first_photo_id(it) or 0) or None
        if not photo or photo.endswith("Weichert-favicon.png"):
            photo = resized
        elif not re.search(r"-\d+x\d+(-\d+)?\.\w+$", photo) and resized:
            # an original upload (one was 6.8 MB): WordPress's own 768 px copy instead.
            # (The site's Cloudflare refuses Vercel's image resizer, so this is the only resizing.)
            photo = resized
        if not photo:
            self._miss("photo")
        return {
            "source_url": card["source_url"],
            "source_listing_id": meta(it, "fave_property_id") or str(it["id"]),
            "raw_title": title,
            "raw_address": address or title.split("|")[0].strip(),
            "raw_district": ", ".join(places) or address,
            "raw_price": price,
            "raw_currency": currency,
            "price_text": price_text,
            "raw_beds": None if is_land else parse_int(meta(it, "fave_property_bedrooms")),
            "raw_baths": None if is_land else baths_of(meta(it, "fave_property_bathrooms")),
            "raw_property_type": kind,
            "raw_status": status,
            "raw_built_area": None if is_land else size_m2(meta(it, "fave_property_size"), meta(it, "fave_property_size_prefix")),
            # a flat's "land" is the building's plot, not the flat's
            "raw_lot_area": None if re.search(r"condo|apartment", kind or "", re.I) else size_m2(meta(it, "fave_property_land"), meta(it, "fave_property_land_postfix")),
            "raw_description": text or None,
            "raw_agent": agent,
            "raw_photos": [photo] if photo else [],
            "raw_lat": lat,
            "raw_lng": lng,
            "extra": {
                "labels": [*self._names("property_status", it), *labels],
                "types": types,
                "year_built": meta(it, "fave_property_year") or None,
                "address": address,
                "index_pages": card.get("index_pages", []),
            },
        }
