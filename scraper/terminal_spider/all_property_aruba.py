"""
All Property Aruba (https://www.allpropertyaruba.com) — site-specific code only.

How the site is built (checked 24 November 2026):

  * A Framer site with the listings in the HTML, so the HTTP engine reads it.
    robots.txt: "Allow: /", no Crawl-delay. 11 listings, all for sale, on one
    page (/properties).
  * Framer class names change with every publish, so selectors use
    data-framer-name, the layer names the designer gave.
  * Every element is in the HTML once per screen size; the first one is used.
  * No map pins and no agent box. Agents sign some descriptions with their
    e-mail, which is matched to the names on /agents.
  * Nothing says "apartment" on the listing itself; /categories/appartment
    lists them.

Selectors used
--------------
/properties, one per card:
  card       a[data-framer-name="Card"][href*="properties/"]
  tag        [data-framer-name="Tag"]                   "For Sale" ("For Rent" is skipped)
  texts      p, h1-h6                                   location, title, price, beds, baths, size
  photo      [data-framer-name="Image Box"] img

Listing page:
  title      [data-framer-name="Hero Section"] h1       "Pos Abou (UNDER CONTRACT)"
  price      [data-framer-name="Hero Section"] h3       "$ 597,000 / AWG 1,062,660"
  location   [data-framer-name="Location Details"], first text
  facts      [data-framer-name="Info"] [data-framer-name="Contain"]   label, value
             Built Year | Total built-up area (sq ft) | Lot size (sq ft unless it says m2) | Bedrooms | Bathrooms
  text       [data-framer-name="Description"]
  amenities  [data-framer-name="Amenties"]              (spelled like this on the site)
  photo      [data-framer-name="Property Listing"] img
"""

from __future__ import annotations

import re
from typing import Any

from .base import BaseSpider
from .doc import Doc
from .parsing import clean, parse_int, parse_number

RICH = '[data-framer-component-type="RichTextContainer"]'
EMAIL = re.compile(r"([A-Za-z.]+)@allpropertyaruba\.com", re.I)
PHONE = re.compile(r"\+297[\s\d-]{7,12}\d")
STATUS_IN_TITLE = re.compile(r"\s*[(\[-]?\s*(under contract|sold|reserved|on hold)\s*[)\]]?\s*$", re.I)


def no_query(url: str | None) -> str | None:
    return url.split("?", 1)[0] if url else None


class AllPropertyArubaSpider(BaseSpider):
    agency_id = "all-property-aruba"
    agency_name = "All Property Aruba"
    website = "https://www.allpropertyaruba.com"
    logo_url = "https://framerusercontent.com/images/gH9efk209Z89yPOcgpquK2RyOPE.svg"
    start_urls = ["https://www.allpropertyaruba.com/properties"]
    min_delay = 3.0

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.apartments: set[str] = set()
        self.agents: dict[str, dict[str, Any]] = {}  # first name -> agent

    async def prepare(self) -> None:
        page = await self.load(f"{self.website}/categories/appartment")
        if page:
            self.apartments = {h.rstrip("/").rsplit("/", 1)[-1] for h in page.attrs('a[href*="properties/"]', "href")}
        page = await self.load(f"{self.website}/agents")
        for card in page.all('a[href*="agents/"]') if page else []:
            texts = card.texts("p, h1, h2, h3, h4, h5, h6")
            if texts and " " in texts[0]:
                self.agents.setdefault(texts[0].split()[0].lower(), {
                    "name": texts[0],
                    "title": texts[1] if len(texts) > 1 else None,
                    "photo": no_query(card.attr("img", "src")),
                    "profile_url": self.absolute(card.own_attr("href")),
                })

    # ── index page ────────────────────────────────────────────────────────

    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for card in page.all('a[data-framer-name="Card"][href*="properties/"]'):
            url = self.absolute(card.own_attr("href"))
            if not url or url in out:
                continue
            tag = card.text('[data-framer-name="Tag"]') or ""
            if "rent" in tag.lower():
                continue
            texts = card.texts("p, h1, h2, h3, h4, h5, h6")
            joined = " | ".join(texts)
            out[url] = {
                "source_url": url,
                "label": "Sold" if re.search(r"\bsold\b", joined, re.I) else tag or None,
                "card_text": joined,
                "photo": no_query(card.attr('[data-framer-name="Image Box"] img', "src")),
            }
        return list(out.values())

    # ── listing page ─────────────────────────────────────────────────────

    def _agent(self, description: str) -> dict[str, Any] | None:
        m = EMAIL.search(description)
        if not m:
            return None
        known = self.agents.get(m.group(1).split(".")[0].lower(), {})
        phone = PHONE.search(description)
        return {
            "name": known.get("name") or m.group(1).title(),
            "title": known.get("title"),
            "phone": clean(phone.group(0)) if phone else None,
            "email": m.group(0),
            "photo": known.get("photo"),
            "profile_url": known.get("profile_url"),
        }

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        slug = card["source_url"].rstrip("/").rsplit("/", 1)[-1]
        hero = page.first('[data-framer-name="Hero Section"]') or page
        heading = self.text(hero, "h1", key="title") or slug.replace("-", " ").title()
        marked = STATUS_IN_TITLE.search(heading)
        title = STATUS_IN_TITLE.sub("", heading).strip() or heading
        location = self.text(page, f'[data-framer-name="Location Details"] {RICH}', key="location")

        facts: dict[str, str] = {}
        for row in page.all('[data-framer-name="Info"] [data-framer-name="Contain"]'):
            cells = [d.own_text() or "" for d in row.all(RICH)]
            if cells and cells[0]:
                facts.setdefault(cells[0].lower(), cells[1] if len(cells) > 1 else "")

        is_land = bool(re.search(r"\b(land|lot|plot)\b", title, re.I))
        apartment = slug in self.apartments
        # "2120 Sq.ft" / "Sq.ft" when empty
        built = facts.get("total built-up area")
        built = built if parse_number(built) else None
        lot = facts.get("lot size") or None
        if lot and parse_number(lot) and not re.search(r"m2|m²|sq", lot, re.I):
            lot = f"{lot} sq ft"  # the site measures in sq ft unless it says m2

        amenities = [a for a in dict.fromkeys(page.texts(f'[data-framer-name="Amenties"] {RICH}')) if a != "-" and len(a) < 80]
        description = "\n".join(
            t for t in (d.block_text("*") or d.own_text() or "" for d in (page.first('[data-framer-name="Description"]') or page).all(RICH)[:1]) if t
        )
        if not description:
            self._miss("description")
        features: dict[str, str] = {}
        if any("pool" in a.lower() for a in amenities):
            features = {"pool": "Yes", "pool type": "Shared pool" if apartment else "Private pool"}

        return {
            "source_url": card["source_url"],
            "source_listing_id": slug,
            "raw_title": title,
            "raw_address": title,
            "raw_district": location,
            "price_text": self.text(hero, "h3", key="price"),
            # land pages print "1 Bedrooms, 0 Bathrooms"; that is the form's default, not a fact
            "raw_beds": None if is_land else parse_int(facts.get("bedrooms")),
            "raw_baths": None if is_land else parse_number(facts.get("bathrooms")),
            "raw_property_type": "Land" if is_land else "Apartment" if apartment else "Residential",
            "raw_status": marked.group(1) if marked else "For sale",
            "raw_built_area": None if is_land else built,
            "raw_lot_area": lot,
            "raw_description": description,
            "raw_agent": self._agent(description),
            "raw_photos": [p for p in [no_query(page.attr('[data-framer-name="Property Listing"] img', "src")) or card.get("photo")] if p],
            "extra": {"labels": [card["label"]] if card.get("label") else [], "features": features, "facts": facts, "amenities": amenities, "location": location},
        }
