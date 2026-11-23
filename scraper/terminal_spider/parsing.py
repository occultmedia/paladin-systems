"""
Text -> number helpers shared by every spider.

Aruba sites print numbers in both styles: "USD 3.900.000" (dots for
thousands, European style) and "$1,250,000.00" (commas for thousands). These
helpers turn either into plain numbers and never raise: anything they cannot
read comes back as None, so a strange price never crashes a run.
"""

from __future__ import annotations

import re

# The first number in a string, including its separators: "3.900.000", "1,250,000.50", "2.5".
_NUMBER = re.compile(r"\d[\d.,]*")

# Currency markers, mapped to ISO codes. Order matters: "US$" before "$".
_CURRENCIES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bUSD\b|US\$", re.I), "USD"),
    (re.compile(r"\bAWG\b|\bAFL\.?|ƒ", re.I), "AWG"),
    (re.compile(r"\bEUR\b|€", re.I), "EUR"),
    (re.compile(r"\$"), "USD"),
]


def parse_number(text: str | None) -> float | None:
    """
    First number in `text`, as a float.

        "USD 3.900.000 (AWG 6.942.000)" -> 3900000.0
        "$1,250,000.50"                 -> 1250000.5
        "157.303"                       -> 157303.0   (3 digits after the dot = thousands)
        "2.5 bathroom(s)"               -> 2.5
        "Price on request"              -> None
    """
    if not text:
        return None
    match = _NUMBER.search(text)
    if not match:
        return None
    num = match.group(0).rstrip(".,")
    try:
        if "," in num and "." in num:
            # Both separators: whichever comes last is the decimal mark.
            if num.rfind(",") > num.rfind("."):
                num = num.replace(".", "").replace(",", ".")  # 1.234.567,89
            else:
                num = num.replace(",", "")  # 1,234,567.89
        elif "," in num or "." in num:
            sep = "," if "," in num else "."
            parts = num.split(sep)
            # "3.900.000" (several groups) or "157.303" (one group of exactly 3) = thousands.
            if len(parts) > 2 or len(parts[-1]) == 3:
                num = num.replace(sep, "")
            else:
                num = num.replace(sep, ".")
        return float(num)
    except ValueError:
        return None


def parse_int(text: str | None) -> int | None:
    """First whole number in `text`: "10 bedroom(s)" -> 10, "" -> None."""
    value = parse_number(text)
    return int(value) if value is not None else None


def parse_currency(text: str | None) -> str | None:
    """ISO code of the first currency named in `text`: "USD 3.900.000 (AWG ...)" -> "USD"."""
    if not text:
        return None
    hits = [(m.start(), code) for pattern, code in _CURRENCIES if (m := pattern.search(text))]
    return min(hits)[1] if hits else None


def clean(text: str | None) -> str | None:
    """Collapse whitespace; empty strings become None."""
    if text is None:
        return None
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def decode_cf_email(encoded: str | None) -> str | None:
    """
    Cloudflare hides e-mail addresses on public pages as a hex string
    (data-cfemail="e58081..."): the first byte is an XOR key for the rest.
    The browser decodes it with Cloudflare's script; this is the fallback when
    that script has not run.
    """
    if not encoded:
        return None
    try:
        key = int(encoded[:2], 16)
        return "".join(chr(int(encoded[i : i + 2], 16) ^ key) for i in range(2, len(encoded), 2)) or None
    except ValueError:
        return None
