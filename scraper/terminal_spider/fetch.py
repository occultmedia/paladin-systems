"""
The two ways to load a page. Both return a Page(status, title, html).

    HttpEngine      downloads the HTML only. One small request per page: no
                    images, scripts, fonts or trackers. Right for sites that
                    put the listing in the HTML (most agency sites).
    BrowserEngine   Playwright Chromium, for sites that only show listings
                    after their scripts run. Slower and heavier; opt in with
                    engine = "browser" in the spider.

Neither tries to get around a block. A bot challenge is reported to the base
class, which stops that agency's run.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from html import unescape
from typing import Any

CHROME_MAJOR = "142"
USER_AGENT_TEMPLATES = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{v}.0.0.0 Safari/537.36",
]
VIEWPORTS = [(1280, 800), (1366, 768), (1440, 900), (1536, 864), (1680, 1050), (1920, 1080)]
HEADERS = {"Accept-Language": "en-US,en;q=0.9", "Upgrade-Insecure-Requests": "1"}
BLOCKED_RESOURCES = {"image", "media", "font"}
CHALLENGE_TITLES = ("just a moment", "attention required", "captcha", "access denied")


@dataclass
class Page:
    status: int
    html: str
    headers: dict[str, str]

    @property
    def title(self) -> str:
        m = re.search(r"<title[^>]*>(.*?)</title>", self.html[:20_000], re.I | re.S)
        return unescape(m.group(1)).strip() if m else ""

    @property
    def is_challenge(self) -> bool:
        if self.headers.get("cf-mitigated") == "challenge":
            return True
        return any(t in self.title.lower() for t in CHALLENGE_TITLES)


class HttpEngine:
    name = "http"

    async def __aenter__(self) -> "HttpEngine":
        import httpx

        self._client = httpx.AsyncClient(
            http2=True,
            follow_redirects=True,
            timeout=30.0,
            headers={
                **HEADERS,
                "User-Agent": random.choice(USER_AGENT_TEMPLATES).format(v=CHROME_MAJOR),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self._client.aclose()

    async def get(self, url: str) -> Page:
        r = await self._client.get(url)
        return Page(r.status_code, r.text, {k.lower(): v for k, v in r.headers.items()})


class BrowserEngine:
    name = "browser"

    def __init__(self, headless: bool = True, timeout_ms: int = 45_000) -> None:
        self.headless = headless
        self.timeout_ms = timeout_ms

    async def __aenter__(self) -> "BrowserEngine":
        from playwright.async_api import async_playwright

        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(headless=self.headless)
        width, height = random.choice(VIEWPORTS)
        self._context = await self._browser.new_context(
            # the user agent always matches the engine that renders the page
            user_agent=random.choice(USER_AGENT_TEMPLATES).format(v=self._browser.version.split(".")[0]),
            viewport={"width": width, "height": height},
            locale="en-US",
            timezone_id="America/Aruba",
            extra_http_headers=HEADERS,
        )
        await self._context.route(
            "**/*",
            lambda route: route.abort() if route.request.resource_type in BLOCKED_RESOURCES else route.continue_(),
        )
        self._page = await self._context.new_page()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self._context.close()
        await self._browser.close()
        await self._pw.stop()

    async def get(self, url: str) -> Page:
        if url.endswith("/robots.txt"):
            r = await self._context.request.get(url, timeout=20_000)
            return Page(r.status, await r.text(), {k.lower(): v for k, v in r.headers.items()})
        resp = await self._page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
        # scroll until the page stops growing, so lazily loaded cards are there
        last = -1
        for _ in range(10):
            height = await self._page.evaluate("document.body.scrollHeight")
            if height == last:
                break
            last = height
            await self._page.mouse.wheel(0, 20_000)
            await self._page.wait_for_timeout(700)
        headers = {k.lower(): v for k, v in (resp.headers if resp else {}).items()}
        return Page(resp.status if resp else 0, await self._page.content(), headers)
