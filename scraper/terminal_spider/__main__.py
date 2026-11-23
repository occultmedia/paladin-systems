"""
Run the spider fleet.

    python -m terminal_spider                       # every spider, write to Supabase
    python -m terminal_spider kw-aruba              # one agency
    python -m terminal_spider kw-aruba --dry-run --limit 3
                                                    # read 3 listings, print them, write nothing

Environment (scraper/.env, never committed; or the job runner's secrets):
    SUPABASE_URL           https://<project>.supabase.co
    SUPABASE_SERVICE_KEY   the service_role key. Server-side only: it bypasses
                           row-level security. Never put it in Vercel or the frontend.
                           (SUPABASE_SERVICE_ROLE_KEY is accepted too.)

One nightly run = one row in scrape_runs, shared by every spider in the run.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import SPIDERS, SiteBlockedError, SpiderStats

log = logging.getLogger("terminal_spider")


def key_role(key: str) -> str | None:
    """'publishable' / 'secret' for the new sb_ keys; the JWT role claim for legacy keys."""
    if key.startswith("sb_publishable_"):
        return "publishable"
    if key.startswith("sb_secret_"):
        return "secret"
    try:
        import base64

        payload = key.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))).get("role")
    except Exception:  # noqa: BLE001
        return None


def make_client():
    """Supabase client with the service key, or exit with a clear message."""
    try:
        from dotenv import load_dotenv

        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    except ImportError:
        pass
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY (see scraper/README.md), or use --dry-run.")
    if key_role(key) in ("anon", "publishable"):
        sys.exit("SUPABASE_SERVICE_KEY is the public anon/publishable key. The spider needs the service_role (secret) key.")
    from supabase import create_client

    return create_client(url, key)


async def main() -> int:
    ap = argparse.ArgumentParser(prog="terminal_spider", description="Terminal Level 1 ingestion spiders")
    ap.add_argument("spiders", nargs="*", help=f"which agencies (default: all). Known: {', '.join(SPIDERS)}")
    ap.add_argument("--dry-run", action="store_true", help="read the site but write nothing to Supabase")
    ap.add_argument("--limit", type=int, help="stop after this many listings per agency (testing)")
    ap.add_argument("--start-url", action="append", help="only crawl this index page (repeatable)")
    ap.add_argument("--refresh-days", type=int, default=7, help="re-open unchanged listing pages after N days (default 7)")
    ap.add_argument("--out", help="dry run: save the records to this JSON file")
    ap.add_argument("--headed", action="store_true", help="show the browser window")
    ap.add_argument("--no-normalise", action="store_true", help="only fill raw_listings; skip the normaliser")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    names = args.spiders or list(SPIDERS)
    unknown = [n for n in names if n not in SPIDERS]
    if unknown:
        ap.error(f"unknown spider(s): {', '.join(unknown)}. Known: {', '.join(SPIDERS)}")

    db = None if args.dry_run else make_client()
    run_id = None
    if db:
        run = db.table("scrape_runs").insert({"status": "running", "sources_checked": len(names)}).execute()
        run_id = run.data[0]["id"]
        log.info("scrape run #%s started", run_id)

    totals = SpiderStats()
    errors: list[str] = []
    records: list[dict] = []
    for name in names:
        spider = SPIDERS[name](db=db, run_id=run_id, limit=args.limit, refresh_days=args.refresh_days, start_urls=args.start_url, headless=not args.headed)
        try:
            stats = await spider.run()
        except SiteBlockedError as exc:
            # Never fight a block: log it, move on to the next agency, look at it by hand.
            errors.append(f"{name}: blocked ({exc})")
            log.error("[%s] stopped: %s", name, exc)
            continue
        except Exception as exc:  # noqa: BLE001 - one agency failing never stops the others
            errors.append(f"{name}: {exc}")
            log.exception("[%s] failed", name)
            continue
        finally:
            records.extend(spider.records)
        log.info(
            "[%s] done: %s found, %s pages read, %s new, %s changed, %s unchanged",
            name, stats.listings_found, stats.details_read, stats.rows_new, stats.rows_changed, stats.rows_unchanged,
        )
        totals.listings_found += stats.listings_found
        totals.rows_new += stats.rows_new
        totals.rows_changed += stats.rows_changed
        totals.rows_unchanged += stats.rows_unchanged

    if db and run_id:
        db.table("scrape_runs").update({
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "status": "failed" if errors and len(errors) == len(names) else "succeeded",
            "listings_checked": totals.listings_found,
            "rows_new": totals.rows_new,
            "rows_changed": totals.rows_changed,
            "rows_unchanged": totals.rows_unchanged,
            "error": "; ".join(errors)[:2000] or None,
        }).eq("id", run_id).execute()

    # Level 2: move what changed tonight into property_master (the dashboard).
    if db and not args.no_normalise:
        from .normalise import Normaliser

        try:
            Normaliser(db).run()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"normaliser: {exc}")
            log.exception("normaliser failed")

    if args.dry_run:
        if args.out:
            Path(args.out).write_text(json.dumps(records, indent=2, ensure_ascii=False))
            log.info("saved %s records to %s", len(records), args.out)
        else:
            print(json.dumps(records, indent=2, ensure_ascii=False))

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
