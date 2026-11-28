"use client";

/*
 * Notary auctions (Baseline Pro) and "Track auction date":
 *   CountdownPills   "Private bid deadline in 5d" · "Auction: Dec 22, 2026 (24d)"
 *   TrackButton      track / stop tracking an auction
 *   AuctionCard      one auction: facts, countdowns, Track, Add to calendar, the notary's papers,
 *                    and for a tracked auction its alert choices and notes
 *   AuctionsView     the Pro tab's Auctions page: Upcoming and My tracked auctions
 *   AuctionPopup     the window an auction pin opens on the map
 */

import { motion } from "framer-motion";
import { Bell, BellRing, CalendarPlus, ExternalLink, FileText, Gavel, MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AWG_PER_USD,
  SALE_LABEL,
  STATUS_LABEL,
  daysUntil,
  downloadIcs,
  fmtDay,
  fmtWhen,
  inDays,
  isLive,
  privateBidDeadline,
  useAuctions,
  useTrackedAuctions,
  type Auction,
  type Tracked,
} from "@/lib/auctions";

const EASE = [0.22, 1, 0.36, 1] as const;
const afl = (n: number) => `Afl. ${Math.round(n).toLocaleString("en-US")}`;
const usdShort = (n: number) => (n >= 1e6 ? `US$${(n / 1e6).toFixed(2)}M` : `US$${Math.round(n / 1000)}k`);

/* ── countdowns ─────────────────────────────────────────────────────── */

export function CountdownPills({ a, dark = false }: { a: Auction; dark?: boolean }) {
  const deadline = privateBidDeadline(a);
  const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums";
  const out: React.ReactNode[] = [];
  if (deadline && isLive(a)) {
    const d = daysUntil(deadline);
    const passed = d < 0;
    const urgent = !passed && d <= 3;
    out.push(
      <span
        key="pb"
        className={`${pill} ${passed ? (dark ? "bg-white/10 text-zinc-400" : "bg-zinc-100 text-zinc-500") : urgent ? "bg-[#D64545] text-white" : dark ? "bg-white/10 text-white" : "bg-zinc-950 text-white"}`}
        title={`Private bids until ${fmtWhen(deadline)}${a.private_bid_deadline_estimated ? " (estimated: 14 days before the auction)" : ""}`}
      >
        {passed ? "Private bids closed" : `Private bid deadline ${inDays(deadline)}`}
        {a.private_bid_deadline_estimated && !passed && <span className="font-normal opacity-70">est.</span>}
      </span>,
    );
  }
  if (a.auction_date) {
    const d = daysUntil(a.auction_date);
    out.push(
      <span key="au" className={`${pill} ${dark ? "bg-lime text-zinc-950" : "bg-lime text-zinc-950"}`} title={fmtWhen(a.auction_date)}>
        {a.sale_type === "tender" ? "Tender closes" : "Auction"}: {fmtDay(a.auction_date)}
        {isLive(a) && <span className="font-normal">({d === 0 ? "today" : d === 1 ? "tomorrow" : d > 0 ? `${d}d` : "held"})</span>}
      </span>,
    );
  }
  if (!isLive(a)) {
    out.push(
      <span key="st" className={`${pill} ${a.status === "completed" ? "bg-zinc-100 text-zinc-600" : "bg-[#FFF4E5] text-[#9A5B00]"}`}>
        {STATUS_LABEL[a.status]}
      </span>,
    );
  } else if (a.status === "suspended_private_bid") {
    out.push(<span key="st" className={`${pill} bg-[#FFF4E5] text-[#9A5B00]`}>{STATUS_LABEL[a.status]}</span>);
  }
  return <span className="flex flex-wrap items-center gap-1.5">{out}</span>;
}

/* ── tracking ───────────────────────────────────────────────────────── */

export function TrackButton({ on, onToggle, busy = false, compact = false }: { on: boolean; onToggle: () => void; busy?: boolean; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={on}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold transition-colors disabled:opacity-50 ${compact ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[12.5px]"} ${
        on ? "border-zinc-950 bg-lime text-zinc-950" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950"
      }`}
    >
      {on ? <BellRing size={13} /> : <Bell size={13} />}
      {on ? "Tracking auction date" : "Track auction date"}
    </button>
  );
}

function AlertChoices({ t, onChange }: { t: Tracked; onChange: (patch: Partial<Tracked>) => void }) {
  const [notes, setNotes] = useState(t.user_notes ?? "");
  const box = (k: "notify_private_bid_deadline" | "notify_7d_before" | "notify_24h_before" | "notify_status_change", label: string) => (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-zinc-700">
      <input type="checkbox" checked={t[k]} onChange={(e) => onChange({ [k]: e.target.checked })} className="size-3.5 accent-zinc-950" />
      {label}
    </label>
  );
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">E-mail me</p>
        {box("notify_private_bid_deadline", "3 days before the private bid deadline")}
        {box("notify_7d_before", "7 days before the auction")}
        {box("notify_24h_before", "The day before the auction")}
        {box("notify_status_change", "When the date or status changes")}
      </div>
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Your notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (t.user_notes ?? "") && onChange({ user_notes: notes.trim() || null })}
          maxLength={2000}
          rows={4}
          placeholder="Bank guarantee from Aruba Bank requested; max bid Afl. 650k"
          className="mt-1.5 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[12.5px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-950"
        />
      </label>
    </div>
  );
}

/* ── one auction ────────────────────────────────────────────────────── */

function Facts({ a }: { a: Auction }) {
  const facts: Array<[string, string | null]> = [
    ["Type", a.property_type],
    ["Land title", a.land_tenure ? (a.land_tenure === "Eigendom" ? "Eigendom (freehold)" : "Erfpacht (long lease)") : null],
    ["Land", a.land_m2 ? `${a.land_m2.toLocaleString("en-US")} m²` : null],
    ["Land Registry", a.kadaster_id],
    ["Sale", SALE_LABEL[a.sale_type]],
    ["Private bids", a.sale_type === "tender" ? null : a.private_bids_allowed === true ? "Allowed" : a.private_bids_allowed === false ? "Not allowed" : "Ask the notary"],
    ["Where", a.auction_place],
  ];
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-3">
      {facts.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-zinc-500">{k}</dt>
          <dd className="truncate font-medium text-zinc-900" title={v ?? ""}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AuctionCard({
  a,
  tracked,
  onTrack,
  onUntrack,
  onUpdate,
  onShowOnMap,
}: {
  a: Auction;
  tracked?: Tracked;
  onTrack: () => void;
  onUntrack: () => void;
  onUpdate: (patch: Partial<Tracked>) => void;
  onShowOnMap?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await (tracked ? onUntrack() : onTrack());
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            <Gavel size={12} /> {a.notary_office}
          </p>
          <h3 className="mt-1 font-display text-[17px] leading-snug text-zinc-950">{a.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-zinc-500">
            {[a.area && a.area !== a.district ? a.area : null, a.district].filter(Boolean).join(", ") || "Aruba"}
            {a.auction_date_changed_at && a.previous_auction_date && (
              <span className="ml-2 rounded bg-[#FFF4E5] px-1.5 py-0.5 text-[11px] font-semibold text-[#9A5B00]">
                Moved from {fmtDay(a.previous_auction_date)}
              </span>
            )}
          </p>
        </div>
        {a.starting_bid_awg && (
          <div className="text-right">
            <p className="text-[11px] text-zinc-500">Starting bid</p>
            <p className="font-display text-[18px] font-bold tabular-nums text-zinc-950">{afl(a.starting_bid_awg)}</p>
            <p className="text-[11.5px] tabular-nums text-zinc-500">≈ {usdShort(a.starting_bid_awg / AWG_PER_USD)}</p>
          </div>
        )}
      </div>

      <div className="mt-3">
        <CountdownPills a={a} />
      </div>
      <Facts a={a} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isLive(a) && <TrackButton on={Boolean(tracked)} onToggle={toggle} busy={busy} />}
        {a.auction_date && isLive(a) && (
          <button
            type="button"
            onClick={() => downloadIcs(a)}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2 text-[12.5px] font-semibold text-zinc-800 transition-colors hover:border-zinc-950"
          >
            <CalendarPlus size={13} /> Add to calendar (.ics)
          </button>
        )}
        <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold text-zinc-700 hover:text-zinc-950">
          Notary&apos;s notice <ExternalLink size={12} />
        </a>
        {a.documents.map((d) => (
          <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[12px] text-zinc-600 hover:text-zinc-950">
            <FileText size={12} /> {d.label}
          </a>
        ))}
        {onShowOnMap && a.lat !== null && (
          <button type="button" onClick={onShowOnMap} className="inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[12px] text-zinc-600 hover:text-zinc-950">
            <MapPin size={12} /> On the map{a.pin_source === "district" ? " (approx.)" : ""}
          </button>
        )}
      </div>
      {tracked && <AlertChoices t={tracked} onChange={onUpdate} />}
    </article>
  );
}

/* ── the Auctions page ──────────────────────────────────────────────── */

export function AuctionsView({ onShowOnMap }: { onShowOnMap?: (a: Auction) => void }) {
  const { auctions, loading, error } = useAuctions();
  const { tracked, byAuction, track, untrack, update, error: trackError } = useTrackedAuctions();
  const [view, setView] = useState<"upcoming" | "tracked" | "past">("upcoming");
  const rows = useMemo(() => {
    const by = (x: Auction) => (x.auction_date ? Date.parse(x.auction_date) : Infinity);
    if (view === "tracked") return auctions.filter((a) => byAuction.has(a.id)).sort((p, q) => by(p) - by(q));
    if (view === "past") return auctions.filter((a) => !isLive(a)).sort((p, q) => by(q) - by(p));
    return auctions.filter(isLive).sort((p, q) => by(p) - by(q));
  }, [auctions, byAuction, view]);
  const counts = { upcoming: auctions.filter(isLive).length, tracked: tracked?.length ?? 0, past: auctions.filter((a) => !isLive(a)).length };
  const tab = (k: typeof view, label: string) => (
    <button
      key={k}
      type="button"
      onClick={() => setView(k)}
      aria-pressed={view === k}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
        view === k ? "border-zinc-950 bg-zinc-950 text-lime" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-950"
      }`}
    >
      {label} <span className={`tabular-nums ${view === k ? "text-lime/70" : "text-zinc-400"}`}>{counts[k]}</span>
    </button>
  );
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Auctions">
          {tab("upcoming", "Upcoming")}
          {tab("tracked", "My tracked auctions")}
          {tab("past", "Held, postponed or cancelled")}
        </div>
        <p className="text-[11.5px] text-zinc-500">From the notary offices&apos; own sites, indexed every night · Aruba time (AST)</p>
      </div>
      {(error || trackError) && <p className="mt-3 text-[12.5px] text-[#D64545]">{error ?? trackError}</p>}
      <div className="mt-4 space-y-3">
        {loading &&
          [0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-zinc-100" />)}
        {!loading && !rows.length && (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center">
            <p className="font-display text-[16px] font-bold text-zinc-950">
              {view === "tracked" ? "Track an auction to see it here" : view === "past" ? "Nothing here yet" : "No auctions announced right now"}
            </p>
            <p className="mt-1 text-[12.5px] text-zinc-500">
              {view === "tracked"
                ? "Tap Track auction date on any auction. We e-mail you before the private bid deadline and the auction, and when the notary changes the date."
                : "Baseline checks Aruba's five notary offices every night. New auctions show up here and on the map."}
            </p>
          </div>
        )}
        {rows.map((a) => (
          <AuctionCard
            key={a.id}
            a={a}
            tracked={byAuction.get(a.id)}
            onTrack={() => track(a.id)}
            onUntrack={() => untrack(a.id)}
            onUpdate={(p) => update(a.id, p)}
            onShowOnMap={onShowOnMap ? () => onShowOnMap(a) : undefined}
          />
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        Private bid deadlines marked &ldquo;est.&rdquo; are 14 days before a foreclosure auction, the usual limit in Aruba; the notary&apos;s
        conditions decide. Auctions are often postponed or cancelled when the owner settles or a private bid is accepted. Always confirm
        dates and conditions with the notary.
      </p>
    </section>
  );
}

/* ── the window an auction pin opens ────────────────────────────────── */

export function AuctionPopup({
  a,
  tracked,
  onTrack,
  onUntrack,
  onClose,
  onDetails,
  className = "",
}: {
  a: Auction;
  tracked: boolean;
  onTrack: () => void;
  onUntrack: () => void;
  onClose: () => void;
  onDetails: () => void;
  className?: string;
}) {
  return (
    <motion.div
      role="dialog"
      aria-label={a.title}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.32, ease: EASE }}
      className={`glass z-[6] overflow-hidden rounded-2xl bg-white! p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-lime">
          <Gavel size={12} /> {a.sale_type === "tender" ? "Tender" : "Notary auction"}
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-full text-zinc-600 hover:bg-zinc-100">
          <X size={14} />
        </button>
      </div>
      <p className="mt-2 font-display text-[16px] leading-snug text-zinc-950">{a.title}</p>
      <p className="text-[12px] text-zinc-500">{a.notary_office}{a.district ? ` · ${a.district}` : ""}</p>
      {a.starting_bid_awg && (
        <p className="mt-2 font-display text-[18px] font-bold tabular-nums text-zinc-950">
          {afl(a.starting_bid_awg)} <span className="text-[12px] font-normal text-zinc-500">≈ {usdShort(a.starting_bid_awg / AWG_PER_USD)}</span>
        </p>
      )}
      <div className="mt-2">
        <CountdownPills a={a} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <TrackButton on={tracked} onToggle={tracked ? onUntrack : onTrack} compact />
        <button type="button" onClick={() => downloadIcs(a)} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-[12px] font-semibold text-zinc-800 hover:border-zinc-950">
          <CalendarPlus size={12} /> .ics
        </button>
        <button type="button" onClick={onDetails} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 hover:text-zinc-950">
          Details →
        </button>
      </div>
      {a.pin_source === "district" && <p className="mt-2 text-[10.5px] text-zinc-400">Pin placed near the district centre; the notice gives no exact location.</p>}
    </motion.div>
  );
}
