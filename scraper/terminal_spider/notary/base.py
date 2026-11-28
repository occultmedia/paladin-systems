"""
The base for the notary auction spiders. It reuses the agency spiders'
polite loading (robots.txt, Crawl-delay, pauses, backing off, a common browser
identity) and adds reading the PDFs an auction notice links to.

A site spider implements `notices()`: every auction its site shows now, as
`Notice`s with the page text (and PDF text) to read the facts from. `ok` stays
True only when the site's auction page itself loaded, so a site that is down
is never taken to mean "every auction was removed".
"""

from __future__ import annotations

import asyncio
import io
import logging
import re
import time
from typing import Any
from urllib.parse import urljoin, urlparse

from ..base import BaseSpider
from ..doc import Doc
from ..fetch import HttpEngine
from .parse import Notice

log = logging.getLogger(__name__)

MAX_PDF_BYTES = 12 * 1024 * 1024
MAX_PDFS = 3           # PDFs read per auction (conditions first)
PDF_PAGES = 12         # pages read per PDF: the facts are on the first pages
# Which linked PDFs describe the auction (read and kept as the brochure), which are only kept as links.
CONDITIONS = re.compile(r"veilingv|veilingvoorwaarden|bijzondere|special|conditions|voorwaarden|inschrijvingsv|brochure|aankondiging|notice", re.I)
SKIP_PDF = re.compile(r"biedingsformulier|bid[-_ ]?form|alg[-_ ]?vwd|algemene[-_ ]voorwaarden|general[-_ ]conditions|privacy", re.I)


def page_text(doc: Doc | Any) -> str:
    node = doc.node if isinstance(doc, Doc) else doc  # a bs4 Tag answers any attribute (tag.node is a child search)
    for el in node.select("script, style, noscript, nav, header, footer"):
        el.decompose()
    return re.sub(r"\s+", " ", node.get_text(" ")).strip()


class NotarySpider(BaseSpider):
    office: str            # notary_auctions.notary_office
    slug: str              # short id, also used as the spider's name
    website: str
    start_urls: list[str]
    min_delay = 4.0
    enabled = True         # False = written but not run

    def __init__(self, **kw: Any) -> None:
        self.agency_id = self.slug
        self.agency_name = self.office
        super().__init__(**kw)
        self.ok = False                        # the auction page loaded
        self._pdf_client: Any = None

    # BaseSpider's listing methods are not used here.
    def parse_index(self, page: Doc) -> list[dict[str, Any]]:  # pragma: no cover
        raise NotImplementedError

    def parse_detail(self, page: Doc, card: dict[str, Any]) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError

    async def notices(self) -> list[Notice]:
        raise NotImplementedError

    async def collect(self) -> list[Notice]:
        """Open the site politely and return its notices."""
        import httpx

        async with HttpEngine() as web:
            self._web = web
            await self._load_robots()
            async with httpx.AsyncClient(follow_redirects=True, timeout=45.0, headers=dict(web._client.headers)) as pdf_client:
                self._pdf_client = pdf_client
                found = await self.notices()
        log.info("[%s] %s auction notice(s), auction page %s", self.slug, len(found), "loaded" if self.ok else "DID NOT LOAD")
        return found

    # ---- PDFs --------------------------------------------------------------

    def pdf_links(self, doc: Doc, base: str) -> list[dict[str, str]]:
        """Every PDF the notice links to on the notary's own site, with its link text."""
        out: list[dict[str, str]] = []
        seen: set[str] = set()
        host = urlparse(self.website).netloc.removeprefix("www.")
        for a in doc.node.select("a[href]"):
            href = urljoin(base, a.get("href", ""))
            if not href.lower().split("?")[0].endswith(".pdf") or href in seen:
                continue
            if urlparse(href).netloc.removeprefix("www.") != host:
                continue
            seen.add(href)
            label = re.sub(r"\s+", " ", a.get_text(" ")).strip() or href.rsplit("/", 1)[-1]
            out.append({"label": label[:80], "url": href})
        return out

    @staticmethod
    def pick_brochure(docs: list[dict[str, str]]) -> str | None:
        for d in docs:
            if CONDITIONS.search(d["url"]) or CONDITIONS.search(d["label"]):
                if not SKIP_PDF.search(d["url"]):
                    return d["url"]
        return None

    async def pdf_text(self, url: str) -> str:
        """Text of the first pages of a PDF, read in memory and never stored. '' when it cannot be read."""
        if not self.allowed(url):
            return ""
        await self._pause()
        self._last_request = time.monotonic()
        try:
            r = await self._pdf_client.get(url)
            if r.status_code != 200 or len(r.content) > MAX_PDF_BYTES or not r.content.startswith(b"%PDF"):
                log.info("[%s] PDF skipped (%s, %s bytes): %s", self.slug, r.status_code, len(r.content), url)
                return ""
            from pypdf import PdfReader

            reader = await asyncio.to_thread(PdfReader, io.BytesIO(r.content))
            pages = reader.pages[:PDF_PAGES]
            text = " ".join((p.extract_text() or "") for p in pages)
            return re.sub(r"\s+", " ", text)
        except Exception as exc:  # noqa: BLE001 - a broken PDF must not stop the site
            log.warning("[%s] PDF unreadable %s: %s", self.slug, url, exc)
            return ""

    async def read_pdfs(self, docs: list[dict[str, str]]) -> str:
        """Text of the PDFs worth reading: the conditions first, never bid forms or general conditions."""
        wanted = [d for d in docs if not SKIP_PDF.search(d["url"]) and not SKIP_PDF.search(d["label"])]
        wanted.sort(key=lambda d: 0 if CONDITIONS.search(d["url"] + " " + d["label"]) else 1)
        texts = [await self.pdf_text(d["url"]) for d in wanted[:MAX_PDFS]]
        return " ".join(t for t in texts if t)
