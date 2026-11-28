"""
Reading notary auction notices: dates, amounts, land registry numbers and the
rest, in English and Dutch, from page text or PDF text.

Every function takes plain text and returns None when the notice does not say.
Nothing here keeps the text itself (foreclosure papers can name the owner).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

AST = timezone(timedelta(hours=-4), "AST")  # Aruba: UTC-4 all year, no daylight saving
AWG_PER_USD = 1.79                           # the florin is pegged to the dollar
PRIVATE_BID_DAYS = 14                        # usual limit for private bids before a foreclosure auction

MONTHS = {
    # English
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7,
    "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "sept": 9,
    "oct": 10, "nov": 11, "dec": 12,
    # Dutch
    "januari": 1, "februari": 2, "maart": 3, "mei": 5, "juni": 6, "juli": 7, "augustus": 8,
    "oktober": 10, "okt": 10, "mrt": 3,
}
_MONTH = "|".join(sorted(MONTHS, key=len, reverse=True))
# "18 December 2026", "26 augustus 2026", "Dec 22, 2026", "January 8, 2027"
DATE_DMY = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+({_MONTH})\.?,?\s+(20\d\d)\b", re.I)
DATE_MDY = re.compile(rf"\b({_MONTH})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(20\d\d)\b", re.I)
DATE_NUM = re.compile(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d\d)\b")  # 22-12-2026 (day first, as in Aruba)
TIME = re.compile(r"\b(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?|uur|u\.?)?", re.I)


def find_dates(text: str) -> list[tuple[int, datetime]]:
    """Every date in the text with its position, as midnight AST."""
    out: list[tuple[int, datetime]] = []
    for m in DATE_DMY.finditer(text):
        d, mon, y = int(m.group(1)), MONTHS[m.group(2).lower()], int(m.group(3))
        out.append((m.start(), _mk(y, mon, d)))
    for m in DATE_MDY.finditer(text):
        mon, d, y = MONTHS[m.group(1).lower()], int(m.group(2)), int(m.group(3))
        out.append((m.start(), _mk(y, mon, d)))
    for m in DATE_NUM.finditer(text):
        d, mon, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mon <= 12:
            out.append((m.start(), _mk(y, mon, d)))
    return sorted((p, dt) for p, dt in out if dt)


def _mk(y: int, mon: int, d: int) -> datetime | None:
    try:
        return datetime(y, mon, d, tzinfo=AST)
    except ValueError:
        return None


def time_near(text: str, pos: int, window: int = 90) -> tuple[int, int] | None:
    """The first clock time within `window` characters after `pos`: (hour, minute) in 24 h."""
    m = TIME.search(text, pos, pos + window)
    if not m:
        return None
    h, mi, ap = int(m.group(1)), int(m.group(2)), (m.group(3) or "").lower().replace(".", "")
    if ap.startswith("p") and h < 12:
        h += 12
    if ap.startswith("a") and h == 12:
        h = 0
    return (h, mi) if h < 24 and mi < 60 else None


def with_time(dt: datetime, hm: tuple[int, int] | None) -> datetime:
    return dt.replace(hour=hm[0], minute=hm[1]) if hm else dt


LABELLED_DATE = re.compile(
    r"(auction date|date of (?:the )?auction|veilingdatum|datum veiling|date|datum|auction will (?:take place|be held) on|"
    r"veiling (?:zal|vindt) .{0,30}?plaats(?:vinden)? op|no later than|uiterlijk)\s*[:\-–]?\s*",
    re.I,
)


def auction_datetime(text: str, *, prefer_after: str | None = None) -> datetime | None:
    """
    The auction's date and time. A labelled date ("Auction date: 18 December
    2026", "Datum: 26 augustus 2026") wins; else the first date in the text.
    """
    for m in LABELLED_DATE.finditer(text):
        for pos, dt in find_dates(text[m.end(): m.end() + 60]):
            return with_time(dt, _time_for(text, m.end() + pos, dt))
    dates = find_dates(text)
    if not dates:
        return None
    pos, dt = dates[0]
    return with_time(dt, _time_for(text, pos, dt))


TIME_LABEL = re.compile(r"\b(?:time|tijd|aanvang|at)\s*[:\-–]?\s*(?=\d{1,2}[:.]\d{2})", re.I)


def _time_for(text: str, pos: int, dt: datetime) -> tuple[int, int] | None:
    """The clock time of the date at `pos`: right after it, after a 'Time:' label close by, or at another mention of the same day."""
    if hm := time_near(text, pos, 40):
        return hm
    lab = TIME_LABEL.search(text, pos, pos + 200)
    if lab and (hm := time_near(text, lab.end(), 12)):
        return hm
    for p2, d2 in find_dates(text):
        if p2 != pos and d2 == dt and (hm := time_near(text, p2, 40)):
            return hm
    return None


PRIVATE_BID_UNTIL = re.compile(
    r"(private bids?|onderhandse bied(?:ing|ingen)|direct bid)[^.]{0,120}?\b(?:until|up to|no later than|tot(?: en met)?|uiterlijk(?: op)?|before|voor)\s+",
    re.I,
)
PRIVATE_BIDS_YES = re.compile(r"private bids? (?:are|is) (?:possible|allowed|permitted)|onderhandse biedingen? (?:zijn|is) (?:mogelijk|toegestaan)|possible to submit an? [^.]{0,40}private bid", re.I)
PRIVATE_BIDS_NO = re.compile(r"no private bids?|private bids? (?:are|is) not (?:possible|allowed|accepted)|geen onderhandse bied", re.I)


def private_bid(text: str) -> tuple[bool | None, datetime | None]:
    """(private bids allowed?, the stated deadline). Either may be None when the notice does not say."""
    deadline = None
    for m in PRIVATE_BID_UNTIL.finditer(text):
        found = find_dates(text[m.end(): m.end() + 40])
        if found:
            pos, dt = found[0]
            deadline = with_time(dt, time_near(text, m.end() + pos, 60))
            break
    allowed: bool | None = None
    if deadline or PRIVATE_BIDS_YES.search(text):
        allowed = True
    elif PRIVATE_BIDS_NO.search(text):
        allowed = False
    return allowed, deadline


AFL = re.compile(r"(?:Afl\.?|AWG|Aruban Florins?\s*\(?\s*Afl\.?)\s*(?:Afl\.?\s*)?([\d.,]+)", re.I)
STARTING = re.compile(r"(starting (?:bid|price)|minimum bid|opening bid|inzetprijs|inzet|ingezet|startprijs|minimumprijs)", re.I)


def awg_amount(raw: str) -> float | None:
    """'725.000,--' / '196.623,00' / '3,000,000' -> florins."""
    s = raw.strip().rstrip(",-–").rstrip(".")
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?", s):      # 725.000 / 196.623,00 (Dutch)
        s = s.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?", s):     # 3,000,000.00 (English)
        s = s.replace(",", "")
    else:
        s = s.replace(",", ".")
    try:
        v = float(s)
    except ValueError:
        return None
    return v if 1_000 <= v <= 2_000_000_000 else None


def starting_bid_awg(text: str) -> float | None:
    """The starting bid in florins: the amount nearest after a 'starting bid' label, else the first florin amount."""
    for m in STARTING.finditer(text):
        a = AFL.search(text, m.end(), m.end() + 160)
        if a and (v := awg_amount(a.group(1))):
            return v
    for a in AFL.finditer(text):
        if v := awg_amount(a.group(1)):
            return v
    return None


def usd(awg: float | None) -> float | None:
    return round(awg / AWG_PER_USD, 2) if awg else None


ORDINAL = {"first": 1, "second": 2, "third": 3, "fourth": 4, "eerste": 1, "tweede": 2, "derde": 3, "vierde": 4}
KADASTER_LONG = re.compile(
    r"\b(first|second|third|fourth|eerste|tweede|derde|vierde)\s+(?:division|department|district|afdeling)\s*,?\s*"
    r"(?:section|sectie)\s+([A-Z]{1,2})\s*,?\s*(?:number|nummer|no\.?|nr\.?)\s*(\d{1,6})",
    re.I,
)
KADASTER_SHORT = re.compile(r"\b([1-4])\s*-\s*([A-Z]{1,2})\s*-\s*(\d{1,6})\b")


def kadaster_id(text: str) -> str | None:
    """Land Registry parcel as '1-P-621' (division-section-number)."""
    m = KADASTER_LONG.search(text)
    if m:
        return f"{ORDINAL[m.group(1).lower()]}-{m.group(2).upper()}-{int(m.group(3))}"
    m = KADASTER_SHORT.search(text)
    return f"{m.group(1)}-{m.group(2).upper()}-{int(m.group(3))}" if m else None


OWNED = re.compile(r"\b(full ownership|property land|eigendom(?:sgrond)?|freehold|ownership land)\b", re.I)
LEASED = re.compile(r"\b(long[- ]?lease|erfpacht\w*|leasehold|lease ?hold|lease land)\b", re.I)


def land_tenure(text: str) -> str | None:
    owned, leased = OWNED.search(text), LEASED.search(text)
    if owned and leased:
        # the first one named describes the parcel; later mentions are usually cost notes ("outstanding long lease fees")
        return "Eigendom" if owned.start() < leased.start() else "Erfpacht"
    return "Eigendom" if owned else "Erfpacht" if leased else None


M2 = re.compile(r"(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:m2|m²|square met(?:er|re)s?|vierkante meter)", re.I)


def land_m2(text: str) -> int | None:
    m = M2.search(text)
    if not m:
        return None
    try:
        v = int(re.sub(r"[.,]", "", m.group(1)))
    except ValueError:
        return None
    return v if 10 <= v <= 5_000_000 else None


def property_type(text: str) -> str | None:
    t = text.lower()
    if re.search(r"\b(condo|condominium|apartment|appartement|apartmentsrecht|appartementsrecht)\b", t):
        return "Condo"
    if re.search(r"\b(commercial|commerci\w*|bedrijfspand|bedrijfsruimte|office|kantoor|winkel|store|warehouse|hotel|restaurant)\b", t):
        return "Commercial"
    if re.search(r"\b(house|home|woonhuis|woning|residential|dwelling|villa|building|gebouw|opstal)\b", t):
        return "Residential House"
    if re.search(r"\b(parcel|land|kavel|perceel|grond|lot)\b", t):
        return "Land / Kavel"
    return None


def sale_type(text: str) -> str:
    t = text.lower()
    if re.search(r"by way of (?:a )?tender|verkoop (?:via|bij) (?:onderhandse )?inschrijving|not a public auction|geen openbare veiling", t):
        return "tender"
    if re.search(r"vrijwillige|voluntary", t):
        return "voluntary_auction"
    return "public_auction"


_IS = r"(?:auction|sale|veiling|verkoop)\s+(?:has been|is|was|wordt|werd|is\s+per\s+direct)\s+"
CANCELLED = re.compile(
    rf"^\s*(?:cancel+ed|postponed|withdrawn|geannuleerd|uitgesteld|ingetrokken|vervallen)\b|"
    rf"{_IS}(?:cancel+ed|postponed|withdrawn|geannuleerd|uitgesteld|ingetrokken|afgelast)|"
    # (not "if it is no longer on our website, it has been withdrawn": a rule, not a notice)
    rf"\b(?:gaat niet door|komt te vervallen)\b",
    re.I,
)
SUSPENDED = re.compile(rf"{_IS}(?:suspended|opgeschort)|private bid has been accepted|onderhands bod is (?:geaccepteerd|aanvaard)|sold by private (?:bid|treaty)", re.I)


def status_cue(text: str) -> str | None:
    """A status the notice states itself (the pipeline also infers them from dates and removals)."""
    if SUSPENDED.search(text):
        return "suspended_private_bid"
    if CANCELLED.search(text):
        return "postponed_or_cancelled"
    return None


PLACE = re.compile(
    r"(?:\b(?:place|location|locatie|plaats)\s*[:\-–]\s*|(?:vindt plaats|will take place|takes place|is held)\s+(?:bij|in|op|at|in the)\s+(?:de\s+|the\s+)?)"
    r"(.{4,140}?)(?=\s+(?:address|adres|adress|time|tijd|general|the auction|de veiling|it is|voor meer|for more)\b|(?<!\b[A-Z])\.\s+[A-Z][a-z]{2,}|$)",
    re.I,
)


def auction_place(text: str) -> str | None:
    m = PLACE.search(text)
    if not m:
        return None
    return re.sub(r",?\s*gelegen aan\s+", ", ", m.group(1)).strip(" ,.")


def street_address(title: str) -> str:
    """The address to look up: 'Rooi Afo z/n (1-P-685)' -> 'Rooi Afo'; 'Caya G.F. (Betico) Croes 1 & Elleboogstraat 2 en 4' -> 'Caya G.F. Betico Croes 1'."""
    s = re.split(r"\s+(?:&|en|and)\s+|,|\s+[-–]\s+", title)[0]
    s = re.sub(r"\((\d[^)]*|[^)]*m2[^)]*)\)", " ", s)      # "(1-P-685)", "(24.060 m2)"
    s = re.sub(r"[()]", " ", s)
    s = re.sub(r"\bz/n\b|\bzn\b", " ", s, flags=re.I)        # zonder nummer
    s = re.sub(r"\bappart?e?ment\s*\d+\b", " ", s, flags=re.I)
    return re.sub(r"\s+", " ", s).strip(" -,")


@dataclass
class Notice:
    """One auction as a notary site publishes it, before it is stored."""

    office: str
    slug: str
    source_url: str
    title: str
    text: str = ""                          # page text (+ PDF text) used to read the facts; never stored
    documents: list[dict[str, str]] = field(default_factory=list)
    brochure_url: str | None = None
    listed_status: str | None = None        # what the site itself says ("closed" on Helmeyer)
    facts: dict[str, Any] = field(default_factory=dict)  # values a site states in fields (override text)


def read_facts(n: Notice) -> dict[str, Any]:
    """Every field of notary_auctions that can be read from the notice."""
    t = n.text
    st = n.facts.get("sale_type") or sale_type(t)
    adate = n.facts.get("auction_date") or auction_datetime(t)
    allowed, deadline = private_bid(t)
    estimated = False
    if st == "tender":
        allowed, deadline = (False if allowed is None else allowed), None
    elif deadline is None and adate is not None and allowed is not False:
        deadline = adate - timedelta(days=PRIVATE_BID_DAYS)  # usual rule; marked as estimated
        estimated = True
    awg = n.facts.get("starting_bid_awg") or starting_bid_awg(t)
    return {
        "sale_type": st,
        "auction_date": adate,
        "auction_place": n.facts.get("auction_place") or auction_place(t),
        "private_bids_allowed": allowed,
        "private_bid_deadline": deadline,
        "private_bid_deadline_estimated": estimated,
        "starting_bid_awg": round(awg, 2) if awg else None,
        "kadaster_id": kadaster_id(t),
        "land_tenure": land_tenure(t),
        "land_m2": land_m2(t),
        "property_type": n.facts.get("property_type") or property_type(n.title + " " + t[:1500]),
        "status_cue": status_cue(n.title) or status_cue(t[:3000]),
    }
