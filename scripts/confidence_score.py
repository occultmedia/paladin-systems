#!/usr/bin/env python3
"""
Nightly Confidence Score job for Terminal.

Reads every active listing in Supabase `property_master`, scores how likely it
is to still really be for sale (0-100) and overwrites `confidence_score`.
Same rules as src/lib/confidence.ts (keep the two in step):

  start at 100, clamp to 0..100
  -5   for every full week since the scraper last found it on its source site (last_scraped_at)
  -10  on the market over 180 days, -20 over 365 days
  -10  price unchanged for 120+ days, -15 for 240+ days

Archived listings (flagged delisted with the Kill Switch) stay at 0. If the
scraper still finds a flagged listing on its source site after the flag, the
flag is marked `disputed` so someone can review it.

Environment (set as secrets wherever the job runs, never committed):
  SUPABASE_URL                https://<project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY   service role key (this job writes to every row)

Usage:
  python3 scripts/confidence_score.py            # score and write
  python3 scripts/confidence_score.py --dry-run  # score and print, write nothing
  python3 scripts/confidence_score.py --self-test
Only the standard library is used.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timezone

MISSING_PER_WEEK = 5
DOM_SOFT = (180, 10)
DOM_HARD = (365, 20)
FLAT_SOFT = (120, 10)
FLAT_HARD = (240, 15)

PAGE = 1000
CHUNK = 150  # ids per PATCH


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    if len(value) == 10:  # a date
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def days_between(start: datetime, now: datetime) -> int:
    return max(0, (now - start).days)


def score(last_found: datetime, days_on_market: int, last_price_change: datetime, now: datetime) -> int:
    s = 100
    s -= (days_between(last_found, now) // 7) * MISSING_PER_WEEK
    if days_on_market > DOM_HARD[0]:
        s -= DOM_HARD[1]
    elif days_on_market > DOM_SOFT[0]:
        s -= DOM_SOFT[1]
    flat = days_between(last_price_change, now)
    if flat > FLAT_HARD[0]:
        s -= FLAT_HARD[1]
    elif flat > FLAT_SOFT[0]:
        s -= FLAT_SOFT[1]
    return max(0, min(100, s))


def score_row(row: dict, now: datetime) -> int:
    first_seen = parse_ts(row.get("first_seen")) or now
    # Trust the scraper's days_on_market, but never less than the age of the record.
    dom = max(int(row.get("days_on_market") or 0), days_between(first_seen, now))
    last_found = parse_ts(row.get("last_scraped_at")) or first_seen
    last_move = parse_ts(row.get("last_price_change_at")) or first_seen
    return score(last_found, dom, last_move, now)


# ── Supabase REST (PostgREST) ────────────────────────────────────────────────


class Supabase:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def _call(self, method: str, path: str, body: object | None = None, extra: dict | None = None):
        req = urllib.request.Request(
            self.base + path,
            method=method,
            data=None if body is None else json.dumps(body).encode(),
            headers={**self.headers, **(extra or {})},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                raw = res.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raise SystemExit(f"Supabase {method} {path.split('?')[0]} failed: {e.code} {e.read().decode(errors='replace')[:300]}")

    def select_all(self, table: str, query: str) -> list[dict]:
        rows: list[dict] = []
        start = 0
        while True:
            page = self._call("GET", f"/{table}?{query}", extra={"Range-Unit": "items", "Range": f"{start}-{start + PAGE - 1}"})
            rows.extend(page)
            if len(page) < PAGE:
                return rows
            start += PAGE

    def patch_ids(self, table: str, key: str, ids: list[str], values: dict, extra_filter: str = ""):
        for i in range(0, len(ids), CHUNK):
            chunk = ",".join('"' + x.replace('"', '""') + '"' for x in ids[i : i + CHUNK])
            q = f"{key}=in.({urllib.parse.quote(chunk, safe=',')}){extra_filter}"
            self._call("PATCH", f"/{table}?{q}", values, {"Prefer": "return=minimal"})


# ── job ──────────────────────────────────────────────────────────────────────


def run(dry_run: bool) -> int:
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: nothing to score. Skipping.")
        return 0
    db = Supabase(url, key)
    now = datetime.now(timezone.utc)
    stamp = now.isoformat()

    active = db.select_all(
        "property_master",
        "select=listing_id,first_seen,days_on_market,last_scraped_at,last_price_change_at,confidence_score&status=eq.active",
    )
    changes: dict[int, list[str]] = defaultdict(list)
    for row in active:
        new = score_row(row, now)
        if new != row.get("confidence_score"):
            changes[new].append(row["listing_id"])

    bands = Counter("high" if s >= 80 else "medium" if s >= 50 else "low" for s in (score_row(r, now) for r in active))
    print(f"{len(active)} active listings · high {bands['high']} · medium {bands['medium']} · low {bands['low']}")
    print(f"{sum(len(v) for v in changes.values())} scores changed")

    # Flags the scraper disagrees with: archived, yet found on the source site after the flag.
    archived = db.select_all("property_master", "select=listing_id,archived_at,last_scraped_at&status=eq.archived")
    disputed = [
        r["listing_id"]
        for r in archived
        if r.get("archived_at") and parse_ts(r["last_scraped_at"]) > parse_ts(r["archived_at"])
    ]
    print(f"{len(archived)} archived · {len(disputed)} still live on their source site (flag disputed)")

    if dry_run:
        for s in sorted(changes):
            print(f"  -> {s:3d}: {', '.join(changes[s][:8])}{' …' if len(changes[s]) > 8 else ''}")
        return 0

    for new, ids in changes.items():
        db.patch_ids("property_master", "listing_id", ids, {"confidence_score": new, "confidence_updated_at": stamp}, "&status=eq.active")
    if disputed:
        db.patch_ids("property_flags", "listing_id", disputed, {"disputed": True}, "&undone_at=is.null")
    print("Done.")
    return 0


def self_test() -> int:
    now = datetime(2026, 11, 15, 6, tzinfo=timezone.utc)
    d = lambda iso: parse_ts(iso)  # noqa: E731
    cases = [
        # (last found, dom, last price change, expected)
        (d("2026-11-15T06:00:00Z"), 10, d("2026-11-05"), 100),  # fresh
        (d("2026-10-25T06:00:00Z"), 40, d("2026-10-06"), 85),  # missing 3 weeks
        (d("2026-11-15T06:00:00Z"), 200, d("2026-05-01"), 80),  # 200 days on market, price flat 198 days
        (d("2026-11-15T06:00:00Z"), 400, d("2025-10-01"), 65),  # 400 days, flat 410 days
        (d("2025-01-01T00:00:00Z"), 700, d("2024-12-01"), 0),  # long gone
    ]
    ok = True
    for lf, dom, lp, want in cases:
        got = score(lf, dom, lp, now)
        ok &= got == want
        print(f"{'ok ' if got == want else 'BAD'} found {lf.date()} dom {dom} price {lp.date()} -> {got} (want {want})")
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    sys.exit(self_test() if a.self_test else run(a.dry_run))
