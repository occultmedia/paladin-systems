"""
MPG Real Estate Aruba (https://mpgaruba.com) — site-specific code only.

Terms (read 28 November 2026): robots.txt allows everything except URLs with
a query string, the CMS folders and the login pages. The terms (section 06)
forbid copying, scraping or harvesting the listings and (section 07)
republishing descriptions, photos or logos without prior written permission;
the user confirmed on 28 November 2026 that they have that permission.

How the site is built (checked 28 November 2026):

  * An OctoberCMS site: plain HTML, so the HTTP engine reads it.
  * The category pages show only a few listings and page with ?page=, which
    robots.txt disallows, so the index is the sitemap it points to:
        https://www.mpgaruba.com/sitemap.xml    every /property/<kind>-<id>-<slug> page
    Its <lastmod> is the time the sitemap was generated (the same for every
    page), so it is not kept on the card.
  * The sitemap mixes sales and rentals, live and sold: the listing page's
    fact box says which (Contract "for sale" / "for rent"; Price "Sold" /
    "Rented" once it is gone, with no price left).
  * Each listing page has a fact box, the description (Overview), the
    amenities, a Google Maps pin (iframe ?q=lat,lng) and the agent.

Selectors used
--------------
Listing page:
  title      .bdc-head h1            address  .bdc-head .brd-hdng  ("Opal 125, Rooi Santo")
  facts      .prt-info-card .prt-item: h4 (label), p (value)
             Type (Residential, Condominium, Commercial, Property Land, Lease Land) |
             Contract | Price ("$ 1,950,000 / AWG 3,471,000" or "Sold") | Beds | Baths |
             Lot size | Build up area ("872 m2 | 9,386 ft2") | Land type (Property land, Long lease) | Pool
  ribbon     .prt-gallery .ribbon     ("New Listing", "Sold", "Rented")
  text       #overview p
  amenities  #amenities .amenities-box span
  photo      .prt-gallery .big-card a[href]   (the main photo; there is no og:image)
  pin        .property-details-map iframe[src]  ?q=12.5876,-70.0411
  agent      .lct-ahr-info h3 (name), p (title), img in .lct-ahr-media, mailto:, tel:
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from .base import BaseSpider
from .doc import Doc
from .parsing import clean, parse_int, parse_number

SITE = "https://mpgaruba.com"
SITEMAP = "https://www.mpgaruba.com/sitemap.xml"
TYPES = {
    "residential": "House",
    "condominium": "Condo",
    "commercial": "Commercial",
    "property land": "Land",
    "lease land": "Land",
}
# ribbons that mean the sale is agreed but not closed
UNDER_CONTRACT = re.compile(r"under (?:contract|offer)|sale (?:pending|in progress)|pending|reserved|on hold", re.I)
M2 = re.compile(r"(\d[\d.,]*)\s*m\s*2", re.I)
PIN = re.compile(r"(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})")
LISTING = re.compile(r"/property/[a-z-]+-(\d+)(?:-|$)")
POOL_SHARED = re.compile(r"\b(?:shared|communal|community|common)\s+(?:swimming\s+)?pools?", re.I)


def canonical(url: str) -> str:
    """The site serves every page on both hosts; keep one (no www, as its own links)."""
    return url.strip().replace("://www.mpgaruba.com", "://mpgaruba.com").rstrip("/")


def m2_of(value: str | None) -> float | None:
    m = M2.search(value or "")
    return parse_number(m.group(1)) if m else None


class MpgArubaSpider(BaseSpider):
    agency_id = "mpg-aruba"
    agency_name = "MPG Real Estate Aruba"
    website = SITE
    logo_url = f"{SITE}/themes/mpg/assets/images/logo.webp"
    start_urls = [SITEMAP]
    min_delay = 4.0

    # ── index: the sitemap ───────────────────────────────────────────────

    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for loc in re.findall(r"<loc>([^<]+)</loc>", page.html):
            url = canonical(loc)
            m = LISTING.search(url)
            if m:
                out[url] = {"source_url": url, "listing_id": m.group(1)}
        return list(out.values())

    def next_page_url(self, page: Doc) -> str | None:
        return None  # one sitemap file

    # ── listing page ─────────────────────────────────────────────────────

    def _facts(self, page: Doc) -> dict[str, str]:
        facts: dict[str, str] = {}
        for item in page.all(".prt-info-card .prt-item"):
            label = (item.text("h4") or "").strip().lower()
            value = clean(item.text("p"))
            if label and value and value != "-":
                facts[label] = value
        return facts

    def _agent(self, page: Doc) -> dict[str, Any] | None:
        name = page.text(".lct-ahr-info h3")
        if not name:
            self._miss("agent")
            return None
        mail = page.attr('.lct-cnt a[href^="mailto:"]', "href")
        phone = page.attr('.lct-cnt a[href^="tel:"]', "href")
        img = page.first(".lct-ahr-media img")
        return {
            "name": clean(name),
            "title": clean(page.text(".lct-ahr-info p")),
            "phone": clean(phone.removeprefix("tel:")) if phone else None,
            "email": mail.removeprefix("mailto:").split("?", 1)[0] if mail else None,
            "photo": (img.own_attr("data-src") or img.own_attr("src")) if img else None,
            "profile_url": None,
        }

    def _pin(self, page: Doc) -> tuple[float | None, float | None]:
        src = page.attr(".property-details-map iframe", "src") or page.attr('.bdc-head a[href*="google.com/maps"]', "href") or ""
        q = parse_qs(urlparse(src).query)
        m = PIN.search(unquote((q.get("q") or q.get("query") or [""])[0]))
        if not m:
            return None, None
        lat, lng = float(m.group(1)), float(m.group(2))
        # Aruba only (a blank pin is 0,0 or the map's default elsewhere)
        return (lat, lng) if 12.3 < lat < 12.7 and -70.1 < lng < -69.8 else (None, None)

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        facts = self._facts(page)
        contract = (facts.get("contract") or "").lower()
        if contract != "for sale":
            return {"skip": f"contract {contract or 'unknown'}"}
        price = facts.get("price") or ""
        ribbons = " ".join(page.texts(".prt-gallery .ribbon"))
        if not re.search(r"\$\s*\d", price):
            # a sold listing keeps its page but loses its price: nothing to compare
            return {"skip": f"no price ({price or 'none'})"}
        raw_type = (facts.get("type") or "").lower()
        kind = TYPES.get(raw_type)
        if not kind:
            return {"skip": f"type {raw_type or 'unknown'}"}
        is_land, is_condo = kind == "Land", kind == "Condo"
        usd = price.split("/", 1)[0].strip()

        title = clean(self.text(page, ".bdc-head h1", key="title"))
        address = clean((page.text(".bdc-head .brd-hdng") or "").strip(" ,"))  # ", Eagle Beach" when no street is given
        district = address.rsplit(",", 1)[-1].strip() if address and "," in address else None
        text = re.sub(r"\s+", " ", " ".join(page.texts("#overview p"))).strip()
        amenities = [a for a in page.texts("#amenities .amenities-box span") if a]

        lot, built = m2_of(facts.get("lot size")), m2_of(facts.get("build up area"))
        if is_land:
            built = None
        elif is_condo:
            lot = None
        if kind == "House" and title and re.search(r"town ?house", title, re.I):
            kind = "Townhouse"  # compared with flats, not villas

        # tenure: the "Land type" fact, or the type itself for lease land
        land_type = facts.get("land type") or ("Long lease" if raw_type == "lease land" else "Property land" if raw_type == "property land" else None)

        pool = ""
        if not is_land and (facts.get("pool") or "").lower() == "available":
            pool = "Shared pool" if is_condo or POOL_SHARED.search(text) else "Private pool"

        lat, lng = self._pin(page)
        if lat is None:
            self._miss("pin")
        photo = page.attr(".prt-gallery .big-card a", "href")
        photo = canonical(self.absolute(photo)) if photo else None
        if not photo:
            self._miss("photo")
        status = "Under contract" if UNDER_CONTRACT.search(ribbons) else "For sale"
        tail = [f"Land type: {land_type}"] if land_type else []
        if amenities:
            tail.append(f"Amenities: {'; '.join(amenities)}")
        return {
            "source_url": card["source_url"],
            "source_listing_id": card.get("listing_id") or page.attr('input[name="property_id"]', "value"),
            "raw_title": title,
            "raw_address": address or title,
            "raw_district": district,
            "price_text": usd,
            "raw_currency": "USD",
            # a studio has no separate bedroom: the site leaves Beds empty, as "-"
            "raw_beds": None if is_land else parse_int(facts.get("beds")) if facts.get("beds") else (0 if title and re.search(r"\bstudio\b", title, re.I) else None),
            "raw_baths": None if is_land else parse_number(facts.get("baths")),
            "raw_property_type": kind,
            "raw_status": status,
            "raw_built_area": f"{built:.0f} m²" if built else None,
            "raw_lot_area": f"{lot:.0f} m²" if lot else None,
            "raw_tenure": land_type,
            # the normaliser reads the land title from the text, so it goes along
            "raw_description": "\n\n".join([text, *tail]).strip() or None,
            "raw_agent": self._agent(page),
            "raw_photos": [photo] if photo else [],
            "raw_lat": lat,
            "raw_lng": lng,
            "extra": {"facts": facts, "amenities": amenities, "ribbons": ribbons or None,
                      "features": {"pool": "Yes", "pool type": pool} if pool else {}, "type": facts.get("type")},
        }

    def is_closed(self, card: dict[str, Any]) -> bool:
        return False  # the sitemap does not say; sold pages are re-read with the rest
