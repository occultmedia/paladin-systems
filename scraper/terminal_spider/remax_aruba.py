"""
RE/MAX Aruba (https://remaxaruba.com) — site-specific code only.

PERMISSION: the site's terms (/terms-conditions, read 25 November 2026) do not
allow automated collection, or reuse of text and photos, without RE/MAX
Aruba's written consent. Terminal's owner confirmed on 25 November 2026 that
this consent is in place. If it is withdrawn, take "remax-aruba" out of
SPIDERS in __init__.py.

How the site is built (checked 25 November 2026):

  * Server-rendered October CMS pages, so the HTTP engine reads everything.
    robots.txt: "Allow: /", no Crawl-delay.
  * Four for-sale index pages, 24 cards each, then ?page=2, ?page=3 ...
        /property/residential-for-sale
        /property/condominium-for-sale
        /property/land-for-sale
        /property/commercial-for-sale
    Only these are crawled. Rentals (/property/...-rental) are never opened.
    /property/sold shows no prices, so it has nothing Terminal can use.
  * Every listing page carries its facts as structured data (JSON-LD): price,
    map pin, photos, agent. The page itself adds the tags and the sizes.
  * Prices use both styles: "USD 2,300,000" and "USD 210.674 / AWG 375.000".
  * Empty numbers are filled in as 1 (build up 1 m2, built in year 1).

Selectors used
--------------
Index page, one per card:
  card       #properties_partial div.relative:has(> a[href*="/property/details/"])
  link       a[href*="/property/details/"]              @href -> source_url
  texts      all text on the card                       title, tags, place, price, sizes
  tags       [class*="tag-"]                            "New Listing", "Under Offer", "On Hold" ...
  next page  ul.pagination                              the link numbered one above the current page (opened as ?page=N)

Listing page:
  data       script[type="application/ld+json"] with @type RealEstateListing
  title      main h1
  tags       the [class*="tag-"] before the h1          (later ones belong to "Comparable listings")
  price      main div.text-secondary.font-bold
  facts      main table.table tr                        Property Type | Area | Bedrooms | Bathrooms | Year built |
                                                        Lot size | Build up size | Furnished | Pool ...
  text       main .wysiwyg
  agent      a[href*="/team/"]                          profile link; the line under the name is the job title
"""

from __future__ import annotations

import json
import re
from typing import Any

from .base import BaseSpider
from .doc import Doc
from .parsing import clean, parse_int, parse_number

# Tags that are a sale status. "New Listing", "Luxury", "Reduced", "Commercial"
# and "Miracle" (a RE/MAX charity) are not.
STATUS_TAGS = {"sold", "under contract", "under offer", "on hold"}


def area(value: str | None) -> str | None:
    """'4,190 m 2' -> '4,190 m²'; a blank or the filler value 1 -> None."""
    n = parse_number(value)
    return f"{re.match(r'[^0-9]*([0-9][0-9.,]*)', value).group(1)} m²" if n and n > 1 else None


# "... ON HOLD!!!!!!!" at the end of a title. Not "sold": "Lot 5 SOLD !!!" is one lot of several.
STATUS_IN_TITLE = re.compile(r"[\s(\[–-]*\b(on hold|under contract|under offer)\W*$", re.I)


def status_of(tags: list[str]) -> str | None:
    return next((t for t in tags if t.lower() in STATUS_TAGS), None)


class RemaxArubaSpider(BaseSpider):
    agency_id = "remax-aruba"
    agency_name = "RE/MAX Aruba"
    website = "https://remaxaruba.com"
    logo_url = "https://remaxaruba.com/themes/remax/assets/images/apple-touch-icon.png"
    start_urls = [
        "https://remaxaruba.com/property/residential-for-sale",
        "https://remaxaruba.com/property/condominium-for-sale",
        "https://remaxaruba.com/property/land-for-sale",
        "https://remaxaruba.com/property/commercial-for-sale",
    ]
    min_delay = 4.0

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        rent = [u for u in self.start_urls if "-for-sale" not in u]
        if rent:
            raise ValueError(f"RE/MAX Aruba: only /property/...-for-sale pages are crawled, not {rent}")

    # ── index pages ───────────────────────────────────────────────────────

    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for card in page.all('#properties_partial div.relative:has(> a[href*="/property/details/"])'):
            url = self.absolute(card.attr('a[href*="/property/details/"]', "href"))
            if not url or url in out:
                continue
            tags = card.texts('[class*="tag-"]')
            out[url] = {
                "source_url": url,
                "label": status_of(tags),
                "tags": tags,
                "card_text": " | ".join(clean(s) or "" for s in card.node.stripped_strings),
            }
        return list(out.values())

    def next_page_url(self, page: Doc) -> str | None:
        pager = page.first("ul.pagination")
        if not pager:
            return None
        current = next((int(t) for t in pager.texts("li > span") if t.isdigit()), None)
        for link in pager.all("li > a"):
            if current and link.own_text() == str(current + 1):
                # the links say /2, but that address serves page 1; the site's script asks for ?page=2
                section = (link.own_attr("href") or "").rstrip("/").rsplit("/", 1)[0]
                return self.absolute(f"{section}?page={current + 1}")
        return None

    # ── listing page ─────────────────────────────────────────────────────

    def _data(self, page: Doc) -> dict[str, Any]:
        for script in page.all('script[type="application/ld+json"]'):
            try:
                data = json.loads(script.node.string or "", strict=False)
            except ValueError:
                continue
            if isinstance(data, dict) and data.get("@type") == "RealEstateListing":
                return data
        self._miss("structured data")
        return {}

    def _agent(self, page: Doc, data: dict[str, Any]) -> dict[str, Any] | None:
        a = data.get("agent") or {}
        name = clean(a.get("name"))
        links = [d for d in page.all('main a[href*="/team/"]') if d.own_text()]
        if not name and links and (links[0].own_text() or "").lower() == "office":
            # no agent of its own: the page says "Office" and the office number
            return {"name": f"{self.agency_name} office", "title": None, "phone": page.attr('main a[href^="tel:"]', "href").removeprefix("tel:").strip(), "email": None, "photo": None}
        if not name:
            self._miss("agent name")
            return None
        title = None
        if links:
            # name, job title and phone are lines of the same block
            lines = [clean(s) for s in links[0].node.parent.parent.stripped_strings]
            title = next((s for s in lines[1:2] if s and not re.search(r"\d", s)), None)
        return {
            "name": name,
            "title": title or clean(a.get("jobTitle")),
            "phone": clean(a.get("telephone")),
            "email": clean(a.get("email")),
            "photo": a.get("image"),
            "profile_url": self.absolute(links[0].own_attr("href")) if links else None,
        }

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        data = self._data(page)
        about = data.get("about") or {}
        address = about.get("address") or {}
        geo = about.get("geo") or {}
        facts = {k.rstrip(": "): v for k, v in page.table("main table.table").items()}

        title = self.text(page, "main h1", key="title") or clean(about.get("name"))
        heading = page.first("main h1")
        tags = [
            t.own_text() or ""
            for t in page.all('main [class*="tag-"]')
            if heading and heading.node in t.node.find_all_next("h1")
        ] or card.get("tags", [])

        kind = facts.get("property type") or ""
        if "rent" in kind.lower():
            raise ValueError(f"a rental on a for-sale page: {kind}")
        kind = clean(re.sub(r"(properties|property)?\s*for sale.*", "", kind, flags=re.I)) or ""
        is_land = "land" in kind.lower()
        description = page.block_text("main .wysiwyg") or ""
        marked = STATUS_IN_TITLE.search(title or "")
        if marked:
            title = STATUS_IN_TITLE.sub("", title).strip()
        lot = area(facts.get("lot size"))
        # A flat filed under Residential: no lot, and the text opens by calling it an apartment.
        if kind.lower() == "residential" and not lot and not re.search(r"villa|house", title or "", re.I) and re.search(r"\b(apartment|condo)", description[:300], re.I):
            kind = "Condominiums"
        is_unit = "condo" in kind.lower()

        offer = data.get("offers") or {}
        price_text = self.text(page, "main div.text-secondary.font-bold", key="price")
        images = data.get("image") or []
        photo = images[0] if isinstance(images, list) and images else images or None
        photo = photo or page.attr('main a[data-fancybox="gallery"]', "href")
        if not photo:
            self._miss("photo")

        pool = (facts.get("pool") or "").lower()
        features = {"pool": "Yes" if pool == "yes" else "No" if pool == "no" else ""}
        if features["pool"] == "Yes" and is_unit:
            features["pool type"] = "Private pool" if re.search(r"\bprivate (plunge )?pool\b", description, re.I) else "Shared pool"

        # A home's "0" means the box was left empty, on land it means nothing at all.
        beds = None if is_land else parse_int(facts.get("bedrooms")) or None
        baths = None if is_land else parse_number(facts.get("bathrooms")) or None
        if baths:
            baths += 0.5 * (parse_number(facts.get("half bathrooms")) or 0)  # "1BR 1.5BA" is filed as 1 + 1 half
        street = clean(address.get("streetAddress"))

        return {
            "source_url": card["source_url"],
            "source_listing_id": card["source_url"].rstrip("/").rsplit("/", 1)[-1],
            "raw_title": title,
            "raw_address": STATUS_IN_TITLE.sub("", street or "").strip() or title,
            "raw_district": clean(facts.get("area")) or clean(address.get("addressLocality")),
            "raw_price": offer.get("price") if offer.get("priceCurrency") == "USD" and offer.get("price") else None,
            "raw_currency": "USD" if offer.get("priceCurrency") == "USD" and offer.get("price") else None,
            "price_text": price_text,
            "raw_beds": beds,
            "raw_baths": baths,
            "raw_property_type": kind or None,
            "raw_status": status_of(tags) or (marked.group(1) if marked else "For sale"),
            "raw_built_area": None if is_land else area(facts.get("build up size")),
            # a flat's "lot size" is its floor area plus terrace, not land
            "raw_lot_area": None if is_unit and not re.search(r"\bvilla\b", title or "", re.I) else lot,
            "raw_description": description or None,
            "raw_agent": self._agent(page, data),
            "raw_photos": [self.absolute(photo)] if photo else [],
            "raw_lat": geo.get("latitude"),
            "raw_lng": geo.get("longitude"),
            "extra": {
                "labels": tags,
                "features": features,
                "facts": facts,
                "date_posted": data.get("datePosted"),
                "index_pages": card.get("index_pages", []),
            },
        }
