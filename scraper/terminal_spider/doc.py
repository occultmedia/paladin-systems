"""
Doc: a parsed page (or part of one) that never raises.

Both engines end up here: the fast HTTP engine parses the HTML it downloaded,
the browser engine parses the page after its scripts have run. Spiders only
see Doc, so the same selectors work with either.

A missing element gives None or an empty list, never an exception.
"""

from __future__ import annotations

import re
from typing import Any

import warnings

from bs4 import BeautifulSoup, NavigableString, Tag, XMLParsedAsHTMLWarning

# Sitemaps are read with the same parser; their <loc> tags are found either way.
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

from .parsing import clean, decode_cf_email


class Doc:
    def __init__(self, node: Tag, html: str = "") -> None:
        self.node = node
        self.html = html  # the whole page's source (for values inside scripts, e.g. map pins)

    @classmethod
    def parse(cls, html: str) -> "Doc":
        soup = BeautifulSoup(html, "lxml")
        # Cloudflare swaps e-mail addresses for "[email protected]"; put them back.
        for el in soup.select(".__cf_email__[data-cfemail]"):
            email = decode_cf_email(el.get("data-cfemail"))
            if email:
                el.string = email
        return cls(soup, html)

    # ---- finding ----------------------------------------------------------

    def all(self, selector: str) -> list["Doc"]:
        try:
            return [Doc(n, self.html) for n in self.node.select(selector)]
        except Exception:  # noqa: BLE001 - a bad selector is just "nothing found"
            return []

    def first(self, selector: str) -> "Doc | None":
        found = self.all(selector)
        return found[0] if found else None

    # ---- reading ------------------------------------------------------------

    def own_text(self) -> str | None:
        """All text inside this element, whitespace collapsed."""
        return clean(self.node.get_text())

    def text(self, selector: str) -> str | None:
        el = self.first(selector)
        return el.own_text() if el else None

    def texts(self, selector: str) -> list[str]:
        return [t for t in (d.own_text() for d in self.all(selector)) if t]

    def own_attr(self, name: str) -> str | None:
        value: Any = self.node.get(name)
        return clean(" ".join(value) if isinstance(value, list) else value)

    def attr(self, selector: str, name: str) -> str | None:
        el = self.first(selector)
        return el.own_attr(name) if el else None

    def attrs(self, selector: str, name: str) -> list[str]:
        return [v for v in (d.own_attr(name) for d in self.all(selector)) if v]

    def block_text(self, selector: str) -> str | None:
        """Readable text of a rich-text block, one line per heading, paragraph or bullet."""
        el = self.first(selector)
        if not el:
            return None

        def text(node: Any) -> str:
            if isinstance(node, NavigableString):
                return str(node)
            return "\n" if node.name == "br" else "".join(text(c) for c in node.children)

        parts = []
        for n in el.node.select("h1,h2,h3,h4,h5,p,li,td"):
            if n.select_one("p,li"):
                continue
            lines = [re.sub(r"\s+", " ", line).strip() for line in text(n).split("\n")]
            part = "\n".join(line for line in lines if line)
            if part:
                parts.append(part)
        return "\n".join(parts) if parts else el.own_text()

    def table(self, selector: str) -> dict[str, str]:
        """A two-column table as {label: value}, labels lower-cased."""
        out: dict[str, str] = {}
        for row in self.all(f"{selector} tr"):
            cells = [clean(c.get_text()) or "" for c in row.node.find_all(["td", "th"])]
            if len(cells) >= 2 and cells[0]:
                out[cells[0].lower()] = cells[1]
        return out
