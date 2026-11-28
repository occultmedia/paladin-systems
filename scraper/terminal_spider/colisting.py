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
