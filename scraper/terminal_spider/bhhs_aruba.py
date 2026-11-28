"""
Berkshire Hathaway HomeServices Aruba Realty (https://www.bhhsaruba.com) — site-specific code only.

Terms (read 28 November 2026): robots.txt allows everything ("Allow: /").
The terms of use have no clause on robots, scraping or automated collection;
section 3 says visitors may not "distribute or create derivative works based
on the Site" without the company's authorisation, the same copyright-style
clause as KW and Bold. Flagged to the user; permission not confirmed.

How the site is built (checked 28 November 2026):

  * An OctoberCMS site (like MPG): plain HTML, so the HTTP engine reads it.
  * /for-sale lists every sale on one page (248 cards on 28 Nov 2026), sold
    and rented ones included, with no paging. The four category pages
    (/residential-, /condominium-, /commercial-, /land-for-sale) are subsets
    of it; they are read too, so a listing missing from /for-sale is still found.
  * Each card has a badge (New listing, Price Reduced, Hot deal, Must see!,
    Motivated Seller, Available Soon, Price upon request, Sale in Progress,
    Under contract, On Hold, Sold, Rented), the type, sizes, rooms and price.
  * Prices "on request" are printed as "USD 0".
  * Sizes use a dot for thousands: "Lot size: 1.332 M2" is 1,332 m².
  * The listing page has the same badge, the price in the h1, a Features list
    (Property ID, sizes, rooms, half bathrooms, beach distance...), the
    description, the agents and a Google Maps pin in its script:
        var mapS = { latLng: { lat: 12.538, lng: -70.032 } ... }
  * The district is in og:title: "Bon Bini Suites - Residential For Sale in Eagle Beach".

Selectors used
--------------
Index card:  .preview-property
  badge      .preview-property__tag          price  .preview-property__price
  link/name  a.preview-property__info        facts  .preview-property__details-item  ("Property type: Land", "Lot size: 1.726 M2")
Listing page:
  badge      .page-property .label, else the first .label
  title      .property-description h1        ("Cuquisastraat 22-A - USD 395,000")
  facts      li.amenities-items__item       ("Property ID: #721", "Bathrooms: 2", "Half bathrooms: 1", "Beach distance: Walking Distance")
  text       .property-description__content .content
  photo      meta[property="og:image"]       (the main photo, full size)
  district   meta[property="og:title"]       "... For Sale in <district>"
  pin        lat: 12.53, lng: -70.03 in the mapS script
  agents     .team-members: a.card-team-member__name, a[href^="tel:"], a[href^="mailto:"]
"""

from __future__ import annotations

import re
from typing import Any

from .base import BaseSpider
from .doc import Doc
from .parsing import clean, parse_int

SITE = "https://www.bhhsaruba.com"
TYPES = {"residential": "House", "condominiums": "Condo", "condominium": "Condo", "commercial": "Commercial", "land": "Land"}
# badge -> Baseline status; a badge not named here (New listing, Hot deal, ...) is a live sale
STATUS = {
    "sold": "Sold",
    "under contract": "Under contract",
    "sale in progress": "Under contract",
    "on hold": "Under contract",
}
SKIP_BADGES = {"rented"}
PIN = re.compile(r"latLng\s*:\s*\{\s*lat\s*:\s*(-?\d{1,2}\.\d{3,})\s*,\s*lng\s*:\s*(-?\d{1,3}\.\d{3,})")
USD = re.compile(r"USD\s*([\d.,]+)", re.I)
DISTRICT = re.compile(r"For Sale in\s+(.+?)\s*$", re.I)
POOL_SHARED = re.compile(r"\b(?:shared|communal|community|common)\s+(?:swimming\s+)?pools?|\bpools,", re.I)
POOL_PRIVATE = re.compile(r"\b(?:private|own|swimming|plunge|infinity)\s+pool\b", re.I)


def eu_int(text: str | None) -> int | None:
    """
    A whole number written the European way, dots for thousands:
    "1.332 M2" -> 1332, "17.400 m2" -> 17400, "209 M2" -> 209, "-16" -> None.
    BHHS never gives decimals in these fields, so every dot and comma is a separator.
    """
    m = re.search(r"(?<![\d-])(\d{1,3}(?:[.,]\d{3})+|\d+)(?![\d])", text or "")
    if not m:
        return None
    n = int(re.sub(r"[.,]", "", m.group(1)))
    return n or None


def usd_amount(text: str | None) -> int | None:
    """'USD 6,500,000' -> 6500000; 'USD 0' (price upon request) -> None."""
    m = USD.search(text or "")
    if not m:
        return None
    n = int(re.sub(r"[.,]", "", m.group(1)) or 0)
    return n if n > 0 else None


class BhhsArubaSpider(BaseSpider):
    agency_id = "bhhs-aruba"
    agency_name = "Berkshire Hathaway HomeServices Aruba"
    website = SITE
    logo_url = f"{SITE}/themes/aruba/assets/images/logo-purple.svg"
    start_urls = [
        f"{SITE}/for-sale",
        f"{SITE}/residential-for-sale",
        f"{SITE}/condominium-for-sale",
        f"{SITE}/commercial-for-sale",
        f"{SITE}/land-for-sale",
    ]
    min_delay = 4.0

    # ── index ─────────────────────────────────────────────────────────────

    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for card in page.all(".preview-property"):
            url = self.absolute(card.attr("a.preview-property__info", "href"))
            if not url or "/listings/" not in url:
                continue
            details = {}
            for item in card.texts(".preview-property__details-item"):
                if ":" in item:
                    k, v = item.split(":", 1)
                    details[k.strip().lower()] = v.strip()
            out[url.split("?", 1)[0].rstrip("/")] = {
                "source_url": url.split("?", 1)[0].rstrip("/"),
                "label": clean(card.text(".preview-property__tag")),  # the badge; "Sold" -> is_closed
                "title": clean(card.text(".preview-property__name")),
                "list_price": clean(card.text(".preview-property__price")),
                "type": details.get("property type"),
                "lot": details.get("lot size"),
                "built": details.get("built up size"),
                "beds": details.get("bedrooms"),
                "baths": details.get("bathrooms"),
            }
        return list(out.values())

    def next_page_url(self, page: Doc) -> str | None:
        return None  # one page per index

    # ── listing page ─────────────────────────────────────────────────────

    def _facts(self, page: Doc) -> dict[str, str]:
        facts: dict[str, str] = {}
        for item in page.texts("li.amenities-items__item"):
            if ":" in item:
                k, v = item.split(":", 1)
                facts[k.strip().lower()] = v.strip()
            else:
                facts.setdefault("extras", "")
                facts["extras"] = f"{facts['extras']}; {item}".strip("; ")  # "Furnished"
        return facts

    def _agent(self, page: Doc) -> dict[str, Any] | None:
        # The first named person; the office's "TEAM ..." entry only when there is no one else.
        cards = [c for c in page.all(".team-members__item, .card-team-member, .team-members li") if c.text("a.card-team-member__name")]
        if not cards:
            name = page.text("a.card-team-member__name")
            if not name:
                self._miss("agent")
                return None
            cards = [page]
        people = [c for c in cards if not (c.text("a.card-team-member__name") or "").upper().startswith("TEAM ")] or cards
        c = people[0]
        name = (c.text("a.card-team-member__name") or "").split(" - ", 1)[0]  # "Darienne Arends - Purple Elite Group"
        phones = [p.removeprefix("tel:") for p in c.attrs('a[href^="tel:"]', "href")]
        mail = c.attr('a[href^="mailto:"]', "href")
        img = c.attr("img", "data-src") or c.attr("img", "src")
        return {
            "name": clean(name),
            "title": clean(c.text(".team-members__job")),
            "phone": clean(phones[-1]) if phones else None,  # the mobile when both are given
            "email": mail.removeprefix("mailto:").split("?", 1)[0] if mail else None,
            "photo": self.absolute(img) if img else None,
            "profile_url": self.absolute(c.attr("a.card-team-member__name", "href")),
        }

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        badge = clean(page.text(".page-property .label") or page.text(".label") or card.get("label")) or ""
        b = badge.lower()
        if b in SKIP_BADGES:
            return {"skip": f"badge {badge}"}
        facts = self._facts(page)
        raw_type = (card.get("type") or "").strip().lower()
        og_title = page.attr('meta[property="og:title"]', "content") or ""
        if not raw_type:
            m = re.search(r" - (\w+) For Sale in ", og_title)
            raw_type = (m.group(1) if m else "").lower()
        kind = TYPES.get(raw_type)
        if not kind:
            return {"skip": f"type {raw_type or 'unknown'}"}
        is_land, is_condo = kind == "Land", kind == "Condo"

        h1 = clean(page.text(".property-description h1")) or ""
        title = clean(re.sub(r"\s*-\s*USD\s*[\d.,]+\s*$", "", h1)) or card.get("title")
        price = usd_amount(h1) or usd_amount(card.get("list_price"))
        on_request = price is None  # "USD 0": price upon request
        text = page.block_text(".property-description__content .content") or ""

        lot = eu_int(facts.get("lot size") or card.get("lot"))
        built = eu_int(facts.get("built up size") or card.get("built"))
        if is_land:
            built = None
        elif is_condo:
            lot = None
        beds = None if is_land else parse_int(facts.get("bedrooms") or card.get("beds"))
        baths = None if is_land else parse_int(facts.get("bathrooms") or card.get("baths"))
        halves = parse_int(facts.get("half bathrooms"))
        if baths is not None and halves:
            baths = baths + 0.5 * halves  # 2 bathrooms + 1 half bathroom = 2.5
        if kind == "House" and title and re.search(r"town ?house|duplex", title, re.I):
            kind = "Townhouse"

        district = DISTRICT.search(og_title)
        pin = PIN.search(page.html)
        lat, lng = (float(pin.group(1)), float(pin.group(2))) if pin else (None, None)
        if lat is not None and not (12.3 < lat < 12.7 and -70.1 < lng < -69.8):
            lat, lng = None, None
        if lat is None:
            self._miss("pin")
        photo = page.attr('meta[property="og:image"]', "content")
        if not photo:
            self._miss("photo")

        pool = ""
        if not is_land:
            if POOL_SHARED.search(text) or (is_condo and re.search(r"\bpools?\b", text, re.I)):
                pool = "Shared pool"
            elif POOL_PRIVATE.search(text):
                pool = "Private pool"
        pid = re.search(r"#\s*(\d+)", facts.get("property id") or "")
        return {
            "source_url": card["source_url"],
            # "Property ID: #721", else the slug of the listing URL
            "source_listing_id": pid.group(1) if pid else card["source_url"].rsplit("/", 1)[-1],
            "raw_title": title,
            "raw_address": title,
            "raw_district": district.group(1) if district else None,
            "raw_price": price,
            "price_text": "Price upon request" if on_request else f"USD {price:,}",
            "raw_currency": "USD",
            "raw_beds": beds,
            "raw_baths": baths,
            "raw_property_type": kind,
            "raw_status": STATUS.get(b, "For sale"),
            "raw_built_area": f"{built} m²" if built else None,
            "raw_lot_area": f"{lot} m²" if lot else None,
            "raw_tenure": None,  # read from the text ("eigendom", "long lease") by the normaliser
            "raw_description": text or None,
            "raw_agent": self._agent(page),
            "raw_photos": [photo] if photo else [],
            "raw_lat": lat,
            "raw_lng": lng,
            "extra": {
                "badge": badge or None,
                "price_reduced_badge": b == "price reduced",
                "price_on_request": on_request,
                "beach_distance": facts.get("beach distance"),
                "facts": facts,
                "features": {"pool": "Yes", "pool type": pool} if pool else {},
                "type": card.get("type"),
            },
        }
