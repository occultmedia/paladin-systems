"use client";

/**
 * Landing-page hero: a live-looking preview of Baseline that cycles
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
  /** How many agencies list it: one pin, every agency's price. */
  agencies: number;
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
    /** Every agency's asking price for this home, lowest first (no names on the landing page). */
    offers: string[];
    /** [x 0–1, y 0–1] points, y up */
    asking: Array<[number, number]>;
    /** today's estimate */
    estimate: [number, number];
    /** The price chart: each price event, price ticks and month labels (positions 0-1, y up). */
    chart: {
      points: Array<{ x: number; y: number; price: string; date: string; pct: number | null }>;
      ticks: Array<{ y: number; label: string }>;
      months: Array<{ x: number; label: string }>;
    };
    askingLabel: string;
    marketLabel: string;
    verdict: string;
    verdictColor: string;
    events: Array<{ date: string; label: string; price: string; pct: number | null }>;
  };
  clients: {
    listing: { name: string; district: string; price: string; photo: string | null };
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
              {l.agencies > 1 && (
                <span className="absolute -bottom-1 -right-1 grid h-3.5 min-w-[14px] place-items-center rounded-[4px] bg-zinc-950 px-0.5 text-[8px] font-bold text-lime ring-2 ring-white" title={`Listed by ${l.agencies} agencies`}>
                  {l.agencies}
                </span>
              )}
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
                {l.agencies > 1 && <span className="hidden truncate sm:inline">· {l.agencies} agencies</span>}
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


/** Asking price over time: a step line over a lime wash, a marker per price event, today's estimate dashed. */
function PriceChart({ f }: { f: PreviewData["featured"] }) {
  const W = 640;
  const H = 200;
  const pad = { l: 10, r: 58, t: 28, b: 24 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const X = (x: number) => pad.l + x * pw;
  const Y = (y: number) => pad.t + (1 - y) * ph;
  const pts = f.chart.points;
  // a step line: the price holds until it changes, then runs on to today
  let line = "";
  pts.forEach((p, i) => {
    line += i === 0 ? `M${X(p.x)},${Y(p.y)}` : `H${X(p.x)}V${Y(p.y)}`;
  });
  if (pts.length) line += `H${X(1)}`;
  const area = pts.length ? `${line}V${pad.t + ph}H${X(pts[0].x)}Z` : "";
  const estY = Y(f.estimate[1]);
  const last = pts[pts.length - 1];
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded bg-zinc-950" /> Asking price
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: UP }} /> Est. market value today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full border-2 border-zinc-950 bg-white" /> Price change
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="mt-2 min-h-0 w-full flex-1" role="img" aria-label="Asking price over time and today's estimated market value">
        <defs>
          <linearGradient id="hist-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ACFA68" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ACFA68" stopOpacity="0" />
          </linearGradient>
        </defs>
        {f.chart.ticks.map((t) => (
          <g key={t.label}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(t.y)} y2={Y(t.y)} stroke="#EEEEF0" />
            <text x={W - pad.r + 8} y={Y(t.y) + 3.5} fontSize="10" fill="#A1A1AA">{t.label}</text>
          </g>
        ))}
        {f.chart.months.map((m) => (
          <text key={m.label + m.x} x={X(m.x)} y={H - 8} fontSize="10" fill="#A1A1AA" textAnchor="middle">{m.label}</text>
        ))}
        <motion.path d={area} fill="url(#hist-wash)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6 }} />
        <motion.path
          d={line}
          fill="none"
          stroke="#0A0A0A"
          strokeWidth={2.4}
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.3, ease: "easeOut", delay: 0.15 }}
        />
        {/* today's estimate */}
        <line x1={pad.l} x2={W - pad.r} y1={estY} y2={estY} stroke={UP} strokeWidth={1.6} strokeDasharray="5 5" />
        <g transform={`translate(${pad.l + 4}, ${estY + 5})`}>
          <rect x={0} y={0} width={108} height={16} rx={8} fill="#E8F6EE" />
          <text x={54} y={11} fontSize="9.5" fontWeight="600" fill={UP} textAnchor="middle">Est. today {f.marketLabel}</text>
        </g>
        {pts.map((p, i) => {
          const cx = X(p.x);
          const cy = Y(p.y);
          const label = p.pct === null ? "Listed" : `${p.pct > 0 ? "+" : "−"}${Math.abs(p.pct).toFixed(1)}%`;
          const color = p.pct === null ? "#52525B" : p.pct < 0 ? DOWN : UP;
          return (
            <motion.g key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.25, duration: 0.4 }}>
              <circle cx={cx} cy={cy} r={5} fill="#FFFFFF" stroke="#0A0A0A" strokeWidth={2.2} />
              <text x={Math.min(Math.max(cx, pad.l + 30), W - pad.r - 30)} y={cy - 12} fontSize="10" textAnchor="middle">
                <tspan fill="#71717A">{p.date} · </tspan>
                <tspan fill={color} fontWeight="600">{label}</tspan>
              </text>
              <text x={Math.min(Math.max(cx, pad.l + 30), W - pad.r - 30)} y={cy + 19} fontSize="10.5" fontWeight="700" fill="#0A0A0A" textAnchor="middle">{p.price}</text>
            </motion.g>
          );
        })}
        {last && (
          <g>
            <circle cx={X(1)} cy={Y(last.y)} r={4} fill="#ACFA68" stroke="#0A0A0A" strokeWidth={1.5} />
            <circle cx={X(1)} cy={Y(last.y)} r={4} fill="none" stroke="#ACFA68" strokeWidth={2}>
              <animate attributeName="r" values="4;11;4" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0;0.9" dur="2.4s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>
    </div>
  );
}

export function HistoryPane({ data }: { data: PreviewData }) {
  const f = data.featured;
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
        <PriceChart f={f} />
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
          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-500">Listed by {f.offers.length} {f.offers.length === 1 ? "agency" : "agencies"}</p>
          <ul className="mt-1.5 space-y-1">
            {f.offers.map((o, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-zinc-500">{i === 0 ? "Lowest asking" : `Offer ${i + 1}`}</span>
                <span className="font-semibold tabular-nums text-zinc-950">{o}</span>
              </li>
            ))}
          </ul>
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
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0" role="tablist" aria-label="Baseline features">
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
        Live preview of Baseline.{" "}
        <Link href={HREF_FOR[active]} className="font-medium text-zinc-950 underline-offset-4 hover:underline">
          Open {FEATURES.find((f) => f.key === active)?.label} →
        </Link>
      </p>
    </div>
  );
}
