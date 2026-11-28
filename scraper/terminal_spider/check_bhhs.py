"""
Dry-run check of the BHHS Aruba spider: reads 20 listings and writes nothing.

    cd scraper && .venv/bin/python -m terminal_spider.check_bhhs            # 20 listings
    cd scraper && .venv/bin/python -m terminal_spider.check_bhhs --n 30 --out bhhs.json

The 20 are not simply the first 20 cards (those are the most expensive, and
"USD 0" sorts last): the check takes the cards that test the tricky cases
first, then fills up in index order:
  - a "USD 0" price (price upon request)  -> raw_price None, extra.price_on_request
  - a size with a thousands dot ("1.332 M2") -> 1332 m²
  - each status badge: Sold, Under contract, Sale in Progress, On Hold, Price Reduced, Rented
It prints one line per listing, then PASS/FAIL per rule, and exits 1 on a failure.
The site is read at the spider's own pace (robots.txt honoured, 4-5 s a page).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
from typing import Any

from .bhhs_aruba import BhhsArubaSpider

WANTED = ["USD 0", "dotted size", "sold", "under contract", "sale in progress", "on hold", "price reduced", "rented"]


def traits(card: dict[str, Any]) -> set[str]:
    out = {(card.get("label") or "").lower()}
    if re.search(r"USD\s*0\s*$", card.get("list_price") or ""):
        out.add("USD 0")
    if re.search(r"\d\.\d{3}", f"{card.get('lot') or ''} {card.get('built') or ''}"):
        out.add("dotted size")
    return out


class CheckSpider(BhhsArubaSpider):
    n = 20

    async def _collect_cards(self) -> list[dict[str, Any]]:
        cards = await super()._collect_cards()
        picked: list[dict[str, Any]] = []
        for want in WANTED:
            c = next((c for c in cards if want in traits(c) and c not in picked), None)
            if c:
                picked.append(c)
        picked += [c for c in cards if c not in picked][: max(0, self.n - len(picked))]
        return picked[: self.n]


def check(cards: dict[str, dict[str, Any]], records: list[dict[str, Any]]) -> list[tuple[str, bool, str]]:
    results = []
    by_url = {r["source_url"]: r for r in records}

    def each(name: str, pick, ok) -> None:
        cases = [(cards[u], r) for u, r in by_url.items() if u in cards and pick(cards[u])]
        if not cases:
            results.append((name, True, "no such listing in this sample"))
            return
        bad = [c["source_url"] for c, r in cases if not ok(c, r)]
        results.append((name, not bad, f"{len(cases) - len(bad)}/{len(cases)} ok" + (f"; wrong: {bad[:3]}" if bad else "")))

    each("USD 0 -> no price, price on request", lambda c: "USD 0" in traits(c),
         lambda c, r: r["raw_status"] == "Skipped" or (r["raw_price"] is None and r["extra"].get("price_on_request") is True))
    each("1.332 M2 -> 1332 m²", lambda c: "dotted size" in traits(c),
         lambda c, r: r["raw_status"] == "Skipped" or any(
             a and int(re.sub(r"[.,]", "", re.search(r"\d[\d.]*", src).group(0))) == int(re.search(r"\d+", a).group(0))
             for src, a in ((c.get("lot") or "", r["raw_lot_area"]), (c.get("built") or "", r["raw_built_area"])) if src and re.search(r"\d\.\d{3}", src)))
    each("Sold -> Sold", lambda c: (c.get("label") or "").lower() == "sold", lambda c, r: r["raw_status"] == "Sold")
    each("Under contract / Sale in Progress / On Hold -> Under contract",
         lambda c: (c.get("label") or "").lower() in ("under contract", "sale in progress", "on hold"), lambda c, r: r["raw_status"] == "Under contract")
    each("Price Reduced -> flagged", lambda c: (c.get("label") or "").lower() == "price reduced",
         lambda c, r: r["extra"].get("price_reduced_badge") is True and r["raw_status"] == "For sale")
    each("Rented -> skipped", lambda c: (c.get("label") or "").lower() == "rented", lambda c, r: r["raw_status"] == "Skipped")
    each("every sale has a pin, a photo and an agent", lambda c: (c.get("label") or "").lower() != "rented",
         lambda c, r: r["raw_status"] == "Skipped" or (r["raw_lat"] is not None and bool(r["raw_photos"]) and bool(r["raw_agent"])))
    return results


async def main() -> int:
    ap = argparse.ArgumentParser(prog="terminal_spider.check_bhhs")
    ap.add_argument("--n", type=int, default=20, help="how many listings to read (default 20)")
    ap.add_argument("--out", help="save the parsed records to this JSON file")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    CheckSpider.n = args.n
    spider = CheckSpider(db=None, run_id=None, limit=None, refresh_days=7, start_urls=None, headless=True)  # db=None: writes nothing
    cards_seen: dict[str, dict[str, Any]] = {}
    orig = spider._collect_cards

    async def remember() -> list[dict[str, Any]]:
        picked = await orig()
        cards_seen.update({c["source_url"]: c for c in picked})
        return picked

    spider._collect_cards = remember  # type: ignore[method-assign]
    await spider.run()
    recs = spider.records

    print(f"\n{'badge':<18} {'status':<15} {'price':>12} {'beds':>4} {'baths':>5} {'built':>8} {'lot':>9}  {'district':<14} title")
    for r in recs:
        c = cards_seen.get(r["source_url"], {})
        print(f"{(c.get('label') or '-')[:18]:<18} {r['raw_status'] or '-':<15} {('POA' if r['extra'].get('price_on_request') else r['raw_price'] or '-')!s:>12} "
              f"{r['raw_beds'] if r['raw_beds'] is not None else '-':>4} {r['raw_baths'] if r['raw_baths'] is not None else '-':>5} "
              f"{r['raw_built_area'] or '-':>8} {r['raw_lot_area'] or '-':>9}  {(r['raw_district'] or '-')[:14]:<14} {(r['raw_title'] or r['source_url'])[:50]}")
    print()
    results = check(cards_seen, recs)
    for name, ok, note in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}: {note}")
    if args.out:
        with open(args.out, "w") as f:
            json.dump(recs, f, indent=1, ensure_ascii=False, default=str)
        print(f"saved {len(recs)} records to {args.out}")
    return 0 if all(ok for _, ok, _ in results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
