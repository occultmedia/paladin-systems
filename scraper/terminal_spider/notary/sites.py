"""
The five notary offices. Each reads only its own office's site, politely
(robots.txt and terms checked 28 November 2026; Yarzagaray's terms ask for
written permission, which the owner confirmed Baseline has).
"""

from __future__ import annotations

import html
import json
import logging
import re
from typing import Any

from ..doc import Doc
from .base import NotarySpider, page_text
from .parse import Notice, auction_datetime, find_dates, starting_bid_awg

log = logging.getLogger(__name__)

# Words that mark a block of text as an auction notice on the one-page sites.
AUCTION_WORDS = re.compile(r"auction|veiling|inzet|starting (?:bid|price)|afl\.?\s*\d|tender|inschrijving", re.I)
# Heading texts that are site sections, never an auction.
NOT_AN_AUCTION = re.compile(r"^(auctions?|veilingen?|going once|general information|algemene informatie|info|contact|our services|buying at auction|"
                            r"auction costs|recently closed|recent gesloten|no auction planned|geen veiling gepland|auction 20\d\d)\b", re.I)


class JohnsonNotary(NotarySpider):
    office = "Johnson Notary Services"
    slug = "johnson-notary"
    website = "https://www.johnsonnotary.com"
    start_urls = ["https://www.johnsonnotary.com/auctions"]

    async def notices(self) -> list[Notice]:
        page = await self.load(self.start_urls[0])
        if page is None:
            return []
        self.ok = True
        out: list[Notice] = []
        for card in page.all(".card-auction"):
            link = card.first("a[href]")
            head = card.first(".card-auction__heading")
            title = head.node.get_text(" ").strip() if head else None
            if not link or not title:
                continue
            url = self.absolute(link.node.get("href", "").split("#")[0])
            listed_date = card.first(".card-auction__date")
            detail = await self.load(url)
            docs = self.pdf_links(detail, url) if detail else []
            text = page_text(detail.node.select_one("#layout-content") or detail.node) if detail else ""
            # the detail page repeats every auction's card first; keep the part about this one
            i = text.find(f"{title} -")
            text = text[i:] if i >= 0 else text
            out.append(Notice(
                office=self.office, slug=self.slug, source_url=url, title=html.unescape(title).strip(),
                text=f"{listed_date.node.get_text(' ').strip() if listed_date else ''} {text} {await self.read_pdfs(docs)}",
                documents=docs, brochure_url=self.pick_brochure(docs),
            ))
        return out


class NewLeafNotary(NotarySpider):
    office = "NewLeaf Notary"
    slug = "newleaf-notary"
    website = "https://newleafaruba.com"
    start_urls = ["https://newleafaruba.com/category/auctions/", "https://newleafaruba.com/"]

    async def notices(self) -> list[Notice]:
        page = await self.load(self.start_urls[0])
        if page is None:
            return []
        self.ok = True
        items: dict[str, dict[str, Any]] = {}
        for it in page.all(".auc-item"):
            a = it.first("h3 a[href]")
            if not a:
                continue
            url = a.node.get("href")
            summary = re.sub(r"\s+", " ", it.node.get_text(" "))
            items[url] = {"title": a.node.get_text(" ").strip(), "summary": summary}
        # Auction notices also appear on the home page; add any post it links that the list lacks.
        home = await self.load(self.start_urls[1])
        if home:
            for a in home.node.select("a[href]"):
                href, label = a.get("href", ""), a.get_text(" ").strip()
                if href.startswith(self.website) and href not in items and re.search(r"auction|veiling", label, re.I) and re.search(r"/[a-z0-9-]+-\d+[a-z]?/?$", href):
                    items[href] = {"title": label, "summary": ""}
        out: list[Notice] = []
        for url, it in items.items():
            detail = await self.load(url)
            body = (detail.node.select_one(".entry-content, article, #content, .content") or detail.node) if detail else None
            docs = self.pdf_links(detail, url) if detail else []
            text = page_text(body) if body is not None else ""
            out.append(Notice(
                office=self.office, slug=self.slug, source_url=url, title=html.unescape(it["title"]).strip(),
                text=f"{it['summary']} {text} {await self.read_pdfs(docs)}",
                documents=[d for d in docs if "biedingsformulier" not in d["url"].lower()],
                brochure_url=self.pick_brochure(docs),
            ))
        return out


class HelmeyerNotary(NotarySpider):
    """Helmeyer publishes each auction as a WordPress 'auction' post, tagged open or closed."""

    office = "Notaris Helmeyer"
    slug = "helmeyer-notary"
    website = "https://notarishelmeyer.com"
    start_urls = ["https://notarishelmeyer.com/wp-json/wp/v2/auction?per_page=50&_fields=id,slug,link,title,modified,class_list"]
    known: set[str] = set()   # source URLs already in Baseline (closed ones are only re-read when known)

    async def notices(self) -> list[Notice]:
        api = await self.load(self.start_urls[0])
        if api is None:
            return []
        try:
            posts = json.loads(api.node.get_text())
        except ValueError:
            log.warning("[%s] auction API did not answer with JSON", self.slug)
            return []
        self.ok = True
        out: list[Notice] = []
        for p in posts:
            title = html.unescape(p["title"]["rendered"]).strip()
            classes = " ".join(p.get("class_list") or [])
            closed = "closed" in classes
            if NOT_AN_AUCTION.search(title) or (closed and p["link"] not in self.known):
                continue
            detail = await self.load(p["link"])
            if detail is None:
                continue
            body = detail.node.select_one("main, #tm-main, article") or detail.node
            docs = self.pdf_links(detail, p["link"])
            text = page_text(body)
            # the page is in English and Dutch; the English half comes first
            out.append(Notice(
                office=self.office, slug=self.slug, source_url=p["link"], title=title,
                text=f"{text} {await self.read_pdfs(docs)}", documents=docs, brochure_url=self.pick_brochure(docs),
                listed_status="closed" if closed else None,
            ))
        return out


class OnePageNotary(NotarySpider):
    """
    Offices that list auctions as blocks on one page (no page per auction).
    A block is a heading followed by text that names a date and an amount or
    the word auction/veiling. Each block's identity is its heading.
    """

    def blocks(self, doc: Doc) -> list[tuple[str, str, Any]]:
        out: list[tuple[str, str, Any]] = []
        root = doc.node.select_one("main, #content, .site-content, #SITE_CONTAINER") or doc.node
        for el in root.select("script, style, noscript, nav, header, footer"):
            el.decompose()
        heads = root.select("h1, h2, h3, h4, h5, strong")
        for h in heads:
            title = re.sub(r"\s+", " ", h.get_text(" ")).strip(" :–-")
            if not (4 <= len(title) <= 160) or NOT_AN_AUCTION.search(title):
                continue
            # text from this heading up to the next heading of any level
            parts: list[str] = []
            for sib in h.find_all_next(string=True):
                parent = sib.parent
                if parent is not h and parent.name in ("h1", "h2", "h3", "h4", "h5") and parent in heads:
                    break
                parts.append(sib)
                if sum(map(len, parts)) > 2500:
                    break
            text = re.sub(r"\s+", " ", " ".join(parts)).strip()
            if find_dates(text) and AUCTION_WORDS.search(text) and (starting_bid_awg(text) or auction_datetime(text)):
                out.append((title, text, h))
        return out

    async def notices(self) -> list[Notice]:
        out: list[Notice] = []
        seen: set[str] = set()
        for start in self.start_urls:
            page = await self.load(start)
            if page is None:
                continue
            self.ok = True
            docs_all = self.pdf_links(page, start)
            for title, text, h in self.blocks(page):
                if title in seen:
                    continue
                seen.add(title)
                # PDFs linked inside this block
                block_docs = []
                for a in h.find_all_next("a", href=True, limit=12):
                    href = a["href"]
                    match = next((d for d in docs_all if d["url"].endswith(href.split("/")[-1])), None)
                    if match and match not in block_docs:
                        block_docs.append(match)
                out.append(Notice(
                    office=self.office, slug=self.slug, source_url=start, title=title,
                    text=f"{text} {await self.read_pdfs(block_docs)}", documents=block_docs, brochure_url=self.pick_brochure(block_docs),
                ))
        return out


class YarzagarayNotary(OnePageNotary):
    office = "Notary Yarzagaray"
    slug = "yarzagaray-notary"
    website = "https://notarisaruba.com"
    start_urls = ["https://notarisaruba.com/auctions/"]
    # Their terms require written permission; the owner confirmed it on 28 November 2026.
    enabled = True


class TrompNotary(OnePageNotary):
    office = "Notaris Tromp"
    slug = "tromp-notary"
    website = "https://www.arubanotary.com"
    start_urls = ["https://www.arubanotary.com/"]


NOTARY_SPIDERS: dict[str, type[NotarySpider]] = {
    s.slug: s for s in (JohnsonNotary, NewLeafNotary, YarzagarayNotary, TrompNotary, HelmeyerNotary)
}
