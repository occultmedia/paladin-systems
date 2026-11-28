"""
The nightly check after the notary crawl: reminders and change notices for
tracked auctions, queued in auction_alerts (each alert once: the table is
unique on user, auction, kind and what it is about) and e-mailed through
Resend when RESEND_API_KEY and RESEND_FROM are set. Without them alerts stay
queued (sent_at null) and go out on the first run that has the key.

  private_bid_deadline  the private bid deadline is 3 days away or less
  auction_7d            the auction is 7 days away or less (more than 36 h)
  auction_24h           the auction is 36 hours away or less
  status_change         postponed, cancelled, suspended, completed, back on
  date_change           the notary moved the auction date
"""

from __future__ import annotations

import logging
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from .parse import AST

log = logging.getLogger(__name__)

SITE = os.environ.get("BASELINE_SITE_URL", "https://sequence-labs-psi.vercel.app").rstrip("/")
STATUS_WORDS = {
    "upcoming": "is back on",
    "suspended_private_bid": "is suspended (a private bid may have been accepted)",
    "postponed_or_cancelled": "has been postponed or cancelled",
    "completed": "has taken place",
}
CHECKLIST = "Bring a valid passport or ID and a bank guarantee letter (or other proof you can pay the bid and the costs)."


def _when(iso: str | None) -> datetime | None:
    return datetime.fromisoformat(iso).astimezone(AST) if iso else None


def _fmt(dt: datetime | None) -> str:
    if not dt:
        return "date to be announced"
    if dt.hour == 0 and dt.minute == 0:  # the notice gives a day, not a time
        return dt.strftime("%a %d %b %Y").replace(" 0", " ")
    return dt.strftime("%a %d %b %Y, %I:%M %p AST").replace(" 0", " ")


def _body(a: dict[str, Any], lead: str) -> str:
    adate, dl = _when(a.get("auction_date")), _when(a.get("private_bid_deadline"))
    lines = [
        lead,
        "",
        f"{a['title']}",
        f"Notary: {a['notary_office']}",
        f"Auction: {_fmt(adate)}" + (f" at {a['auction_place']}" if a.get("auction_place") else ""),
    ]
    if dl and a.get("private_bids_allowed") is not False:
        lines.append(f"Private bid deadline: {_fmt(dl)}" + (" (estimated: 14 days before the auction)" if a.get("private_bid_deadline_estimated") else ""))
    if a.get("starting_bid_awg"):
        lines.append(f"Starting bid: Afl. {float(a['starting_bid_awg']):,.0f} (about US${float(a['starting_bid_usd']):,.0f})")
    lines += ["", CHECKLIST, "", f"Notary's notice: {a['source_url']}", f"On Baseline: {SITE}/dashboard?tab=pro&section=auctions", "",
              "Always confirm dates and conditions with the notary. You get this because you track this auction on Baseline Pro."]
    return "\n".join(lines)


def queue(db: Any, now: datetime | None = None) -> int:
    """Work out which alerts are due and queue them. Returns how many are new."""
    now = now or datetime.now(timezone.utc).astimezone(AST)
    tracked = db.table("tracked_auctions").select("*, notary_auctions(*)").execute().data or []
    if not tracked:
        return 0
    ids = list({t["auction_id"] for t in tracked})
    events = db.table("notary_auction_events").select("*").in_("auction_id", ids).in_("event", ["status_changed", "date_changed"]).execute().data or []
    due: list[dict[str, Any]] = []
    for t in tracked:
        a = t["notary_auctions"]
        if not a:
            continue
        adate, dl = _when(a.get("auction_date")), _when(a.get("private_bid_deadline"))
        live = a["status"] in ("upcoming", "suspended_private_bid")
        base = {"user_id": t["user_id"], "auction_id": a["id"]}
        if t["notify_private_bid_deadline"] and live and dl and a.get("private_bids_allowed") is not False and timedelta(0) < dl - now <= timedelta(days=3):
            days = max(1, math.ceil((dl - now).total_seconds() / 86400))
            due.append(base | {"kind": "private_bid_deadline", "ref": dl.date().isoformat(),
                               "subject": f"Private bid deadline in {days} day{'s' if days != 1 else ''}: {a['title']}",
                               "body": _body(a, f"The private bid deadline for {a['title']} is {_fmt(dl)}.")})
        if t["notify_7d_before"] and live and adate and timedelta(hours=36) < adate - now <= timedelta(days=7):
            due.append(base | {"kind": "auction_7d", "ref": adate.date().isoformat(),
                               "subject": f"Auction in {math.ceil((adate - now).total_seconds() / 86400)} days: {a['title']}",
                               "body": _body(a, f"{a['title']} goes to auction on {_fmt(adate)}.")})
        if t["notify_24h_before"] and live and adate and timedelta(0) < adate - now <= timedelta(hours=36):
            due.append(base | {"kind": "auction_24h", "ref": adate.date().isoformat(),
                               "subject": f"Auction tomorrow: {a['title']}",
                               "body": _body(a, f"{a['title']} goes to auction on {_fmt(adate)}.")})
        if t["notify_status_change"]:
            for e in events:
                if e["auction_id"] != a["id"] or e["created_at"] < t["created_at"]:
                    continue
                if e["event"] == "status_changed":
                    word = STATUS_WORDS.get(e["new_value"], f"is now {e['new_value']}")
                    due.append(base | {"kind": "status_change", "ref": str(e["id"]),
                                       "subject": f"Auction {word.split(' (')[0]}: {a['title']}",
                                       "body": _body(a, f"The auction of {a['title']} {word}.")})
                else:
                    old = _when(e["old_value"])
                    due.append(base | {"kind": "date_change", "ref": str(e["id"]),
                                       "subject": f"New auction date: {a['title']}",
                                       "body": _body(a, f"The notary moved the auction of {a['title']} from {_fmt(old)} to {_fmt(_when(e['new_value']))}.")})
    if not due:
        return 0
    before = db.table("auction_alerts").select("id", count="exact").execute().count or 0
    db.table("auction_alerts").upsert(due, on_conflict="user_id,auction_id,kind,ref", ignore_duplicates=True).execute()
    after = db.table("auction_alerts").select("id", count="exact").execute().count or 0
    return after - before


def send(db: Any) -> dict[str, int]:
    """E-mail queued alerts through Resend. Without RESEND_API_KEY / RESEND_FROM they stay queued."""
    key, sender = os.environ.get("RESEND_API_KEY"), os.environ.get("RESEND_FROM")
    pending = db.table("auction_alerts").select("*").is_("sent_at", "null").lt("attempts", 5).order("created_at").limit(200).execute().data or []
    if not pending:
        return {"pending": 0, "sent": 0}
    if not key or not sender:
        log.info("%s auction alert(s) queued; e-mail not configured (set RESEND_API_KEY and RESEND_FROM)", len(pending))
        return {"pending": len(pending), "sent": 0}
    import httpx

    emails: dict[str, str | None] = {}
    sent = 0
    for al in pending:
        uid = al["user_id"]
        if uid not in emails:
            try:
                emails[uid] = db.auth.admin.get_user_by_id(uid).user.email
            except Exception as exc:  # noqa: BLE001
                log.warning("no e-mail for a tracked user: %s", exc)
                emails[uid] = None
        to = emails[uid]
        err = None
        if not to:
            err = "member has no e-mail address"
        else:
            try:
                r = httpx.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {key}"},
                    json={"from": sender, "to": [to], "subject": al["subject"], "text": al["body"]},
                    timeout=20,
                )
                if r.status_code >= 300:
                    err = f"Resend HTTP {r.status_code}: {r.text[:200]}"
            except Exception as exc:  # noqa: BLE001
                err = str(exc)[:300]
        upd: dict[str, Any] = {"attempts": al["attempts"] + 1, "last_error": err}
        if err is None:
            upd["sent_at"] = datetime.now(timezone.utc).isoformat()
            sent += 1
        db.table("auction_alerts").update(upd).eq("id", al["id"]).execute()
    return {"pending": len(pending) - sent, "sent": sent}
