"""
Coldwell Banker Aruba Realty (https://www.coldwellbanker.aw) — site-specific code only.

Terms (read 28 November 2026): no robots.txt (everything allowed), no terms
or privacy page; the footer says "All rights reserved" and nothing about
automated collection. Same position as Bold.

How the site is built (checked 28 November 2026):

  * An Open-Realty site: plain HTML, so the HTTP engine reads it.
  * The listing page never names the property type, so the index is the
    search results per sale type, which tells it:
        index.php?action=searchresults&pclass[]=<n>     1 Homes, 6 Condos, 2 Land, 4 Commercial
    paged with cur_page=0,1,2... (10 results a page). Long Term Rental (10)
    and Commercial Leasing (11) are left out: they are rentals.
  * Each listing page has a fact table, the features, the description, the
    agent and a Google Maps pin in its script: LatLng(lat, lng).
  * "Sq. Ft." / "Sq. Mt." is the plot for homes, land and commercial (the
    results page files it under "hide_lot"), the unit itself for condos.

Selectors used
--------------
Results: .search_result_row a[href*="listing-"]  (title h3, raw price #rawprice<ID>)
         pager a[href*="cur_page="]
Listing page:
  facts      .property_information .row: b (label), .col-xs-8 (value)
             Ref# | Price ($ and Afl.) | Status (Active, Sale in Progress, Sold) |
             Sq. Ft. | Sq. Mt. | Beds | Baths | Location | View
  features   p.property_feature            "Property Land" (= Eigendom), "Private Pool ..."
  text       the block under h2 "Property Description"
  photo      meta[property="og:image"]
  pin        google.maps.LatLng(12.5139, -70.0284) in the page script
  agent      a.listing_agent_name, .listing_contact_popups (data-content phone, mailto), img.listing_agent_image
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urlparse

from .base import BaseSpider
from .doc import Doc
from .parsing import clean, parse_int, parse_number

SITE = "https://www.coldwellbanker.aw"
SALE_CLASSES = {"1": "House", "6": "Condo", "2": "Land", "4": "Commercial"}
STATUS = {"active": "For sale", "sale in progress": "Under contract", "under contract": "Under contract", "pending": "Under contract", "sold": "Sold"}
PIN = re.compile(r"LatLng\(\s*(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})\s*\)")
M2 = re.compile(r"(\d[\d.,]*)\s*(?:m²|m2|sqm|square met)", re.I)
BUILT_IN_TEXT = re.compile(
    r"(\d[\d.,]*)\s*(?:m²|m2|sqm)\s*(?:of\s+)?(?:(?!with\b|on\b|and\b|lot\b|land\b|plot\b|parcel\b)\w+\s+){0,2}?(?:living|built[- ]up|build[- ]?up|built|construction|interior|indoor|enclosed)"
    r"|(?:living|built[- ]up|built|construction|interior|indoor|enclosed)\s*(?:area|space|size)?\s*(?:of|:|is|approximately|approx\.?|±|~|\s)*\s*(\d[\d.,]*)\s*(?:m²|m2|sqm)",
    re.I,
)
LOT_IN_TEXT = re.compile(
    r"(\d[\d.,]*)\s*(?:m²|m2|sqm)\s*(?:of\s+)?(?:\w+\s+){0,3}?(?:lot|land|parcel|plot|grounds)"
    r"|(?:lot|land|parcel|plot)\s*(?:area|size)?\s*(?:of|:|is|approximately|approx\.?|±|~|\s)*\s*(\d[\d.,]*)\s*(?:m²|m2|sqm)",
    re.I,
)
# The site's map default when an agent sets no location (seen on several listings): not a pin.
DEFAULT_PIN = (12.4964, -69.9582)


def fix_text(s: str | None) -> str | None:
    """The site stores some text UTF-8-encoded twice ("â€“", "mÂ²"): undo it when that is what happened."""
    if not s or not re.search(r"â€|Â[\u0080-\u00bf]|Ã[\u0080-\u00bf]", s):
        return s
    try:
        return s.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        try:
            return s.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return s


POOL_SHARED = re.compile(r"\b(?:shared|communal|community|common)\s+(?:swimming\s+)?pools?|\bpools,", re.I)
POOL_PRIVATE = re.compile(r"\b(?:private|own|swimming|plunge|infinity)\s+pool\b", re.I)


def from_text(pattern: re.Pattern[str], text: str) -> float | None:
    for m in pattern.finditer(text):
        n = parse_number(m.group(1) or m.group(2))
        if n and n >= 10:
            return n
    return None


class ColdwellBankerArubaSpider(BaseSpider):
    agency_id = "coldwell-banker-aruba"
    agency_name = "Coldwell Banker Aruba Realty"
    website = SITE
    logo_url = f"{SITE}/template/open_realty_lite_responsive/images/Logo_901142_Aruba_Realty_VER_BLU_RGB_FR.png"
    start_urls = [f"{SITE}/index.php?action=searchresults&pclass[]={c}" for c in SALE_CLASSES]
    min_delay = 4.0

    # ── index: the search results per sale type ──────────────────────────

    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        here = getattr(self, "_current_index", "") or ""
        cls = (parse_qs(urlparse(here).query).get("pclass[]") or [""])[0]
        out: dict[str, dict[str, Any]] = {}
        for row in page.all(".search_result_row"):
            href = row.attr('a[href*="listing-"]', "href")
            if not href:
                continue
            url = self.absolute("/" + href.lstrip("/"))
            lid = re.search(r"-(\d+)\.html", url)
            raw = row.text(f"#rawprice{lid.group(1)}") if lid else None
            out[url] = {"source_url": url, "type": SALE_CLASSES.get(cls), "list_price": raw, "title": row.text("h3")}
        return list(out.values())

    def next_page_url(self, page: Doc) -> str | None:
        here = getattr(self, "_current_index", "") or ""
        q = parse_qs(urlparse(here).query)
        cur = int((q.get("cur_page") or ["0"])[0])
        cls = (q.get("pclass[]") or [""])[0]
        for href in page.attrs('a[href*="cur_page="]', "href"):
            m = re.search(r"cur_page=(\d+)", href)
            if m and int(m.group(1)) == cur + 1:
                return f"{SITE}/index.php?cur_page={cur + 1}&action=searchresults&pclass[]={cls}"
        return None

    async def load(self, url: str):  # remember which index page is open (its type and page number)
        if "action=searchresults" in url:
            self._current_index = url
        return await super().load(url)

    # ── listing page ─────────────────────────────────────────────────────

    def _facts(self, page: Doc) -> dict[str, list[str]]:
        facts: dict[str, list[str]] = {}
        for row in page.all(".property_information .row"):
            label = (row.text("b") or "").rstrip(":").strip().lower()
            value = row.text(".col-xs-8")
            if label and value:
                facts.setdefault(label, []).append(value)
        return facts

    def _description(self, page: Doc) -> str:
        for h2 in page.node.select("h2"):
            if h2.get_text(strip=True).lower() == "property description":
                parts = []
                for sib in h2.next_siblings:
                    if getattr(sib, "name", None) in ("h2", "h3", "script", "form"):
                        break
                    parts.append(sib.get_text(" ") if hasattr(sib, "get_text") else str(sib))
                return re.sub(r"\s+", " ", " ".join(parts)).strip()
        return ""

    def _agent(self, page: Doc) -> dict[str, Any] | None:
        name = page.text("a.listing_agent_name")
        if not name:
            self._miss("agent")
            return None
        content = page.attr(".listing_contact_popups a[data-content]", "data-content") or ""
        phones = re.findall(r"(?:Mobile|Phone):\s*</b>\s*([+\d][\d\s()-]{5,})", content) or re.findall(r"(\+?\d[\d\s()-]{6,})", content)
        mail = page.attr('.listing_contact_popups a[href^="mailto:"]', "href")
        return {
            "name": clean(name.rstrip(" >")),
            "title": None,
            "phone": clean(phones[-1]) if phones else None,  # the mobile when both are given
            "email": mail.removeprefix("mailto:").split("?", 1)[0] if mail else None,
            "photo": page.attr("img.listing_agent_image", "src"),
            "profile_url": self.absolute(page.attr("a.listing_agent_name", "href")),
        }

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        facts = self._facts(page)
        one = lambda k: (facts.get(k) or [None])[0]  # noqa: E731
        status = (one("status") or "").strip().lower()
        if status not in STATUS:
            return {"skip": f"status {status or 'unknown'}"}
        kind = card.get("type")
        if not kind:
            return {"skip": "not in a sale category"}
        is_land, is_condo = kind == "Land", kind == "Condo"
        prices = facts.get("price") or []
        usd = next((p for p in prices if "$" in p), None)
        text = fix_text(self._description(page)) or ""
        features = [fix_text(re.sub(r"\s+", " ", p.node.get_text(" ")).strip()) or "" for p in page.all("p.property_feature")]

        # the fact box size: m² when given, else sq ft
        box_m2 = parse_number(one("sq. mt.")) or ((parse_number(one("sq. ft.")) or 0) / 10.7639 or None)
        built_t, lot_t = from_text(BUILT_IN_TEXT, text), from_text(LOT_IN_TEXT, text)
        if is_land:
            built, lot = None, lot_t or box_m2
        elif is_condo:
            built, lot = built_t or box_m2, None
        else:  # homes and commercial: the box is the plot
            lot = lot_t or box_m2
            built = built_t if built_t and (not lot or abs(built_t - lot) > 1) else None
            if not lot_t and not built and box_m2 and box_m2 < 120 and kind == "House":
                built, lot = box_m2, None  # a townhouse or unit filed under Homes: that size is the home itself
                kind = "Townhouse"         # e.g. a Caribbean Town unit: compared with flats, not villas
        pin = PIN.search(page.html)
        lat, lng = (float(pin.group(1)), float(pin.group(2))) if pin else (None, None)
        if lat is not None and abs(lat - DEFAULT_PIN[0]) < 1e-4 and abs(lng - DEFAULT_PIN[1]) < 1e-4:
            lat, lng = None, None  # the map's default, not the property
        title = fix_text(self.text(page, ".listing_details h1, h1", key="title") or card.get("title"))
        location = one("location")
        pool = ""
        joined = f"{' '.join(features)} {text}"
        if not is_land:
            if POOL_SHARED.search(joined) or (is_condo and re.search(r"\bpools?\b", joined, re.I)):
                pool = "Shared pool"
            elif POOL_PRIVATE.search(joined):
                pool = "Private pool"
        photo = page.attr('meta[property="og:image"]', "content")
        if not photo:
            self._miss("photo")
        tenure_bits = " ".join(features)
        return {
            "source_url": card["source_url"],
            "source_listing_id": one("ref#") or re.search(r"-(\d+)\.html", card["source_url"]).group(1),
            "raw_title": title,
            "raw_address": title,
            # "Gated Community" is not a place: leave it to the pin and the description
            "raw_district": None if (location or "").lower() in ("gated community", "") else location,
            "price_text": usd or card.get("list_price"),
            "raw_currency": "USD",
            "raw_beds": None if is_land else parse_int(one("beds")),
            "raw_baths": None if is_land else parse_number(one("baths")),
            "raw_property_type": kind,
            "raw_status": STATUS[status],
            "raw_built_area": f"{built:.0f} m²" if built else None,
            "raw_lot_area": f"{lot:.0f} m²" if lot else None,
            "raw_tenure": tenure_bits or None,  # "Property Land" reads as Eigendom
            # the features go along: the normaliser reads the land title ("Property Land") from the text
            "raw_description": (f"{text}\n\nFeatures: {'; '.join(features)}" if features else text) or None,
            "raw_agent": self._agent(page),
            "raw_photos": [photo] if photo else [],
            "raw_lat": lat,
            "raw_lng": lng,
            # the normaliser reads the pool from "features" (as on the other sites)
            "extra": {"facts": facts, "feature_list": features, "features": {"pool": "Yes", "pool type": pool} if pool else {},
                      "type": kind, "location": location},
        }

    def is_closed(self, card: dict[str, Any]) -> bool:
        return False
