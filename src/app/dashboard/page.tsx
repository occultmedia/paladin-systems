"use client";

/**
 * SEQUENCE DATA — Aruba Luxury STR Terminal (MVP)
 * Single-file dashboard: types → data layer → formatters → UI.
 *
 * Deps: next, react, tailwindcss, lucide-react, recharts
 * Drop in as app/page.tsx (or app/dashboard/page.tsx).
 *
 * To go live: implement `supabaseRepository` (sketch below) and flip
 * `repository` to it. Nothing in the UI layer needs to change.
 */

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/logo";
import {
  COMMERCIAL_USES,
  DISTRICTS,
  MARKET_ID,
  PLATFORM_LABEL,
  RENTAL_PLATFORMS,
  RESIDENTIAL_TYPES,
  SCRAPE_RUNS,
  TENURES,
  TENURE_HINT,
  ZONINGS,
  estimateRevenue,
  repository,
  type EstimateInput,
  type DistrictStats,
  type Listing,
  type ListingSignal,
  type MarketSnapshot,
  type MonthlyPerformance,
  type PriceEvent,
  type PropertyType,
  type ScrapeRun,
  type Signal,
  type Tenure,
  type VacationRental,
} from "@/lib/aruba-data";
import { PLATFORM_COLOR } from "@/components/dashboard/map-shared";
import { Inter } from "next/font/google";
import {
  ArrowDownRight,
  ArrowRight,
  Calculator,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  Bell,
  ChevronDown,
  CreditCard,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  Search,
  SlidersHorizontal,
  User,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ─────────────────────────────────────────────────────────────────────────
 * Fonts
 * ──────────────────────────────────────────────────────────────────────── */

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
/** Numbers use Inter with tabular figures so columns line up (no monospace). */
const MONO = "tabular-nums";
const MONO_FAMILY = inter.style.fontFamily;

/* ─────────────────────────────────────────────────────────────────────────
 * Palette (white / ink / slate; muted green & red reserved for deltas)
 * ──────────────────────────────────────────────────────────────────────── */

const C = {
  ink: "#0A0A0A",
  slate300: "#52525B",
  slate500: "#71717A",
  slate700: "#D4D4D8",
  hairline: "#F1F1F2",
  up: "#5E8A6B", // desaturated green
  down: "#A05A5D", // desaturated red
} as const;

/* Types, mock data and the repository live in src/lib/aruba-data.ts. */

const ArubaMap = dynamic(() => import("@/components/dashboard/aruba-map"), {
  ssr: false,
  loading: () => <div className="h-[520px] w-full animate-pulse bg-zinc-100" />,
});


interface DashboardData {
  snapshot: MarketSnapshot;
  monthly: MonthlyPerformance[];
  listings: ListingSignal[];
  allListings: Listing[];
  rentals: VacationRental[];
}

function useDashboardData(marketId: string) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      repository.getMarketSnapshot(marketId),
      repository.getMonthlyPerformance(marketId, 12),
      repository.getActiveListingSignals(marketId, 5),
      repository.getActiveListings(marketId),
      repository.getVacationRentals(marketId),
    ])
      .then(([snapshot, monthly, listings, allListings, rentals]) => {
        if (!cancelled) setData({ snapshot, monthly, listings, allListings, rentals });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Feed unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  return { data, error, loading: !data && !error };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Formatters
 * ──────────────────────────────────────────────────────────────────────── */

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const fmtUsd = (n: number) => usd0.format(n);
const fmtUsdCompact = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : usd0.format(n);
const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;
const fmtDelta = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}%`;
const fmtBps = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${int.format(Math.abs(n))} bps`;
const fmtMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
const fmtMonthYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
const fmtTimestamp = (iso: string) =>
  new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";

const deltaColor = (n: number) => (n > 0 ? C.up : n < 0 ? C.down : C.slate500);

/* Asking-price moves: up = green, down = red, no change = orange. */
const PRICE_UP = "#2E9E5B";
const PRICE_DOWN = "#D64545";
const PRICE_FLAT = "#E08A1E";
const priceColor = (n: number) => (n > 0 ? PRICE_UP : n < 0 ? PRICE_DOWN : PRICE_FLAT);

function PriceMove({ pct, label = true, size = 12 }: { pct: number; label?: boolean; size?: number }) {
  const Icon = pct > 0 ? ArrowUp : pct < 0 ? ArrowDown : ArrowRight;
  return (
    <span className={`${MONO} inline-flex items-center gap-0.5 font-semibold`} style={{ color: priceColor(pct) }}>
      <Icon size={size} strokeWidth={2.5} aria-hidden />
      {pct === 0 ? (label ? "No change" : "0%") : `${Math.abs(pct).toFixed(1)}%`}
      <span className="sr-only">{pct > 0 ? "price up" : pct < 0 ? "price down" : "no price change"}</span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Header
 * ──────────────────────────────────────────────────────────────────────── */

function Logo() {
  return (
    <Link href="/" className="select-none" aria-label="Sequence Data home">
      <Wordmark tagline />
    </Link>
  );
}

const TABS = ["Listings & Rentals", "Districts", "Revenue Estimator", "Rental Market"] as const;
type Tab = (typeof TABS)[number];
const TAB_SLUG: Record<Tab, string> = {
  "Listings & Rentals": "listings",
  Districts: "districts",
  "Revenue Estimator": "estimator",
  "Rental Market": "rental",
};

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { icon: User, label: "Profile" },
    { icon: KeyRound, label: "API Keys" },
    { icon: CreditCard, label: "Billing" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 border border-zinc-950/15 bg-white/70 px-3 py-1.5 text-[12px] tracking-wide text-zinc-800 transition-colors hover:bg-white hover:text-zinc-950"
      >
        <User size={13} strokeWidth={1.5} />
        Account
        <ChevronDown size={13} strokeWidth={1.5} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-60 border border-zinc-300 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <p className="text-[12px] text-zinc-950">Investor Account</p>
            <p className={`${MONO} mt-1 text-[11px] text-zinc-500`}>TIER: ARUBA CORE · $150/MO</p>
          </div>
          {items.map(({ icon: Icon, label }) => (
            <button
              key={label}
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950"
            >
              <Icon size={13} strokeWidth={1.5} />
              {label}
            </button>
          ))}
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-3 border-t border-zinc-200 px-4 py-2.5 text-left text-[12px] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-950"
          >
            <LogOut size={13} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Header({ tab, onTab, updates, onUpdates }: { tab: Tab; onTab: (t: Tab) => void; updates: number; onUpdates: () => void }) {
  return (
    <header className="border-b border-mint-deep bg-mint">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-4 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">
        <div className="flex items-center gap-12">
          <Logo />
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTab(t)}
                className={`relative whitespace-nowrap py-[22px] text-[12px] tracking-wide transition-colors ${
                  tab === t ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {t}
                {tab === t && <span className="absolute inset-x-0 bottom-0 h-px bg-zinc-950" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: C.up }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: C.up }} />
            </span>
            <span className={`${MONO} whitespace-nowrap text-[11px] tracking-wider text-zinc-600`}>
              LIVE DATA: <span className="text-zinc-800">ARUBA NODE CONNECTED</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onUpdates}
            aria-label={`Terminal updates: ${updates} today`}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-950/15 bg-white/60 text-zinc-800 transition-colors hover:bg-white"
          >
            <Bell size={15} strokeWidth={1.75} />
            {updates > 0 && (
              <span className={`${MONO} absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zinc-950 px-1 text-[10px] font-semibold text-mint`}>
                {updates}
              </span>
            )}
          </button>
          <AccountMenu />
        </div>

        {/* mobile tabs */}
        <nav className="flex gap-6 overflow-x-auto lg:hidden" aria-label="Primary mobile">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTab(t)}
              className={`whitespace-nowrap pb-2 text-[12px] ${tab === t ? "border-b border-zinc-950 text-zinc-950" : "text-zinc-500"}`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Shared bits
 * ──────────────────────────────────────────────────────────────────────── */

function SectionLabel({ index, title, meta }: { index: string; title: string; meta?: string }) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-4">
      <div className="flex items-baseline gap-4">
        <span className={`${MONO} text-[11px] text-zinc-500`}>{index}</span>
        <h2 className="font-display text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-700">{title}</h2>
      </div>
      {meta && <span className={`${MONO} hidden text-[11px] text-zinc-500 sm:block`}>{meta}</span>}
    </div>
  );
}

function Delta({ value, suffix = "YOY" }: { value: number; suffix?: string }) {
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`${MONO} inline-flex items-center gap-1 text-[12px]`} style={{ color: deltaColor(value) }}>
      <Icon size={12} strokeWidth={1.5} />
      {fmtDelta(value)}
      <span className="ml-1 text-zinc-500">{suffix}</span>
    </span>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-100 ${className}`} />;
}

/* ─────────────────────────────────────────────────────────────────────────
 * 01 — Anchor metrics
 * ──────────────────────────────────────────────────────────────────────── */

function AnchorMetrics({ snapshot }: { snapshot?: MarketSnapshot }) {
  const metrics = snapshot
    ? [
        { label: "Average Occupancy Rate", value: fmtPct(snapshot.avg_occupancy_pct), delta: snapshot.avg_occupancy_yoy_pct, note: "Trailing 12M" },
        { label: "Average Daily Rate", value: fmtUsd(snapshot.avg_daily_rate_usd), unit: "USD", delta: snapshot.avg_daily_rate_yoy_pct, note: "Occupancy-weighted" },
        { label: "Estimated Gross Yield", value: fmtPct(snapshot.est_gross_yield_pct), delta: snapshot.est_gross_yield_yoy_pct, note: "On asking price" },
      ]
    : null;

  return (
    <section>
      <SectionLabel
        index="01"
        title="Aruba Luxury Market"
        meta={snapshot ? `N=${snapshot.sample_size} ASSETS · AS OF ${fmtTimestamp(snapshot.as_of)}` : undefined}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3">
        {(metrics ?? [null, null, null]).map((m, i) => (
          <div
            key={i}
            className={`py-6 sm:py-2 ${i > 0 ? "border-t border-zinc-200 sm:border-l sm:border-t-0 sm:pl-10" : ""}`}
          >
            {m ? (
              <>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{m.label}</p>
                <p className={`${MONO} mt-5 text-[44px] font-semibold leading-none tracking-tight text-zinc-950`}>
                  {m.value}
                  {m.unit && <span className="ml-2 text-[13px] text-zinc-500">{m.unit}</span>}
                </p>
                <div className="mt-5 flex items-center justify-between pr-10">
                  <Delta value={m.delta} />
                  <span className="text-[11px] text-zinc-500">{m.note}</span>
                </div>
              </>
            ) : (
              <>
                <Skeleton className="h-3 w-40" />
                <Skeleton className="mt-5 h-11 w-36" />
                <Skeleton className="mt-5 h-3 w-24" />
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 02 — Historical booking analysis
 * ──────────────────────────────────────────────────────────────────────── */

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
  payload?: MonthlyPerformance;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (!row) return null;
  return (
    <div className={`${MONO} border border-zinc-300 bg-white px-4 py-3 text-[11px]`}>
      <p className="mb-2 tracking-wider text-zinc-500">{fmtMonthYear(row.month)}</p>
      <div className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1">
        <span className="text-zinc-500">RevPAR</span>
        <span className="text-right text-zinc-950">{fmtUsd(row.revpar_usd)}</span>
        <span className="text-zinc-500">Occupancy</span>
        <span className="text-right text-zinc-700">{fmtPct(row.occupancy_pct)}</span>
        <span className="text-zinc-500">ADR</span>
        <span className="text-right text-zinc-700">{fmtUsd(row.adr_usd)}</span>
      </div>
    </div>
  );
}

function LegendKey({ dashed, color, label }: { dashed?: boolean; color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[11px] text-zinc-600">
      <svg width="20" height="2" aria-hidden>
        <line x1="0" y1="1" x2="20" y2="1" stroke={color} strokeWidth="1.5" strokeDasharray={dashed ? "3 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function HistoricalChart({ monthly }: { monthly?: MonthlyPerformance[] }) {
  const stats = useMemo(() => {
    if (!monthly?.length) return null;
    const avg = monthly.reduce((sum, m) => sum + m.revpar_usd, 0) / monthly.length;
    const peak = monthly.reduce((a, b) => (b.revpar_usd > a.revpar_usd ? b : a));
    const trough = monthly.reduce((a, b) => (b.revpar_usd < a.revpar_usd ? b : a));
    return { avg, peak, trough };
  }, [monthly]);

  const tick = { fill: C.slate500, fontSize: 11, fontFamily: MONO_FAMILY };

  return (
    <section>
      <SectionLabel index="02" title="Historical Booking Analysis" meta="RevPAR vs. Occupancy · Trailing 12M" />
      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        <LegendKey color={C.ink} label="RevPAR (USD)" />
        <LegendKey color={C.slate500} dashed label="Occupancy (%)" />
        {stats && (
          <span className={`${MONO} ml-auto flex gap-6 text-[11px] text-zinc-500`}>
            <span>
              PEAK <span className="text-zinc-800">{fmtUsd(stats.peak.revpar_usd)}</span> {fmtMonth(stats.peak.month)}
            </span>
            <span>
              TROUGH <span className="text-zinc-800">{fmtUsd(stats.trough.revpar_usd)}</span> {fmtMonth(stats.trough.month)}
            </span>
            <span>
              AVG <span className="text-zinc-800">{fmtUsd(stats.avg)}</span>
            </span>
          </span>
        )}
      </div>

      <div className="h-[320px] w-full">
        {monthly ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke={C.hairline} strokeWidth={1} />
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonth}
                axisLine={{ stroke: C.slate700 }}
                tickLine={false}
                tick={tick}
                dy={10}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="revpar"
                axisLine={false}
                tickLine={false}
                tick={tick}
                width={56}
                tickCount={5}
                domain={[400, 1800]}
                tickFormatter={(v: number) => `$${int.format(v)}`}
              />
              <YAxis
                yAxisId="occ"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={tick}
                width={44}
                tickCount={5}
                domain={[50, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: C.slate700, strokeWidth: 1 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="revpar"
                type="monotone"
                dataKey="revpar_usd"
                stroke={C.ink}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: C.ink, stroke: "#FFF", strokeWidth: 2 }}
                animationDuration={900}
              />
              <Line
                yAxisId="occ"
                type="monotone"
                dataKey="occupancy_pct"
                stroke={C.slate500}
                strokeWidth={1.25}
                strokeDasharray="3 4"
                dot={false}
                activeDot={{ r: 3, fill: C.slate300, stroke: "#FFF", strokeWidth: 2 }}
                animationDuration={900}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 03 — Yield radar (ledger)
 * ──────────────────────────────────────────────────────────────────────── */

const SIGNAL_STYLE: Record<Signal, { label: string; color: string }> = {
  UNDERVALUED: { label: "Undervalued", color: C.up },
  AT_MARKET: { label: "At Market", color: C.slate300 },
  OVERPRICED: { label: "Overpriced", color: C.down },
};

function SignalBadge({ signal }: { signal: Signal }) {
  const s = SIGNAL_STYLE[signal];
  return (
    <span className={`${MONO} inline-flex items-center gap-2 text-[11px] uppercase tracking-wider`} style={{ color: s.color }}>
      <span className="h-1.5 w-1.5" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function YieldRadar({ listings, marketYield }: { listings?: ListingSignal[]; marketYield?: number }) {
  const th = "px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-300";
  const td = "px-4 py-4 border-b border-zinc-200";

  return (
    <section>
      <SectionLabel
        index="03"
        title="Yield Radar — Villas For Sale"
        meta={marketYield !== undefined ? `BENCHMARK GROSS YIELD ${fmtPct(marketYield)}` : undefined}
      />
      <div className="overflow-x-auto border-t border-zinc-300">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr>
              <th className={`${th} w-[34%] pl-0`}>Asset Name</th>
              <th className={`${th} text-right`}>Asking Price</th>
              <th className={`${th} text-right`}>Sequence ADR</th>
              <th className={`${th} text-right`}>Projected Yield</th>
              <th className={`${th} pr-0 text-right`}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {listings
              ? listings.map((l) => (
                  <tr key={l.listing_id} className="transition-colors hover:bg-zinc-50">
                    <td className={`${td} pl-0`}>
                      <p className="text-[13px] text-zinc-950">{l.asset_name}</p>
                      <p className={`${MONO} mt-1 text-[11px] text-zinc-500`}>
                        {l.listing_id} · {l.district.toUpperCase()} · {l.bedrooms}BR
                      </p>
                    </td>
                    <td className={`${td} ${MONO} text-right text-[13px] text-zinc-800`}>
                      {fmtUsdCompact(l.asking_price_usd)}
                    </td>
                    <td className={`${td} ${MONO} text-right text-[13px] text-zinc-800`}>
                      {fmtUsd(l.sequence_adr_usd)}
                      <span className="ml-1 text-[11px] text-zinc-500">/NT</span>
                    </td>
                    <td className={`${td} ${MONO} text-right`}>
                      <p className="text-[13px] text-zinc-950">{fmtPct(l.projected_gross_yield_pct)}</p>
                      <p className="mt-1 text-[11px]" style={{ color: deltaColor(l.yield_spread_bps) }}>
                        {fmtBps(l.yield_spread_bps)}
                      </p>
                    </td>
                    <td className={`${td} pr-0 text-right`}>
                      <SignalBadge signal={l.signal} />
                    </td>
                  </tr>
                ))
              : Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className={`${td} px-0`}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        Projected yield = Sequence ADR × 365 × modeled occupancy ÷ asking price. Spread shown against the
        Aruba luxury benchmark. Gross, pre-OpEx, pre-management.
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Active Listings — map of every listing on top, the full list below
 * ──────────────────────────────────────────────────────────────────────── */

type Category = "All" | "Property" | "Land" | "Commercial";
type SortKey = "name" | "district" | "beds" | "size" | "asking" | "psf" | "adr" | "yield" | "vsDistrict" | "listed";

const SORT_VALUE: Record<SortKey, (l: Listing) => number | string | null> = {
  name: (l) => l.asset_name,
  district: (l) => l.district,
  beds: (l) => (l.category === "Property" ? l.bedrooms : null),
  size: (l) => (l.category === "Land" ? l.lot_sqft : l.built_sqft),
  asking: (l) => l.asking_price_usd,
  psf: (l) => l.price_per_sqft_usd,
  adr: (l) => (l.category === "Property" ? l.sequence_adr_usd : null),
  yield: (l) => (l.category === "Property" ? l.projected_gross_yield_pct : null),
  vsDistrict: (l) => (l.category === "Property" ? null : l.price_vs_district_pct),
  listed: (l) => l.days_on_market,
};

const CATEGORY_FILTERS: Array<{ value: Category; label: string }> = [
  { value: "All", label: "All" },
  { value: "Property", label: "Residential" },
  { value: "Land", label: "Land" },
  { value: "Commercial", label: "Commercial" },
];
const SIGNAL_FILTERS: Array<{ value: Signal | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "UNDERVALUED", label: "Undervalued" },
  { value: "AT_MARKET", label: "At Market" },
  { value: "OVERPRICED", label: "Overpriced" },
];
/** Type chips shown for each category. In "All" the chips are the listing types themselves. */
const TYPE_OPTIONS: Record<Category, string[]> = {
  All: [...RESIDENTIAL_TYPES, "Land", "Commercial"],
  Property: RESIDENTIAL_TYPES,
  Land: ZONINGS,
  Commercial: COMMERCIAL_USES,
};
const TYPE_LABEL: Record<Category, string> = { All: "Type", Property: "Home type", Land: "Zoning", Commercial: "Use" };
const PRICE_STEPS = [250_000, 500_000, 750_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000];
const SIZE_STEPS = [1_000, 2_500, 5_000, 10_000, 20_000, 50_000];

/** The value a listing's type chip compares against, given the category view. */
function subtypeOf(l: Listing, category: Category): string {
  if (category === "All") return l.property_type;
  if (l.category === "Land") return l.zoning;
  if (l.category === "Commercial") return l.commercial_use;
  return l.property_type;
}
const typeLine = (l: Listing) =>
  l.category === "Land" ? `Land · ${l.zoning}` : l.category === "Commercial" ? `Commercial · ${l.commercial_use}` : l.property_type;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const fmtSqft = (n: number) => `${int.format(n)} sq ft`;
const fmtDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const fmtPriceStep = (n: number) => (n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}k`);
const DASH = <span className="text-zinc-300">—</span>;

function downloadCsv(rows: Listing[]) {
  const p = (l: Listing) => (l.category === "Property" ? l : null);
  const d = (l: Listing) => (l.category === "Land" ? l : null);
  const c = (l: Listing) => (l.category === "Commercial" ? l : null);
  const cols: Array<[string, (l: Listing) => string | number | null | undefined]> = [
    ["Listing ID", (l) => l.listing_id],
    ["Category", (l) => (l.category === "Property" ? "Residential" : l.category)],
    ["Name", (l) => l.asset_name],
    ["Type", (l) => l.property_type],
    ["Commercial use", (l) => c(l)?.commercial_use],
    ["Zoning", (l) => d(l)?.zoning],
    ["District", (l) => l.district],
    ["Land title", (l) => l.tenure],
    ["Erfpacht years left", (l) => l.lease_years_left],
    ["New today", (l) => (l.is_new ? "Yes" : "")],
    ["Last price change", (l) => l.last_price_change?.date],
    ["Bedrooms", (l) => p(l)?.bedrooms],
    ["Bathrooms", (l) => p(l)?.bathrooms],
    ["Built sq ft", (l) => (l.category === "Land" ? null : l.built_sqft)],
    ["Lot sq ft", (l) => l.lot_sqft],
    ["Asking price USD", (l) => l.asking_price_usd],
    ["Price per sq ft USD", (l) => l.price_per_sqft_usd],
    ["Price change %", (l) => l.price_change_pct],
    ["District avg per sq ft USD", (l) => d(l)?.district_land_psf_usd ?? c(l)?.district_commercial_psf_usd],
    ["Price vs district %", (l) => (l.category === "Property" ? null : l.price_vs_district_pct)],
    ["Est. ADR USD", (l) => p(l)?.sequence_adr_usd],
    ["Est. occupancy %", (l) => p(l)?.projected_occupancy_pct],
    ["Est. annual revenue USD", (l) => p(l)?.projected_annual_revenue_usd],
    ["Projected gross yield %", (l) => p(l)?.projected_gross_yield_pct],
    ["Yield spread vs market bps", (l) => p(l)?.yield_spread_bps],
    ["Signal", (l) => SIGNAL_STYLE[l.signal].label],
    ["Days on market", (l) => l.days_on_market],
    ["First seen", (l) => l.first_seen],
    ["Last scraped", (l) => l.last_scraped],
    ["Source", (l) => l.source],
    ["Source URL", (l) => l.source_url],
    ["Latitude", (l) => l.lat],
    ["Longitude", (l) => l.lng],
  ];
  const esc = (v: string | number | null | undefined) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = [cols.map(([h]) => h), ...rows.map((r) => cols.map(([, f]) => f(r)))]
    .map((line) => line.map(esc).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `sequence-data-aruba-listings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  align = "right",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`border-b border-zinc-300 px-3 py-3 text-[10px] font-medium uppercase tracking-[0.14em] ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase transition-colors ${active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"}`}
      >
        {label}
        <span className="text-[9px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

function PlainHeader({ label, align = "right" }: { label: string; align?: "left" | "right" }) {
  return (
    <th
      className={`border-b border-zinc-300 px-3 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {label}
    </th>
  );
}

function Thumb({ src, alt, w = 64, h = 44 }: { src: string | null; alt: string; w?: number; h?: number }) {
  return src ? (
    <Image
      src={`${src}?auto=format&fit=crop&w=${w * 2}&h=${h * 2}&q=60`}
      alt={alt}
      width={w}
      height={h}
      unoptimized
      className="shrink-0 rounded-md bg-zinc-100 object-cover"
      style={{ width: w, height: h }}
    />
  ) : (
    <span className="block shrink-0 rounded-md bg-zinc-100" style={{ width: w, height: h }} />
  );
}

function DetailItem({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
      <dd className={`${MONO} mt-1.5 text-[13px] text-zinc-900`} style={color ? { color } : undefined}>
        {value}
      </dd>
    </div>
  );
}

function SourceValue({ l }: { l: Listing }) {
  return l.source_url ? (
    <a
      href={l.source_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 underline underline-offset-4"
    >
      {l.source} <ExternalLink size={11} strokeWidth={1.5} />
    </a>
  ) : (
    <>{l.source}</>
  );
}

const TENURE_COLOR: Record<Tenure, string> = { Eigendom: "#0A0A0A", Erfpacht: "#8A6A2E" };

function TenureTag({ l }: { l: Listing }) {
  return (
    <span
      title={TENURE_HINT[l.tenure]}
      className="inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ color: TENURE_COLOR[l.tenure], borderColor: `${TENURE_COLOR[l.tenure]}55` }}
    >
      {l.tenure}
    </span>
  );
}

/** "NEW" for listings found in the latest scrape, "PRICE ↓/↑" for prices that moved in it. */
function ScrapeTags({ l }: { l: Listing }) {
  const moved = l.last_price_change && l.last_price_change.date === SCRAPE_RUNS[0].date ? l.last_price_change : null;
  return (
    <>
      {l.is_new && <span className="rounded bg-zinc-950 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-mint">NEW</span>}
      {moved && (
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white"
          style={{ background: moved.event === "Price drop" ? PRICE_DOWN : PRICE_UP }}
        >
          PRICE {moved.event === "Price drop" ? "↓" : "↑"} TODAY
        </span>
      )}
    </>
  );
}

const relDay = (iso: string) => {
  const days = Math.round((Date.parse(`${SCRAPE_RUNS[0].date}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

const DAY_MS = 86_400_000;
const dayTs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Monthly appreciation used to walk the market estimate back in time (mock; prod reads district_value_index). */
const MONTHLY_GROWTH: Record<Listing["category"], number> = { Property: 0.006, Land: 0.005, Commercial: 0.003 };

/**
 * What the listing should be worth today:
 * residential = projected rental revenue capitalised at the market yield,
 * land / commercial = district average price per sq ft × size.
 */
function estMarketValue(l: Listing, marketYield?: number) {
  if (l.category === "Property") return marketYield ? l.projected_annual_revenue_usd / (marketYield / 100) : l.asking_price_usd;
  if (l.category === "Land") return l.district_land_psf_usd * l.lot_sqft;
  return l.district_commercial_psf_usd * l.built_sqft;
}

/** Asking price (step line, from the day we found it) and estimated market value over time. */
function valueSeries(l: Listing, marketYield?: number) {
  const today = dayTs(SCRAPE_RUNS[0].date);
  const listed = dayTs(l.price_history[0].date);
  const start = Math.min(listed - 45 * DAY_MS, today - 270 * DAY_MS);
  const fair = estMarketValue(l, marketYield);
  const g = MONTHLY_GROWTH[l.category];
  let h = 0;
  for (const c of l.listing_id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const stamps = new Set<number>([today]);
  for (let t = start; t < today; t += 14 * DAY_MS) stamps.add(t);
  for (const e of l.price_history) stamps.add(dayTs(e.date));
  return [...stamps]
    .sort((a, b) => a - b)
    .map((t) => {
      const monthsBack = (today - t) / (30.4 * DAY_MS);
      const wiggle = 1 + Math.sin(t / (40 * DAY_MS) + (h % 7)) * 0.006;
      const ask = [...l.price_history].reverse().find((e) => dayTs(e.date) <= t);
      return {
        t,
        asking: ask ? ask.price_usd : null,
        market: Math.round((fair / Math.pow(1 + g, monthsBack)) * (t === today ? 1 : wiggle)),
      };
    });
}

function ValueChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number | null }>; label?: number }) {
  if (!active || !payload?.length || label === undefined) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const asking = get("asking");
  const market = get("market");
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] shadow-md">
      <p className="text-zinc-500">{fmtDate(new Date(label).toISOString().slice(0, 10))}</p>
      {asking != null && (
        <p className={`${MONO} mt-1 text-zinc-950`}>
          Asking <b>{fmtUsdCompact(asking)}</b>
        </p>
      )}
      {market != null && (
        <p className={`${MONO} mt-0.5`} style={{ color: MARKET_LINE }}>
          Est. market <b>{fmtUsdCompact(market)}</b>
        </p>
      )}
    </div>
  );
}

const MARKET_LINE = "#2E9E5B";

function PriceHistory({ l, marketYield }: { l: Listing; marketYield?: number }) {
  const history = l.price_history;
  const series = valueSeries(l, marketYield);
  const fair = estMarketValue(l, marketYield);
  const gap = ((l.asking_price_usd - fair) / fair) * 100;
  const changed = history.length > 1;
  return (
    <div className="mt-8 border-t border-zinc-300/70 pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Price history vs. est. market value</p>
        <p className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-zinc-950" /> Asking price
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: MARKET_LINE }} /> Est. market value
          </span>
        </p>
      </div>
      <div className="mt-3 grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="rounded-lg border border-zinc-200 bg-white p-2">
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#F4F4F5" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })}
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={[(min: number) => min * 0.95, (max: number) => max * 1.03]}
                  tickFormatter={(v: number) => fmtUsdCompact(v)}
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  axisLine={false}
                  tickLine={false}
                  width={62}
                />
                <Tooltip content={<ValueChartTooltip />} />
                <Line type="monotone" dataKey="market" stroke={MARKET_LINE} strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line
                  type="stepAfter"
                  dataKey="asking"
                  stroke="#0A0A0A"
                  strokeWidth={2}
                  dot={(p: { cx?: number; cy?: number; payload?: { t: number }; index?: number }) =>
                    p.payload && history.some((e) => dayTs(e.date) === p.payload!.t) && p.cx != null && p.cy != null ? (
                      <circle key={p.index} cx={p.cx} cy={p.cy} r={3} fill="#0A0A0A" />
                    ) : (
                      <g key={p.index} />
                    )
                  }
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="px-2 pb-1 pt-2 text-[12px] text-zinc-600">
            Asking <b className={`${MONO} text-zinc-950`}>{fmtUsdCompact(l.asking_price_usd)}</b> vs est. market value{" "}
            <b className={MONO} style={{ color: MARKET_LINE }}>
              {fmtUsdCompact(fair)}
            </b>
            {" · "}
            <span className="font-semibold" style={{ color: SIGNAL_STYLE[l.signal].color }}>
              {l.signal === "AT_MARKET"
                ? `priced about right (${gap < 0 ? "−" : "+"}${Math.abs(gap).toFixed(0)}%)`
                : `${Math.abs(gap).toFixed(0)}% ${gap < 0 ? "below" : "above"} market`}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500">
            {changed ? `${history.length - 1} price change${history.length > 2 ? "s" : ""} since we first scraped it` : "No price changes since we first scraped it"}
          </p>
          <ol className="mt-1">
            {[...history].reverse().map((e, i) => (
              <li key={`${e.date}-${i}`} className="flex items-baseline justify-between gap-4 whitespace-nowrap border-b border-zinc-200 py-2 text-[12px] last:border-0">
                <span className="text-zinc-500">
                  {fmtDate(e.date)} <span className="text-zinc-400">· {relDay(e.date)}</span>
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="text-zinc-700">{e.event}</span>
                  <span className={`${MONO} font-semibold text-zinc-950`}>{fmtUsd(e.price_usd)}</span>
                  {e.change_pct !== null && (
                    <span className="w-14 text-right">
                      <PriceMove pct={e.change_pct} />
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function ListingDetails({
  l,
  marketYield,
  onEstimate,
}: {
  l: Listing;
  marketYield?: number;
  onEstimate?: (l: ListingSignal) => void;
}) {
  const shared = (
    <>
      <DetailItem label="Asking price" value={fmtUsd(l.asking_price_usd)} />
      <DetailItem
        label="Price change"
        value={<PriceMove pct={l.price_change_pct} />}
      />
      <DetailItem
        label="Land title"
        value={l.tenure === "Erfpacht" ? `Erfpacht · ${l.lease_years_left} yrs left` : "Eigendom (freehold)"}
        color={TENURE_COLOR[l.tenure]}
      />
      <DetailItem label="First seen" value={fmtDate(l.first_seen)} />
      <DetailItem label="Last scraped" value={fmtTimestamp(l.last_scraped)} />
      <DetailItem label="Source" value={<SourceValue l={l} />} />
    </>
  );

  let facts: React.ReactNode;
  if (l.category === "Land") {
    facts = (
      <>
        <DetailItem label="Type" value="Land parcel" />
        <DetailItem label="Zoning" value={l.zoning} />
        <DetailItem label="Lot size" value={fmtSqft(l.lot_sqft)} />
        <DetailItem label="Price / sq ft" value={fmtUsd(l.price_per_sqft_usd)} />
        <DetailItem label="District land avg" value={`${fmtUsd(l.district_land_psf_usd)} / sq ft`} />
        <DetailItem
          label="Vs. district avg"
          value={`${fmtDelta(l.price_vs_district_pct)} ${l.price_vs_district_pct < 0 ? "cheaper" : "pricier"}`}
          color={deltaColor(-l.price_vs_district_pct)}
        />
      </>
    );
  } else if (l.category === "Commercial") {
    facts = (
      <>
        <DetailItem label="Use" value={l.commercial_use} />
        <DetailItem label="Building size" value={fmtSqft(l.built_sqft)} />
        <DetailItem label="Lot size" value={l.lot_sqft ? fmtSqft(l.lot_sqft) : "N/A (unit)"} />
        <DetailItem label="Price / sq ft" value={fmtUsd(l.price_per_sqft_usd)} />
        <DetailItem label="District commercial avg" value={`${fmtUsd(l.district_commercial_psf_usd)} / sq ft`} />
        <DetailItem
          label="Vs. district avg"
          value={`${fmtDelta(l.price_vs_district_pct)} ${l.price_vs_district_pct < 0 ? "cheaper" : "pricier"}`}
          color={deltaColor(-l.price_vs_district_pct)}
        />
      </>
    );
  } else {
    facts = (
      <>
        <DetailItem label="Property type" value={l.property_type} />
        <DetailItem label="Bedrooms / baths" value={`${l.bedrooms} / ${l.bathrooms}`} />
        <DetailItem label="Built area" value={fmtSqft(l.built_sqft)} />
        <DetailItem label="Lot size" value={l.lot_sqft ? fmtSqft(l.lot_sqft) : "N/A (unit)"} />
        <DetailItem label="Price / sq ft" value={fmtUsd(l.price_per_sqft_usd)} />
        <DetailItem
          label="Yield vs market"
          value={`${fmtPct(l.projected_gross_yield_pct)} vs ${marketYield !== undefined ? fmtPct(marketYield) : "—"}`}
          color={deltaColor(l.yield_spread_bps)}
        />
      </>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {l.photo_url && (
        <Image
          src={`${l.photo_url}?auto=format&fit=crop&w=720&h=460&q=70`}
          alt={l.asset_name}
          width={320}
          height={205}
          unoptimized
          className="h-[205px] w-full rounded-xl bg-zinc-100 object-cover"
        />
      )}
      <div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
          {facts}
          {shared}
        </dl>
        {onEstimate && l.category === "Property" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEstimate(l);
            }}
            className="mt-6 inline-flex items-center gap-2 bg-zinc-950 px-3 py-2 text-[12px] text-mint transition-colors hover:bg-zinc-800"
          >
            <Calculator size={13} strokeWidth={1.5} />
            Open in Revenue Estimator
          </button>
        )}
        <PriceHistory l={l} marketYield={marketYield} />
      </div>
    </div>
  );
}

function ActiveListings({
  listings,
  marketYield,
  initialDistrict,
  initialQuery,
  initialOpenId,
  initialNewToday,
  onEstimate,
}: {
  listings?: Listing[];
  marketYield?: number;
  initialDistrict?: string;
  initialQuery?: string;
  initialOpenId?: string;
  initialNewToday?: boolean;
  onEstimate: (l: ListingSignal) => void;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [tenure, setTenure] = useState<Tenure | "All">("All");
  const [newToday, setNewToday] = useState(Boolean(initialNewToday));
  const [category, setCategory] = useState<Category>("All");
  const [subtypes, setSubtypes] = useState<string[]>([]);
  const [district, setDistrict] = useState(initialDistrict ?? "All");
  const [signal, setSignal] = useState<Signal | "ALL">("ALL");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [bedsMin, setBedsMin] = useState(0);
  const [sizeMin, setSizeMin] = useState(0);
  const [newOnly, setNewOnly] = useState(false);
  const [dropsOnly, setDropsOnly] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "listed", dir: "asc" });
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialOpenId || !listings) return;
    const t = window.setTimeout(
      () => document.getElementById(`row-${initialOpenId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      150,
    );
    return () => window.clearTimeout(t);
  }, [initialOpenId, listings]);

  const landOnly = category === "Land";
  const commercialOnly = category === "Commercial";
  const nonResidential = landOnly || commercialOnly;

  const districts = useMemo(
    () => ["All", ...Array.from(new Set((listings ?? []).map((l) => l.district))).sort()],
    [listings],
  );

  const rows = useMemo(() => {
    if (!listings) return [];
    const q = query.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      const size = l.category === "Land" ? l.lot_sqft : l.built_sqft;
      return (
        (category === "All" || l.category === category) &&
        (!subtypes.length || subtypes.includes(subtypeOf(l, category))) &&
        (district === "All" || l.district === district) &&
        (signal === "ALL" || l.signal === signal) &&
        (tenure === "All" || l.tenure === tenure) &&
        (!newToday || l.is_new) &&
        (!priceMin || l.asking_price_usd >= priceMin) &&
        (!priceMax || l.asking_price_usd <= priceMax) &&
        (!bedsMin || (l.category === "Property" && l.bedrooms >= bedsMin)) &&
        (!sizeMin || size >= sizeMin) &&
        (!newOnly || l.days_on_market <= 7) &&
        (!dropsOnly || l.price_change_pct < 0) &&
        (!q || `${l.asset_name} ${l.district} ${l.listing_id} ${l.source} ${typeLine(l)} ${l.tenure}`.toLowerCase().includes(q))
      );
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const get = SORT_VALUE[sort.key];
    return filtered.sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // N/A always last
      if (y === null) return -1;
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * dir;
    });
  }, [listings, query, category, subtypes, district, signal, priceMin, priceMax, bedsMin, sizeMin, newOnly, dropsOnly, sort, tenure, newToday]);

  const stats = useMemo(() => {
    const props = rows.filter((r): r is ListingSignal => r.category === "Property");
    return {
      count: rows.length,
      residential: props.length,
      land: rows.filter((r) => r.category === "Land").length,
      commercial: rows.filter((r) => r.category === "Commercial").length,
      medianAsk: median(rows.map((r) => r.asking_price_usd)),
      undervalued: rows.filter((r) => r.signal === "UNDERVALUED").length,
    };
  }, [rows]);

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "district" || key === "listed" || key === "vsDistrict" ? "asc" : "desc" },
    );

  const pickCategory = (c: Category) => {
    setCategory(c);
    setSubtypes([]);
    if (c !== "All" && c !== "Property") setBedsMin(0);
    if (c === "Property" && sort.key === "vsDistrict") setSort({ key: "listed", dir: "asc" });
    if ((c === "Land" || c === "Commercial") && (sort.key === "beds" || sort.key === "adr" || sort.key === "yield"))
      setSort({ key: "listed", dir: "asc" });
  };
  const toggleSubtype = (t: string) => setSubtypes((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]));

  const moreCount = [priceMin, priceMax, bedsMin, sizeMin].filter(Boolean).length + (newOnly ? 1 : 0) + (dropsOnly ? 1 : 0);
  const filtersActive = Boolean(query) || tenure !== "All" || newToday || category !== "All" || subtypes.length > 0 || district !== "All" || signal !== "ALL" || moreCount > 0;
  const clearAll = () => {
    setQuery("");
    setTenure("All");
    setNewToday(false);
    pickCategory("All");
    setDistrict("All");
    setSignal("ALL");
    setPriceMin(0);
    setPriceMax(0);
    setBedsMin(0);
    setSizeMin(0);
    setNewOnly(false);
    setDropsOnly(false);
  };

  const selectFromMap = (id: string) => {
    setOpenId(id);
    requestAnimationFrame(() => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const selectCls = `${MONO} rounded-md border border-zinc-300 bg-white px-3 py-2 text-[12px] text-zinc-800 outline-none transition-colors hover:border-zinc-500 focus:border-zinc-950`;
  const segBtn = (on: boolean) =>
    `px-3 py-2 text-[12px] font-medium transition-colors ${on ? "bg-zinc-950 text-mint" : "text-zinc-600 hover:text-zinc-950"}`;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
      on ? "border-zinc-950 bg-zinc-950 text-mint" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
    }`;
  const toggleCls = (on: boolean) =>
    `inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-medium transition-colors ${
      on ? "border-zinc-950 bg-zinc-950 text-mint" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
    }`;
  const td = "px-3 py-4 border-b border-zinc-200 align-top";
  const num = `${td} ${MONO} text-right text-[13px] text-zinc-800`;
  const colCount = nonResidential ? 10 : 11;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 py-8">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Aruba · Scraped daily</p>
          <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-zinc-950">Active Listings</h1>
          <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-zinc-600">
            Every home, condo, piece of land and commercial property for sale in Aruba. Hover a pin for a quick look, click it
            for full details in the list below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(rows)}
          disabled={!rows.length}
          className="inline-flex items-center gap-2 bg-zinc-950 px-4 py-2 text-[12px] font-medium tracking-wide text-mint transition-colors hover:bg-zinc-800 disabled:opacity-40"
        >
          <Download size={13} strokeWidth={1.5} />
          Export CSV
        </button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 border-b border-zinc-200 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Listings shown", listings ? int.format(stats.count) : "—", undefined],
          ["Residential", listings ? int.format(stats.residential) : "—", undefined],
          ["Land", listings ? int.format(stats.land) : "—", undefined],
          ["Commercial", listings ? int.format(stats.commercial) : "—", undefined],
          ["Median asking", listings && stats.count ? fmtUsdCompact(stats.medianAsk) : "—", undefined],
          ["Undervalued", listings ? int.format(stats.undervalued) : "—", listings ? C.up : undefined],
        ].map(([label, value, color], i) => (
          <div key={label} className={`py-5 ${i > 0 ? "lg:border-l lg:border-zinc-200 lg:pl-6" : ""}`}>
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
            <p className={`${MONO} mt-1.5 font-display text-[24px] font-bold text-zinc-950`} style={color ? { color } : undefined}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="space-y-3 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-zinc-950" role="group" aria-label="Category">
            {CATEGORY_FILTERS.map((f) => (
              <button key={f.value} type="button" onClick={() => pickCategory(f.value)} aria-pressed={category === f.value} className={segBtn(category === f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Search listings</span>
            <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, district, ID"
              className={`${selectCls} w-56 pl-8 placeholder:text-zinc-400`}
            />
          </label>
          <label className="sr-only" htmlFor="f-district">District</label>
          <select id="f-district" value={district} onChange={(e) => setDistrict(e.target.value)} className={selectCls}>
            {districts.map((d) => (
              <option key={d} value={d}>{d === "All" ? "All districts" : d}</option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border border-zinc-300" role="group" aria-label="Signal">
            {SIGNAL_FILTERS.map((f) => (
              <button key={f.value} type="button" onClick={() => setSignal(f.value)} aria-pressed={signal === f.value} className={segBtn(signal === f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-md border border-zinc-300" role="group" aria-label="Land title">
            {(["All", ...TENURES] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTenure(t)}
                aria-pressed={tenure === t}
                title={t === "All" ? "Eigendom and erfpacht" : TENURE_HINT[t]}
                className={segBtn(tenure === t)}
              >
                {t === "All" ? "Any title" : t}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setNewToday((v) => !v)} aria-pressed={newToday} className={toggleCls(newToday)}>
            New today
            {listings && (
              <span className={`${MONO} rounded-full px-1.5 text-[10px] ${newToday ? "bg-mint text-zinc-950" : "bg-zinc-950 text-mint"}`}>
                {listings.filter((l) => l.is_new).length}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={toggleCls(moreOpen || moreCount > 0)}>
            <SlidersHorizontal size={13} strokeWidth={1.75} />
            More filters{moreCount > 0 ? ` (${moreCount})` : ""}
          </button>
          {filtersActive && (
            <button type="button" onClick={clearAll} className="text-[12px] text-zinc-500 underline-offset-4 hover:text-zinc-950 hover:underline">
              Clear all
            </button>
          )}
        </div>

        {/* type chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{TYPE_LABEL[category]}</span>
          <button type="button" onClick={() => setSubtypes([])} className={chip(subtypes.length === 0)}>
            All
          </button>
          {TYPE_OPTIONS[category].map((t) => (
            <button key={t} type="button" onClick={() => toggleSubtype(t)} aria-pressed={subtypes.includes(t)} className={chip(subtypes.includes(t))}>
              {t}
            </button>
          ))}
        </div>

        {moreOpen && (
          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-mint-soft p-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Min price</span>
              <select value={priceMin} onChange={(e) => setPriceMin(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                <option value={0}>No min</option>
                {PRICE_STEPS.map((p) => (
                  <option key={p} value={p}>{fmtPriceStep(p)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Max price</span>
              <select value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                <option value={0}>No max</option>
                {PRICE_STEPS.map((p) => (
                  <option key={p} value={p}>{fmtPriceStep(p)}</option>
                ))}
              </select>
            </label>
            {!nonResidential && (
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Bedrooms</span>
                <select value={bedsMin} onChange={(e) => setBedsMin(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                  <option value={0}>Any</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((b) => (
                    <option key={b} value={b}>{b}+</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{landOnly ? "Min lot size" : "Min size"}</span>
              <select value={sizeMin} onChange={(e) => setSizeMin(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                <option value={0}>Any</option>
                {SIZE_STEPS.map((s) => (
                  <option key={s} value={s}>{int.format(s)}+ sq ft</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setNewOnly((v) => !v)} aria-pressed={newOnly} className={toggleCls(newOnly)}>
              New this week
            </button>
            <button type="button" onClick={() => setDropsOnly((v) => !v)} aria-pressed={dropsOnly} className={toggleCls(dropsOnly)}>
              Price drops
            </button>
          </div>
        )}
      </div>

      {/* map */}
      <ArubaMap
        mode="listings"
        listings={rows}
        selectedId={openId}
        hoveredId={hoverId}
        onSelect={selectFromMap}
        onHover={setHoverId}
        height={560}
      />

      {/* list */}
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-[18px] font-bold text-zinc-950">
          {listings ? `${int.format(stats.count)} listing${stats.count === 1 ? "" : "s"}` : "Loading listings…"}
        </p>
        <p className="text-[12px] text-zinc-500">Click a row or a pin for full details · click a column to sort</p>
      </div>
      <div className="mt-3 overflow-x-auto border-t border-zinc-950">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead>
            <tr>
              <SortHeader label={landOnly ? "Parcel" : "Listing"} k="name" sort={sort} onSort={onSort} align="left" />
              <SortHeader label="District" k="district" sort={sort} onSort={onSort} align="left" />
              {landOnly ? (
                <PlainHeader label="Zoning" />
              ) : commercialOnly ? (
                <PlainHeader label="Use" />
              ) : (
                <SortHeader label="Bd / Ba" k="beds" sort={sort} onSort={onSort} />
              )}
              <SortHeader label={landOnly ? "Lot (sq ft)" : category === "All" ? "Size (sq ft)" : "Built (sq ft)"} k="size" sort={sort} onSort={onSort} />
              <SortHeader label="Asking" k="asking" sort={sort} onSort={onSort} />
              <SortHeader label="$ / sq ft" k="psf" sort={sort} onSort={onSort} />
              {nonResidential ? (
                <SortHeader label="Vs. District" k="vsDistrict" sort={sort} onSort={onSort} />
              ) : (
                <>
                  <SortHeader label="Est. ADR" k="adr" sort={sort} onSort={onSort} />
                  <SortHeader label="Proj. Yield" k="yield" sort={sort} onSort={onSort} />
                </>
              )}
              <PlainHeader label="Signal" />
              <SortHeader label="Listed" k="listed" sort={sort} onSort={onSort} />
              <th className="w-8 border-b border-zinc-300" aria-label="Details" />
            </tr>
          </thead>
          <tbody>
            {!listings &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={colCount} className="border-b border-zinc-200 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            {listings && !rows.length && (
              <tr>
                <td colSpan={colCount} className="py-16 text-center text-[13px] text-zinc-500">
                  No listings match these filters.{" "}
                  <button type="button" onClick={clearAll} className="underline underline-offset-4 hover:text-zinc-950">
                    Clear all
                  </button>
                </td>
              </tr>
            )}
            {rows.map((l) => {
              const open = openId === l.listing_id;
              const hot = hoverId === l.listing_id;
              const vsDistrict =
                l.category !== "Property" ? (
                  <span style={{ color: deltaColor(-l.price_vs_district_pct) }}>{fmtDelta(l.price_vs_district_pct)}</span>
                ) : null;
              return (
                <Fragment key={l.listing_id}>
                  <tr
                    id={`row-${l.listing_id}`}
                    onClick={() => setOpenId(open ? null : l.listing_id)}
                    onMouseEnter={() => setHoverId(l.listing_id)}
                    onMouseLeave={() => setHoverId(null)}
                    className={`cursor-pointer scroll-mt-24 transition-colors hover:bg-mint-soft ${open || hot ? "bg-mint-soft" : ""}`}
                  >
                    <td className={`${td} pl-0`}>
                      <div className="flex items-start gap-3">
                        <Thumb src={l.photo_url} alt={l.asset_name} />
                        <div>
                          <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-zinc-950">
                            {l.asset_name}
                            <ScrapeTags l={l} />
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                            {l.listing_id} · {typeLine(l)}
                            <TenureTag l={l} />
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} text-[13px] text-zinc-700`}>{l.district}</td>
                    {landOnly ? (
                      <td className={`${td} text-right text-[13px] text-zinc-700`}>{l.category === "Land" ? l.zoning : DASH}</td>
                    ) : commercialOnly ? (
                      <td className={`${td} text-right text-[13px] text-zinc-700`}>{l.category === "Commercial" ? l.commercial_use : DASH}</td>
                    ) : (
                      <td className={num}>{l.category === "Property" ? `${l.bedrooms} / ${l.bathrooms}` : DASH}</td>
                    )}
                    <td className={num}>
                      {int.format(l.category === "Land" ? l.lot_sqft : l.built_sqft)}
                      {category === "All" && <p className="mt-1 text-[10px] uppercase text-zinc-400">{l.category === "Land" ? "lot" : "built"}</p>}
                    </td>
                    <td className={`${num} text-zinc-950`}>
                      {fmtUsdCompact(l.asking_price_usd)}
                      <p className="mt-1 text-[11px]">
                        <PriceMove pct={l.price_change_pct} size={11} />
                      </p>
                    </td>
                    <td className={num}>{fmtUsd(l.price_per_sqft_usd)}</td>
                    {nonResidential ? (
                      <td className={num}>{vsDistrict}</td>
                    ) : (
                      <>
                        <td className={num}>{l.category === "Property" ? fmtUsd(l.sequence_adr_usd) : DASH}</td>
                        <td className={`${td} ${MONO} text-right`}>
                          {l.category === "Property" ? (
                            <>
                              <p className="text-[13px] text-zinc-950">{fmtPct(l.projected_gross_yield_pct)}</p>
                              <p className="mt-1 text-[11px]" style={{ color: deltaColor(l.yield_spread_bps) }}>
                                {fmtBps(l.yield_spread_bps)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[13px]">{DASH}</p>
                              <p className="mt-1 text-[11px]">{vsDistrict} vs dist.</p>
                            </>
                          )}
                        </td>
                      </>
                    )}
                    <td className={`${td} text-right`}>
                      <SignalBadge signal={l.signal} />
                    </td>
                    <td className={num}>{l.is_new ? <span className="font-semibold text-zinc-950">Today</span> : `${l.days_on_market}d`}</td>
                    <td className={`${td} pr-0 text-right`}>
                      <ChevronDown size={14} strokeWidth={1.5} className={`ml-auto text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-mint-soft">
                      <td colSpan={colCount} className="border-b border-zinc-300 px-0 pb-8 pt-3">
                        <ListingDetails l={l} marketYield={marketYield} onEstimate={onEstimate} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-zinc-500">
        <p>
          <span className="text-zinc-700">Residential</span> listings are scored on projected rental yield: estimated nightly
          rate and occupancy come from comparable vacation rentals in the same district. Gross, before costs.
        </p>
        <p>
          <span className="text-zinc-700">Land</span> and <span className="text-zinc-700">commercial</span> listings are
          scored on price per sq ft against the district average: 10% or more below is Undervalued, 10% or more above is
          Overpriced.
        </p>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Vacation Rentals — Airbnb, Vrbo and direct-booking rentals on the map
 * ──────────────────────────────────────────────────────────────────────── */

type RentalSortKey = "name" | "district" | "beds" | "sleeps" | "nightly" | "occupancy" | "revenue" | "rating";

const RENTAL_SORT: Record<RentalSortKey, (r: VacationRental) => number | string | null> = {
  name: (r) => r.name,
  district: (r) => r.district,
  beds: (r) => r.bedrooms,
  sleeps: (r) => r.sleeps,
  nightly: (r) => r.nightly_rate_usd,
  occupancy: (r) => r.occupancy_pct,
  revenue: (r) => r.annual_revenue_usd,
  rating: (r) => r.rating,
};
const NIGHTLY_STEPS = [150, 250, 400, 600, 800, 1000, 1500, 2500, 4000, 6000];

function PlatformPill({ platform }: { platform: VacationRental["platform"] }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: PLATFORM_COLOR[platform] }}
    >
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

function RentalSortHeader({
  label,
  k,
  sort,
  onSort,
  align = "right",
}: {
  label: string;
  k: RentalSortKey;
  sort: { key: RentalSortKey; dir: "asc" | "desc" };
  onSort: (k: RentalSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`border-b border-zinc-300 px-3 py-3 text-[10px] font-medium uppercase tracking-[0.14em] ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase transition-colors ${active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"}`}
      >
        {label}
        <span className="text-[9px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

function downloadRentalsCsv(rows: VacationRental[]) {
  const cols: Array<[string, (r: VacationRental) => string | number | null]> = [
    ["Rental ID", (r) => r.rental_id],
    ["Name", (r) => r.name],
    ["Platform", (r) => PLATFORM_LABEL[r.platform]],
    ["Host", (r) => r.host_type],
    ["Type", (r) => r.property_type],
    ["District", (r) => r.district],
    ["Bedrooms", (r) => r.bedrooms],
    ["Bathrooms", (r) => r.bathrooms],
    ["Sleeps", (r) => r.sleeps],
    ["Nightly rate USD (next 30 days)", (r) => r.nightly_rate_usd],
    ["Low season USD", (r) => r.low_season_rate_usd],
    ["High season USD", (r) => r.high_season_rate_usd],
    ["Cleaning fee USD", (r) => r.cleaning_fee_usd],
    ["Occupancy % (12 months)", (r) => r.occupancy_pct],
    ["Est. yearly revenue USD", (r) => r.annual_revenue_usd],
    ["Rating", (r) => r.rating],
    ["Reviews", (r) => r.reviews],
    ["First seen", (r) => r.first_seen],
    ["Last scraped", (r) => r.last_scraped],
    ["Source URL", (r) => r.source_url],
    ["Latitude", (r) => r.lat],
    ["Longitude", (r) => r.lng],
  ];
  const esc = (v: string | number | null) => {
    const t = v === null ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = [cols.map(([h]) => h), ...rows.map((r) => cols.map(([, f]) => f(r)))]
    .map((line) => line.map(esc).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `sequence-data-aruba-vacation-rentals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function VacationRentals({
  rentals,
  initialDistrict,
  onShowForSale,
}: {
  rentals?: VacationRental[];
  initialDistrict?: string;
  onShowForSale: (district: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [district, setDistrict] = useState(initialDistrict ?? "All");
  const [nightMin, setNightMin] = useState(0);
  const [nightMax, setNightMax] = useState(0);
  const [bedsMin, setBedsMin] = useState(0);
  const [sleepsMin, setSleepsMin] = useState(0);
  const [ratingMin, setRatingMin] = useState(0);
  const [newOnly, setNewOnly] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sort, setSort] = useState<{ key: RentalSortKey; dir: "asc" | "desc" }>({ key: "revenue", dir: "desc" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const districts = useMemo(
    () => ["All", ...Array.from(new Set((rentals ?? []).map((r) => r.district))).sort()],
    [rentals],
  );
  const newCutoff = Date.parse("2026-11-13T00:00:00Z") - 60 * 86_400_000;

  const rows = useMemo(() => {
    if (!rentals) return [];
    const q = query.trim().toLowerCase();
    const filtered = rentals.filter(
      (r) =>
        (!platforms.length || platforms.includes(r.platform)) &&
        (!types.length || types.includes(r.property_type)) &&
        (district === "All" || r.district === district) &&
        (!nightMin || r.nightly_rate_usd >= nightMin) &&
        (!nightMax || r.nightly_rate_usd <= nightMax) &&
        (!bedsMin || r.bedrooms >= bedsMin) &&
        (!sleepsMin || r.sleeps >= sleepsMin) &&
        (!ratingMin || (r.rating ?? 0) >= ratingMin) &&
        (!newOnly || Date.parse(r.first_seen) >= newCutoff) &&
        (!q || `${r.name} ${r.district} ${r.rental_id} ${r.property_type} ${r.platform}`.toLowerCase().includes(q)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    const get = RENTAL_SORT[sort.key];
    return filtered.sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * dir;
    });
  }, [rentals, query, platforms, types, district, nightMin, nightMax, bedsMin, sleepsMin, ratingMin, newOnly, newCutoff, sort]);

  const stats = useMemo(() => {
    const rated = rows.filter((r) => r.rating !== null);
    return {
      count: rows.length,
      medianNightly: median(rows.map((r) => r.nightly_rate_usd)),
      avgOcc: rows.length ? rows.reduce((a, r) => a + r.occupancy_pct, 0) / rows.length : 0,
      medianRevenue: median(rows.map((r) => r.annual_revenue_usd)),
      avgRating: rated.length ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length : null,
      byPlatform: RENTAL_PLATFORMS.map((p) => [p, rows.filter((r) => r.platform === p).length] as const),
    };
  }, [rows]);

  const onSort = (key: RentalSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "district" ? "asc" : "desc" }));
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    set((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]));

  const moreCount = [nightMin, nightMax, bedsMin, sleepsMin, ratingMin].filter(Boolean).length + (newOnly ? 1 : 0);
  const filtersActive = Boolean(query) || platforms.length > 0 || types.length > 0 || district !== "All" || moreCount > 0;
  const clearAll = () => {
    setQuery("");
    setPlatforms([]);
    setTypes([]);
    setDistrict("All");
    setNightMin(0);
    setNightMax(0);
    setBedsMin(0);
    setSleepsMin(0);
    setRatingMin(0);
    setNewOnly(false);
  };
  const selectFromMap = (id: string) => {
    setOpenId(id);
    requestAnimationFrame(() => document.getElementById(`rental-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const selectCls = `${MONO} rounded-md border border-zinc-300 bg-white px-3 py-2 text-[12px] text-zinc-800 outline-none transition-colors hover:border-zinc-500 focus:border-zinc-950`;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
      on ? "border-zinc-950 bg-zinc-950 text-mint" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
    }`;
  const toggleCls = (on: boolean) =>
    `inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-medium transition-colors ${
      on ? "border-zinc-950 bg-zinc-950 text-mint" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
    }`;
  const td = "px-3 py-4 border-b border-zinc-200 align-top";
  const num = `${td} ${MONO} text-right text-[13px] text-zinc-800`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 py-8">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Aruba · Airbnb, Vrbo &amp; direct sites</p>
          <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-zinc-950">Vacation Rentals</h1>
          <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-zinc-600">
            Every vacation rental we track in Aruba, with what it charges per night, how often it is booked and what it earns.
            Pins show the nightly price; hover for a quick look, click for full details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadRentalsCsv(rows)}
          disabled={!rows.length}
          className="inline-flex items-center gap-2 bg-zinc-950 px-4 py-2 text-[12px] font-medium tracking-wide text-mint transition-colors hover:bg-zinc-800 disabled:opacity-40"
        >
          <Download size={13} strokeWidth={1.5} />
          Export CSV
        </button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 border-b border-zinc-200 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Rentals shown", rentals ? int.format(stats.count) : "—"],
          ["Median per night", rentals && stats.count ? fmtUsd(stats.medianNightly) : "—"],
          ["Avg. occupancy", rentals && stats.count ? fmtPct(stats.avgOcc, 0) : "—"],
          ["Median yearly revenue", rentals && stats.count ? fmtUsdCompact(stats.medianRevenue) : "—"],
          ["Avg. rating", stats.avgRating !== null ? `★ ${stats.avgRating.toFixed(2)}` : "—"],
        ].map(([label, value], i) => (
          <div key={label} className={`py-5 ${i > 0 ? "lg:border-l lg:border-zinc-200 lg:pl-6" : ""}`}>
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
            <p className={`${MONO} mt-1.5 font-display text-[24px] font-bold text-zinc-950`}>{value}</p>
          </div>
        ))}
        <div className="py-5 lg:border-l lg:border-zinc-200 lg:pl-6">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">By platform</p>
          <div className="mt-2 space-y-1">
            {stats.byPlatform.map(([p, n]) => (
              <div key={p} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="flex items-center gap-1.5 text-zinc-700">
                  <span className="size-2 rounded-full" style={{ background: PLATFORM_COLOR[p] }} />
                  {PLATFORM_LABEL[p]}
                </span>
                <span className={`${MONO} font-semibold text-zinc-950`}>{rentals ? n : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="space-y-3 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative">
            <span className="sr-only">Search rentals</span>
            <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, district, ID"
              className={`${selectCls} w-56 pl-8 placeholder:text-zinc-400`}
            />
          </label>
          <label className="sr-only" htmlFor="r-district">District</label>
          <select id="r-district" value={district} onChange={(e) => setDistrict(e.target.value)} className={selectCls}>
            {districts.map((d) => (
              <option key={d} value={d}>{d === "All" ? "All districts" : d}</option>
            ))}
          </select>
          <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={toggleCls(moreOpen || moreCount > 0)}>
            <SlidersHorizontal size={13} strokeWidth={1.75} />
            More filters{moreCount > 0 ? ` (${moreCount})` : ""}
          </button>
          {filtersActive && (
            <button type="button" onClick={clearAll} className="text-[12px] text-zinc-500 underline-offset-4 hover:text-zinc-950 hover:underline">
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Platform</span>
          <button type="button" onClick={() => setPlatforms([])} className={chip(platforms.length === 0)}>All</button>
          {RENTAL_PLATFORMS.map((p) => (
            <button key={p} type="button" onClick={() => toggle(setPlatforms, p)} aria-pressed={platforms.includes(p)} className={chip(platforms.includes(p))}>
              <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: PLATFORM_COLOR[p] }} />
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Type</span>
          <button type="button" onClick={() => setTypes([])} className={chip(types.length === 0)}>All</button>
          {RESIDENTIAL_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => toggle(setTypes, t)} aria-pressed={types.includes(t)} className={chip(types.includes(t))}>
              {t}
            </button>
          ))}
        </div>
        {moreOpen && (
          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-mint-soft p-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Min per night</span>
              <select value={nightMin} onChange={(e) => setNightMin(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                <option value={0}>No min</option>
                {NIGHTLY_STEPS.map((n) => (
                  <option key={n} value={n}>{fmtUsd(n)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Max per night</span>
              <select value={nightMax} onChange={(e) => setNightMax(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                <option value={0}>No max</option>
                {NIGHTLY_STEPS.map((n) => (
                  <option key={n} value={n}>{fmtUsd(n)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Bedrooms</span>
              <select value={bedsMin} onChange={(e) => setBedsMin(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                <option value={0}>Any</option>
                {[1, 2, 3, 4, 5, 6, 7].map((b) => (
                  <option key={b} value={b}>{b}+</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Sleeps</span>
              <select value={sleepsMin} onChange={(e) => setSleepsMin(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                <option value={0}>Any</option>
                {[2, 4, 6, 8, 10, 12, 16].map((n) => (
                  <option key={n} value={n}>{n}+ guests</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Rating</span>
              <select value={ratingMin} onChange={(e) => setRatingMin(Number(e.target.value))} className={`${selectCls} mt-1.5 block`}>
                <option value={0}>Any</option>
                {[4.5, 4.7, 4.8, 4.9].map((n) => (
                  <option key={n} value={n}>★ {n}+</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setNewOnly((v) => !v)} aria-pressed={newOnly} className={toggleCls(newOnly)}>
              New rentals (60 days)
            </button>
          </div>
        )}
      </div>

      <ArubaMap mode="rentals" rentals={rows} selectedId={openId} hoveredId={hoverId} onSelect={selectFromMap} onHover={setHoverId} height={560} />

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-[18px] font-bold text-zinc-950">
          {rentals ? `${int.format(stats.count)} rental${stats.count === 1 ? "" : "s"}` : "Loading rentals…"}
        </p>
        <p className="text-[12px] text-zinc-500">Click a row or a pin for full details · click a column to sort</p>
      </div>
      <div className="mt-3 overflow-x-auto border-t border-zinc-950">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead>
            <tr>
              <RentalSortHeader label="Rental" k="name" sort={sort} onSort={onSort} align="left" />
              <RentalSortHeader label="District" k="district" sort={sort} onSort={onSort} align="left" />
              <th className="border-b border-zinc-300 px-3 py-3 text-left text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Platform</th>
              <RentalSortHeader label="Bd / Ba" k="beds" sort={sort} onSort={onSort} />
              <RentalSortHeader label="Sleeps" k="sleeps" sort={sort} onSort={onSort} />
              <RentalSortHeader label="Per night" k="nightly" sort={sort} onSort={onSort} />
              <RentalSortHeader label="Occupancy" k="occupancy" sort={sort} onSort={onSort} />
              <RentalSortHeader label="Est. yearly" k="revenue" sort={sort} onSort={onSort} />
              <RentalSortHeader label="Rating" k="rating" sort={sort} onSort={onSort} />
              <th className="w-8 border-b border-zinc-300" aria-label="Details" />
            </tr>
          </thead>
          <tbody>
            {!rentals &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={10} className="border-b border-zinc-200 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            {rentals && !rows.length && (
              <tr>
                <td colSpan={10} className="py-16 text-center text-[13px] text-zinc-500">
                  No rentals match these filters.{" "}
                  <button type="button" onClick={clearAll} className="underline underline-offset-4 hover:text-zinc-950">
                    Clear all
                  </button>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const open = openId === r.rental_id;
              const hot = hoverId === r.rental_id;
              return (
                <Fragment key={r.rental_id}>
                  <tr
                    id={`rental-${r.rental_id}`}
                    onClick={() => setOpenId(open ? null : r.rental_id)}
                    onMouseEnter={() => setHoverId(r.rental_id)}
                    onMouseLeave={() => setHoverId(null)}
                    className={`cursor-pointer scroll-mt-24 transition-colors hover:bg-mint-soft ${open || hot ? "bg-mint-soft" : ""}`}
                  >
                    <td className={`${td} pl-0`}>
                      <div className="flex items-start gap-3">
                        <Thumb src={r.photo_url} alt={r.name} />
                        <div>
                          <p className="text-[13px] font-medium text-zinc-950">{r.name}</p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {r.rental_id} · {r.property_type}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} text-[13px] text-zinc-700`}>{r.district}</td>
                    <td className={td}>
                      <PlatformPill platform={r.platform} />
                    </td>
                    <td className={num}>
                      {r.bedrooms} / {r.bathrooms}
                    </td>
                    <td className={num}>{r.sleeps}</td>
                    <td className={`${num} text-zinc-950`}>
                      {fmtUsd(r.nightly_rate_usd)}
                      <p className="mt-1 text-[10px] text-zinc-400">
                        {fmtUsd(r.low_season_rate_usd)}–{fmtUsd(r.high_season_rate_usd)}
                      </p>
                    </td>
                    <td className={num}>{r.occupancy_pct}%</td>
                    <td className={`${num} text-zinc-950`}>{fmtUsdCompact(r.annual_revenue_usd)}</td>
                    <td className={num}>
                      {r.rating ? (
                        <>
                          ★ {r.rating.toFixed(2)}
                          <p className="mt-1 text-[10px] text-zinc-400">{r.reviews} reviews</p>
                        </>
                      ) : (
                        <span className="text-[11px] text-zinc-400">New</span>
                      )}
                    </td>
                    <td className={`${td} pr-0 text-right`}>
                      <ChevronDown size={14} strokeWidth={1.5} className={`ml-auto text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-mint-soft">
                      <td colSpan={10} className="border-b border-zinc-300 px-0 pb-8 pt-3">
                        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                          {r.photo_url && (
                            <Image
                              src={`${r.photo_url}?auto=format&fit=crop&w=720&h=460&q=70`}
                              alt={r.name}
                              width={320}
                              height={205}
                              unoptimized
                              className="h-[205px] w-full rounded-xl bg-zinc-100 object-cover"
                            />
                          )}
                          <div>
                            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
                              <DetailItem label="Platform" value={`${PLATFORM_LABEL[r.platform]} · ${r.host_type}`} />
                              <DetailItem label="Type" value={r.property_type} />
                              <DetailItem label="Bedrooms / baths" value={`${r.bedrooms} / ${r.bathrooms}`} />
                              <DetailItem label="Sleeps" value={`${r.sleeps} guests`} />
                              <DetailItem label="Avg. nightly (next 30 days)" value={fmtUsd(r.nightly_rate_usd)} />
                              <DetailItem label="Low / high season" value={`${fmtUsd(r.low_season_rate_usd)} / ${fmtUsd(r.high_season_rate_usd)}`} />
                              <DetailItem label="Cleaning fee" value={fmtUsd(r.cleaning_fee_usd)} />
                              <DetailItem label="Occupancy (12 months)" value={`${r.occupancy_pct}% · ${Math.round((365 * r.occupancy_pct) / 100)} nights`} />
                              <DetailItem label="Est. yearly revenue" value={fmtUsd(r.annual_revenue_usd)} />
                              <DetailItem label="Rating" value={r.rating ? `★ ${r.rating.toFixed(2)} (${r.reviews} reviews)` : "No reviews yet"} />
                              <DetailItem label="First seen" value={fmtDate(r.first_seen)} />
                              <DetailItem label="Last scraped" value={fmtTimestamp(r.last_scraped)} />
                            </dl>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowForSale(r.district);
                              }}
                              className="mt-6 inline-flex items-center gap-2 bg-zinc-950 px-3 py-2 text-[12px] text-mint transition-colors hover:bg-zinc-800"
                            >
                              See properties for sale in {r.district}
                              <ArrowRight size={13} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        Nightly rates are the average quoted price for the next 30 days. Occupancy is booked nights over the last 12 months,
        read from each rental&apos;s public calendar; yearly revenue is estimated from rate × booked nights, before fees.
      </p>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Districts — rental performance and for-sale supply by area
 * ──────────────────────────────────────────────────────────────────────── */

type DistrictSortKey =
  | "score"
  | "forSale"
  | "median_asking_usd"
  | "avg_property_yield_pct"
  | "adr_usd"
  | "occupancy_pct"
  | "revpar_usd"
  | "revpar_yoy_pct"
  | "rental_supply_yoy_pct"
  | "land_psf_usd";

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? C.up : score >= 50 ? C.slate500 : C.down;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${MONO} w-7 text-right text-[13px] text-zinc-950`}>{score}</span>
      <span className="h-1 w-16 bg-zinc-100">
        <span className="block h-1" style={{ width: `${score}%`, background: color }} />
      </span>
    </span>
  );
}

function Districts({ districts, onOpenDistrict }: { districts: DistrictStats[]; onOpenDistrict: (d: string) => void }) {
  const [sort, setSort] = useState<{ key: DistrictSortKey; dir: "asc" | "desc" }>({ key: "score", dir: "desc" });

  const value = (d: DistrictStats, k: DistrictSortKey): number | null =>
    k === "forSale" ? d.properties_for_sale + d.land_for_sale + d.commercial_for_sale : d[k];

  const rows = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...districts].sort((a, b) => {
      const x = value(a, sort.key);
      const y = value(b, sort.key);
      if (x === null) return 1;
      if (y === null) return -1;
      return (x - y) * dir;
    });
  }, [districts, sort]);

  const top = districts.slice(0, 3);
  const th = (label: string, k: DistrictSortKey) => {
    const active = sort.key === k;
    return (
      <th className="border-b border-zinc-300 px-3 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em]">
        <button
          type="button"
          onClick={() => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }))}
          className={`inline-flex items-center gap-1 uppercase ${active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"}`}
        >
          {label}
          <span className={`${MONO} text-[9px]`}>{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
        </button>
      </th>
    );
  };
  const td = `px-3 py-4 border-b border-zinc-200 ${MONO} text-right text-[13px] text-zinc-800`;

  return (
    <>
      <div className="border-b border-zinc-200 py-10">
        <p className={`${MONO} text-[11px] tracking-wider text-zinc-500`}>DATASET / AW-DISTRICTS / 12 AREAS</p>
        <h1 className="font-display mt-3 text-[26px] font-semibold tracking-tight text-zinc-950">Districts</h1>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-zinc-600">
          How each area of Aruba performs as a luxury rental market, and what is for sale there. Ranked by Sequence Score.
          Click a district to see its listings.
        </p>
      </div>

      {/* top 3 */}
      <div className="grid gap-px border-b border-zinc-200 bg-zinc-200 sm:grid-cols-3">
        {top.map((d, i) => (
          <button
            key={d.district}
            type="button"
            onClick={() => onOpenDistrict(d.district)}
            className="group bg-white py-6 text-left transition-colors hover:bg-zinc-50 sm:px-6 sm:first:pl-0"
          >
            <div className="flex items-baseline justify-between">
              <span className={`${MONO} text-[11px] text-zinc-500`}>#{i + 1}</span>
              <span className={`${MONO} text-[11px] text-zinc-500`}>SCORE <span className="text-zinc-950">{d.score}</span></span>
            </div>
            <p className="mt-3 text-[20px] font-semibold tracking-tight text-zinc-950">{d.district}</p>
            <div className={`${MONO} mt-4 grid grid-cols-3 gap-3 text-[11px] text-zinc-500`}>
              <span>
                <span className="block text-[13px]" style={{ color: deltaColor(d.revpar_yoy_pct) }}>{fmtDelta(d.revpar_yoy_pct)}</span>
                RevPAR YoY
              </span>
              <span>
                <span className="block text-[13px] text-zinc-950">{d.properties_for_sale + d.land_for_sale + d.commercial_for_sale}</span>
                For sale
              </span>
              <span>
                <span className="block text-[13px] text-zinc-950">{d.occupancy_pct}%</span>
                Occupancy
              </span>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] text-zinc-500 group-hover:text-zinc-950">
              View listings <ArrowRight size={12} strokeWidth={1.5} />
            </span>
          </button>
        ))}
      </div>

      <div className="py-8">
        <ArubaMap mode="districts" districts={districts} onSelect={onOpenDistrict} height={440} />
      </div>

      <div className="overflow-x-auto border-t border-zinc-950">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b border-zinc-300 py-3 pr-3 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">District</th>
              {th("Score", "score")}
              {th("For sale", "forSale")}
              {th("Median ask", "median_asking_usd")}
              {th("Avg. yield", "avg_property_yield_pct")}
              {th("ADR", "adr_usd")}
              {th("Occ.", "occupancy_pct")}
              {th("RevPAR", "revpar_usd")}
              {th("RevPAR YoY", "revpar_yoy_pct")}
              {th("New rentals YoY", "rental_supply_yoy_pct")}
              {th("Land $/sq ft", "land_psf_usd")}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.district} onClick={() => onOpenDistrict(d.district)} className="cursor-pointer transition-colors hover:bg-zinc-50">
                <td className="border-b border-zinc-200 py-4 pr-3">
                  <p className="text-[13px] text-zinc-950">{d.district}</p>
                  <p className={`${MONO} mt-1 text-[11px] text-zinc-500`}>{d.rentals_tracked} RENTALS TRACKED</p>
                </td>
                <td className={td}><ScoreBar score={d.score} /></td>
                <td className={td}>
                  {d.properties_for_sale + d.land_for_sale + d.commercial_for_sale}
                  <p className="mt-1 text-[10px] text-zinc-400">{d.properties_for_sale} HOMES · {d.land_for_sale} LAND · {d.commercial_for_sale} COMM.</p>
                </td>
                <td className={td}>{d.median_asking_usd ? fmtUsdCompact(d.median_asking_usd) : DASH}</td>
                <td className={td}>{d.avg_property_yield_pct !== null ? fmtPct(d.avg_property_yield_pct) : DASH}</td>
                <td className={td}>{fmtUsd(d.adr_usd)}</td>
                <td className={td}>{d.occupancy_pct}%</td>
                <td className={td}>{fmtUsd(d.revpar_usd)}</td>
                <td className={td} style={{ color: deltaColor(d.revpar_yoy_pct) }}>{fmtDelta(d.revpar_yoy_pct)}</td>
                <td className={td}>{fmtDelta(d.rental_supply_yoy_pct)}</td>
                <td className={td}>{d.land_psf_usd ? fmtUsd(d.land_psf_usd) : DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-[90ch] text-[11px] leading-relaxed text-zinc-500">
        <span className="text-zinc-700">Sequence Score</span> (0–100) combines rental demand (occupancy), growth (RevPAR
        year over year), value for buyers (average yield of homes for sale) and competition (new rental supply). Higher
        is better. ADR, occupancy and RevPAR are for luxury vacation rentals in the district over the last 12 months.
      </p>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Revenue Estimator — what would this property earn as a luxury rental?
 * ──────────────────────────────────────────────────────────────────────── */

export interface EstimatorPrefill extends Partial<EstimateInput> {
  label?: string;
}

const ESTIMATOR_TYPES: PropertyType[] = RESIDENTIAL_TYPES;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Stepper({ value, onChange, min, max, step = 1 }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number }) {
  return (
    <div className="flex items-center border border-zinc-300">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} className="px-3 py-2 text-zinc-500 hover:text-zinc-950" aria-label="Decrease">−</button>
      <span className={`${MONO} flex-1 text-center text-[13px] text-zinc-950`}>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} className="px-3 py-2 text-zinc-500 hover:text-zinc-950" aria-label="Increase">+</button>
    </div>
  );
}

function RevenueEstimator({ prefill, districts }: { prefill?: EstimatorPrefill | null; districts: DistrictStats[] }) {
  const [district, setDistrict] = useState(prefill?.district ?? "Malmok");
  const [type, setType] = useState<PropertyType>(prefill?.property_type ?? "Villa");
  const [beds, setBeds] = useState(prefill?.bedrooms ?? 5);
  const [baths, setBaths] = useState(prefill?.bathrooms ?? 5);
  const [beachfront, setBeachfront] = useState(prefill?.beachfront ?? false);
  const [price, setPrice] = useState(prefill?.asking_price_usd ? String(prefill.asking_price_usd) : "");

  const priceNum = Number(price.replace(/[^0-9.]/g, "")) || null;
  const est = useMemo(
    () => estimateRevenue({ district, property_type: type, bedrooms: beds, bathrooms: baths, beachfront, asking_price_usd: priceNum }),
    [district, type, beds, baths, beachfront, priceNum],
  );
  const selectCls = `${MONO} w-full border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none hover:border-zinc-500 focus:border-zinc-950`;
  const tick = { fill: C.slate500, fontSize: 11, fontFamily: MONO_FAMILY };

  return (
    <>
      <div className="border-b border-zinc-200 py-10">
        <p className={`${MONO} text-[11px] tracking-wider text-zinc-500`}>TOOL / REVENUE ESTIMATOR</p>
        <h1 className="font-display mt-3 text-[26px] font-semibold tracking-tight text-zinc-950">Revenue Estimator</h1>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-zinc-600">
          What would this property earn as a luxury vacation rental? Describe it, and we estimate nightly rate, occupancy
          and yearly revenue from comparable rentals in the same district. Add an asking price to see the yield.
        </p>
      </div>

      <div className="grid gap-10 pt-10 lg:grid-cols-[340px_1fr]">
        {/* form */}
        <div className="space-y-6">
          {prefill?.label && (
            <p className={`${MONO} border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600`}>
              FROM LISTING: <span className="text-zinc-950">{prefill.label}</span>
            </p>
          )}
          <Field label="District">
            <select value={district} onChange={(e) => setDistrict(e.target.value)} className={selectCls}>
              {districts.map((d) => (
                <option key={d.district} value={d.district}>{d.district}</option>
              ))}
            </select>
          </Field>
          <Field label="Property type">
            <div className="grid grid-cols-2 border border-zinc-300">
              {ESTIMATOR_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`${MONO} px-3 py-2 text-[11px] uppercase tracking-wider ${type === t ? "bg-zinc-950 text-mint" : "text-zinc-500 hover:text-zinc-950"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bedrooms"><Stepper value={beds} onChange={setBeds} min={2} max={12} /></Field>
            <Field label="Bathrooms"><Stepper value={baths} onChange={setBaths} min={1} max={14} step={0.5} /></Field>
          </div>
          <label className="flex cursor-pointer items-center justify-between border border-zinc-300 px-3 py-2.5">
            <span className="text-[12px] text-zinc-800">Beachfront</span>
            <input type="checkbox" checked={beachfront} onChange={(e) => setBeachfront(e.target.checked)} className="size-4 accent-zinc-950" />
          </label>
          <Field label="Asking price (optional, USD)">
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 8,500,000"
              className={`${selectCls} placeholder:text-zinc-400`}
            />
          </Field>
        </div>

        {/* results */}
        <div>
          <div className="grid gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="bg-white p-6">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Est. yearly revenue</p>
              <p className={`${MONO} mt-3 text-[36px] font-semibold leading-none tracking-tight text-zinc-950`}>{fmtUsdCompact(est.annual_revenue_usd)}</p>
              <p className={`${MONO} mt-3 text-[11px] text-zinc-500`}>
                RANGE {fmtUsdCompact(est.revenue_low_usd)} – {fmtUsdCompact(est.revenue_high_usd)}
              </p>
            </div>
            <div className="bg-white p-6">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Nightly rate</p>
              <p className={`${MONO} mt-3 text-[22px] text-zinc-950`}>{fmtUsd(est.adr_usd)}</p>
            </div>
            <div className="bg-white p-6">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Occupancy</p>
              <p className={`${MONO} mt-3 text-[22px] text-zinc-950`}>{est.occupancy_pct}%</p>
              <p className={`${MONO} mt-2 text-[11px] text-zinc-500`}>{Math.round((365 * est.occupancy_pct) / 100)} NIGHTS</p>
            </div>
            <div className="bg-white p-6">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{est.gross_yield_pct !== null ? "Gross yield" : "RevPAR"}</p>
              {est.gross_yield_pct !== null && est.signal ? (
                <>
                  <p className={`${MONO} mt-3 text-[22px] text-zinc-950`}>{fmtPct(est.gross_yield_pct)}</p>
                  <div className="mt-2"><SignalBadge signal={est.signal} /></div>
                </>
              ) : (
                <p className={`${MONO} mt-3 text-[22px] text-zinc-950`}>{fmtUsd(est.revpar_usd)}</p>
              )}
            </div>
          </div>

          <div className="mt-10">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-700">Revenue by month</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={est.monthly} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.hairline} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} axisLine={{ stroke: C.slate700 }} tickLine={false} tick={tick} />
                  <YAxis axisLine={false} tickLine={false} tick={tick} width={56} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip
                    cursor={{ fill: "#F4F4F5" }}
                    formatter={(v) => [fmtUsd(Number(v)), "Revenue"]}
                    labelFormatter={(l) => fmtMonthYear(String(l))}
                    contentStyle={{ fontFamily: MONO_FAMILY, fontSize: 11, border: "1px solid #D4D4D8", borderRadius: 0 }}
                  />
                  <Bar dataKey="revenue_usd" fill={C.ink} maxBarSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-10">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-700">Comparable rentals</p>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  <th className="border-b border-zinc-300 py-2 font-medium">Rental</th>
                  <th className="border-b border-zinc-300 py-2 text-right font-medium">Nightly rate</th>
                  <th className="border-b border-zinc-300 py-2 text-right font-medium">Occupancy</th>
                  <th className="border-b border-zinc-300 py-2 text-right font-medium">Yearly revenue</th>
                </tr>
              </thead>
              <tbody>
                {est.comps.map((c) => (
                  <tr key={c.comp_id}>
                    <td className="border-b border-zinc-200 py-3 text-[13px] text-zinc-900">
                      {c.label}
                      <span className={`${MONO} ml-2 text-[10px] text-zinc-400`}>{c.comp_id}</span>
                    </td>
                    <td className={`${MONO} border-b border-zinc-200 py-3 text-right text-[13px]`}>{fmtUsd(c.adr_usd)}</td>
                    <td className={`${MONO} border-b border-zinc-200 py-3 text-right text-[13px]`}>{c.occupancy_pct}%</td>
                    <td className={`${MONO} border-b border-zinc-200 py-3 text-right text-[13px] text-zinc-950`}>{fmtUsdCompact(c.annual_revenue_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
              Estimates are gross revenue before cleaning, management and platform fees. Comparable rentals are anonymized.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────
 * Terminal updates — message board fed by every daily scrape
 * ──────────────────────────────────────────────────────────────────────── */

const fmtRunTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Aruba" });
const fmtRunDay = (run: ScrapeRun, i: number) =>
  i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(run.run_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Aruba" });

type BoardMessage =
  | { kind: "run"; run: ScrapeRun }
  | { kind: "new"; l: Listing }
  | { kind: "price"; l: Listing; from: number; e: PriceEvent };

function runMessages(run: ScrapeRun): BoardMessage[] {
  return [
    { kind: "run", run },
    ...run.new_listings.map((l): BoardMessage => ({ kind: "new", l })),
    ...run.price_changes.map((c): BoardMessage => ({ kind: "price", l: c.listing, from: c.previous_price_usd, e: c.change })),
  ];
}

function TerminalUpdates({
  runs,
  open,
  onToggle,
  onOpenListing,
  onShowNew,
}: {
  runs: ScrapeRun[];
  open: boolean;
  onToggle: () => void;
  onOpenListing: (id: string) => void;
  onShowNew: () => void;
}) {
  const latest = runs[0];
  const drops = latest.price_changes.filter((c) => c.change.event === "Price drop").length;
  const ups = latest.price_changes.length - drops;
  const boxRef = useRef<HTMLDivElement>(null);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onToggle();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onToggle();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onToggle]);

  return (
    <div ref={boxRef} id="terminal-updates" className="relative mt-4 scroll-mt-4">
      {/* slim bar */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-mint-deep bg-mint-soft px-4 py-2 text-left text-[12px] transition-colors hover:bg-mint"
      >
        <span className="flex items-center gap-2 font-semibold text-zinc-950">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: PRICE_UP }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: PRICE_UP }} />
          </span>
          Terminal updated
        </span>
        <span className="text-zinc-500">Today {fmtRunTime(latest.run_at)} AST</span>
        <span className="flex items-center gap-3 text-zinc-700">
          <span>
            <b className={`${MONO} text-zinc-950`}>{latest.new_listings.length}</b> new
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowDown size={12} strokeWidth={2.5} style={{ color: PRICE_DOWN }} />
            <b className={MONO}>{drops}</b>
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowUp size={12} strokeWidth={2.5} style={{ color: PRICE_UP }} />
            <b className={MONO}>{ups}</b>
          </span>
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-medium text-zinc-700">
          {open ? "Close" : "View updates"}
          <ChevronDown size={13} strokeWidth={1.75} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {/* dropdown feed */}
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-full max-w-[560px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_18px_40px_-12px_rgb(0_0_0/0.25)]">
          <div className="max-h-[360px] overflow-y-auto" role="log" aria-label="Terminal updates">
            {runs.map((run, i) => (
              <div key={run.run_at}>
                <p className="sticky top-0 z-10 flex justify-between border-b border-zinc-100 bg-white/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 backdrop-blur">
                  <span>{fmtRunDay(run, i)}</span>
                  <span className="font-normal normal-case tracking-normal text-zinc-400">
                    {fmtRunTime(run.run_at)} · {run.listings_checked} listings, {int.format(run.rentals_checked)} rentals checked
                  </span>
                </p>
                <ul>
                  {!run.new_listings.length && !run.price_changes.length && (
                    <li className="px-4 py-2 text-[12px] text-zinc-400">Terminal updated, no changes</li>
                  )}
                  {runMessages(run).map((m) => {
                      if (m.kind === "run") return null;
                      return (
                        <li key={`${m.kind}-${m.l.listing_id}-${m.kind === "price" ? m.e.date : ""}`}>
                          <button
                            type="button"
                            onClick={() => {
                              onOpenListing(m.l.listing_id);
                              onToggle();
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2 text-left text-[12px] transition-colors hover:bg-mint-soft"
                          >
                            <span className="w-[52px] shrink-0">
                              {m.kind === "new" ? (
                                <span className="rounded bg-zinc-950 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-mint">NEW</span>
                              ) : (
                                <PriceMove pct={m.e.change_pct ?? 0} label={false} />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-zinc-950">{m.l.asset_name}</span>
                              <span className="block truncate text-[11px] text-zinc-500">
                                {typeLine(m.l)} · {m.l.district} · {m.l.tenure}
                              </span>
                            </span>
                            <span className={`${MONO} shrink-0 text-right`}>
                              {m.kind === "new" ? (
                                <span className="font-semibold text-zinc-950">{fmtUsdCompact(m.l.asking_price_usd)}</span>
                              ) : (
                                <>
                                  <span className="text-zinc-400 line-through">{fmtUsdCompact(m.from)}</span>{" "}
                                  <span className="font-semibold text-zinc-950">{fmtUsdCompact(m.e.price_usd)}</span>
                                </>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
          {latest.new_listings.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onShowNew();
                onToggle();
              }}
              className="flex w-full items-center justify-center gap-2 border-t border-zinc-200 bg-zinc-950 px-3 py-2.5 text-[12px] font-medium text-mint transition-colors hover:bg-zinc-800"
            >
              Show the {latest.new_listings.length} new listings
              <ArrowRight size={13} strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const SLUG_TAB = Object.fromEntries(Object.entries(TAB_SLUG).map(([t, s]) => [s, t])) as Record<string, Tab>;

function Dashboard() {
  const params = useSearchParams();
  const [tab, setTabState] = useState<Tab>(SLUG_TAB[params.get("tab") ?? ""] ?? "Listings & Rentals");
  const [listingsView, setListingsView] = useState<{
    key: number;
    district?: string;
    query?: string;
    openId?: string;
    newToday?: boolean;
  }>({
    key: 0,
    district: params.get("district") ?? undefined,
    query: params.get("q") ?? undefined,
  });
  const [boardOpen, setBoardOpen] = useState(false);
  const toggleBoard = useCallback(() => setBoardOpen((o) => !o), []);
  const updatesToday = SCRAPE_RUNS[0].new_listings.length + SCRAPE_RUNS[0].price_changes.length;
  const [marketView, setMarketViewState] = useState<"sale" | "rentals">(params.get("view") === "rentals" ? "rentals" : "sale");
  const [prefill, setPrefill] = useState<{ key: number; value: EstimatorPrefill | null }>({ key: 0, value: null });
  const { data, error } = useDashboardData(MARKET_ID);

  const setTab = (t: Tab, view: "sale" | "rentals" = marketView) => {
    setTabState(t);
    const viewParam = t === "Listings & Rentals" && view === "rentals" ? "&view=rentals" : "";
    window.history.replaceState(null, "", `?tab=${TAB_SLUG[t]}${viewParam}`);
    window.scrollTo({ top: 0 });
  };
  const setMarketView = (v: "sale" | "rentals") => {
    setMarketViewState(v);
    window.history.replaceState(null, "", `?tab=listings${v === "rentals" ? "&view=rentals" : ""}`);
  };
  const showForSale = (district: string) => {
    setListingsView((v) => ({ key: v.key + 1, district, query: undefined }));
    setMarketViewState("sale");
    setTab("Listings & Rentals", "sale");
  };
  const openDistrict = (district: string) => showForSale(district);
  const openListing = (id: string) => {
    setListingsView((v) => ({ key: v.key + 1, openId: id }));
    setMarketViewState("sale");
    setTabState("Listings & Rentals");
    window.history.replaceState(null, "", "?tab=listings");
  };
  const showNewToday = () => {
    setListingsView((v) => ({ key: v.key + 1, newToday: true }));
    setMarketViewState("sale");
    window.history.replaceState(null, "", "?tab=listings");
  };
  const openUpdates = () => {
    setBoardOpen(true);
    setTabState("Listings & Rentals");
    requestAnimationFrame(() => document.getElementById("terminal-updates")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const openEstimator = (l: ListingSignal) => {
    setPrefill((p) => ({
      key: p.key + 1,
      value: {
        label: l.asset_name,
        district: l.district,
        property_type: l.property_type,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        beachfront: false,
        asking_price_usd: l.asking_price_usd,
      },
    }));
    setTab("Revenue Estimator");
  };

  return (
    <div className={`${inter.className} min-h-screen bg-white text-zinc-800 antialiased selection:bg-mint selection:text-zinc-950`}>
      <Header tab={tab} onTab={setTab} updates={updatesToday} onUpdates={openUpdates} />

      <main className="mx-auto max-w-[1400px] px-6 pb-20">
        {error ? (
          <div className={`${MONO} py-24 text-center text-[12px]`} style={{ color: C.down }}>
            FEED ERROR — {error}
          </div>
        ) : tab === "Listings & Rentals" ? (
          <>
          <TerminalUpdates
            runs={SCRAPE_RUNS}
            open={boardOpen}
            onToggle={toggleBoard}
            onOpenListing={openListing}
            onShowNew={showNewToday}
          />
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="inline-flex rounded-xl border border-zinc-300 bg-white p-1 shadow-sm" role="tablist" aria-label="Market view">
              {(
                [
                  ["sale", "For sale", data?.allListings.length],
                  ["rentals", "Vacation rentals", data?.rentals.length],
                ] as const
              ).map(([v, label, count]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={marketView === v}
                  onClick={() => setMarketView(v)}
                  className={`rounded-lg px-5 py-2.5 font-display text-[14px] font-semibold transition-colors ${
                    marketView === v ? "bg-zinc-950 text-mint" : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  {label}
                  {count !== undefined && <span className={`ml-2 text-[12px] ${marketView === v ? "text-mint/70" : "text-zinc-400"}`}>{count}</span>}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-zinc-500">
              {marketView === "sale"
                ? "Properties, land and commercial real estate listed for sale"
                : "Airbnb, Vrbo and direct-booking rentals with nightly prices"}
            </p>
          </div>
          {marketView === "rentals" ? (
            <VacationRentals rentals={data?.rentals} initialDistrict={listingsView.district} onShowForSale={showForSale} />
          ) : (
          <ActiveListings
            key={listingsView.key}
            listings={data?.allListings}
            marketYield={data?.snapshot.est_gross_yield_pct}
            initialDistrict={listingsView.district}
            initialQuery={listingsView.query}
            initialOpenId={listingsView.openId}
            initialNewToday={listingsView.newToday}
            onEstimate={openEstimator}
          />
          )}
          </>
        ) : tab === "Districts" ? (
          <Districts districts={DISTRICTS} onOpenDistrict={openDistrict} />
        ) : tab === "Revenue Estimator" ? (
          <RevenueEstimator key={prefill.key} prefill={prefill.value} districts={DISTRICTS} />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 py-10">
              <div>
                <p className={`${MONO} text-[11px] tracking-wider text-zinc-500`}>DATASET / AW-LUX-STR / v1</p>
                <h1 className="font-display mt-3 text-[26px] font-semibold tracking-tight text-zinc-950">
                  Aruba Ultra-Luxury Short-Term Rental Market
                </h1>
              </div>
              <p className={`${MONO} text-[11px] text-zinc-500`}>
                {data ? `LAST SYNC ${fmtTimestamp(data.snapshot.as_of)}` : "SYNCING…"}
              </p>
            </div>

            <div className="space-y-16 pt-10">
              <AnchorMetrics snapshot={data?.snapshot} />
              <div className="border-t border-zinc-200 pt-10">
                <HistoricalChart monthly={data?.monthly} />
              </div>
              <div className="border-t border-zinc-200 pt-10">
                <YieldRadar listings={data?.listings} marketYield={data?.snapshot.est_gross_yield_pct} />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-zinc-200">
        <div className={`${MONO} mx-auto flex max-w-[1400px] flex-wrap justify-between gap-2 px-6 py-5 text-[10px] tracking-wider text-zinc-500`}>
          <span>© 2026 SEQUENCE DATA · PROPRIETARY & CONFIDENTIAL</span>
          <span>NOT INVESTMENT ADVICE · FOR LICENSED SUBSCRIBERS ONLY</span>
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <Dashboard />
    </Suspense>
  );
}
