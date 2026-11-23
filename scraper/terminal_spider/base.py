"""
BaseSpider: everything a Terminal spider needs except the site itself.

A site-specific spider (see kw_aruba.py) only answers three questions:

    1. Which pages list the inventory?            start_urls
    2. What is on each listing card, and where
       is the next page of cards?                  parse_index() / next_page_url()
    3. What is on a listing's own page?            parse_detail()

This class does the rest, identically for every agency:

    - opens Playwright (Chromium) with a rotating desktop user agent, a random
      window size and normal browser headers;
    - reads the site's robots.txt and honours its Disallow rules and its
      Crawl-delay (KW Aruba asks for 20 seconds between requests);
    - waits a random interval between page loads and backs off on errors;
    - stops (does not try to get around it) if the site serves a bot challenge;
    - turns every listing into one standard record, hashes it, and upserts it
      into Supabase `raw_listings` on `source_url`, stamping `last_scraped_at`.

Politeness also saves work: a listing's own page is only re-opened when its
card on the index page changed (price, status, beds...) or the last full read
is older than `refresh_days`. Listings that are still there but unchanged
just get `last_scraped_at` bumped, which is what keeps their Confidence
Score up.
"""

from __future__ import annotations

import abc
import asyncio
import hashlib
import json
import logging
import random
import time
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urljoin, urlparse

from playwright.async_api import Browser, BrowserContext, Locator, Page, Response, async_playwright

from .parsing import clean, parse_currency, parse_int, parse_number

log = logging.getLogger("terminal_spider")

# ── browser emulation ──────────────────────────────────────────────────────

# Desktop Chrome / Edge on the three platforms agents and investors use. The
# version is filled in at run time from the Chromium that Playwright ships,
# so the user agent always matches the engine actually rendering the page.
USER_AGENT_TEMPLATES = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Safari/537.36 Edg/{v}.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Safari/537.36",
]

# Common laptop and desktop window sizes; one is picked per run.
VIEWPORTS = [(1280, 800), (1366, 768), (1440, 900), (1536, 864), (1680, 1050), (1920, 1080)]

# Sent with every request, like a normal English-language browser.
EXTRA_HEADERS = {
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
}

# Things a listing page does not need to be read. Not downloading them is
# faster for us and lighter on the agency's server.
BLOCKED_RESOURCES = {"image", "media", "font"}

# Pages that mean "you look like a bot". We stop the run instead of trying
# to get past them.
CHALLENGE_MARKERS = ("Just a moment...", "Attention Required!", "cf-challenge", "captcha")

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
    field_misses: dict[str, int] = field(default_factory=dict)  # selector -> times it found nothing


@dataclass
class PreviousRow:
    """What raw_listings already holds for a URL (read once at the start of the run)."""
    content_hash: str
    card_hash: str | None
    detail_read_at: str | None


def sha256(data: Any) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


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

    # ---- optional tuning -------------------------------------------------
    min_delay: float = 6.0    # seconds between page loads (raised to robots.txt Crawl-delay)
    max_delay: float = 12.0
    max_pages_per_index: int = 50   # guard against pagination loops
    max_photos: int = 1             # only the main photo is kept (raw_photos[0])
    page_timeout_ms: int = 45_000
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
        self._last_request = 0.0
        self.source_website = urlparse(self.website).netloc.removeprefix("www.")

    # ---- what each site implements ----------------------------------------

    @abc.abstractmethod
    async def parse_index(self, page: Page) -> list[dict[str, Any]]:
        """
        Read every listing card on the index page that is open in `page`.
        Return one dict per card with at least {"source_url": ...}; anything
        else on the card (price text, beds, status label...) is used to tell
        whether the listing changed since the last run.
        """

    @abc.abstractmethod
    async def next_page_url(self, page: Page) -> str | None:
        """The next index page after the one open in `page`, or None on the last page."""

    @abc.abstractmethod
    async def parse_detail(self, page: Page, card: dict[str, Any]) -> dict[str, Any]:
        """
        Read the listing page open in `page` and return the standard record
        (see `normalise`). `card` is what parse_index() found for it, so the
        detail parser can fall back to the card when a field is missing.
        """

    # ---- safe DOM helpers (a missing element gives None, never an exception) ----

    async def text(self, scope: Page | Locator, selector: str, *, key: str | None = None) -> str | None:
        """Text of the first match of `selector`, cleaned; None if absent.

        Uses textContent, not innerText: the text as written in the page, not
        as styled (KW uppercases districts with CSS), and it also works inside
        hidden tabs."""
        try:
            loc = scope.locator(selector).first
            if await loc.count() == 0:
                self._miss(key or selector)
                return None
            return clean(await loc.text_content(timeout=2_000))
        except Exception as exc:  # noqa: BLE001 - any DOM failure is just "no value"
            log.debug("text(%s) failed: %s", selector, exc)
            self._miss(key or selector)
            return None

    async def texts(self, scope: Page | Locator, selector: str) -> list[str]:
        """Texts of every match of `selector` (empty list if none)."""
        try:
            return [t for t in (clean(x) for x in await scope.locator(selector).all_text_contents()) if t]
        except Exception as exc:  # noqa: BLE001
            log.debug("texts(%s) failed: %s", selector, exc)
            return []

    async def attr(self, scope: Page | Locator, selector: str, name: str) -> str | None:
        """Attribute `name` of the first match of `selector`; None if absent."""
        try:
            loc = scope.locator(selector).first
            if await loc.count() == 0:
                return None
            return clean(await loc.get_attribute(name, timeout=2_000))
        except Exception as exc:  # noqa: BLE001
            log.debug("attr(%s, %s) failed: %s", selector, name, exc)
            return None

    async def attrs(self, scope: Page | Locator, selector: str, name: str) -> list[str]:
        """Attribute `name` of every match of `selector`."""
        try:
            values = await scope.locator(selector).evaluate_all(f"els => els.map(e => e.getAttribute({json.dumps(name)}))")
            return [v for v in (clean(x) for x in values) if v]
        except Exception as exc:  # noqa: BLE001
            log.debug("attrs(%s, %s) failed: %s", selector, name, exc)
            return []

    async def block_text(self, scope: Page | Locator, selector: str) -> str | None:
        """Readable text of a rich-text block (description), one line per heading, paragraph or bullet.
        Works on hidden tabs, where innerText would run everything together."""
        try:
            loc = scope.locator(selector).first
            if await loc.count() == 0:
                self._miss(selector)
                return None
            return await loc.evaluate(
                """el => {
                    // textContent, but with <br> kept as a line break
                    const text = n => Array.from(n.childNodes).map(c =>
                        c.nodeName === 'BR' ? '\\n' : c.nodeType === 3 ? c.textContent : text(c)).join('');
                    const parts = Array.from(el.querySelectorAll('h1,h2,h3,h4,h5,p,li,td'))
                        .filter(e => !e.querySelector('p,li'))
                        .map(e => text(e).split('\\n').map(l => l.replace(/\\s+/g, ' ').trim()).filter(Boolean).join('\\n'))
                        .filter(Boolean);
                    return parts.length ? parts.join('\\n') : el.textContent;
                }"""
            )
        except Exception as exc:  # noqa: BLE001
            log.debug("block_text(%s) failed: %s", selector, exc)
            self._miss(selector)
            return None

    def absolute(self, href: str | None) -> str | None:
        return urljoin(self.website + "/", href) if href else None

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

    def to_row(self, rec: dict[str, Any], card_hash: str, seen_at: str) -> dict[str, Any]:
        """The raw_listings row for a fully read listing."""
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
                "detail_read_at": seen_at,
                **rec["extra"],
            },
            "content_hash": content_hash,
            "last_scraped_at": seen_at,
            "last_run_id": self.run_id,
        }
        assert tuple(row) == FULL_COLUMNS
        return row

    # ---- polite page loading ----------------------------------------------------

    async def _load_robots(self, context: BrowserContext) -> None:
        """Read robots.txt once. If it can't be read, assume everything is allowed (the standard rule)."""
        rp = urllib.robotparser.RobotFileParser()
        try:
            resp = await context.request.get(urljoin(self.website + "/", "robots.txt"), timeout=20_000)
            rp.parse((await resp.text()).splitlines() if resp.ok else [])
        except Exception as exc:  # noqa: BLE001
            log.warning("[%s] robots.txt unreadable (%s); continuing with default delays", self.agency_id, exc)
            rp.parse([])
        self._robots = rp
        crawl_delay = rp.crawl_delay("*")
        if crawl_delay:
            self.min_delay = max(self.min_delay, float(crawl_delay))
            self.max_delay = max(self.max_delay, self.min_delay * 1.5)
        log.info("[%s] waiting %.0f-%.0f s between pages (robots.txt Crawl-delay: %s)", self.agency_id, self.min_delay, self.max_delay, crawl_delay)

    def allowed(self, url: str) -> bool:
        return self._robots is None or self._robots.can_fetch("*", url)

    async def _pause(self) -> None:
        """Random wait so requests are at least min_delay apart."""
        wait = random.uniform(self.min_delay, self.max_delay) - (time.monotonic() - self._last_request)
        if wait > 0 and self._last_request:
            await asyncio.sleep(wait)

    async def goto(self, page: Page, url: str) -> bool:
        """
        Open `url` politely. Returns True when the page loaded, False when it
        could not (404, robots.txt forbids it, kept failing). Raises
        SiteBlockedError on a bot challenge or repeated 403/429.
        """
        if not self.allowed(url):
            log.info("[%s] robots.txt disallows %s; skipped", self.agency_id, url)
            return False
        status = 0
        for attempt in range(1, self.retries + 1):
            await self._pause()
            self._last_request = time.monotonic()
            try:
                resp: Response | None = await page.goto(url, wait_until="domcontentloaded", timeout=self.page_timeout_ms)
                status = resp.status if resp else 0
                title = (await page.title()) or ""
                if any(m.lower() in title.lower() for m in CHALLENGE_MARKERS):
                    raise SiteBlockedError(f"bot challenge on {url} ({title!r})")
                if status in (403, 429, 503):
                    backoff = 60 * attempt
                    log.warning("[%s] HTTP %s on %s; backing off %ss (%s/%s)", self.agency_id, status, url, backoff, attempt, self.retries)
                    await asyncio.sleep(backoff)
                    continue
                if status == 404:
                    return False
                if status >= 400:
                    raise RuntimeError(f"HTTP {status}")
                return True
            except SiteBlockedError:
                raise
            except Exception as exc:  # noqa: BLE001 - network blips, timeouts
                backoff = 15 * attempt
                log.warning("[%s] %s failed (%s); retry in %ss (%s/%s)", self.agency_id, url, exc, backoff, attempt, self.retries)
                await asyncio.sleep(backoff)
        if status in (403, 429, 503):
            raise SiteBlockedError(f"{url} keeps answering HTTP {status}")
        return False

    # ---- database ------------------------------------------------------------------

    async def _db(self, fn):
        """supabase-py is synchronous; run its calls off the event loop."""
        return await asyncio.to_thread(fn)

    async def _ensure_agency(self) -> None:
        """Make sure the agencies row exists (raw_listings.agency_id points at it). Keeps an existing logo."""
        if not self.db:
            return
        await self._db(
            lambda: self.db.table("agencies")
            .upsert({"id": self.agency_id, "name": self.agency_name, "website": self.website, "is_active": True}, on_conflict="id")
            .execute()
        )

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

    async def _upsert(self, rows: list[dict[str, Any]]) -> None:
        """Upsert on source_url in batches. Rows in one call must share the same keys."""
        if not self.db or not rows:
            return
        for i in range(0, len(rows), 100):
            batch = rows[i : i + 100]
            await self._db(lambda b=batch: self.db.table("raw_listings").upsert(b, on_conflict="source_url").execute())

    # ---- the run ----------------------------------------------------------------------

    def _needs_detail(self, prev: PreviousRow | None, card_hash: str) -> bool:
        if prev is None or prev.card_hash != card_hash or not prev.detail_read_at:
            return True
        try:
            read_at = datetime.fromisoformat(prev.detail_read_at)
        except ValueError:
            return True
        return datetime.now(timezone.utc) - read_at > timedelta(days=self.refresh_days)

    async def _collect_cards(self, page: Page) -> list[dict[str, Any]]:
        """Walk every index page (following next_page_url) and gather unique cards."""
        cards: dict[str, dict[str, Any]] = {}
        for start in self.start_urls:
            url: str | None = start
            visited: set[str] = set()
            while url and url not in visited and len(visited) < self.max_pages_per_index:
                visited.add(url)
                if not await self.goto(page, url):
                    log.warning("[%s] index page did not load: %s", self.agency_id, url)
                    break
                found = await self.parse_index(page)
                for card in found:
                    card.setdefault("index_pages", [])
                    if card["source_url"] in cards:
                        # The same listing on two index pages (e.g. Condo and New development): keep both pages.
                        cards[card["source_url"]]["index_pages"].append(url)
                    else:
                        card["index_pages"].append(url)
                        cards[card["source_url"]] = card
                log.info("[%s] %s: %s listings", self.agency_id, url, len(found))
                url = await self.next_page_url(page)
                if self.limit and len(cards) >= self.limit:
                    break
            if self.limit and len(cards) >= self.limit:
                break
        out = list(cards.values())
        return out[: self.limit] if self.limit else out

    async def run(self) -> SpiderStats:
        """Crawl the site and write raw_listings. Returns the run's counters."""
        await self._ensure_agency()
        previous = await self._previous_rows()

        async with async_playwright() as pw:
            browser: Browser = await pw.chromium.launch(headless=self.headless)
            # One user agent and window size per run, chosen at random.
            major = browser.version.split(".")[0]
            ua = random.choice(USER_AGENT_TEMPLATES).format(v=major)
            width, height = random.choice(VIEWPORTS)
            log.info("[%s] browser: Chrome %s, %sx%s, %s", self.agency_id, major, width, height, ua.split("(")[1].split(")")[0])
            context = await browser.new_context(
                user_agent=ua,
                viewport={"width": width, "height": height},
                locale="en-US",
                timezone_id="America/Aruba",
                extra_http_headers=EXTRA_HEADERS,
            )
            await context.route(
                "**/*",
                lambda route: route.abort() if route.request.resource_type in BLOCKED_RESOURCES else route.continue_(),
            )
            page = await context.new_page()
            try:
                await self._load_robots(context)
                cards = await self._collect_cards(page)
                self.stats.listings_found = len(cards)
                log.info("[%s] %s listings on the index pages", self.agency_id, len(cards))

                seen_at = now_iso()
                full_rows: list[dict[str, Any]] = []
                seen_rows: list[dict[str, Any]] = []
                for n, card in enumerate(cards, 1):
                    url = card["source_url"]
                    card_hash = sha256({k: v for k, v in card.items() if k != "index_pages"})
                    prev = previous.get(url)

                    if self.db and not self._needs_detail(prev, card_hash):
                        # Same card as last time and read recently: just record that it is still listed.
                        seen_rows.append({
                            "agency_id": self.agency_id,
                            "source_url": url,
                            "content_hash": prev.content_hash,
                            "last_scraped_at": seen_at,
                            "last_run_id": self.run_id,
                        })
                        self.stats.rows_unchanged += 1
                        continue

                    if not await self.goto(page, url):
                        log.warning("[%s] listing page did not load, using the card only: %s", self.agency_id, url)
                        data = {**card}
                    else:
                        try:
                            data = await self.parse_detail(page, card)
                            self.stats.details_read += 1
                        except Exception as exc:  # noqa: BLE001 - one bad page never stops the run
                            log.exception("[%s] could not read %s: %s", self.agency_id, url, exc)
                            data = {**card}
                    data["source_url"] = url
                    rec = self.normalise(data)
                    row = self.to_row(rec, card_hash, seen_at)
                    self.records.append(rec)

                    if prev is None:
                        self.stats.rows_new += 1
                    elif prev.content_hash != row["content_hash"]:
                        self.stats.rows_changed += 1
                    else:
                        self.stats.rows_unchanged += 1
                    full_rows.append(row)
                    log.info("[%s] %s/%s %s | %s %s | %s bd %s ba", self.agency_id, n, len(cards), rec["raw_address"], rec["raw_currency"], rec["raw_price"], rec["raw_beds"], rec["raw_baths"])

                    # Write as we go, so a crash halfway keeps what was read.
                    if len(full_rows) >= 25:
                        await self._upsert(full_rows)
                        full_rows = []
                await self._upsert(full_rows)
                await self._upsert(seen_rows)
            finally:
                await context.close()
                await browser.close()

        if self.stats.field_misses:
            log.info("[%s] fields not found (selector: times): %s", self.agency_id, self.stats.field_misses)
        return self.stats
