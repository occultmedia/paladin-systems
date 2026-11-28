"""
Notary auctions, nightly (02:00 AST, see .github/workflows/notary-auctions-nightly.yml):

    python -m terminal_spider.notary                 # all five offices, then the alert check
    python -m terminal_spider.notary newleaf-notary  # one office
    python -m terminal_spider.notary --dry-run       # read the sites, print, write nothing
    python -m terminal_spider.notary --alerts-only   # only queue and send alerts

Offices run one after another (each politely, 4 s or more between pages).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

from . import NOTARY_SPIDERS, alerts, pipeline
from .sites import HelmeyerNotary

log = logging.getLogger("terminal_spider.notary")


async def crawl(names: list[str], db, dry_run: bool) -> list[dict]:
    out = []
    if db:
        HelmeyerNotary.known = {r["source_url"] for r in db.table("notary_auctions").select("source_url").eq("notary_slug", HelmeyerNotary.slug).execute().data or []}
    for name in names:
        cls = NOTARY_SPIDERS[name]
        if not cls.enabled:
            log.info("[%s] switched off", name)
            continue
        spider = cls(db=None)
        try:
            notices = await spider.collect()
        except Exception as exc:  # noqa: BLE001 - one office failing must not stop the others
            log.exception("[%s] failed: %s", name, exc)
            out.append({"office": name, "error": str(exc)})
            continue
        stats = await asyncio.to_thread(pipeline.store, db, name, notices, spider.ok, dry_run=dry_run)
        out.append({"office": name, "site_loaded": spider.ok, **stats})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(prog="terminal_spider.notary", description="Aruba notary auctions for Baseline Pro")
    ap.add_argument("offices", nargs="*", help=f"default: all. Known: {', '.join(NOTARY_SPIDERS)}")
    ap.add_argument("--dry-run", action="store_true", help="read the sites, write nothing")
    ap.add_argument("--alerts-only", action="store_true", help="skip the crawl; queue and send alerts")
    ap.add_argument("--no-alerts", action="store_true", help="crawl only")
    ap.add_argument("--out", help="dry run: save the rows to this JSON file")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    names = args.offices or list(NOTARY_SPIDERS)
    unknown = [n for n in names if n not in NOTARY_SPIDERS]
    if unknown:
        sys.exit(f"Unknown office(s): {', '.join(unknown)}")
    db = None
    if not args.dry_run:
        from ..__main__ import make_client

        db = make_client()

    if not args.alerts_only:
        results = asyncio.run(crawl(names, db, args.dry_run))
        if db:
            done = pipeline.settle_past(db)
            log.info("auctions now past their date: %s", done)
        for r in results:
            rows = r.pop("rows", None)
            log.info("%s", json.dumps(r))
            if args.out and rows is not None:
                r["rows"] = rows
        if args.out:
            with open(args.out, "w") as f:
                json.dump(results, f, indent=1, default=str)
    if db and not args.no_alerts:
        new = alerts.queue(db)
        log.info("alerts queued: %s new; %s", new, alerts.send(db))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
