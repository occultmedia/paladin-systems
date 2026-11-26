"""
Bold Real Estate Aruba (https://bold.realestate) — site-specific code only.

Terms (read 25 November 2026): nothing about automated collection; content
"may not be used, copied, modified or distributed without prior written
consent". Same position as KW Aruba.

How the site is built (checked 25 November 2026):

  * A Luxury Presence site: every property page is plain HTML, so the HTTP
    engine reads it. robots.txt has no Crawl-delay but disallows /api/ and
    /home-search/listings?, which is what the "load more" button calls. So
    the index is the property sitemap instead, which robots.txt points to:
        /sitemap-properties-dpages--0.xml   every property page + lastmod
    plus /properties/sale (the 20 newest), in case the sitemap lags.
  * The sitemap mixes Aruba, Curaçao and Bonaire, sales, rentals and sold
    listings. Each page says which ("Status", "Neighborhood"), so pages are
    opened and only Aruba sales are kept: For Sale, Under Contract and Sold.
    The others are stored as "Skipped" (no text, no photo) so they are not
    opened again until their lastmod changes.
  * No map pins on the pages ("There is no property location added").
  * Sizes are labelled sq ft, but some boxes hold m² or acres, and many
    homes have no living area box: the description is checked for both.

Selectors used
--------------
Sitemap: <url><loc>…/properties/<slug></loc><lastmod>YYYY-MM-DD</lastmod></url>
/properties/sale: a[href^="/properties/"]

Listing page:
  status     .property-intro-2 span.label                  "For Sale" | "Under Contract" | "Sold" | "For Rent"
  title      .property-intro-2 h1
  address    .property-intro-2 p.feature                   "Boroncana 309, Aruba"
  price      .property-intro-2 h5                          "$1,414,000"
  facts      .features-amenities-list li: strong (label), span.feature (value)
             total bedrooms | Total bathrooms | full bathrooms | half bathrooms | Status | Living Area |
             Lot Area | Type (Residential, Condo, Land, Commercial) | Neighborhood (Aruba, Curaçao, Bonaire) |
             Sales Price | Lease Price
  text       .property-description__main
  photo      meta[property="og:image"]
  agent      first .property-agent-cta-item: h3.name, li.row-item (title, PHONE, EMAIL)
"""

from __future__ import annotations

import re
from typing import Any

from .base import BaseSpider
from .doc import Doc
from .parsing import clean, parse_int, parse_number

SITEMAP = "https://bold.realestate/sitemap-properties-dpages--0.xml"
KEEP = {"for sale": "For sale", "under contract": "Under contract", "pending": "Under contract", "sold": "Sold"}
NON_LISTINGS = {"sale", "sold", "rent", "lease"}  # /properties/sale is an index, not a property


M2_IN_TEXT = re.compile(r"(\d[\d.,]*)\s*(?:m²|m2|sqm|square met)", re.I)
# "236 m² of living space", "built-up area of 236 m2", "living area: 236m2"
BUILT_IN_TEXT = re.compile(
    r"(\d[\d.,]*)\s*(?:m²|m2|sqm)\s*(?:of\s+)?(?:(?!with\b|on\b|and\b|lot\b|land\b|plot\b|parcel\b)\w+\s+){0,2}?(?:living|built[- ]up|build[- ]?up|built|construction|interior|indoor)"
    r"|(?:living|built[- ]up|build[- ]?up|built|construction|interior|indoor)\s*(?:area|space|size)?\s*(?:of|:|is|approximately|approx\.?|±|~|\s)*\s*(\d[\d.,]*)\s*(?:m²|m2|sqm)",
    re.I,
)
LOT_IN_TEXT = re.compile(
    r"(\d[\d.,]*)\s*(?:m²|m2|sqm)\s*(?:of\s+)?(?:\w+\s+){0,3}?(?:lot|land|parcel|plot|grounds)"
    r"|(?:lot|land|parcel|plot)\s*(?:area|size)?\s*(?:of|:|is|approximately|approx\.?|±|~|\s)*\s*(\d[\d.,]*)\s*(?:m²|m2|sqm)",
    re.I,
)
POOL_SHARED = re.compile(r"\b(?:shared|communal|community|common)\s+(?:swimming\s+)?pool", re.I)
POOL_PRIVATE = re.compile(r"(?<!potential for a )(?<!room for a )(?<!space for a )\b(?:private|own|swimming|plunge|infinity|salt[- ]?water)\s+pool\b", re.I)


def area_sqft(value: str | None, text: str) -> str | None:
    """
    A size from the fact box as "<n> sq ft". The box says Sq.Ft. but agents
    sometimes type square metres or acres into it; the description tells.
    """
    if not value:
        return None
    unit = value.lower()
    if "acre" in unit:
        acres = float(m.group(0)) if (m := re.search(r"\d+(?:\.\d+)?", value)) else 0
        return f"{acres * 43560:.0f} sq ft" if acres else None
    n = parse_number(value)
    if not n or n < 2 or re.match(r"\s*0[.,]", value):  # "0.284 Sq.Ft." is not a size
        return None
    if re.match(r"\s*10[.,]76", value):  # "10.764 Sq.Ft." is 1 m² converted, not a size
        return None
    if "sq.m" in unit or "m²" in unit or "m2" in unit:
        return f"{n} m²"
    in_m2 = [parse_number(v) for v in M2_IN_TEXT.findall(text)]
    if any(v and abs(v - n) <= 1 for v in in_m2):
        return f"{n} m²"  # the description gives the same number in m²
    return f"{n:.0f} sq ft"


def from_text(pattern: re.Pattern[str], text: str) -> str | None:
    """The first size the description states for this, in m²."""
    for m in pattern.finditer(text):
        n = parse_number(m.group(1) or m.group(2))
        if n and n >= 10:
            return f"{n} m²"
    return None


class BoldArubaSpider(BaseSpider):
    agency_id = "bold-aruba"
    agency_name = "Bold Real Estate Aruba"
    website = "https://bold.realestate"
    # the copper "B" from their header (the "light" one is white, for dark backgrounds)
    logo_url = "https://media-production.lp-cdn.com/cdn-cgi/image/format=auto,quality=85,fit=scale-down,width=192/https://media-production.lp-cdn.com/media/6f2a22a5-e73a-476c-b483-e445569ab6b3"
    start_urls = [SITEMAP, "https://bold.realestate/properties/sale"]
    min_delay = 4.0

    # ── index ─────────────────────────────────────────────────────────────

    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        if "<urlset" in page.html[:500]:
            for loc, lastmod in re.findall(r"<loc>([^<]+)</loc>\s*(?:<lastmod>([^<]+)</lastmod>)?", page.html):
                if "/properties/" in loc and loc.rstrip("/").rsplit("/", 1)[-1] not in NON_LISTINGS:
                    out[loc.strip()] = {"source_url": loc.strip(), "lastmod": lastmod or None}
            return list(out.values())
        for href in page.attrs('a[href^="/properties/"]', "href"):
            slug = href.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
            if slug and slug not in NON_LISTINGS and "{" not in slug and "$" not in slug:
                url = self.absolute(f"/properties/{slug}")
                out[url] = {"source_url": url}
        return list(out.values())

    def next_page_url(self, page: Doc) -> str | None:
        return None  # the sitemap is one file; /properties/sale pages with a script

    # ── listing page ─────────────────────────────────────────────────────

    def _facts(self, page: Doc) -> dict[str, str]:
        facts: dict[str, str] = {}
        for li in page.all(".features-amenities-list li"):
            label = li.text("strong")
            value = li.text(".feature")
            if label and value:
                facts.setdefault(label.lower(), value)
        return facts

    def _agent(self, page: Doc) -> dict[str, Any] | None:
        box = page.first(".property-agent-cta-item")
        name = box.text("h3.name") if box else None
        if not box or not name:
            self._miss("agent")
            return None
        rows = {(r.text("strong") or "").lower(): r for r in box.all("li.row-item")}
        phone = rows["phone"].attr("a", "href") if "phone" in rows else None
        email = rows["email"].text(".data") if "email" in rows else None
        return {
            "name": name,
            "title": rows["title"].text(".data") if "title" in rows else None,
            "phone": phone.removeprefix("tel:") if phone else None,
            "email": email if email and "@" in email else None,
            "photo": box.attr("img", "src"),
            "profile_url": None,
        }

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        intro = page.first(".property-intro-2") or page
        facts = self._facts(page)
        status = (facts.get("status") or intro.text("span.label") or "").strip()
        where = (facts.get("neighborhood") or "").strip()
        address = intro.text("p.feature")
        in_aruba = where.lower() == "aruba" or (not where and bool(address) and address.lower().endswith("aruba"))
        if not in_aruba:
            return {"skip": f"not in Aruba ({where or address or 'unknown'})"}
        if status.lower() not in KEEP:
            return {"skip": f"status {status or 'unknown'}"}  # rentals, coming soon

        kind = facts.get("type") or ""
        is_land = kind.lower() == "land"
        title = self.text(intro, "h1", key="title")
        full = parse_number(facts.get("full bathrooms") or facts.get("total bathrooms"))
        half = parse_number(facts.get("half bathrooms")) or 0
        baths = full + 0.5 * half if full else None

        text = page.block_text(".property-description__main") or ""
        lot = area_sqft(facts.get("lot area"), text) or from_text(LOT_IN_TEXT, text)
        built = None if is_land else area_sqft(facts.get("living area"), text) or from_text(BUILT_IN_TEXT, text)
        total = area_sqft(facts.get("total area"), text)
        if not is_land and not built and total and total != lot and (parse_number(total) or 0) < (parse_number(lot) or 0):
            built = total  # a "Total Area" smaller than the lot is the house
        if built and built == lot and not is_land:
            built = None  # the same number twice: the plot, not the house
        pool = facts.get("pool") or ""
        features: dict[str, str] = {}
        if not is_land:
            if POOL_SHARED.search(f"{pool} {text}") or (pool and kind.lower() == "condo"):
                features = {"pool": "Yes", "pool type": "Shared pool"}
            elif pool or POOL_PRIVATE.search(text):
                features = {"pool": "Yes", "pool type": "Shared pool" if kind.lower() == "condo" else "Private pool"}

        # "Boroncana 309, Aruba" / "Tuscany Residence, Noord, Aruba": the part before the country
        parts = [p.strip() for p in (address or "").split(",") if p.strip() and p.strip().lower() != "aruba"]
        photo = page.attr('meta[property="og:image"]', "content")
        if not photo:
            self._miss("photo")
        return {
            "source_url": card["source_url"],
            "source_listing_id": card["source_url"].rstrip("/").rsplit("/", 1)[-1],
            "raw_title": title,
            "raw_address": parts[0] if parts else title,
            "raw_district": ", ".join(parts) or None,  # the normaliser picks the district out of it
            "price_text": facts.get("sales price") or intro.text("h5"),
            "raw_beds": None if is_land else parse_int(facts.get("total bedrooms")),
            "raw_baths": None if is_land else baths,
            "raw_property_type": kind or None,
            "raw_status": KEEP[status.lower()],
            "raw_built_area": built,
            "raw_lot_area": lot,
            "raw_description": text or None,
            "raw_agent": self._agent(page),
            "raw_photos": [photo] if photo else [],
            "extra": {"labels": [status], "facts": facts, "features": features, "address": address, "lastmod": card.get("lastmod"), "index_pages": card.get("index_pages", [])},
        }

    def is_closed(self, card: dict[str, Any]) -> bool:
        return False  # the sitemap does not say; lastmod changes when the page does
