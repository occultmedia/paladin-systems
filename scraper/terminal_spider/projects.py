"""
Building projects: condo buildings and new developments whose units are
listed separately (often by several agencies), grouped so the map shows one
pin and the list one card ("From $X · N units") for the whole project.

Runs after the normaliser (python -m terminal_spider.projects). Writes
`projects` and `property_master.project_id`; nothing else.

Two listings are in one project when they are flats (condo, apartment,
townhouse, penthouse) and
  - share a word of the project's name that is not a place ("Aquila" in
    "L'Aquila Residences - Eagle Beach") and stand within 150 m, or
  - carry exactly the same project name words and stand within 400 m
    (agencies without a printed pin place a project's units a little apart).
Houses are left alone: "Villa Nassau" in Caribbean Town is a model sold many
times over on different plots, not one building. A project needs 2 units.

A project keeps its id from run to run (the id most of its units already
carry), so links and watchlists that point at it stay valid.
"""

from __future__ import annotations

import argparse
import logging
import re
from collections import Counter
from typing import Any

from .normalise import MARKET_ID, PLACE_WORDS, _all, distance_m, project_key

log = logging.getLogger(__name__)

PROJECT_TYPES = {"Condo", "Apartment", "Townhouse", "Penthouse"}
NEAR_SHARED_WORD_M = 150
NEAR_SAME_NAME_M = 400
MIN_UNITS = 2


def _key(name: str) -> frozenset[str]:
    return frozenset(project_key(name) - PLACE_WORDS)


def group(rows: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Projects (2+ units) among master rows."""
    flats = [r for r in rows if r.get("asset_class") == "Property" and r.get("property_type") in PROJECT_TYPES and _key(r["asset_name"])]
    parent = list(range(len(flats)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    keys = [_key(r["asset_name"]) for r in flats]
    for i, a in enumerate(flats):
        for j in range(i):
            b = flats[j]
            shared = keys[i] & keys[j]
            if not shared or max(map(len, shared)) < 4:
                continue
            d = distance_m(a["lat"], a["lng"], b["lat"], b["lng"])
            if (d <= NEAR_SHARED_WORD_M) or (keys[i] == keys[j] and d <= NEAR_SAME_NAME_M):
                parent[find(i)] = find(j)
    out: dict[int, list[dict[str, Any]]] = {}
    for i, r in enumerate(flats):
        out.setdefault(find(i), []).append(r)
    return [g for g in out.values() if len(g) >= MIN_UNITS]


TOKEN = re.compile(r"[0-9A-Za-zÀ-ÿ’']+")
# Words that belong to a project's name when every unit has them ("The Reef", "Eagle Condos").
NAME_WORDS = {"the", "residences", "residence", "condos", "condominiums", "condominium", "gardens", "beach", "resort", "towers",
              "tower", "village", "suites", "club", "plaza", "place", "estates", "park", "bay", "point", "hills", "heights", "town", "house"}


def name_of(units: list[dict[str, Any]]) -> str:
    """
    A project's name: its name words plus the name words around them that
    most units share (numbers: every unit) ("The Reef 2B", "The Reef 5C" -> "The Reef"; "Luxury Condo
    Waykiri C-08", "Waykiri C12" -> "Waykiri"; "Single 1 Residences"). The
    most common such name wins.
    """
    keys = [project_key(u["asset_name"]) for u in units]
    shared = set.intersection(*keys) or set.union(*keys)
    toks = [TOKEN.findall(u["asset_name"]) for u in units]
    has = Counter(x for ts in toks for x in {t.lower() for t in ts})

    def joins(t: str) -> bool:
        # name words most units share; numbers only when every unit has them
        x = t.lower()
        if project_key(t) & shared:
            return True
        return has[x] == len(units) if x.isdigit() else x in NAME_WORDS and has[x] >= 0.6 * len(units)

    names = Counter()
    for ts in toks:
        i = next((k for k, t in enumerate(ts) if project_key(t) & shared), None)
        if i is None:
            continue
        lo, hi = i, i
        while lo > 0 and joins(ts[lo - 1]):
            lo -= 1
        while hi + 1 < len(ts) and joins(ts[hi + 1]):
            hi += 1
        names[" ".join(ts[lo : hi + 1]).replace("'", "’")] += 1
    if not names:
        return min((u["asset_name"] for u in units), key=len)
    return max(names.items(), key=lambda kv: (kv[1], -len(kv[0])))[0]


def run(db: Any, *, dry_run: bool = False) -> dict[str, int]:
    rows = _all(lambda: db.table("property_master").select(
        "id,listing_id,asset_class,property_type,asset_name,district,lat,lng,project_id").eq("status", "active").order("id"))
    groups = group(rows)
    stats = {"projects": len(groups), "units": sum(map(len, groups)), "linked": 0, "unlinked": 0, "created": 0, "removed": 0}
    want: dict[str, str | None] = {r["id"]: None for r in rows}
    keep: set[str] = set()
    for units in groups:
        held = Counter(u["project_id"] for u in units if u.get("project_id"))
        pid = next((p for p, _ in held.most_common() if p not in keep), None)
        info = {
            "market_id": MARKET_ID,
            "name": name_of(units),
            "district": Counter(u["district"] for u in units).most_common(1)[0][0],
            "lat": sum(u["lat"] for u in units) / len(units),
            "lng": sum(u["lng"] for u in units) / len(units),
        }
        log.info("project %s: %s units (%s)", info["name"], len(units), ", ".join(u["listing_id"] for u in units))
        if not dry_run:
            if pid:
                db.table("projects").update(info).eq("id", pid).execute()
            else:
                pid = db.table("projects").insert(info).execute().data[0]["id"]
                stats["created"] += 1
        pid = pid or f"dry-{len(keep)}"
        keep.add(pid)
        for u in units:
            want[u["id"]] = pid
    for r in rows:
        if r.get("project_id") != want[r["id"]]:
            stats["linked" if want[r["id"]] else "unlinked"] += 1
            if not dry_run:
                db.table("property_master").update({"project_id": want[r["id"]]}).eq("id", r["id"]).execute()
    if not dry_run:
        stale = [p["id"] for p in _all(lambda: db.table("projects").select("id").order("id")) if p["id"] not in keep]
        for p in stale:
            # projects of de-listed units only stay until nothing points at them
            if not db.table("property_master").select("id").eq("project_id", p).limit(1).execute().data:
                db.table("projects").delete().eq("id", p).execute()
                stats["removed"] += 1
    log.info("projects: %s", ", ".join(f"{k} {v}" for k, v in stats.items()))
    return stats


def main() -> int:
    from .__main__ import make_client

    ap = argparse.ArgumentParser(prog="terminal_spider.projects", description="group flats into building projects")
    ap.add_argument("--dry-run", action="store_true", help="print the projects, write nothing")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    run(make_client(), dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
