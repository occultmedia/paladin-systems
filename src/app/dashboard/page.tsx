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

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/logo";
import {
  DISTRICTS,
  MARKET_ID,
  estimateRevenue,
  repository,
  type EstimateInput,
  type DistrictStats,
  type Listing,
  type ListingSignal,
  type MarketSnapshot,
  type MonthlyPerformance,
  type PropertyType,
  type Signal,
} from "@/lib/aruba-data";
import { Inter } from "next/font/google";
import {
  ArrowDownRight,
  ArrowRight,
  Calculator,
  List,
  Map as MapIcon,
  ArrowUpRight,
  ChevronDown,
  CreditCard,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  Search,
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
    ])
      .then(([snapshot, monthly, listings, allListings]) => {
        if (!cancelled) setData({ snapshot, monthly, listings, allListings });
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

const TABS = ["Active Listings", "Districts", "Revenue Estimator", "Rental Market"] as const;
type Tab = (typeof TABS)[number];
const TAB_SLUG: Record<Tab, string> = {
  "Active Listings": "listings",
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

function Header({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
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
 * Active Listings — every scraped property and land parcel for sale
 * ──────────────────────────────────────────────────────────────────────── */

type SortKey = "name" | "district" | "beds" | "size" | "asking" | "psf" | "adr" | "yield" | "vsDistrict" | "listed";
type Category = "All" | "Property" | "Land";

const SORT_VALUE: Record<SortKey, (l: Listing) => number | string | null> = {
  name: (l) => l.asset_name,
  district: (l) => l.district,
  beds: (l) => (l.category === "Property" ? l.bedrooms : null),
  size: (l) => (l.category === "Property" ? l.built_sqft : l.lot_sqft),
  asking: (l) => l.asking_price_usd,
  psf: (l) => l.price_per_sqft_usd,
  adr: (l) => (l.category === "Property" ? l.sequence_adr_usd : null),
  yield: (l) => (l.category === "Property" ? l.projected_gross_yield_pct : null),
  vsDistrict: (l) => (l.category === "Land" ? l.price_vs_district_pct : null),
  listed: (l) => l.days_on_market,
};

const CATEGORY_FILTERS: Array<{ value: Category; label: string }> = [
  { value: "All", label: "All" },
  { value: "Property", label: "Properties" },
  { value: "Land", label: "Land" },
];
const PROPERTY_TYPES: Array<PropertyType | "All"> = ["All", "Villa", "Estate", "Penthouse", "Beach House"];
const SIGNAL_FILTERS: Array<{ value: Signal | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "UNDERVALUED", label: "Undervalued" },
  { value: "AT_MARKET", label: "At Market" },
  { value: "OVERPRICED", label: "Overpriced" },
];

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
const DASH = <span className="text-zinc-300">—</span>;

function downloadCsv(rows: Listing[]) {
  const p = (l: Listing) => (l.category === "Property" ? l : null);
  const d = (l: Listing) => (l.category === "Land" ? l : null);
  const cols: Array<[string, (l: Listing) => string | number | null | undefined]> = [
    ["Listing ID", (l) => l.listing_id],
    ["Category", (l) => l.category],
    ["Name", (l) => l.asset_name],
    ["Type", (l) => l.property_type],
    ["District", (l) => l.district],
    ["Zoning", (l) => d(l)?.zoning],
    ["Bedrooms", (l) => p(l)?.bedrooms],
    ["Bathrooms", (l) => p(l)?.bathrooms],
    ["Built sq ft", (l) => p(l)?.built_sqft],
    ["Lot sq ft", (l) => l.lot_sqft],
    ["Asking price USD", (l) => l.asking_price_usd],
    ["Price per sq ft USD", (l) => l.price_per_sqft_usd],
    ["Price change %", (l) => l.price_change_pct],
    ["District land avg per sq ft USD", (l) => d(l)?.district_land_psf_usd],
    ["Price vs district %", (l) => d(l)?.price_vs_district_pct],
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
      className={`border-b border-zinc-300 px-3 py-3 text-[10px] font-medium uppercase tracking-[0.16em] ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase transition-colors ${active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"}`}
      >
        {label}
        <span className={`${MONO} text-[9px]`}>{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

function PlainHeader({ label }: { label: string }) {
  return (
    <th className="border-b border-zinc-300 px-3 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
      {label}
    </th>
  );
}

function Thumb({ src, alt, w = 64, h = 44 }: { src: string | null; alt: string; w?: number; h?: number }) {
  return src ? (
    <Image src={`${src}?auto=format&fit=crop&w=${w * 2}&h=${h * 2}&q=60`} alt={alt} width={w} height={h} unoptimized className="shrink-0 bg-zinc-100 object-cover" style={{ width: w, height: h }} />
  ) : (
    <span className="block shrink-0 bg-zinc-100" style={{ width: w, height: h }} />
  );
}

function DetailItem({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</dt>
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

function ListingDetails({
  l,
  marketYield,
  compact = false,
  onEstimate,
}: {
  l: Listing;
  marketYield?: number;
  compact?: boolean;
  onEstimate?: (l: ListingSignal) => void;
}) {
  const grid = compact ? "grid grid-cols-2 gap-x-6 gap-y-5" : "grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4 lg:grid-cols-6";
  const shared = (
    <>
      <DetailItem label="Asking price" value={fmtUsd(l.asking_price_usd)} />
      <DetailItem
        label="Price change"
        value={l.price_change_pct === 0 ? "No change" : fmtDelta(l.price_change_pct)}
        color={l.price_change_pct ? deltaColor(l.price_change_pct) : undefined}
      />
      <DetailItem label="First seen" value={fmtDate(l.first_seen)} />
      <DetailItem label="Last scraped" value={fmtTimestamp(l.last_scraped)} />
      <DetailItem label="Source" value={<SourceValue l={l} />} />
    </>
  );

  const photo = l.photo_url ? (
    <div className={compact ? "col-span-full" : "col-span-2 row-span-2"}>
      <Image
        src={`${l.photo_url}?auto=format&fit=crop&w=720&h=440&q=70`}
        alt={l.asset_name}
        width={360}
        height={220}
        unoptimized
        className="h-full max-h-[220px] w-full bg-zinc-100 object-cover"
      />
    </div>
  ) : null;

  if (l.category === "Land") {
    return (
      <dl className={grid}>
        {photo}
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
        {shared}
      </dl>
    );
  }

  return (
    <dl className={grid}>
      {photo}
      <DetailItem label="Property type" value={l.property_type} />
      <DetailItem label="Bedrooms / baths" value={`${l.bedrooms} / ${l.bathrooms}`} />
      <DetailItem label="Built area" value={fmtSqft(l.built_sqft)} />
      <DetailItem label="Lot size" value={l.lot_sqft ? fmtSqft(l.lot_sqft) : "N/A (condo)"} />
      <DetailItem label="Price / sq ft" value={fmtUsd(l.price_per_sqft_usd)} />
      <DetailItem label="Est. annual revenue" value={fmtUsd(l.projected_annual_revenue_usd)} />
      <DetailItem label="Est. nightly rate" value={fmtUsd(l.sequence_adr_usd)} />
      <DetailItem
        label="Est. occupancy"
        value={`${fmtPct(l.projected_occupancy_pct, 0)} · ${Math.round((365 * l.projected_occupancy_pct) / 100)} nights`}
      />
      <DetailItem
        label="Yield vs market"
        value={`${fmtPct(l.projected_gross_yield_pct)} vs ${marketYield !== undefined ? fmtPct(marketYield) : "—"}`}
        color={deltaColor(l.yield_spread_bps)}
      />
      {shared}
      {onEstimate && (
        <div className="col-span-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEstimate(l);
            }}
            className="inline-flex items-center gap-2 border border-zinc-950 px-3 py-2 text-[12px] text-zinc-950 transition-colors hover:bg-zinc-950 hover:text-white"
          >
            <Calculator size={13} strokeWidth={1.5} />
            Open in Revenue Estimator
          </button>
        </div>
      )}
    </dl>
  );
}

function ActiveListings({
  listings,
  marketYield,
  initialDistrict,
  initialQuery,
  onEstimate,
}: {
  listings?: Listing[];
  marketYield?: number;
  initialDistrict?: string;
  initialQuery?: string;
  onEstimate: (l: ListingSignal) => void;
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [category, setCategory] = useState<Category>("All");
  const [district, setDistrict] = useState(initialDistrict ?? "All");
  const [type, setType] = useState<PropertyType | "All">("All");
  const [signal, setSignal] = useState<Signal | "ALL">("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "listed", dir: "asc" });
  const [openId, setOpenId] = useState<string | null>(null);

  const landOnly = category === "Land";
  const propsOnly = category === "Property";

  const districts = useMemo(
    () => ["All", ...Array.from(new Set((listings ?? []).map((l) => l.district))).sort()],
    [listings],
  );

  const rows = useMemo(() => {
    if (!listings) return [];
    const q = query.trim().toLowerCase();
    const filtered = listings.filter(
      (l) =>
        (category === "All" || l.category === category) &&
        (district === "All" || l.district === district) &&
        (type === "All" || landOnly || l.property_type === type) &&
        (signal === "ALL" || l.signal === signal) &&
        (!q || `${l.asset_name} ${l.district} ${l.listing_id} ${l.source} ${l.property_type}`.toLowerCase().includes(q)),
    );
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
  }, [listings, query, category, district, type, landOnly, signal, sort]);

  const stats = useMemo(() => {
    const props = rows.filter((r): r is ListingSignal => r.category === "Property");
    return {
      count: rows.length,
      properties: props.length,
      land: rows.length - props.length,
      medianAsk: median(rows.map((r) => r.asking_price_usd)),
      avgYield: props.length ? props.reduce((s, r) => s + r.projected_gross_yield_pct, 0) / props.length : null,
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
    if (c === "Land") setType("All");
    if (c !== "Land" && sort.key === "vsDistrict") setSort({ key: "listed", dir: "asc" });
    if (c === "Land" && (sort.key === "beds" || sort.key === "adr" || sort.key === "yield")) setSort({ key: "listed", dir: "asc" });
  };

  const filtersActive = query || category !== "All" || district !== "All" || type !== "All" || signal !== "ALL";
  const selectCls = `${MONO} border border-zinc-300 bg-white px-3 py-2 text-[12px] text-zinc-800 outline-none transition-colors hover:border-zinc-500 focus:border-zinc-950`;
  const segBtn = (on: boolean) =>
    `${MONO} px-3 py-2 text-[11px] uppercase tracking-wider transition-colors ${on ? "bg-zinc-950 text-mint" : "text-zinc-500 hover:text-zinc-950"}`;
  const td = "px-3 py-4 border-b border-zinc-200 align-top";
  const num = `${td} ${MONO} text-right text-[13px] text-zinc-800`;
  const colCount = landOnly ? 10 : 11;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 py-10">
        <div>
          <p className={`${MONO} text-[11px] tracking-wider text-zinc-500`}>DATASET / AW-LISTINGS / SCRAPED DAILY</p>
          <h1 className="font-display mt-3 text-[26px] font-semibold tracking-tight text-zinc-950">Active Listings</h1>
          <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-zinc-600">
            Every high-value property and land parcel currently for sale in Aruba, scraped daily from broker, agency,
            developer and private listings. Click any row for full details.
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
          ["Properties", listings ? int.format(stats.properties) : "—", undefined],
          ["Land parcels", listings ? int.format(stats.land) : "—", undefined],
          ["Median asking", listings && stats.count ? fmtUsdCompact(stats.medianAsk) : "—", undefined],
          ["Avg. property yield", stats.avgYield !== null ? fmtPct(stats.avgYield) : "—", undefined],
          ["Undervalued", listings ? int.format(stats.undervalued) : "—", listings ? C.up : undefined],
        ].map(([label, value, color], i) => (
          <div key={label} className={`py-6 ${i > 0 ? "lg:border-l lg:border-zinc-200 lg:pl-6" : ""}`}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
            <p className={`${MONO} mt-2 font-display text-[24px] font-bold text-zinc-950`} style={color ? { color } : undefined}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3 py-6">
        <div className="flex border border-zinc-950" role="group" aria-label="Category">
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
            className={`${selectCls} w-60 pl-8 placeholder:text-zinc-400`}
          />
        </label>
        <label className="sr-only" htmlFor="f-district">District</label>
        <select id="f-district" value={district} onChange={(e) => setDistrict(e.target.value)} className={selectCls}>
          {districts.map((d) => (
            <option key={d} value={d}>{d === "All" ? "All districts" : d}</option>
          ))}
        </select>
        {!landOnly && (
          <>
            <label className="sr-only" htmlFor="f-type">Property type</label>
            <select id="f-type" value={type} onChange={(e) => setType(e.target.value as PropertyType | "All")} className={selectCls}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t === "All" ? "All property types" : t}</option>
              ))}
            </select>
          </>
        )}
        <div className="flex border border-zinc-300" role="group" aria-label="Signal">
          {SIGNAL_FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setSignal(f.value)} aria-pressed={signal === f.value} className={segBtn(signal === f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              pickCategory("All");
              setDistrict("All");
              setType("All");
              setSignal("ALL");
            }}
            className="text-[12px] text-zinc-500 underline-offset-4 hover:text-zinc-950 hover:underline"
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto flex border border-zinc-950" role="group" aria-label="View">
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`${segBtn(view === "list")} inline-flex items-center gap-1.5`}>
            <List size={12} strokeWidth={1.5} /> List
          </button>
          <button type="button" onClick={() => setView("map")} aria-pressed={view === "map"} className={`${segBtn(view === "map")} inline-flex items-center gap-1.5`}>
            <MapIcon size={12} strokeWidth={1.5} /> Map
          </button>
        </div>
      </div>

      {view === "map" ? (
        <div className="grid gap-6 border-t border-zinc-950 pt-6 lg:grid-cols-[1fr_400px]">
          <ArubaMap mode="listings" listings={rows} selectedId={openId} onSelect={setOpenId} height={640} />
          <div className="max-h-[640px] overflow-y-auto border border-zinc-200">
            {!rows.length && (
              <p className={`${MONO} p-8 text-center text-[12px] text-zinc-500`}>NO LISTINGS MATCH THESE FILTERS</p>
            )}
            {rows.map((l) => {
              const open = openId === l.listing_id;
              return (
                <div key={l.listing_id} className={`border-b border-zinc-200 ${open ? "bg-zinc-50" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : l.listing_id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    <Thumb src={l.photo_url} alt={l.asset_name} w={56} h={42} />
                    <span className="flex-1">
                      <span className="block text-[13px] font-medium text-zinc-950">{l.asset_name}</span>
                      <span className={`${MONO} mt-1 block text-[10px] uppercase tracking-wider text-zinc-500`}>
                        {l.property_type} · {l.district}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={`${MONO} block text-[13px] text-zinc-950`}>{fmtUsdCompact(l.asking_price_usd)}</span>
                      <span className="mt-1 block"><SignalBadge signal={l.signal} /></span>
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-5 pt-1">
                      <ListingDetails l={l} marketYield={marketYield} compact onEstimate={onEstimate} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div className="overflow-x-auto border-t border-zinc-950">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead>
            <tr>
              <SortHeader label={landOnly ? "Parcel" : "Listing"} k="name" sort={sort} onSort={onSort} align="left" />
              <SortHeader label="District" k="district" sort={sort} onSort={onSort} align="left" />
              {landOnly ? <PlainHeader label="Zoning" /> : <SortHeader label="Bd / Ba" k="beds" sort={sort} onSort={onSort} />}
              <SortHeader label={landOnly ? "Lot (sq ft)" : propsOnly ? "Built (sq ft)" : "Size (sq ft)"} k="size" sort={sort} onSort={onSort} />
              <SortHeader label="Asking" k="asking" sort={sort} onSort={onSort} />
              <SortHeader label="$ / sq ft" k="psf" sort={sort} onSort={onSort} />
              {landOnly ? (
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
                <td colSpan={colCount} className={`${MONO} py-16 text-center text-[12px] text-zinc-500`}>
                  NO LISTINGS MATCH THESE FILTERS
                </td>
              </tr>
            )}
            {rows.map((l) => {
              const open = openId === l.listing_id;
              const isLand = l.category === "Land";
              return (
                <Fragment key={l.listing_id}>
                  <tr
                    onClick={() => setOpenId(open ? null : l.listing_id)}
                    className={`cursor-pointer transition-colors hover:bg-zinc-50 ${open ? "bg-zinc-50" : ""}`}
                  >
                    <td className={`${td} pl-0`}>
                      <div className="flex items-start gap-3">
                      <Thumb src={l.photo_url} alt={l.asset_name} />
                      <div>
                      <p className="text-[13px] font-medium text-zinc-950">{l.asset_name}</p>
                      <p className={`${MONO} mt-1 text-[11px] text-zinc-500`}>
                        {l.listing_id} ·{" "}
                        <span className={isLand ? "border border-zinc-400 px-1 text-zinc-700" : ""}>
                          {l.property_type.toUpperCase()}
                        </span>
                        {l.days_on_market <= 7 && <span className="ml-2 bg-zinc-950 px-1.5 py-0.5 text-[9px] text-white">NEW</span>}
                      </p>
                      </div>
                      </div>
                    </td>
                    <td className={`${td} text-[13px] text-zinc-700`}>{l.district}</td>
                    {landOnly ? (
                      <td className={`${td} text-right text-[13px] text-zinc-700`}>{l.category === "Land" ? l.zoning : DASH}</td>
                    ) : (
                      <td className={num}>{l.category === "Property" ? `${l.bedrooms} / ${l.bathrooms}` : DASH}</td>
                    )}
                    <td className={num}>
                      {int.format(l.category === "Property" ? l.built_sqft : l.lot_sqft)}
                      {!landOnly && !propsOnly && <p className="mt-1 text-[10px] uppercase text-zinc-400">{isLand ? "lot" : "built"}</p>}
                    </td>
                    <td className={`${num} text-zinc-950`}>
                      {fmtUsdCompact(l.asking_price_usd)}
                      {l.price_change_pct !== 0 && (
                        <p className="mt-1 text-[11px]" style={{ color: deltaColor(l.price_change_pct) }}>
                          {fmtDelta(l.price_change_pct)}
                        </p>
                      )}
                    </td>
                    <td className={num}>{fmtUsd(l.price_per_sqft_usd)}</td>
                    {landOnly ? (
                      <td className={num}>
                        {l.category === "Land" && (
                          <span style={{ color: deltaColor(-l.price_vs_district_pct) }}>{fmtDelta(l.price_vs_district_pct)}</span>
                        )}
                      </td>
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
                              <p className="mt-1 text-[11px]" style={{ color: deltaColor(-l.price_vs_district_pct) }}>
                                {fmtDelta(l.price_vs_district_pct)} vs dist.
                              </p>
                            </>
                          )}
                        </td>
                      </>
                    )}
                    <td className={`${td} text-right`}>
                      <SignalBadge signal={l.signal} />
                    </td>
                    <td className={num}>{l.days_on_market}d</td>
                    <td className={`${td} pr-0 text-right`}>
                      <ChevronDown size={14} strokeWidth={1.5} className={`ml-auto text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-zinc-50">
                      <td colSpan={colCount} className="border-b border-zinc-300 px-0 pb-8 pt-2">
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
      )}
      <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-zinc-500">
        <p>
          <span className="text-zinc-700">Properties</span> are scored on projected rental yield: estimated nightly rate and
          occupancy come from comparable luxury vacation rentals in the same district. Gross, before costs.
        </p>
        <p>
          <span className="text-zinc-700">Land</span> is scored on price per sq ft against the district&apos;s average land
          price: 10% or more below is Undervalued, 10% or more above is Overpriced.
        </p>
      </div>
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
    k === "forSale" ? d.properties_for_sale + d.land_for_sale : d[k];

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
                <span className="block text-[13px] text-zinc-950">{d.properties_for_sale + d.land_for_sale}</span>
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
                  {d.properties_for_sale + d.land_for_sale}
                  <p className="mt-1 text-[10px] text-zinc-400">{d.properties_for_sale} HOMES · {d.land_for_sale} LAND</p>
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

const ESTIMATOR_TYPES: PropertyType[] = ["Villa", "Estate", "Penthouse", "Beach House"];

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

const SLUG_TAB = Object.fromEntries(Object.entries(TAB_SLUG).map(([t, s]) => [s, t])) as Record<string, Tab>;

function Dashboard() {
  const params = useSearchParams();
  const [tab, setTabState] = useState<Tab>(SLUG_TAB[params.get("tab") ?? ""] ?? "Active Listings");
  const [listingsView, setListingsView] = useState({
    key: 0,
    district: params.get("district") ?? undefined,
    query: params.get("q") ?? undefined,
  });
  const [prefill, setPrefill] = useState<{ key: number; value: EstimatorPrefill | null }>({ key: 0, value: null });
  const { data, error } = useDashboardData(MARKET_ID);

  const setTab = (t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, "", `?tab=${TAB_SLUG[t]}`);
    window.scrollTo({ top: 0 });
  };
  const openDistrict = (district: string) => {
    setListingsView((v) => ({ key: v.key + 1, district, query: undefined }));
    setTab("Active Listings");
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
      <Header tab={tab} onTab={setTab} />

      <main className="mx-auto max-w-[1400px] px-6 pb-20">
        {error ? (
          <div className={`${MONO} py-24 text-center text-[12px]`} style={{ color: C.down }}>
            FEED ERROR — {error}
          </div>
        ) : tab === "Active Listings" ? (
          <ActiveListings
            key={listingsView.key}
            listings={data?.allListings}
            marketYield={data?.snapshot.est_gross_yield_pct}
            initialDistrict={listingsView.district}
            initialQuery={listingsView.query}
            onEstimate={openEstimator}
          />
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
