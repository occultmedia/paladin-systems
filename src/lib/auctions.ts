"use client";

/*
 * Notary auctions for Baseline Pro (notary_auctions, indexed nightly from the
 * five Aruba notary offices) and "Track auction date" (tracked_auctions; the
 * nightly check e-mails reminders, see scraper/terminal_spider/notary/alerts.py).
 *
 * Times are Aruba time (AST, UTC-4, no daylight saving) whatever the viewer's
 * own time zone, because that is when the notary holds the auction.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase, useUser } from "./auth";
import type { NotaryAuctionRow, TrackedAuctionRow } from "./database.types";
import { usePlan } from "./plan";

export type Auction = NotaryAuctionRow;
export type Tracked = TrackedAuctionRow;

const DAY = 86_400_000;
export const AWG_PER_USD = 1.79;

/* ── reading ────────────────────────────────────────────────────────── */

/** Upcoming auctions, plus those that changed status or took place in the last 60 days. Pro only (RLS). */
export function useAuctions() {
  const { user } = useUser();
  const { isPro } = usePlan();
  const [state, setState] = useState<{ key: string; rows: Auction[]; error: string | null } | null>(null);
  const key = user && isPro ? user.id : null;
  useEffect(() => {
    const sb = supabase();
    if (!key || !sb) return;
    let live = true;
    const since = new Date(Date.now() - 60 * DAY).toISOString();
    sb.from("notary_auctions")
      .select("*")
      .or(`status.in.(upcoming,suspended_private_bid),auction_date.gte.${since},status_changed_at.gte.${since}`)
      .order("auction_date", { ascending: true, nullsFirst: false })
      .then(({ data, error }) => live && setState({ key, rows: (data ?? []) as Auction[], error: error?.message ?? null }));
    return () => {
      live = false;
    };
  }, [key]);
  const current = state && state.key === key ? state : null;
  return { auctions: current?.rows ?? [], loading: Boolean(key) && !current, error: current?.error ?? null };
}

/** The member's tracked auctions, and changing them. */
export function useTrackedAuctions() {
  const { user } = useUser();
  const [rows, setRows] = useState<Tracked[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uid = user?.id ?? null;
  useEffect(() => {
    const sb = supabase();
    if (!uid || !sb) return;
    let live = true;
    sb.from("tracked_auctions").select("*").then(({ data, error }) => {
      if (!live) return;
      setRows((data ?? []) as Tracked[]);
      setError(error?.message ?? null);
    });
    return () => {
      live = false;
    };
  }, [uid]);

  const byAuction = new Map((rows ?? []).map((r) => [r.auction_id, r]));

  const track = useCallback(async (auctionId: string) => {
    const sb = supabase();
    if (!sb) return;
    setError(null);
    const { data, error } = await sb.from("tracked_auctions").insert({ auction_id: auctionId }).select("*").single();
    if (error) return setError(error.message);
    setRows((r) => [...(r ?? []), data as Tracked]);
  }, []);

  const untrack = useCallback(async (auctionId: string) => {
    const sb = supabase();
    if (!sb) return;
    setError(null);
    const before = rows;
    setRows((r) => (r ?? []).filter((x) => x.auction_id !== auctionId));
    const { error } = await sb.from("tracked_auctions").delete().eq("auction_id", auctionId);
    if (error) {
      setRows(before);
      setError(error.message);
    }
  }, [rows]);

  const update = useCallback(async (auctionId: string, patch: Partial<Pick<Tracked, "notify_private_bid_deadline" | "notify_7d_before" | "notify_24h_before" | "notify_status_change" | "user_notes">>) => {
    const sb = supabase();
    if (!sb) return;
    setRows((r) => (r ?? []).map((x) => (x.auction_id === auctionId ? { ...x, ...patch } : x)));
    const { error } = await sb.from("tracked_auctions").update(patch).eq("auction_id", auctionId);
    if (error) setError(error.message);
  }, []);

  return { tracked: rows, byAuction, track, untrack, update, error };
}

/* ── dates and countdowns ───────────────────────────────────────────── */

const ARUBA = "America/Aruba";

/** "Dec 22, 2026" (Aruba time). */
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: ARUBA });

/** "Dec 22, 2026, 11:00 AM AST", or the day alone when the notice gives no time. */
export function fmtWhen(iso: string) {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ARUBA });
  return hm === "12:00 AM" ? fmtDay(iso) : `${fmtDay(iso)}, ${hm} AST`;
}

/** Whole Aruba calendar days from today to the date (0 = today, negative = past). */
export function daysUntil(iso: string, now = Date.now()) {
  const day = (t: number) => Math.floor((t - 4 * 3600_000) / DAY); // AST is UTC-4
  return day(new Date(iso).getTime()) - day(now);
}

/** "today", "tomorrow", "in 5d", "2d ago". */
export function inDays(iso: string, now = Date.now()) {
  const d = daysUntil(iso, now);
  return d === 0 ? "today" : d === 1 ? "tomorrow" : d > 1 ? `in ${d}d` : `${-d}d ago`;
}

export const isLive = (a: Pick<Auction, "status">) => a.status === "upcoming" || a.status === "suspended_private_bid";

export const STATUS_LABEL: Record<Auction["status"], string> = {
  upcoming: "Upcoming",
  suspended_private_bid: "Suspended: private bid",
  postponed_or_cancelled: "Postponed or cancelled",
  completed: "Auction held",
};

export const SALE_LABEL: Record<Auction["sale_type"], string> = {
  public_auction: "Public auction",
  voluntary_auction: "Voluntary auction",
  tender: "Tender (written bids)",
};

/** The private bid deadline, when private bids are possible and it has not passed long ago. */
export const privateBidDeadline = (a: Auction) => (a.private_bids_allowed === false || a.sale_type === "tender" ? null : a.private_bid_deadline);

/* ── calendar (.ics) ────────────────────────────────────────────────── */

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
/** Aruba calendar day as YYYYMMDD. */
const icsDay = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ARUBA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return p.replace(/-/g, "");
};
const isMidnightAst = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ARUBA }) === "12:00 AM";

/** Lines longer than 75 octets continue on the next line, indented by one space (RFC 5545). */
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) {
      out.push(cur);
      cur = " " + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

function icsEvent(uid: string, title: string, iso: string, durationMin: number, location: string, description: string, alarmMinutes: number) {
  const start = new Date(iso);
  const allDay = isMidnightAst(iso);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}@baseline`,
    `DTSTAMP:${icsUtc(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${icsDay(iso)}` : `DTSTART:${icsUtc(start)}`,
    allDay ? `DTEND;VALUE=DATE:${icsDay(new Date(start.getTime() + DAY).toISOString())}` : `DTEND:${icsUtc(new Date(start.getTime() + durationMin * 60_000))}`,
    `SUMMARY:${icsText(title)}`,
    `LOCATION:${icsText(location)}`,
    `DESCRIPTION:${icsText(description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(title)}`,
    `TRIGGER:-PT${alarmMinutes}M`,
    "END:VALARM",
    "END:VEVENT",
  ];
  return lines.map(fold).join("\r\n");
}

const CHECKLIST = "Bring: a valid passport or ID, and a bank guarantee letter (or other proof you can pay the bid and the costs).";

/** A calendar file with the private bid cutoff (when there is one) and the auction day. */
export function auctionIcs(a: Auction) {
  const usd = a.starting_bid_awg ? ` (about US$${Math.round(a.starting_bid_awg / AWG_PER_USD).toLocaleString("en-US")})` : "";
  const facts = [
    `${a.title}`,
    `Notary: ${a.notary_office}`,
    a.address ? `Property: ${a.address}${a.district ? `, ${a.district}` : ""}` : null,
    a.kadaster_id ? `Land Registry: ${a.kadaster_id}` : null,
    a.starting_bid_awg ? `Starting bid: Afl. ${Math.round(a.starting_bid_awg).toLocaleString("en-US")}${usd}` : null,
    "",
    CHECKLIST,
    "",
    `Notice: ${a.source_url}`,
    a.pdf_brochure_url ? `Conditions: ${a.pdf_brochure_url}` : null,
    "Always confirm dates and conditions with the notary.",
  ].filter((x) => x !== null).join("\n");
  const events: string[] = [];
  const deadline = privateBidDeadline(a);
  if (deadline) {
    events.push(icsEvent(`${a.id}-private-bid`, `Private bid deadline: ${a.title}`, deadline, 30, a.notary_office,
      `${a.private_bid_deadline_estimated ? "Estimated: 14 days before the auction. Check the exact deadline with the notary.\n\n" : ""}Submit an irrevocable private bid to ${a.notary_office} with a bank guarantee.\n\n${facts}`, 24 * 60));
  }
  if (a.auction_date) {
    events.push(icsEvent(`${a.id}-auction`, `${a.sale_type === "tender" ? "Tender closes" : "Auction"}: ${a.title}`, a.auction_date, 120,
      a.auction_place ?? a.notary_office, facts, 24 * 60));
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Baseline//Notary auctions//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...events, "END:VCALENDAR", ""].join("\r\n");
}

/** Download the calendar file. */
export function downloadIcs(a: Auction) {
  const blob = new Blob([auctionIcs(a)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `auction-${a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
