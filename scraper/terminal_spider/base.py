"""
BaseSpider: everything a Terminal spider needs except the site itself.

A site-specific spider (see kw_aruba.py, all_property_aruba.py) only answers
three questions:

    1. Which pages list the inventory?            start_urls
    2. What is on each listing card, and where
       is the next page of cards?                  parse_index() / next_page_url()
    3. What is on a listing's own page?            parse_detail()

This class does the rest, identically for every agency:

    - loads pages with the fast HTTP engine, or a real browser for sites that
      need one (engine = "browser"); see fetch.py;
    - reads robots.txt and honours its Disallow rules and Crawl-delay;
    - keeps requests to one site at least min_delay apart and backs off on
      errors. Different agencies run side by side, each at its own pace;
    - stops (does not try to get around it) if the site serves a bot challenge;
    - turns every listing into one standard record, hashes it, and upserts it
      into Supabase `raw_listings` on `source_url`, stamping `last_scraped_at`.

What keeps a nightly run short is opening few pages, not opening them faster:

    - unchanged card, read recently     only marked "still listed"
    - new listing or changed card       opened tonight
    - unchanged but read long ago       re-read in rotation: 1/refresh_days of
                                        the site per night, oldest first
    - sold and unchanged                never opened again
"""

from __future__ import annotations

import abc
import asyncio
import hashlib
import json
import logging
import math
import random
import time
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urljoin, urlparse

from .doc import Doc
from .fetch import BrowserEngine, HttpEngine
from .parsing import clean, parse_currency, parse_int, parse_number

log = logging.getLogger("terminal_spider")

# The columns of raw_listings this pipeline writes on a full read. Every full
# row carries all of them (PostgREST bulk upserts need the same keys per row).
FULL_COLUMNS = (
    "agency_id", "source_url", "source_listing_id", "raw_title", "raw_price", "raw_currency",
    "raw_beds", "raw_baths", "raw_built_area", "raw_lot_area", "raw_property_type", "raw_status",
    "raw_address", "raw_district", "raw_tenure", "raw_description", "raw_agent", "raw_photos",
    "raw_lat", "raw_lng", "raw_payload", "content_hash", "last_scraped_at", "last_run_id",
)


class SiteBlockedError(RuntimeError):
    """The site served a bot challenge or keeps refusing us. Stop, don't push."""


@dataclass
class SpiderStats:
    listings_found: int = 0       # listing cards seen on the index pages
    details_read: int = 0         # listing pages opened this run
    rows_new: int = 0
    rows_changed: int = 0
    rows_unchanged: int = 0
    index_failures: int = 0       # index pages that would not load
    seconds: float = 0.0
    field_misses: dict[str, int] = field(default_factory=dict)  # selector -> times it found nothing


@dataclass
class PreviousRow:
    """What raw_listings already holds for a URL (read once at the start of the run)."""
    content_hash: str
    card_hash: str | None
    detail_read_at: str | None


def sha256(data: Any) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def card_hash_of(card: dict[str, Any]) -> str:
    return sha256({k: v for k, v in card.items() if k != "index_pages"})


def num_text(value: float | int | None) -> str | None:
    """3900000.0 -> "3900000", 2.5 -> "2.5", None -> None (raw_* columns are text)."""
    if value is None:
        return None
    return str(int(value)) if float(value).is_integer() else str(value)


def clean_block(text: str | None, limit: int = 8000) -> str | None:
    """Trim a long text (a description), keeping its line breaks."""
    if not text:
        return None
    lines = [" ".join(line.split()) for line in text.splitlines()]
    out = "\n".join(line for line in lines if line).strip()
    return out[:limit] or None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ── the base class ─────────────────────────────────────────────────────────


class BaseSpider(abc.ABC):
    # ---- set these in every subclass -------------------------------------
    agency_id: str            # slug in the agencies table, e.g. "kw-aruba"
    agency_name: str          # "Keller Williams Aruba"
    website: str              # "https://kw-aruba.com"
    start_urls: list[str]     # index pages that list the inventory
    logo_url: str | None = None  # the agency's own logo, shown next to every listing

    # ---- optional tuning -------------------------------------------------
    engine: str = "http"            # "http", or "browser" when listings need scripts to appear
    min_delay: float = 2.0          # seconds between page loads; robots.txt Crawl-delay raises it
    jitter: float = 1.0             # up to this many random seconds on top
    max_pages_per_index: int = 50   # guard against pagination loops
    max_photos: int = 1             # only the main photo is kept (raw_photos[0])
    retries: int = 3

    def __init__(
        self,
        *,
        db: Any | None = None,                 # supabase Client, or None for a dry run
        run_id: int | None = None,             # scrape_runs.id this run writes into
        limit: int | None = None,              # stop after this many listings (testing)
        refresh_days: int = 7,                 # re-open unchanged listing pages after this many days
        start_urls: list[str] | None = None,   # override the subclass's index pages
        headless: bool = True,
    ) -> None:
        self.db = db
        self.run_id = run_id
        self.limit = limit
        self.refresh_days = refresh_days
        if start_urls:
            self.start_urls = start_urls
        self.headless = headless
        self.stats = SpiderStats()
        self.records: list[dict[str, Any]] = []  # what a dry run prints / saves
        self._robots: urllib.robotparser.RobotFileParser | None = None
        self._web: Any = None  # the open engine
        self._last_request = 0.0
        self.source_website = urlparse(self.website).netloc.removeprefix("www.")

    # ---- what each site implements ----------------------------------------

    @abc.abstractmethod
    def parse_index(self, page: Doc) -> list[dict[str, Any]]:
        """
        Read every listing card on an index page. Return one dict per card
        with at least {"source_url": ...}; anything else on the card (price
        text, beds, status label...) is used to tell whether the listing
        changed since the last run.
        """

    def next_page_url(self, page: Doc) -> str | None:
        """The next index page, or None on the last one."""
        return self.absolute(page.attr('a[rel="next"], .pagination a.next, .pagination__next a', "href"))

    @abc.abstractmethod
    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:
        """
        Read a listing page and return the standard record (see `normalise`).
        `card` is what parse_index() found for it, so the detail parser can
        fall back to the card when a field is missing.
        """

    async def prepare(self) -> None:
        """Optional: load anything shared by all listings (an agents page, a category list) with self.load()."""

    def is_closed(self, card: dict[str, Any]) -> bool:
        """True when the card says the listing is sold: it is not re-read while it stays that way."""
        return (card.get("label") or "").strip().lower() == "sold"

    # ---- helpers for spiders ------------------------------------------------

    def text(self, scope: Doc, selector: str, *, key: str | None = None) -> str | None:
        """Text of the first match; None (and counted as a miss) if absent."""
        value = scope.text(selector)
        if value is None:
            self._miss(key or selector)
        return value

    def absolute(self, href: str | None, base: str | None = None) -> str | None:
        return urljoin(base or self.website + "/", href) if href else None

    def _miss(self, key: str) -> None:
        self.stats.field_misses[key] = self.stats.field_misses.get(key, 0) + 1

    # ---- the standard record ------------------------------------------------

    def normalise(self, data: dict[str, Any]) -> dict[str, Any]:
        """
        Coerce what a spider returned into the standard record. Spiders may
        pass raw text or numbers; this makes the types right and fills gaps
        with None. Required by the brief:

            source_url      direct link to the property page
            source_website  e.g. "kw-aruba.com"
            raw_price       number, no currency symbol or separators (None = price on request)
            raw_beds        int
            raw_baths       float (2.5 = two full baths and a half bath)
            raw_address     the location or title of the property
        """
        price = data.get("raw_price")
        price_text = data.get("price_text") or (price if isinstance(price, str) else None)
        return {
            "source_url": data["source_url"],
            "source_website": self.source_website,
            "raw_price": price if isinstance(price, (int, float)) else parse_number(price_text),
            "raw_currency": data.get("raw_currency") or parse_currency(price_text),
            "price_text": clean(price_text),
            "raw_beds": data["raw_beds"] if isinstance(data.get("raw_beds"), int) else parse_int(data.get("raw_beds")),
            "raw_baths": float(data["raw_baths"]) if isinstance(data.get("raw_baths"), (int, float)) else parse_number(data.get("raw_baths")),
            "raw_address": clean(data.get("raw_address")),
            # Optional extras. The normaliser that builds property_master uses them.
            "source_listing_id": clean(data.get("source_listing_id")),
            "raw_title": clean(data.get("raw_title")),
            "raw_district": clean(data.get("raw_district")),
            "raw_property_type": clean(data.get("raw_property_type")),
            "raw_status": clean(data.get("raw_status")),
            "raw_built_area": clean(data.get("raw_built_area")),
            "raw_lot_area": clean(data.get("raw_lot_area")),
            "raw_tenure": clean(data.get("raw_tenure")),
            "raw_description": clean_block(data.get("raw_description")),
            "raw_agent": data.get("raw_agent") or None,
            "raw_photos": list(dict.fromkeys(data.get("raw_photos") or []))[: self.max_photos],
            "raw_lat": data.get("raw_lat"),
            "raw_lng": data.get("raw_lng"),
            "extra": data.get("extra") or {},
        }

    def to_row(self, rec: dict[str, Any], card_hash: str, seen_at: str, *, read: bool = True) -> dict[str, Any]:
        """The raw_listings row for a listing. read=False: only its card could be read; the next run tries its page again."""
        # The delta key: everything we read, minus timestamps. When this
        # changes, the database re-queues the listing for normalising.
        content_hash = sha256(rec)
        row = {
            "agency_id": self.agency_id,
            "source_url": rec["source_url"],
            "source_listing_id": rec["source_listing_id"],
            "raw_title": rec["raw_title"],
            # raw_* columns are text in the schema; numbers are stored as plain digits ("3900000").
            "raw_price": num_text(rec["raw_price"]),
            "raw_currency": rec["raw_currency"],
            "raw_beds": num_text(rec["raw_beds"]),
            "raw_baths": num_text(rec["raw_baths"]),
            "raw_built_area": rec["raw_built_area"],
            "raw_lot_area": rec["raw_lot_area"],
            "raw_property_type": rec["raw_property_type"],
            "raw_status": rec["raw_status"],
            "raw_address": rec["raw_address"],
            "raw_district": rec["raw_district"],
            "raw_tenure": rec["raw_tenure"],
            "raw_description": rec["raw_description"],
            "raw_agent": rec["raw_agent"],
            "raw_photos": rec["raw_photos"],
            "raw_lat": rec["raw_lat"],
            "raw_lng": rec["raw_lng"],
            "raw_payload": {
                "source_website": rec["source_website"],
                "price_text": rec["price_text"],         # as printed, e.g. "USD 3.900.000 (AWG 6.942.000)"
                "card_hash": card_hash,                  # tells the next run whether the card changed
                "detail_read_at": seen_at if read else None,
                **rec["extra"],
            },
            "content_hash": content_hash,
            "last_scraped_at": seen_at,
            "last_run_id": self.run_id,
        }
        assert tuple(row) == FULL_COLUMNS
        return row

    # ---- polite page loading ----------------------------------------------------

    async def _load_robots(self) -> None:
        """Read robots.txt once. If it can't be read, assume everything is allowed (the standard rule)."""
        rp = urllib.robotparser.RobotFileParser()
        try:
            page = await self._web.get(urljoin(self.website + "/", "robots.txt"))
            rp.parse(page.html.splitlines() if page.status < 400 else [])
        except Exception as exc:  # noqa: BLE001
            log.warning("[%s] robots.txt unreadable (%s); continuing with default delays", self.agency_id, exc)
            rp.parse([])
        self._robots = rp
        crawl_delay = rp.crawl_delay("*")
        if crawl_delay:
            self.min_delay = max(self.min_delay, float(crawl_delay))
        log.info("[%s] %s engine, %.0f-%.0f s between pages (robots.txt Crawl-delay: %s)", self.agency_id, self._web.name, self.min_delay, self.min_delay + self.jitter, crawl_delay)

    def allowed(self, url: str) -> bool:
        return self._robots is None or self._robots.can_fetch("*", url)

    async def _pause(self) -> None:
        """Keep requests to this site at least min_delay apart."""
        wait = self.min_delay + random.uniform(0, self.jitter) - (time.monotonic() - self._last_request)
        if wait > 0 and self._last_request:
            await asyncio.sleep(wait)

    async def load(self, url: str) -> Doc | None:
        """
        Load `url` politely. None when it could not be loaded (404, robots.txt
        forbids it, kept failing). Raises SiteBlockedError on a bot challenge
        or repeated 403/429.
        """
        if not self.allowed(url):
            log.info("[%s] robots.txt disallows %s; skipped", self.agency_id, url)
            return None
        status = 0
        for attempt in range(1, self.retries + 1):
            await self._pause()
            self._last_request = time.monotonic()
            try:
                page = await self._web.get(url)
                status = page.status
                if page.is_challenge:
                    raise SiteBlockedError(f"bot challenge on {url} ({page.title!r})")
                if status in (403, 429, 503):
                    backoff = 60 * attempt
                    log.warning("[%s] HTTP %s on %s; backing off %ss (%s/%s)", self.agency_id, status, url, backoff, attempt, self.retries)
                    await asyncio.sleep(backoff)
                    continue
                if status == 404:
                    return None
                if status >= 400:
                    raise RuntimeError(f"HTTP {status}")
                return Doc.parse(page.html)
            except SiteBlockedError:
                raise
            except Exception as exc:  # noqa: BLE001 - network blips, timeouts
                backoff = 15 * attempt
                log.warning("[%s] %s failed (%s); retry in %ss (%s/%s)", self.agency_id, url, exc, backoff, attempt, self.retries)
                await asyncio.sleep(backoff)
        if status in (403, 429, 503):
            raise SiteBlockedError(f"{url} keeps answering HTTP {status}")
        return None

    # ---- database ------------------------------------------------------------------

    # Spiders run side by side but share one database connection: one call at a time.
    _db_lock = asyncio.Lock()

    async def _db(self, fn):
        """supabase-py is synchronous; run its calls off the event loop."""
        async with self._db_lock:
            return await asyncio.to_thread(fn)

    async def _ensure_agency(self) -> None:
        """Make sure the agencies row exists (raw_listings.agency_id points at it). Keeps an existing logo."""
        if not self.db:
            return
        row = {"id": self.agency_id, "name": self.agency_name, "website": self.website, "is_active": True}
        if self.logo_url:
            row["logo_url"] = self.logo_url
        await self._db(lambda: self.db.table("agencies").upsert(row, on_conflict="id").execute())

    async def _previous_rows(self) -> dict[str, PreviousRow]:
        """Everything raw_listings already has for this agency, keyed by URL."""
        if not self.db:
            return {}
        out: dict[str, PreviousRow] = {}
        start = 0
        while True:
            res = await self._db(
                lambda s=start: self.db.table("raw_listings")
                .select("source_url,content_hash,card_hash:raw_payload->>card_hash,detail_read_at:raw_payload->>detail_read_at")
                .eq("agency_id", self.agency_id)
                .range(s, s + 999)
                .execute()
            )
            for r in res.data or []:
                out[r["source_url"]] = PreviousRow(r["content_hash"], r.get("card_hash"), r.get("detail_read_at"))
            if len(res.data or []) < 1000:
                return out
            start += 1000

    def _seen_row(self, url: str, prev: PreviousRow, seen_at: str) -> dict[str, Any]:
        """Still listed, nothing new: only the timestamps move."""
        return {
            "agency_id": self.agency_id,
            "source_url": url,
            "content_hash": prev.content_hash,
            "last_scraped_at": seen_at,
            "last_run_id": self.run_id,
        }

    async def _upsert(self, rows: list[dict[str, Any]]) -> None:
        """Upsert on source_url in batches. Rows in one call must share the same keys."""
        if not self.db or not rows:
            return
        for i in range(0, len(rows), 100):
            batch = rows[i : i + 100]
            await self._db(lambda b=batch: self.db.table("raw_listings").upsert(b, on_conflict="source_url").execute())

    # ---- the run ----------------------------------------------------------------------

    def _age(self, prev: PreviousRow) -> timedelta:
        try:
            return datetime.now(timezone.utc) - datetime.fromisoformat(prev.detail_read_at or "")
        except ValueError:
            return timedelta.max

    async def _collect_cards(self) -> list[dict[str, Any]]:
        """Walk every index page (following next_page_url) and gather unique cards."""
        cards: dict[str, dict[str, Any]] = {}
        for start in self.start_urls:
            url: str | None = start
            visited: set[str] = set()
            while url and url not in visited and len(visited) < self.max_pages_per_index:
                visited.add(url)
                page = await self.load(url)
                if page is None:
                    log.warning("[%s] index page did not load: %s", self.agency_id, url)
                    self.stats.index_failures += 1
                    break
                found = self.parse_index(page)
                if len(visited) > 1 and found and all(c["source_url"] in cards for c in found):
                    # "page 2" that repeats page 1: part of the inventory would be missed without a word
                    log.warning("[%s] %s repeats listings already seen; paging may be broken", self.agency_id, url)
                    self.stats.index_failures += 1
                    break
                for card in found:
                    known = cards.setdefault(card["source_url"], card)
                    # the same listing can be on two index pages (e.g. Condo and New development)
                    known.setdefault("index_pages", []).append(url)
                log.info("[%s] %s: %s listings", self.agency_id, url, len(found))
                url = self.next_page_url(page)
        return list(cards.values())

    def _plan(self, cards: list[dict[str, Any]], previous: dict[str, PreviousRow]) -> list[dict[str, Any]]:
        """The cards whose page is opened this run (see the module docstring)."""
        must, due = [], []
        for card in cards:
            prev = previous.get(card["source_url"])
            if prev is None or not prev.detail_read_at or prev.card_hash != card_hash_of(card):
                must.append(card)
            elif not self.is_closed(card) and self._age(prev) > timedelta(days=self.refresh_days):
                due.append(card)
        due.sort(key=lambda c: previous[c["source_url"]].detail_read_at or "")
        tonight = due[: math.ceil(len(cards) / max(1, self.refresh_days))]
        log.info(
            "[%s] %s listings: %s new or changed, %s of %s due for a re-read, %s sold or recent",
            self.agency_id, len(cards), len(must), len(tonight), len(due), len(cards) - len(must) - len(tonight),
        )
        return must + tonight

    async def run(self) -> SpiderStats:
        """Crawl the site and write raw_listings. Returns the run's counters."""
        began = time.monotonic()
        await self._ensure_agency()
        previous = await self._previous_rows()

        async with (BrowserEngine(self.headless) if self.engine == "browser" else HttpEngine()) as web:
            self._web = web
            await self._load_robots()
            await self.prepare()
            cards = await self._collect_cards()
            self.stats.listings_found = len(cards)
            if self.limit:
                cards = cards[: self.limit]
            plan = self._plan(cards, previous)
            log.info("[%s] opening %s pages, about %.0f min", self.agency_id, len(plan), len(plan) * (self.min_delay + self.jitter / 2) / 60)

            seen_at = now_iso()
            opening = {c["source_url"] for c in plan}
            seen_rows = [self._seen_row(c["source_url"], previous[c["source_url"]], seen_at) for c in cards if c["source_url"] not in opening]
            self.stats.rows_unchanged += len(seen_rows)
            await self._upsert(seen_rows)

            full_rows: list[dict[str, Any]] = []
            for n, card in enumerate(plan, 1):
                url = card["source_url"]
                prev = previous.get(url)
                data: dict[str, Any] | None = None
                page = await self.load(url)
                if page is None:
                    log.warning("[%s] listing page did not load: %s", self.agency_id, url)
                else:
                    try:
                        data = self.parse_detail(page, card)
                        self.stats.details_read += 1
                    except Exception as exc:  # noqa: BLE001 - one bad page never stops the run
                        log.exception("[%s] could not read %s: %s", self.agency_id, url, exc)
                if data is None and prev is not None:
                    # Keep what we read before; it is still on the index, and the next run tries again.
                    self.stats.rows_unchanged += 1
                    await self._upsert([self._seen_row(url, prev, seen_at)])
                    continue
                read = data is not None
                data = {**card} if data is None else data
                data["source_url"] = url
                rec = self.normalise(data)
                row = self.to_row(rec, card_hash_of(card), seen_at, read=read)
                self.records.append(rec)

                if prev is None:
                    self.stats.rows_new += 1
                elif prev.content_hash != row["content_hash"]:
                    self.stats.rows_changed += 1
                else:
                    self.stats.rows_unchanged += 1
                full_rows.append(row)
                log.info("[%s] %s/%s %s | %s %s | %s bd %s ba", self.agency_id, n, len(plan), rec["raw_address"], rec["raw_currency"], rec["raw_price"], rec["raw_beds"], rec["raw_baths"])

                # Write as we go, so a crash halfway keeps what was read.
                if len(full_rows) >= 25:
                    await self._upsert(full_rows)
                    full_rows = []
            await self._upsert(full_rows)
        self.stats.seconds = time.monotonic() - began

        if self.stats.field_misses:
            log.info("[%s] fields not found (selector: times): %s", self.agency_id, self.stats.field_misses)
        return self.stats
