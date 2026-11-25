"use client";

/**
 * Landing-page hero: a live-looking preview of the Terminal that cycles
 * through its real features (daily Index, price history, watchlist,
 * interested clients). All data comes from the same mock
 * layer as the dashboard, prepared on the server and passed in as props.
 */

import { RunLine } from "@/components/run-line";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Bell, MessageCircle, Minus, Pin, Sparkles, Users } from "lucide-react";
import { TypeText } from "@/components/ai/ai-visuals";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface PreviewRow {
  id: string;
  name: string;
  district: string;
  type: string;
  photo: string | null;
  price: string;
  changePct: number;
  isNew: boolean;
  priceToday: "down" | "up" | null;
  tenure: string;
  status: string;
  agency: { name: string; color: string };
  agent: string | null;
}

export interface PreviewData {
  headline?: string; // AI Signal headline for the latest Index run
  run: { time: string; newCount: number; drops: number; ups: number; statusChanges: number; checked: number };
  rows: PreviewRow[];
  featured: {
    id: string;
    name: string;
    district: string;
    photo: string | null;
    price: string;
    tenure: string;
    agency: { name: string; color: string };
    agent: { name: string; title: string } | null;
    /** [x 0–1, y 0–1] points, y up */
    asking: Array<[number, number]>;
    /** today's estimate */
    estimate: [number, number];
    askingLabel: string;
    marketLabel: string;
    verdict: string;
    verdictColor: string;
    events: Array<{ date: string; label: string; price: string; pct: number | null }>;
  };
  clients: {
    listing: { name: string; district: string; price: string; photo: string | null; agent: string | null };
    people: Array<{ name: string; phone: string; comment: string; added: string }>;
  };
  watchlist: {
    updatesToday: number;
    rows: Array<{ id: string; name: string; district: string; photo: string | null; price: string; sincePct: number; pinned: string; status: string; note: string | null }>;
    activity: Array<{ text: string; color: string; when: string }>;
  };
}

const UP = "#2E9E5B";
const DOWN = "#D64545";
const FLAT = "#E08A1E";

const FEATURES = [
  { key: "index", label: "Daily Index", sub: "New listings & price moves" },
  { key: "history", label: "Price history", sub: "Every asking price change" },
  { key: "watchlist", label: "Watchlist", sub: "Pin and track properties" },
  { key: "clients", label: "Client leads", sub: "Who asked about what" },
] as const;
type FeatureKey = (typeof FEATURES)[number]["key"];

const TAB_FOR: Record<FeatureKey, string> = {
  index: "Listings",
  history: "Listings",
  watchlist: "Watchlist",
  clients: "Listings",
};
const HREF_FOR: Record<FeatureKey, string> = {
  index: "/dashboard?tab=listings",
  history: "/dashboard?tab=listings",
  clients: "/dashboard?tab=listings",
  watchlist: "/dashboard?tab=watchlist",
};

const DURATION = 5600;

function Move({ pct }: { pct: number }) {
  const c = pct < 0 ? DOWN : pct > 0 ? UP : FLAT;
  const Icon = pct < 0 ? ArrowDown : pct > 0 ? ArrowUp : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] font-semibold tabular-nums" style={{ color: c }}>
      <Icon size={10} strokeWidth={2.5} />
      {pct === 0 ? "No change" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  );
}

function Monogram({ name, color, size = 18 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] font-display font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {initials}
    </span>
  );
}

const STATUS_COLOR: Record<string, string> = { "For sale": UP, "Under contract": FLAT, Sold: DOWN, "De-listed": "#71717A" };

/* ── panes ─────────────────────────────────────────────────────────────── */

function IndexPane({ data }: { data: PreviewData }) {
  const r = data.run;
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950">
          <Sparkles size={11} strokeWidth={2.2} />
          AI Signal
        </span>
        <span className="min-w-0 flex-1 basis-[180px] truncate text-zinc-700">
          {data.headline ? <TypeText text={data.headline} delay={900} caret={false} /> : `Today ${r.time}`}
        </span>
        <span className="ml-auto flex items-center gap-2.5 tabular-nums">
          <span className="inline-flex items-center gap-0.5" style={{ color: DOWN }}>
            <ArrowDown size={10} strokeWidth={2.5} />
            {r.drops}
          </span>
          <span className="inline-flex items-center gap-0.5" style={{ color: UP }}>
            <ArrowUp size={10} strokeWidth={2.5} />
            {r.ups}
          </span>
        </span>
      </div>
      <ul className="mt-2.5 flex-1 divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {data.rows.map((l, i) => (
          <motion.li
            key={l.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 px-3 py-2"
          >
            <span className="relative shrink-0">
              {l.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${l.photo}?auto=format&fit=crop&w=96&h=72&q=60`} alt="" className="h-9 w-12 rounded-md bg-zinc-100 object-cover" />
              ) : (
                <span className="block h-9 w-12 rounded-md bg-zinc-100" />
              )}
              <span className="absolute -bottom-1 -right-1 rounded-[5px] ring-2 ring-white">
                <Monogram name={l.agency.name} color={l.agency.color} size={14} />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[12px] font-semibold text-zinc-950">{l.name}</span>
                {l.isNew && <span className="shrink-0 rounded bg-zinc-950 px-1 py-px text-[8px] font-bold tracking-wide text-lime">NEW</span>}
                {l.priceToday && (
                  <span
                    className="shrink-0 rounded px-1 py-px text-[8px] font-bold tracking-wide text-white"
                    style={{ background: l.priceToday === "down" ? DOWN : UP }}
                  >
                    PRICE {l.priceToday === "down" ? "↓" : "↑"}
                  </span>
                )}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-zinc-500">
                {l.district} · {l.type}
                <span className="rounded border px-1 text-[8px] font-semibold uppercase" style={{ color: l.tenure === "Erfpacht" ? "#8A6A2E" : "#0A0A0A", borderColor: l.tenure === "Erfpacht" ? "#8A6A2E55" : "#0A0A0A33" }}>
                  {l.tenure}
                </span>
                {l.agent && <span className="hidden truncate sm:inline">· {l.agent}</span>}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-display text-[12px] font-bold tabular-nums text-zinc-950">{l.price}</span>
              <Move pct={l.changePct} />
            </span>
            <span className="hidden shrink-0 items-center gap-1 text-[10px] text-zinc-600 sm:inline-flex">
              <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[l.status] }} />
              {l.status}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function linePath(pts: Array<[number, number]>, w: number, h: number, step: boolean) {
  return pts
    .map(([x, y], i) => {
      const X = (x * w * 0.94 + w * 0.02).toFixed(1);
      const Y = ((1 - y) * h).toFixed(1);
      if (i === 0) return `M${X},${Y}`;
      if (step) {
        const prevY = ((1 - pts[i - 1][1]) * h).toFixed(1);
        return `L${X},${prevY}L${X},${Y}`;
      }
      return `L${X},${Y}`;
    })
    .join("");
}

export function HistoryPane({ data }: { data: PreviewData }) {
  const f = data.featured;
  const W = 340;
  const H = 130;
  return (
    <div className="grid h-full gap-3 sm:grid-cols-[1fr_160px]">
      <div className="flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-white p-3">
        <div className="flex items-start gap-3">
          {f.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${f.photo}?auto=format&fit=crop&w=120&h=90&q=60`} alt="" className="h-11 w-14 shrink-0 rounded-md bg-zinc-100 object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-zinc-950">{f.name}</p>
            <p className="text-[10px] text-zinc-500">
              {f.district} · {f.tenure} · <span className="font-semibold tabular-nums text-zinc-950">{f.price}</span>
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-zinc-950" /> Asking
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: UP }} /> Est. market value today
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full flex-1" preserveAspectRatio="none" aria-label="Asking price over time and today's estimated market value">
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={0} x2={W} y1={g * H} y2={g * H} stroke="#F4F4F5" />
          ))}
          <motion.path
            d={linePath(f.asking, W, H, true)}
            fill="none"
            stroke="#0A0A0A"
            strokeWidth={2.2}
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.15 }}
          />
          {/* a zero-length round stroke stays a circle however the chart is stretched */}
          <path d={`${linePath([f.estimate], W, H, false)}h0.01`} fill="none" stroke={UP} strokeWidth={9} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <p className="mt-2 text-[11px]">
          <span className="font-semibold tabular-nums text-zinc-950">{f.askingLabel}</span>
          <span className="text-zinc-500"> vs est. today </span>
          <span className="font-semibold tabular-nums" style={{ color: UP }}>{f.marketLabel}</span>
          <span className="text-zinc-500"> · </span>
          <span className="font-semibold" style={{ color: f.verdictColor }}>{f.verdict}</span>
        </p>
      </div>
      <div className="hidden flex-col gap-2 sm:flex">
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Price history</p>
          <ul className="mt-2 space-y-1.5">
            {f.events.map((e) => (
              <li key={e.date + e.label} className="text-[10px]">
                <span className="flex justify-between gap-2">
                  <span className="text-zinc-500">{e.date}</span>
                  {e.pct !== null ? <Move pct={e.pct} /> : <span className="text-zinc-400">Listed</span>}
                </span>
                <span className="block font-semibold tabular-nums text-zinc-950">{e.price}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Listed by</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-950">
            <Monogram name={f.agency.name} color={f.agency.color} size={16} />
            <span className="truncate">{f.agency.name}</span>
          </p>
          {f.agent && (
            <p className="mt-1 truncate text-[10px] text-zinc-500">
              Agent <span className="text-zinc-800">{f.agent.name}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

export function ClientsPane({ data }: { data: PreviewData }) {
  const c = data.clients;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5">
        {c.listing.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${c.listing.photo}?auto=format&fit=crop&w=96&h=72&q=60`} alt="" className="h-9 w-12 shrink-0 rounded-md bg-zinc-100 object-cover" />
        ) : (
          <span className="block h-9 w-12 shrink-0 rounded-md bg-zinc-100" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-zinc-950">{c.listing.name}</span>
          <span className="block truncate text-[10px] text-zinc-500">
            {c.listing.district} · {c.listing.price}
            {c.listing.agent && <> · Agent {c.listing.agent}</>}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime px-2 py-0.5 text-[10px] font-semibold text-zinc-950">
          <Users size={10} strokeWidth={2} /> {c.people.length} interested
        </span>
      </div>
      <ul className="flex-1 space-y-2 overflow-hidden p-2.5">
        {c.people.map((p, i) => (
          <motion.li
            key={p.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[9px] font-semibold text-lime" aria-hidden>
                {initials(p.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-zinc-950">{p.name}</span>
                <span className="flex items-center gap-2 text-[10px]">
                  <span className="tabular-nums text-zinc-600">{p.phone}</span>
                  <span className="inline-flex items-center gap-0.5 font-medium text-[#2E9E5B]">
                    <MessageCircle size={9} strokeWidth={2.2} /> WhatsApp
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-[9px] text-zinc-400">{p.added}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-zinc-700">{p.comment}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function WatchPane({ data }: { data: PreviewData }) {
  const w = data.watchlist;
  return (
    <div className="grid h-full gap-2.5 sm:grid-cols-[minmax(0,1fr)_170px]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950">
            <Pin size={11} strokeWidth={2} fill="currentColor" /> Your watchlist
          </span>
          <span className="tabular-nums text-zinc-500">{w.rows.length} pinned · {w.updatesToday} updates today</span>
        </div>
        <ul className="flex-1 divide-y divide-zinc-100 overflow-hidden">
          {w.rows.map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 px-3 py-2"
            >
              {r.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${r.photo}?auto=format&fit=crop&w=96&h=72&q=60`} alt="" className="h-9 w-12 shrink-0 rounded-md bg-zinc-100 object-cover" />
              ) : (
                <span className="block h-9 w-12 shrink-0 rounded-md bg-zinc-100" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-zinc-950">{r.name}</span>
                <span className="block truncate text-[10px] text-zinc-500">
                  {r.note ? <span className="italic">“{r.note}”</span> : <>{r.district} · pinned {r.pinned}</>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-[12px] font-bold tabular-nums text-zinc-950">{r.price}</span>
                {r.status !== "For sale" ? (
                  <span className="text-[10px] font-semibold" style={{ color: STATUS_COLOR[r.status] }}>{r.status}</span>
                ) : (
                  <Move pct={r.sincePct} />
                )}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
      <div className="hidden min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white sm:flex">
        <p className="border-b border-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-950">Activity</p>
        <ul className="flex-1 space-y-2.5 overflow-hidden px-3 py-2.5">
          {w.activity.map((a, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-2"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="text-[10px] leading-snug text-zinc-700">
                {a.text}
                <span className="block text-zinc-400">{a.when}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── shell ─────────────────────────────────────────────────────────────── */

export function TerminalPreview({ data }: { data: PreviewData }) {
  const [active, setActive] = useState<FeatureKey>("index");
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || reduced.current) return;
    const t = window.setTimeout(() => {
      setActive((a) => FEATURES[(FEATURES.findIndex((f) => f.key === a) + 1) % FEATURES.length].key);
      setCycle((c) => c + 1);
    }, DURATION);
    return () => window.clearTimeout(t);
  }, [active, paused, cycle]);

  const pick = (k: FeatureKey) => {
    setActive(k);
    setCycle((c) => c + 1);
  };

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10 sm:rounded-3xl">
        <RunLine speed={11} delay={-5} />
        {/* window chrome */}
        <div className="flex items-center gap-3 border-b border-mint-deep bg-mint px-3 py-2.5 sm:px-4">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-zinc-950/15" />
            <span className="size-2.5 rounded-full bg-zinc-950/15" />
            <span className="size-2.5 rounded-full bg-zinc-950/15" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
            {["Listings", "Watchlist"].map((t) => (
              <span key={t} className={`relative whitespace-nowrap text-[10px] tracking-wide sm:text-[11px] ${TAB_FOR[active] === t ? "text-zinc-950" : "text-zinc-500"}`}>
                {t}
                {TAB_FOR[active] === t && <motion.span layoutId="tp-tab" className="absolute inset-x-0 -bottom-[11px] h-px bg-zinc-950" />}
              </span>
            ))}
          </span>
          <span className="relative hidden size-6 items-center justify-center rounded-full border border-zinc-950/15 bg-white/70 sm:flex" aria-hidden>
            <Bell size={11} strokeWidth={1.75} />
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-zinc-950 px-0.5 text-[8px] font-semibold text-lime">
              {data.run.newCount + data.run.drops + data.run.ups + data.run.statusChanges}
            </span>
          </span>
        </div>

        {/* pane */}
        <div className="relative h-[330px] bg-mint-soft/60 p-3 sm:h-[360px] sm:p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              className="h-full"
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              {active === "index" && <IndexPane data={data} />}
              {active === "history" && <HistoryPane data={data} />}
              {active === "clients" && <ClientsPane data={data} />}
              {active === "watchlist" && <WatchPane data={data} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* feature tabs */}
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0" role="tablist" aria-label="Terminal features">
        {FEATURES.map((f) => {
          const on = f.key === active;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(f.key)}
              className={`group relative min-w-[132px] shrink-0 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors sm:min-w-0 ${
                on ? "border-zinc-950 bg-white" : "border-zinc-200 bg-white/60 hover:border-zinc-400 hover:bg-white"
              }`}
            >
              <span className={`block text-[12px] font-semibold ${on ? "text-zinc-950" : "text-zinc-700"}`}>{f.label}</span>
              <span className="mt-0.5 block truncate text-[10px] text-zinc-500">{f.sub}</span>
              {on && (
                <span
                  key={cycle}
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-zinc-950 motion-reduce:hidden"
                  style={{ animation: `sd-progress ${DURATION}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-zinc-500">
        Live preview of the Terminal.{" "}
        <Link href={HREF_FOR[active]} className="font-medium text-zinc-950 underline-offset-4 hover:underline">
          Open {FEATURES.find((f) => f.key === active)?.label} →
        </Link>
      </p>
    </div>
  );
}
