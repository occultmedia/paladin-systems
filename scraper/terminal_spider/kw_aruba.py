"""
Keller Williams Aruba (https://kw-aruba.com) — site-specific code only.

How the site is built (checked November 2026):

  * Server-rendered October CMS pages, so the HTTP engine reads everything.
    robots.txt allows everything but asks for `Crawl-delay: 20`, which
    BaseSpider honours.
  * For-sale inventory is split into five index pages, each listing every
    card of its category on ONE page (no pagination today):
        /listings/for-sale/residential
        /listings/for-sale/condominium-townhouse
        /listings/for-sale/land
        /listings/for-sale/commercial
        /listings/for-sale/new-development
    Only the buy (for-sale) section is crawled. Rentals (/listings/for-rent/...)
    are never opened: Terminal tracks sales.
    The base class still follows a "next" link if the site ever adds one.
  * Prices use dots for thousands: "USD 3.900.000 (AWG 6.942.000)".

Selectors used
--------------
Index page, one per card:
  card                 div.card:has(> a.card__overlay[href^="/listings/"])
  link                 a.card__overlay                       @href  -> source_url
  title                .card__heading                        "Malmokweg 29"
  district             .card__location                       "Malmok"
  price                .card__price                          "USD 3.900.000 (AWG 6.942.000)"
  label                .card__label                          "New Listing" | "Reduced in price" | "Under contract" |
                                                             "Sale in Progress" | "On Hold" | "Sold" (or none)
  size / beds          .card__options .option__value         "1078 m²", "10 bedroom(s)"
  photo                img.card__image-img                   @src
  next page            a[rel="next"], .pagination a.next, .pagination__next a   (none today)

Listing page:
  title                h1.page-property-details__heading
  district             .page-property-details__location
  type                 .page-property-details__type           "For Sale - Residential"
  price                .page-property-details__price
  status label         .page-property-details__status
  headline options     .page-property-details__options .option__value
                                                             "1078 m²", "10 bedroom(s)", "10 bathroom(s)", "Pool"
  features table       #features table tr  -> td:nth-child(1) label, td:nth-child(2) value
                       Bedrooms | Full bathrooms | Half bathrooms | Land size | Build up size |
                       Pool | Pool type | Furnished | Garage ...
  description          #description .wysiwyg
  main photo           first a[data-fancybox="gallery"]      @href (full size; falls back to the card photo)
  agent                .card-agent__name-link, .card-agent__position, a.card-agent__phone,
                       a.card-agent__email (Cloudflare-protected), img.card-agent__image-img
  map pin              inline script:  latLng: { lat: 12.60..., lng: -70.04... }
"""

from __future__ import annotations

import re
from typing import Any

from .base import BaseSpider
from .doc import Doc
from .parsing import clean, parse_int, parse_number

# Card labels that are a sale status. The others ("New Listing", "Reduced in
# price") are tags on a listing that is simply for sale.
STATUS_LABELS = {"under contract", "sale in progress", "on hold", "sold"}

LAT_LNG = re.compile(r"lat:\s*(-?\d+\.\d+)\s*,\s*lng:\s*(-?\d+\.\d+)")


class KWArubaSpider(BaseSpider):
    agency_id = "kw-aruba"
    agency_name = "Keller Williams Aruba"
    website = "https://kw-aruba.com"
    logo_url = "https://kw-aruba.com/apple-touch-icon.png"
    start_urls = [
        "https://kw-aruba.com/listings/for-sale/residential",
        "https://kw-aruba.com/listings/for-sale/condominium-townhouse",
        "https://kw-aruba.com/listings/for-sale/land",
        "https://kw-aruba.com/listings/for-sale/commercial",
        "https://kw-aruba.com/listings/for-sale/new-development",
    ]

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        rent = [u for u in self.start_urls if "/for-sale/" not in u]
        if rent:
            raise ValueError(f"KW Aruba: only /listings/for-sale/ pages are crawled, not {rent}")

    # ── index pages ───────────────────────────────────────────────────────

    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for card in page.all('div.card:has(> a.card__overlay[href^="/listings/"])'):
            url = self.absolute(card.attr("a.card__overlay", "href"))
            if not url:
                continue
            options = card.texts(".card__options .option__value")
            out.append({
                "source_url": url,
                "raw_title": self.text(card, ".card__heading", key="card title"),
                "raw_district": self.text(card, ".card__location", key="card district"),
                "price_text": self.text(card, ".card__price", key="card price"),
                "label": card.text(".card__label"),
                "raw_beds": next((o for o in options if "bed" in o.lower()), None),
                "area": next((o for o in options if "m²" in o or "m2" in o.lower()), None),
                "photo": card.attr("img.card__image-img", "src"),
            })
        return out

    # ── listing page ─────────────────────────────────────────────────────

    def _agent(self, page: Doc) -> dict[str, Any] | None:
        name = self.text(page, ".card-agent__name-link", key="agent name")
        if not name:
            return None
        phone = page.attr("a.card-agent__phone", "href")
        email = page.text("a.card-agent__email")
        return {
            "name": name,
            "title": page.text(".card-agent__position"),
            "phone": phone.removeprefix("tel:").strip() if phone else None,
            "email": email if email and "@" in email else None,
            "photo": page.attr("img.card-agent__image-img", "src"),
            "profile_url": self.absolute(page.attr("a.card-agent__name-link", "href")),
        }

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        features = page.table("#features table")
        options = page.texts(".page-property-details__options .option__value")

        # Bathrooms: full + 0.5 per half bath from the Features table; else the headline option.
        full = parse_number(features.get("full bathrooms"))
        half = parse_number(features.get("half bathrooms")) or 0
        baths: float | None = full + 0.5 * half if full is not None else parse_number(
            next((o for o in options if "bath" in o.lower()), None)
        )
        if baths is None:
            self._miss("bathrooms")

        beds = parse_int(features.get("bedrooms")) if features.get("bedrooms") else None
        if beds is None:
            beds = parse_int(next((o for o in options if "bed" in o.lower()), None) or card.get("raw_beds"))

        type_text = self.text(page, ".page-property-details__type", key="type")  # "For Sale - Residential"
        if type_text and "land" in type_text.lower():
            # The Features table says "Bedrooms 0" on land; that means "not applicable", not zero.
            beds = baths = None

        title = self.text(page, "h1.page-property-details__heading", key="title") or card.get("raw_title")
        district = self.text(page, ".page-property-details__location", key="district") or card.get("raw_district")
        price_text = self.text(page, ".page-property-details__price", key="price") or card.get("price_text")
        label = page.text(".page-property-details__status") or card.get("label")
        status = label if label and label.lower() in STATUS_LABELS else "For sale"

        # Areas: an empty value prints as " m² (0 Sq Ft)"; treat a leading 0 or no digits as missing.
        def area(value: str | None) -> str | None:
            n = parse_number(value)
            return clean(value) if n else None

        lot = area(features.get("land size")) or (card.get("area") if type_text and "land" in type_text.lower() else None)
        built = area(features.get("build up size"))
        pin = LAT_LNG.search(page.html)
        # Main photo only: the first image of the gallery, else the card photo.
        photo = self.absolute(page.attr('a[data-fancybox="gallery"]', "href")) or card.get("photo")

        return {
            "source_url": card["source_url"],
            "source_listing_id": card["source_url"].rstrip("/").rsplit("/", 1)[-1],  # the URL slug
            "raw_title": title,
            "raw_address": title,                      # KW titles are the street address or the project name
            "raw_district": district,
            "price_text": price_text,
            "raw_beds": beds,
            "raw_baths": baths,
            "raw_property_type": type_text.split(" - ", 1)[-1] if type_text else None,
            "raw_status": status,
            "raw_lot_area": lot,
            "raw_built_area": built,
            "raw_description": page.block_text("#description .wysiwyg"),
            "raw_agent": self._agent(page),
            "raw_photos": [photo] if photo else [],
            "raw_lat": float(pin.group(1)) if pin else None,
            "raw_lng": float(pin.group(2)) if pin else None,
            "extra": {
                "labels": [label] if label else [],
                "listing_type": type_text,
                "features": features,
                "options": options,
                "index_pages": card.get("index_pages", []),
            },
        }
