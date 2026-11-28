"""
The co-listing check: a second, independent test that two agencies list the
same home. normalise.py merges a new listing into another agency's only when
its score says so (match_score) AND this check agrees.

Same home when all of these hold:
  - the same district;
  - exactly the same bedrooms and bathrooms (both unknown counts as the same);
  - built size within 7% (plots: lot size), both sizes known;
  - and either the asking prices within 8%, or both pins printed by the
    agencies' own pages and within 75 m of each other.

One exception (the user's choice, 28 November 2026): the same unit number in
the same development, with the same bedrooms and bathrooms and prices within
3%, is one flat whatever the measured size. Agencies measure flats
differently (with or without the terrace): RE/MAX and Weichert list The Reef
2B as 1,528 and 1,787 sq ft at $1,629,999 and $1,630,000.

Added 28 November 2026 at the user's request ("both must agree").

A second exception, the named home (28 November 2026): agencies pin the same
house kilometres apart and file it under different neighbourhoods. "Villa Bella
Luna Calabas 33" (MPG), "Villa Bella Luna" (Bold) and "Villa Bella Luna -
Calbas" (KW) are one villa: 3 bed, 3 bath, the same 690 m² plot, $1,450,000,
pinned up to 5.5 km apart. Two houses are the same home whatever their pins
and districts when all of these hold:
  - houses, not flats or townhouses (flats are matched by unit number only);
  - their names share at least two words that are neither generic ("villa")
    nor a place ("Noord");
  - exactly the same bedrooms, and bathrooms when both are known;
  - plot or built size within 2% (and, when both built sizes are known, built within 7%);
  - asking prices within 3%;
  - and neither agency lists another house whose name has those words. A
    model sold many times over ("Caribbean Town - Villa Nevis" 5611, 5712,
    5811, 5812 at Weichert) is several houses, never folded together.
"""

from __future__ import annotations

from typing import Any

AREA_TOLERANCE = 0.07
PRICE_TOLERANCE = 0.08
PIN_METRES = 75
UNIT_PRICE_TOLERANCE = 0.03


def _close(a: float | None, b: float | None, tolerance: float) -> bool:
    if not a or not b:
        return False
    return abs(float(a) - float(b)) <= tolerance * max(float(a), float(b))


def why_not(a: dict[str, Any], b: dict[str, Any], *, pins_exact: bool) -> str | None:
    """None when the two rows pass the check, else the first reason they do not."""
    from .normalise import PLACE_WORDS, distance_m, project_key, unit_tokens

    if (a.get("district") or "").strip().lower() != (b.get("district") or "").strip().lower():
        return "district"
    for k in ("bedrooms", "bathrooms"):
        x, y = a.get(k), b.get(k)
        if (x is None) != (y is None) or (x is not None and float(x) != float(y)):
            return k
    ua, ub = unit_tokens(a.get("asset_name") or ""), unit_tokens(b.get("asset_name") or "")
    same_project = bool((project_key(a.get("asset_name") or "") & project_key(b.get("asset_name") or "")) - PLACE_WORDS)
    if ua and ua == ub and same_project and _close(a.get("asking_price_usd"), b.get("asking_price_usd"), UNIT_PRICE_TOLERANCE):
        return None  # the same unit of the same development (the exception above)
    if a.get("built_sqft") and b.get("built_sqft"):
        if not _close(a["built_sqft"], b["built_sqft"], AREA_TOLERANCE):
            return "built size"
    elif a.get("lot_sqft") and b.get("lot_sqft"):
        if not _close(a["lot_sqft"], b["lot_sqft"], AREA_TOLERANCE):
            return "lot size"
    else:
        return "size unknown"
    if _close(a.get("asking_price_usd"), b.get("asking_price_usd"), PRICE_TOLERANCE):
        return None
    if pins_exact and None not in (a.get("lat"), a.get("lng"), b.get("lat"), b.get("lng")):
        if distance_m(a["lat"], a["lng"], b["lat"], b["lng"]) <= PIN_METRES:
            return None
    return "price and pin"


def same_home(a: dict[str, Any], b: dict[str, Any], *, pins_exact: bool) -> bool:
    return why_not(a, b, pins_exact=pins_exact) is None


# ── the named home (second exception above) ─────────────────────────────────

NAMED_SIZE_TOLERANCE = 0.02
NAMED_PRICE_TOLERANCE = 0.03


def name_words(name: str) -> set[str]:
    """The words that tell one named house from another: neither generic nor a place."""
    from .normalise import PLACE_WORDS, project_key

    return project_key(name or "") - PLACE_WORDS


def named_home(a: dict[str, Any], a_agency: str, b: dict[str, Any], masters: list[dict[str, Any]]) -> bool:
    """
    True when a (listed by a_agency) and b (a property_master row) are one named
    house, whatever their pins and districts. `masters` is every active listing,
    used to make sure neither agency lists another house of that name.
    """
    from .normalise import UNIT_TYPES, unit_tokens

    if a_agency == b.get("agency_id") or a.get("asset_class") != "Property" or b.get("asset_class") != "Property":
        return False
    if a.get("property_type") in UNIT_TYPES or b.get("property_type") in UNIT_TYPES:
        return False
    shared = name_words(a.get("asset_name") or "") & name_words(b.get("asset_name") or "")
    if len(shared) < 2:
        return False
    ua, ub = unit_tokens(a.get("asset_name") or ""), unit_tokens(b.get("asset_name") or "")
    if ua and ub and not ua & ub:
        return False  # both give a number, and not the same one
    if a.get("bedrooms") is None or b.get("bedrooms") is None or float(a["bedrooms"]) != float(b["bedrooms"]):
        return False
    if a.get("bathrooms") is not None and b.get("bathrooms") is not None and float(a["bathrooms"]) != float(b["bathrooms"]):
        return False
    built_known = bool(a.get("built_sqft") and b.get("built_sqft"))
    if built_known and not _close(a["built_sqft"], b["built_sqft"], AREA_TOLERANCE):
        return False
    if not (_close(a.get("lot_sqft"), b.get("lot_sqft"), NAMED_SIZE_TOLERANCE) or _close(a.get("built_sqft"), b.get("built_sqft"), NAMED_SIZE_TOLERANCE)):
        return False
    if not _close(a.get("asking_price_usd"), b.get("asking_price_usd"), NAMED_PRICE_TOLERANCE):
        return False
    # neither agency may list another house of that name (a model sold many times over)
    own = {a.get("id"), b.get("id")} - {None}
    for agency in (a_agency, b.get("agency_id")):
        if any(
            m.get("agency_id") == agency and m.get("id") not in own and m.get("asset_class") == "Property"
            and shared <= name_words(m.get("asset_name") or "")
            for m in masters
        ):
            return False
    return True


def named_pairs(masters: list[dict[str, Any]]) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """Every pair of listed houses that are one named home (for folding listings made before the rule)."""
    houses = [m for m in masters if m.get("asset_class") == "Property" and len(name_words(m.get("asset_name") or "")) >= 2]
    out = []
    for i, a in enumerate(houses):
        for b in houses[i + 1:]:
            if named_home(a, a.get("agency_id") or "", b, masters):
                out.append((a, b))
    return out
