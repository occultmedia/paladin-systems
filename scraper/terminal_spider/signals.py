"""
The value signal: Below market, At market or Overpriced.

Two separate checks estimate what a home would normally ask:

  nearest   the 5 nearest homes of similar size (and plot, land title and
            condition), one per building project, scaled to this home's size;
  model     a price model over all homes of the same group: size, plot,
            bedrooms, private pool, land title, condition and district.

Neither check sees the home itself or the rest of its project. A home is
flagged only when BOTH put it 20% or more away. The estimate shown is the
average of the two.

No signal at all (so no estimate either) for:
  - land and commercial: too few, and too different from each other;
  - anything not for sale (under contract, sold, de-listed);
  - fixer-uppers and homes sold with several apartments: nothing to compare
    them with;
  - homes without a built size, or with fewer than 3 similar homes near them.

Why 20%: measured 25 November 2026 on 184 homes, the estimate is typically
about 20-30% away from the asking price. A 10% line (the rule before this)
flagged four listings in five. These are asking prices; sale prices are not
published.
"""

from __future__ import annotations

import math
import re
import statistics
from collections import Counter
from typing import Any

THRESHOLD = 0.20
NEAREST = 5
NEAR_KM = 4.0      # a comparable further than this is not "near"
MIN_NEAR = 3
UNIT_TYPES = {"Condo", "Apartment", "Townhouse", "Penthouse"}
# How price grows with size: twice the house is not twice the price.
SIZE_POWER = {"house": 0.6, "unit": 0.85}

FIXER = re.compile(
    r"fixer|handyman|redevelopment opportunity|tear ?down|as[- ]is condition|existing condition|asbestos|"
    r"renovation potential|through renovation|opportunity to renovate|renovation plan|improvements requiring|"
    r"\b(?:requir\w+|needs?|in need of)\s+(?:\w+\s+){0,3}(?:renovation|renovating|repairs?|modernization|updating|tlc)\b",
    re.I,
)
MULTI_NAME = re.compile(r"multi[- ]?(?:unit|family)|complex|\d[- ]unit\b|\d\s*apartments|\+\s*(?:\d+\s+)?apartment|\btwo (?:homes|houses)\b", re.I)
# "... complemented by two fully independent 1-bedroom apartments"
MULTI_TEXT = re.compile(
    r"\b(?:two|three|four|five|six|[2-9])\s+(?:(?:separate|fully|independent|income[- ]\w+|rental|self[- ]contained|additional|adjacent|guest|\d[- ]bed(?:room)?|one[- ]bedroom|two[- ]bedroom)\s*,?\s*){0,4}(?:apartments?|apartment units|rental units|studios)\b"
    r"|divided into (?:two|three|[2-9])\b|multi[- ]?(?:unit|family)",
    re.I,
)


def group_of(row: dict[str, Any]) -> str | None:
    if row["asset_class"] != "Property":
        return None
    return "unit" if row["property_type"] in UNIT_TYPES else "house"


def is_fixer(name: str, text: str) -> bool:
    return bool(FIXER.search(f"{name}\n{text}"))


def is_multi(group: str, name: str, text: str) -> bool:
    """Sold as several homes in one. A flat's text talks about its building, so only its name counts."""
    return bool(MULTI_NAME.search(name) or (group == "house" and MULTI_TEXT.search(text[:1500])))


# ── the homes ─────────────────────────────────────────────────────────────


class Home:
    def __init__(self, row: dict[str, Any], text: str) -> None:
        from .normalise import project_key

        self.row = row
        self.id = row["id"]
        self.group = group_of(row) or ""
        self.price = float(row["asking_price_usd"])
        self.size = float(row["built_sqft"])
        self.lot = float(row["lot_sqft"]) if row.get("lot_sqft") else None
        self.lat, self.lng = float(row["lat"]), float(row["lng"])
        self.fixer = is_fixer(row["asset_name"], text)
        self.multi = is_multi(self.group, row["asset_name"], text)
        self.words = project_key(row["asset_name"])
        self.project = -1


def km(a: Home, b: Home) -> float:
    from .normalise import distance_m

    return distance_m(a.lat, a.lng, b.lat, b.lng) / 1000


def mark_projects(homes: list[Home]) -> None:
    """Give homes of one building project, and one home listed twice, the same project number."""
    parent = list(range(len(homes)))

    def find(i: int) -> int:
        while parent[i] != i:
            i = parent[i]
        return i

    for i, a in enumerate(homes):
        for j in range(i):
            b = homes[j]
            if a.group != b.group:
                continue
            near = km(a, b)
            same = (
                (a.price == b.price and a.size == b.size)
                or (a.group == "unit" and near < 0.15 and bool(a.words & b.words))
                or (bool(a.words) and a.words == b.words and near < 0.4)
            )
            if same:
                parent[find(i)] = find(j)
    for i, h in enumerate(homes):
        h.project = find(i)


# ── check 1: nearest similar homes ───────────────────────────────────────


def unlike(a: Home, b: Home) -> float:
    """How different two homes are; 0 = same place, size, plot, title and condition."""
    d = km(a, b) / 2 + abs(math.log(a.size / b.size)) / 0.5
    if a.group == "house":
        d += (abs(math.log(a.lot / b.lot)) if a.lot and b.lot else 0.4) / 0.8
    ta, tb = a.row.get("tenure"), b.row.get("tenure")
    if ta and tb and ta != tb:
        d += 0.7
    return d + (1 if a.fixer != b.fixer else 0)


def nearest(h: Home, others: list[Home]) -> list[Home]:
    """The most similar homes, one per project."""
    seen: set[int] = set()
    out: list[Home] = []
    for o in sorted(others, key=lambda o: unlike(h, o)):
        if o.project not in seen:
            seen.add(o.project)
            out.append(o)
            if len(out) == NEAREST:
                break
    return out


def nearest_estimate(h: Home, comps: list[Home]) -> float:
    power = SIZE_POWER[h.group]
    return math.exp(statistics.median(math.log(c.price) + power * math.log(h.size / c.size) for c in comps))


# ── check 2: price model (ridge regression on log price) ─────────────────


def _solve(m: list[list[float]], v: list[float]) -> list[float]:
    n = len(v)
    a = [r[:] + [v[i]] for i, r in enumerate(m)]
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(a[r][i]))
        a[i], a[p] = a[p], a[i]
        for r in range(n):
            if r != i and a[r][i]:
                f = a[r][i] / a[i][i]
                for c in range(i, n + 1):
                    a[r][c] -= f * a[i][c]
    return [a[i][n] / a[i][i] for i in range(n)]


def _features(h: Home, districts: list[str], typical_lot: float) -> tuple[list[float], list[float]]:
    """(values, how strongly each is held back from extreme weights)"""
    r = h.row
    x: list[tuple[float, float]] = [(1.0, 1e-6), (math.log(h.size), 1e-6)]
    if h.group == "house":
        x.append((math.log(h.lot or typical_lot), 0.3))
    x += [
        (math.log(1 + (r.get("bedrooms") or 0)), 0.3),
        (float(r.get("pool") == "Private pool"), 0.3),
        (float(r.get("tenure") == "Erfpacht"), 0.3),
        (float(r.get("tenure") == "Eigendom"), 0.3),
        (float(h.fixer), 0.3),
        (float(r["property_type"] == "Penthouse"), 0.3),
    ]
    x += [(float(r["district"] == d), 2.0) for d in districts]
    return [v for v, _ in x], [k for _, k in x]


def model_estimate(h: Home, others: list[Home]) -> float:
    districts = sorted({o.row["district"] for o in others} | {h.row["district"]})
    lots = [o.lot for o in others if o.lot]
    typical_lot = statistics.median(lots) if lots else 1.0
    rows = [_features(o, districts, typical_lot)[0] for o in others]
    target, hold = _features(h, districts, typical_lot)
    size_of = Counter(o.project for o in others)
    weight = [1 / size_of[o.project] for o in others]  # a project counts once, however many flats it lists
    y = [math.log(o.price) for o in others]
    n = len(target)
    m = [[sum(w * r[i] * r[j] for r, w in zip(rows, weight)) for j in range(n)] for i in range(n)]
    for i in range(n):
        m[i][i] += hold[i]
    beta = _solve(m, [sum(w * r[i] * v for r, v, w in zip(rows, y, weight)) for i in range(n)])
    return math.exp(sum(b * v for b, v in zip(beta, target)))


# ── the signal ────────────────────────────────────────────────────────────

NO_SIGNAL: dict[str, Any] = {
    # comps_count 0 is what tells the site there is no signal; the column itself cannot be empty
    "signal": "AT_MARKET", "comps_psf_usd": None, "comps_count": 0, "price_vs_comps_pct": None,
    "district_psf_usd": None, "price_vs_district_pct": None,
}


def score(rows: list[dict[str, Any]], texts: dict[str, str]) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    """
    Signals for active property_master rows. `texts`: description by source_url.
    Returns ({id: columns to write}, {id: why there is no signal}).
    """
    out: dict[str, dict[str, Any]] = {}
    why: dict[str, str] = {}
    live: list[Home] = []
    for r in rows:
        out[r["id"]] = dict(NO_SIGNAL)
        if group_of(r) is None:
            why[r["id"]] = "land or commercial"
        elif r["listing_status"] not in ("For sale", "Under contract"):
            why[r["id"]] = "sold or de-listed"
        elif not r.get("built_sqft"):
            why[r["id"]] = "no built size"
        else:
            live.append(Home(r, texts.get(r.get("source_url") or "", "")))
    mark_projects(live)

    for h in live:
        if h.row["listing_status"] != "For sale":
            why[h.id] = "under contract"
            continue
        if h.multi:
            why[h.id] = "several homes in one"
            continue
        if h.fixer:
            why[h.id] = "fixer-upper"
            continue
        others = [o for o in live if o.project != h.project and o.group == h.group and not o.multi]
        comps = nearest(h, others)
        if sum(km(h, c) <= NEAR_KM for c in comps) < MIN_NEAR:
            why[h.id] = "too few similar homes nearby"
            continue
        a = nearest_estimate(h, comps)
        b = model_estimate(h, others)
        gap_a, gap_b = h.price / a - 1, h.price / b - 1
        estimate = math.sqrt(a * b)
        if gap_a <= -THRESHOLD and gap_b <= -THRESHOLD:
            signal = "UNDERVALUED"
        elif gap_a >= THRESHOLD and gap_b >= THRESHOLD:
            signal = "OVERPRICED"
        else:
            signal = "AT_MARKET"
        out[h.id] = {
            **NO_SIGNAL,
            "signal": signal,
            "comps_psf_usd": round(estimate / h.size, 2),
            "comps_count": len(comps),
            "price_vs_comps_pct": round((h.price / estimate - 1) * 100, 2),
        }
    return out, why
