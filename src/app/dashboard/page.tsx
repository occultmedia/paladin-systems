"use client";

/**
 * SEQUENCE DATA — Aruba Luxury STR Baseline (MVP)
 * Single-file dashboard: types → data layer → formatters → UI.
 *
 * Deps: next, react, tailwindcss, lucide-react, recharts
 * Drop in as app/page.tsx (or app/dashboard/page.tsx).
 *
 * To go live: implement `supabaseRepository` (sketch below) and flip
 * `repository` to it. Nothing in the UI layer needs to change.
 */

import { ProBadge } from "@/components/pro-badge";
import { RunLine } from "@/components/run-line";
import { Fragment, Suspense, createContext, useCallback, useContext, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ListingPhoto } from "@/components/listing-photo";
import { fmtArea, fmtPerArea, fmtSqft, perM2, pricePerM2, shortSize, toM2, toSqft } from "@/lib/units";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ViewToggle } from "@/components/dashboard/listing-popup";
import { Wordmark } from "@/components/logo";
import { FeedView } from "@/components/feed/feed-view";
import { SettingsView } from "@/components/settings/settings-view";
import { GrainField } from "@/components/landing/grain-field";
import { useProfile } from "@/lib/profile";
import { Dialog } from "@/components/feed/profile-dialog";
import { MapFullscreen, type AgencyOption, type FullPanel } from "@/components/dashboard/map-fullscreen";
import { AddListingDialog } from "@/components/dashboard/add-listing";
import { VISIBILITY_HINT, VISIBILITY_LABEL, agentRowToListing, useAgentListings } from "@/lib/agent-listings";
import { BAND_COLOR, CONFIDENCE_RULES, confidenceBand, scoreConfidence } from "@/lib/confidence";
import { FLAG_REASONS, UNDO_MINUTES, canUndo, useFlags, type FlagReason } from "@/lib/flags";
import { useWatchlist, type WatchEntry } from "@/lib/watchlist";
import { useInterestedClients, type ClientInput, type InterestedClient } from "@/lib/clients";
import { useListingNote, useMarketBrief } from "@/lib/use-signal";
import { authConfigured, displayName, logOut, useUser } from "@/lib/auth";
import { PLANS, fmtPlanPrice } from "@/lib/site";
import { usePlan } from "@/lib/plan";
import { ProView } from "@/components/dashboard/pro-view";
import type { AISource, Verdict } from "@/lib/signal-ai";
import {
  COMMERCIAL_USES,
  arubaToday,
  buildIndexRuns,
  RESIDENTIAL_TYPES,
  LISTING_STATUSES,
  STATUS_TAB,
  isClosed,
  isScored,
  STATUS_HINT,
  TENURES,
  TENURE_HINT,
  ZONINGS,
  type Listing,
  type ListingStatus,
  type Pool,
  type PriceEvent,
  type IndexRun,
  type Signal,
  TENURE_NOT_STATED,
  type Tenure,
} from "@/lib/aruba-data";
import { publishMarket } from "@/lib/live-market";
import {
  PAGE_SIZE,
  fetchAllGroups,
  groupKeyOf,
  useListingPages,
  useListingsByRef,
  useMapPins,
  useMarketFacets,
  useRecentActivity,
  type MarketFilters,
  type SortKey,
} from "@/lib/market-api";
import { GroupDetails, GroupPopup, GroupTags, groupPrice } from "@/components/dashboard/group-parts";
import { HotFlame, AgencyLogo } from "@/components/dashboard/map-shared";
import { Inter } from "next/font/google";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  Bell,
  ChevronDown,
  Flag,
  Info,
  Lock,
  Settings as SettingsIcon,
  ShieldCheck,
  Undo2,
  LayoutList,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Trash2,
  Users,
  Waves,
  CreditCard,
  Download,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  LogOut,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
} from "lucide-react";
import {
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


/* ─────────────────────────────────────────────────────────────────────────
 * Formatters
 * ──────────────────────────────────────────────────────────────────────── */

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const fmtUsd = (n: number) => usd0.format(n);
const fmtUsdCompact = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : usd0.format(n);
const fmtDelta = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}%`;
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
    <span className={`${MONO} inline-flex items-center gap-0.5 whitespace-nowrap font-semibold`} style={{ color: priceColor(pct) }}>
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
    <Link href="/" className="select-none" aria-label="Baseline home">
      <Wordmark tone="white" />
    </Link>
  );
}

const TABS = ["Listings", "Watchlist", "Market feed", "Pro", "Settings"] as const;
type Tab = (typeof TABS)[number];
const TAB_SLUG: Record<Tab, string> = {
  Listings: "listings",
  Watchlist: "watchlist",
  "Market feed": "market-feed",
  Pro: "pro",
  Settings: "settings",
};

const TAB_ICON: Record<Tab, typeof Pin> = { Listings: LayoutList, Watchlist: Pin, "Market feed": Megaphone, Pro: Lock, Settings: SettingsIcon };

/** Pill switch between the dashboard tabs. */
function TabSwitch({ tab, onTab, watchCount, full = false }: { tab: Tab; onTab: (t: Tab) => void; watchCount: number; full?: boolean }) {
  const { isPro } = usePlan();
  return (
    <div className={`${full ? "grid w-full grid-cols-5" : "inline-flex"} gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10`} role="tablist">
      {TABS.map((t) => {
        const on = tab === t;
        const Icon = TAB_ICON[t];
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onTab(t)}
            className={`relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full ${full ? "px-0.5 text-[11.5px]" : "px-4 text-[13px]"} py-1.5 font-medium transition-colors ${
              on ? "text-zinc-950" : "text-zinc-400 hover:text-white"
            }`}
          >
            {on && <motion.span layoutId={full ? "tab-pill-mobile" : "tab-pill"} className="absolute inset-0 rounded-full bg-lime" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative inline-flex items-center gap-2">
              {!full && t !== "Pro" && <Icon size={14} strokeWidth={1.75} fill={t === "Watchlist" && on ? "currentColor" : "none"} />}
              {t === "Pro" && !isPro && <Lock size={full ? 11 : 13} strokeWidth={2} aria-label="Locked" />}
              {t}
              {t === "Watchlist" && watchCount > 0 && (
                <span
                  className={`${MONO} inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    on ? "bg-zinc-950 text-lime" : "bg-white/10 text-zinc-300"
                  }`}
                >
                  {watchCount}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AccountMenu({ compact = false, onProfile }: { compact?: boolean; onProfile: () => void }) {
  const { user } = useUser();
  const { plan, billing } = usePlan();
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
    { icon: User, label: "Profile", onClick: onProfile },
    { icon: CreditCard, label: "Billing & payment", onClick: () => {
      onProfile();
      window.setTimeout(() => document.getElementById("settings-billing")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } },
  ];

  if (!user)
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Link href="/login" className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white ${compact ? "hidden sm:inline-flex" : ""}`}>
          Log in
        </Link>
        <Link
          href="/signup"
          className="shine inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-lime px-3.5 py-1.5 font-display text-[12.5px] font-semibold text-zinc-950 transition-colors hover:bg-white"
        >
          Sign up
        </Link>
      </div>
    );

  const name = displayName(user);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className={`flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] text-[12.5px] text-zinc-200 transition-colors hover:bg-white/[0.12] hover:text-white ${
          compact ? "size-9 justify-center" : "py-1 pl-1 pr-3"
        }`}
      >
        <span className="relative">
          <span
            className={`grid size-7 place-items-center rounded-full bg-lime font-display text-[11px] font-bold text-zinc-950 ${plan === "pro" ? "ring-2 ring-lime/60 ring-offset-1 ring-offset-zinc-950" : ""}`}
          >
            {initials}
          </span>
          {plan === "pro" && compact && <ProBadge size="xs" label="" className="absolute -bottom-1 -right-1.5 !px-[3px]" />}
        </span>
        {!compact && (
          <>
            <span className="max-w-[120px] truncate font-medium">{name}</span>
            {plan === "pro" && <ProBadge size="xs" />}
            <ChevronDown size={13} strokeWidth={1.75} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <motion.div
          role="menu"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-0 z-[1100] mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/10"
        >
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="truncate text-[13px] font-semibold text-zinc-950">{name}</p>
            <p className="truncate text-[12px] text-zinc-500">{user.email}</p>
            {plan === "pro" ? (
              <p className="mt-2 flex items-center gap-2">
                <ProBadge size="sm" />
                <span className="text-[11px] text-zinc-500">Every feature unlocked</span>
              </p>
            ) : (
              <p className="mt-2 inline-flex rounded-full bg-lime px-2 py-0.5 text-[11px] font-semibold text-zinc-950">
                {PLANS[plan].name} · {fmtPlanPrice(plan, billing)}
              </p>
            )}
          </div>
          {items.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onClick?.();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950"
            >
              <Icon size={13} strokeWidth={1.5} />
              {label}
            </button>
          ))}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void logOut();
            }}
            className="flex w-full items-center gap-3 border-t border-zinc-100 px-4 py-2.5 text-left text-[12.5px] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-950"
          >
            <LogOut size={13} strokeWidth={1.5} />
            Sign out
          </button>
        </motion.div>
      )}
    </div>
  );
}

function Header({ tab, onTab, updates, onUpdates, watchCount, onProfile, updatedAt }: { tab: Tab; onTab: (t: Tab) => void; updates: number; onUpdates: () => void; watchCount: number; onProfile: () => void; /** Latest Index run (ISO), null before the first one. */ updatedAt: string | null }) {
  return (
    <header className="deck relative isolate z-40 border-b border-white/[0.08]">
      <GrainField variant="ink" particles={false} className="-z-10" />
      <div className="mx-auto flex max-w-[1400px] flex-col px-4 pt-3 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:pt-0">
        <div className="flex items-center justify-between gap-4 lg:justify-start lg:gap-12">
          <Logo />
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={onUpdates}
              aria-label={`Baseline updates: ${updates} today`}
              className="relative flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-zinc-200 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              <Bell size={15} strokeWidth={1.75} />
              {updates > 0 && (
                <span className={`${MONO} absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-lime px-1 text-[10px] font-semibold text-zinc-950`}>
                  {updates}
                </span>
              )}
            </button>
            <AccountMenu compact onProfile={onProfile} />
          </div>
          <nav className="hidden lg:block" aria-label="Primary">
            <TabSwitch tab={tab} onTab={onTab} watchCount={watchCount} />
          </nav>
        </div>

        <div className="hidden items-center justify-between gap-6 lg:flex">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: C.up }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: C.up }} />
            </span>
            <span className={`${MONO} whitespace-nowrap text-[11px] tracking-wider text-zinc-500`}>
              UPDATED TODAY <span className="text-zinc-200">{updatedAt ? `${fmtRunTime(updatedAt)} AST` : "—"}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onUpdates}
            aria-label={`Baseline updates: ${updates} today`}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-zinc-200 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <Bell size={15} strokeWidth={1.75} />
            {updates > 0 && (
              <span className={`${MONO} absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-lime px-1 text-[10px] font-semibold text-zinc-950`}>
                {updates}
              </span>
            )}
          </button>
          <AccountMenu onProfile={onProfile} />
        </div>

        {/* mobile tabs */}
        <nav className="pb-3 pt-3 lg:hidden" aria-label="Primary mobile">
          <TabSwitch tab={tab} onTab={onTab} watchCount={watchCount} full />
        </nav>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Shared bits
 * ──────────────────────────────────────────────────────────────────────── */

/** Scrolls to the visible copy of a row (desktop table row or mobile card). */
function scrollToRow(key: string, block: ScrollLogicalPosition = "center") {
  const el = [...document.querySelectorAll<HTMLElement>(`[data-row="${key}"]`)].find((e) => e.offsetParent !== null);
  el?.scrollIntoView({ behavior: "smooth", block });
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-100 ${className}`} />;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Signal badge (below market / at market / above market)
 * ──────────────────────────────────────────────────────────────────────── */

const SIGNAL_STYLE: Record<Signal, { label: string; color: string }> = {
  UNDERVALUED: { label: "Below market", color: C.up },
  AT_MARKET: { label: "At Market", color: C.slate300 },
  OVERPRICED: { label: "Above market", color: C.down },
  NO_SIGNAL: { label: "No signal", color: C.slate300 },
};

const NO_SIGNAL_WHY =
  "Not scored: land, commercial, not for sale, size not stated, a fixer-upper, several homes in one, or too few similar homes nearby.";

function SignalBadge({ signal }: { signal: Signal }) {
  const s = SIGNAL_STYLE[signal];
  return (
    <span className={`${MONO} inline-flex items-center gap-2 text-[11px] uppercase tracking-wider`} style={{ color: s.color }} title={signal === "NO_SIGNAL" ? NO_SIGNAL_WHY : undefined}>
      <span className="h-1.5 w-1.5" style={{ background: s.color }} />
      {s.label}
      {signal === "UNDERVALUED" && <HotFlame size={13} className="-ml-0.5" />}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Active Listings — map of every listing on top, the full list below
 * ──────────────────────────────────────────────────────────────────────── */

type Category = "All" | "Property" | "Land" | "Commercial";

/** Sort choices for the phone layout (no column headers there). */
const MOBILE_SORTS: Array<[SortKey, "asc" | "desc", string]> = [
  ["activity", "desc", "Newest & price drops"],
  ["listed", "asc", "Newest"],
  ["asking", "desc", "Price: high to low"],
  ["asking", "asc", "Price: low to high"],
  ["vsDistrict", "asc", "Cheapest vs similar"],
  ["psf", "asc", "Lowest $ / m²"],
  ["beds", "desc", "Most bedrooms"],
  ["built", "desc", "Largest built-up"],
  ["lot", "desc", "Largest lot"],
  ["confidence", "desc", "Most reliable first"],
];

const CATEGORY_FILTERS: Array<{ value: Category; label: string }> = [
  { value: "All", label: "All" },
  { value: "Property", label: "Residential" },
  { value: "Land", label: "Land" },
  { value: "Commercial", label: "Commercial" },
];
const SIGNAL_FILTERS: Array<{ value: Signal | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "UNDERVALUED", label: "Below market" },
  { value: "AT_MARKET", label: "At Market" },
  { value: "OVERPRICED", label: "Above market" },
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
const SIZE_STEPS = [75, 100, 150, 200, 300, 500, 1_000, 2_500, 5_000]; // m²

const typeLine = (l: Listing) =>
  l.category === "Land" ? `Land · ${l.zoning}` : l.category === "Commercial" ? `Commercial · ${l.commercial_use}` : l.property_type;

const fmtDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const fmtPriceStep = (n: number) => (n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}k`);
const DASH = <span className="text-zinc-300">—</span>;
const STATUS_TITLE: Record<ListingStatus, string> = {
  "For sale": "Available Listings",
  "Under contract": "Under Contract",
  Sold: "Sold Properties",
  "De-listed": "De-listed",
};

/** Table cell: m² with sq ft underneath. */
function BothAreas({ sqft }: { sqft: number }) {
  return (
    <>
      {int.format(toM2(sqft))}
      <p className="mt-1 whitespace-nowrap text-[11px] text-zinc-500">{int.format(sqft)} ft²</p>
    </>
  );
}

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
    ["Listed by", (l) => l.agency.name],
    ["Agent", (l) => l.agent?.name],
    ["Agent phone", (l) => l.agent?.phone],
    ["Agent e-mail", (l) => l.agent?.email],
    ["Listing URL", (l) => l.source_url],
    ["Status", (l) => l.status],
    ["Status since", (l) => l.status_changed],
    ["Pool", (l) => l.pool],
    ["Land title", (l) => l.tenure ?? "Not stated"],
    ["Erfpacht years left", (l) => l.lease_years_left],
    ["New today", (l) => (l.is_new ? "Yes" : "")],
    ["Last price change", (l) => l.last_price_change?.date],
    ["Bedrooms", (l) => p(l)?.bedrooms],
    ["Bathrooms", (l) => p(l)?.bathrooms],
    ["Built-up m2", (l) => (l.category === "Land" || !l.built_sqft ? null : toM2(l.built_sqft))],
    ["Built-up sq ft", (l) => (l.category === "Land" ? null : l.built_sqft || null)],
    ["Lot m2", (l) => (l.lot_sqft ? toM2(l.lot_sqft) : null)],
    ["Lot sq ft", (l) => l.lot_sqft || null],
    ["Asking price USD", (l) => l.asking_price_usd],
    ["Price per m2 USD", (l) => pricePerM2(l) || null],
    ["Price per sq ft USD", (l) => l.price_per_sqft_usd || null],
    ["Price change %", (l) => l.price_change_pct],
    ["Similar homes estimate per sq ft USD", (l) => (isScored(l) ? p(l)?.comps_psf_usd : null)],
    ["Price vs similar homes %", (l) => (isScored(l) ? p(l)?.price_vs_comps_pct : null)],
    ["Value", (l) => (isClosed(l) ? null : SIGNAL_STYLE[l.signal].label)],
    ["Days on market", (l) => l.days_on_market],
    ["First seen", (l) => l.first_seen],
    ["Last indexed", (l) => l.last_scraped],
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
  tip,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  tip?: React.ReactNode;
}) {
  const active = sort.key === k;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`whitespace-nowrap border-b border-zinc-300 px-2.5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] first:pl-4 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase transition-colors ${active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"}`}
      >
        {label}
        <span className="text-[9px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
      {tip && <span className="ml-1 inline-flex align-middle">{tip}</span>}
    </th>
  );
}

function PlainHeader({ label, align = "right" }: { label: string; align?: "left" | "right" }) {
  return (
    <th
      className={`whitespace-nowrap border-b border-zinc-300 px-2.5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {label}
    </th>
  );
}

function Thumb({ src, alt, w = 64, h = 44 }: { src: string | null; alt: string; w?: number; h?: number }) {
  return src ? (
    <ListingPhoto
      src={src}
      alt={alt}
      w={w}
      h={h}
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

/* ── Confidence Score + Kill Switch ───────────────────────────────────── */

/** Small (i) button with a tooltip: opens on hover, focus or tap; Escape closes. */
function InfoTip({ label, children, align = "right" }: { label: string; children: React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="grid size-[18px] place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-950"
      >
        <Info size={12} strokeWidth={2} />
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`absolute top-full z-50 mt-2 block w-[min(300px,calc(100vw-48px))] rounded-xl bg-zinc-950 p-3.5 whitespace-normal break-words text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-zinc-300 shadow-2xl shadow-zinc-950/30 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}

function ConfidenceTip() {
  return (
    <>
      <span className="block font-semibold text-white">What is the Confidence Score?</span>
      <span className="mt-1 block">
        How likely it is that this listing is really still for sale. Agency sites often leave sold or withdrawn homes online (&quot;ghost listings&quot;), so Baseline scores every listing from 0 to 100% instead of trusting the site.
      </span>
      <span className="mt-2 block text-white">It goes down when:</span>
      <span className="block">· the listing disappears from the agency&apos;s site (−{CONFIDENCE_RULES.missingPerWeek} per week)</span>
      <span className="block">· it sits on the market for 6+ months</span>
      <span className="block">· the price never moves for 4+ months</span>
      <span className="mt-2 block">
        Rescored every night. If a member flags it as delisted it drops to 0% and is removed for everyone.
      </span>
      <span className="mt-2 flex gap-3 text-[11px]">
        <span style={{ color: "#6FCF97" }}>80+ High</span>
        <span style={{ color: "#F2B45A" }}>50–79 Medium</span>
        <span style={{ color: "#F28B82" }}>Under 50 Low</span>
      </span>
    </>
  );
}

function confidenceReasons(l: Listing) {
  const lastMove = l.price_history[l.price_history.length - 1]?.date ?? l.first_seen;
  return scoreConfidence({
    lastFoundAt: l.last_found_at,
    daysOnMarket: l.days_on_market,
    lastPriceChangeAt: `${lastMove}T00:00:00Z`,
    asOf: l.last_scraped,
  }).reasons;
}

/** Score pill: a 0-100 meter, coloured by band. */
function ConfidenceBadge({ l, align = "end" }: { l: Listing; align?: "start" | "end" }) {
  if (l.member)
    return (
      <span className={`inline-flex flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`} title="Added by the listing agent, not indexed">
        <span className="whitespace-nowrap text-[12px] font-semibold text-zinc-950">Agent</span>
        <span className="text-[10px] uppercase tracking-wide text-zinc-400">direct</span>
      </span>
    );
  const s = l.confidence_score;
  const band = confidenceBand(s);
  const color = BAND_COLOR[band];
  const why = confidenceReasons(l);
  return (
    <span
      className={`inline-flex flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`}
      title={`Confidence ${s}/100 (${band}). ${why.length ? why.map((r) => `${r.label} (${r.points})`).join("; ") : "Found on its source site in the latest Index run, price active."}`}
    >
      <span className={`${MONO} inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold`} style={{ color }}>
        <span className="relative h-1.5 w-8 overflow-hidden rounded-full bg-zinc-100">
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s}%`, background: color }} />
        </span>
        {s}%
      </span>
      <span className="text-[10px] uppercase tracking-wide text-zinc-400">{band}</span>
    </span>
  );
}

/** Detail panel for a listing an agent added: who sees it, the duplicate watch, notes. */
function MemberListingPanel({ l }: { l: Listing }) {
  const actions = useContext(MemberListingActions);
  const m = l.member!;
  const priv = m.visibility === "private";
  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            {priv ? <Lock size={12} /> : <Users size={12} />} {VISIBILITY_LABEL[m.visibility]} listing
          </p>
          <p className="mt-1.5 text-[13px] text-zinc-700">{VISIBILITY_HINT[m.visibility]}</p>
          {m.went_public && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Now also on a public site: the Index found it as{" "}
              <button type="button" onClick={() => actions?.openListing(m.went_public!.listing_id)} className="font-semibold underline underline-offset-2">
                {m.went_public.listing_id}
              </button>{" "}
              on {fmtDate(m.went_public.at.slice(0, 10))}.
            </p>
          )}
          {m.match && m.dup_acknowledged && (
            <p className="mt-2 text-[12px] text-zinc-500">
              Similar to {m.match.name} ({m.match.ref}, {m.match.score}% match). The agent confirmed it is a different property.
            </p>
          )}
          {m.address && <p className="mt-2 text-[12px] text-zinc-600">Address: {m.address}{m.pinned ? "" : " · map position is approximate"}</p>}
          {!m.address && !m.pinned && <p className="mt-2 text-[12px] text-zinc-500">Map position is approximate (district only).</p>}
          {m.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-zinc-50 px-3 py-2 text-[12.5px] leading-relaxed text-zinc-700">{m.notes}</p>}
        </div>
        {m.mine && actions && (
          <button
            type="button"
            onClick={() => actions.edit(m.id)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-zinc-950 hover:text-zinc-950"
          >
            <Pencil size={13} strokeWidth={2} /> Edit
          </button>
        )}
      </div>
    </div>
  );
}

/** Detail panel: the score, why it is not 100, and the Kill Switch. */
function ConfidencePanel({ l }: { l: Listing }) {
  const why = confidenceReasons(l);
  const band = confidenceBand(l.confidence_score);
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            <ShieldCheck size={12} /> Confidence score
            <InfoTip label="What is the Confidence Score?" align="left">
              <ConfidenceTip />
            </InfoTip>
          </p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className={`${MONO} font-display text-[22px] font-bold`} style={{ color: BAND_COLOR[band] }}>
              {l.confidence_score}%
            </span>
            <span className="text-[12px] text-zinc-500">{band} chance this is still for sale</span>
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-zinc-600">
            {why.length ? (
              why.map((r) => (
                <li key={r.label} className="flex gap-2">
                  <span className={`${MONO} w-9 shrink-0 text-right font-semibold text-[#B42318]`}>{r.points}</span>
                  {r.label}
                </li>
              ))
            ) : (
              <li>Found on {l.agency.name}&apos;s site in the latest Index run, last seen {fmtTimestamp(l.last_found_at)}.</li>
            )}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-400">
            Rescored every night: −{CONFIDENCE_RULES.missingPerWeek} for each week it is missing from the source site, less for long time on market and a price that never moves.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-[#B42318] hover:text-[#B42318]"
        >
          <Flag size={13} strokeWidth={2} /> Flag delisted
        </button>
      </div>
      <FlagDialog l={l} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function FlagDialog({ l, open, onClose }: { l: Listing; open: boolean; onClose: () => void }) {
  const { flag, live } = useFlags();
  const { user } = useUser();
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsAccount = live && !user;
  return (
    <Dialog open={open} onClose={onClose} title="Flag as delisted">
      <form
        className="space-y-4 px-5 py-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!reason) return setError("Pick what happened to this listing.");
          setBusy(true);
          setError(null);
          try {
            await flag(l.listing_id, reason, note);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not flag this listing.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="rounded-xl bg-zinc-50 p-3">
          <p className="text-[13.5px] font-semibold text-zinc-950">{l.asset_name}</p>
          <p className="text-[12px] text-zinc-500">
            {l.listing_id} · {l.district} · {fmtUsdCompact(l.asking_price_usd)} · {l.agency.name}
          </p>
        </div>
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-zinc-700">What happened?</legend>
          <div className="grid gap-2">
            {(Object.keys(FLAG_REASONS) as FlagReason[]).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] transition-colors ${
                  reason === k ? "border-zinc-950 bg-zinc-950 text-lime" : "border-zinc-300 text-zinc-800 hover:border-zinc-500"
                }`}
              >
                <input type="radio" name="flag-reason" className="sr-only" checked={reason === k} onChange={() => setReason(k)} />
                <span className={`grid size-4 place-items-center rounded-full border ${reason === k ? "border-mint" : "border-zinc-400"}`}>
                  {reason === k && <span className="size-2 rounded-full bg-lime" />}
                </span>
                {FLAG_REASONS[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-zinc-700">How do you know? (optional)</span>
          <textarea
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[72px] w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-[13px] outline-none placeholder:text-zinc-400 focus:border-zinc-950"
            placeholder="e.g. Closed in cash last week, I represented the buyer."
          />
        </label>
        <p className="rounded-lg border border-[#F3C9C9] bg-[#FDF2F2] px-3 py-2.5 text-[12px] leading-relaxed text-[#9B2C2C]">
          This removes the listing from Baseline for every member right away and sets its confidence to 0. Your account is recorded with the flag, and you can undo it for {UNDO_MINUTES} minutes.
        </p>
        {!live && <p className="text-[11.5px] text-zinc-500">Preview: flags are saved on this device until live listing data is connected.</p>}
        {error && <p className="rounded-lg bg-[#FBE9E9] px-3 py-2 text-[12.5px] text-[#B23A3A]">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[13px] font-semibold text-zinc-600 hover:text-zinc-950">
            Cancel
          </button>
          {needsAccount ? (
            <Link href="/login" className="rounded-full bg-zinc-950 px-5 py-2 text-[13px] font-semibold text-lime">
              Log in to flag
            </Link>
          ) : (
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#B42318] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#8F1C13] disabled:opacity-60">
              <Flag size={13} /> {busy ? "Removing…" : "Remove from Baseline"}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

/** After a flag: "Removed for everyone" with Undo while the undo window is open. */
function FlagToast({ listings }: { listings?: Listing[] }) {
  const { flags, undo } = useFlags();
  const [toast, setToast] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  // Show a toast for 12 s whenever a listing is newly flagged in this visit.
  useEffect(() => {
    const keys = Object.keys(flags);
    if (!seen.current) {
      seen.current = new Set(keys);
      return;
    }
    const added = keys.find((k) => !seen.current!.has(k));
    seen.current = new Set(keys);
    if (!added) return;
    const show = window.setTimeout(() => setToast(added), 0);
    const hide = window.setTimeout(() => setToast((t) => (t === added ? null : t)), 12_000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [flags]);
  const f = toast ? flags[toast] : undefined;
  if (!toast || !f) return null;
  const id = toast;
  const name = listings?.find((l) => l.listing_id === id)?.asset_name ?? id;
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-[1100] mx-auto flex max-w-md items-center gap-3 rounded-xl bg-zinc-950 px-4 py-3 text-[13px] text-white shadow-2xl">
      <Flag size={14} className="shrink-0 text-lime" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{name}</b> removed for every member · {FLAG_REASONS[f.reason]}
      </span>
      {canUndo(f) && (
        <button
          type="button"
          onClick={() => {
            setToast(null);
            void undo(id).catch((e) => window.alert(e instanceof Error ? e.message : "Could not undo."));
          }}
          className="inline-flex shrink-0 items-center gap-1 font-semibold text-lime hover:underline"
        >
          <Undo2 size={13} /> Undo
        </button>
      )}
    </div>
  );
}

/** Who is listing it: agency logo + name, linking to the listing on the agency's own site. */
function ListedBy({ l }: { l: Listing }) {
  const actions = useContext(MemberListingActions);
  const href = l.source_url ?? l.agency.website;
  const body = (
    <>
      <AgencyLogo agency={l.agency} size={36} rounded={8} />
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">{l.member ? "Added by member" : "Listed by"}</span>
        <span className="block truncate font-display text-[14px] font-bold text-zinc-950">{l.agency.name}</span>
      </span>
    </>
  );
  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">{body}</div>
      {l.member ? (
        l.member.mine && actions ? (
          <button
            type="button"
            onClick={(e) => (e.stopPropagation(), actions.edit(l.member!.id))}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-950 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-zinc-950 hover:text-lime"
          >
            <Pencil size={12} strokeWidth={1.75} /> Edit listing
          </button>
        ) : (
          <span className="text-[11.5px] text-zinc-500">{l.member.visibility === "private" ? "Only you see this" : "Off-market · contact the agent"}</span>
        )
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-950 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-zinc-950 hover:text-lime"
        >
          View on their site <ExternalLink size={12} strokeWidth={1.75} />
        </a>
      ) : (
        <span
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-[12px] text-zinc-400"
          title="The link to the original listing is stored once the Index runs on this site"
        >
          View on their site <ExternalLink size={12} strokeWidth={1.75} />
        </span>
      )}
    </div>
    <ListingAgentRow l={l} />
    </div>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

/** The agent handling the listing, with call / WhatsApp / e-mail buttons. */
function ListingAgentRow({ l }: { l: Listing }) {
  const a = l.agent;
  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-[12px] text-zinc-800 transition-colors hover:border-zinc-950 hover:bg-zinc-950 hover:text-lime";
  if (!a)
    return (
      <div className="border-t border-zinc-100 px-3 py-2.5 text-[12px] text-zinc-500">
        No agent named on this listing. Contact the agency directly.
      </div>
    );
  const digits = a.phone?.replace(/[^\d]/g, "") ?? "";
  const subject = encodeURIComponent(`${l.asset_name} (${l.listing_id})`);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        {a.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.photo_url} alt={a.name} className="size-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
            style={{ background: l.agency.color }}
            aria-hidden
          >
            {initialsOf(a.name)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">Listing agent</span>
          <span className="block truncate text-[14px] font-semibold text-zinc-950">{a.name}</span>
          <span className="block truncate text-[11px] text-zinc-500">
            {a.title}
            {a.phone && <> · <span className="tabular-nums">{a.phone}</span></>}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        {a.phone && (
          <a href={`tel:+${digits}`} className={btn}>
            <Phone size={12} strokeWidth={1.75} /> Call
          </a>
        )}
        {a.phone && a.whatsapp && (
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className={btn}>
            <MessageCircle size={12} strokeWidth={1.75} /> WhatsApp
          </a>
        )}
        {a.email && (
          <a href={`mailto:${a.email}?subject=${subject}`} className={btn}>
            <Mail size={12} strokeWidth={1.75} /> E-mail
          </a>
        )}
      </div>
    </div>
  );
}

const TENURE_COLOR: Record<Tenure, string> = { Eigendom: "#0A0A0A", Erfpacht: "#8A6A2E" };

function TenureTag({ l }: { l: Listing }) {
  if (!l.tenure)
    return (
      <span title="The agency does not say whether the land is owned (eigendom) or leased (erfpacht). Ask the agent." className="inline-flex items-center whitespace-nowrap rounded border border-dashed border-zinc-300 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
        {TENURE_NOT_STATED}
      </span>
    );
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

const STATUS_STYLE: Record<ListingStatus, { color: string; bg: string }> = {
  "For sale": { color: "#1F7A45", bg: "#E6F4EC" },
  "Under contract": { color: "#9A5B00", bg: "#FDF1DC" },
  Sold: { color: "#B42318", bg: "#FDE8E7" },
  "De-listed": { color: "#52525B", bg: "#EEEEF0" },
};

function StatusBadge({ l, withDate = false, align = "start" }: { l: Listing; withDate?: boolean; align?: "start" | "end" }) {
  const st = STATUS_STYLE[l.status];
  return (
    <span className={`inline-flex flex-col gap-0.5 ${align === "end" ? "items-end" : "items-start"}`}>
      <span title={STATUS_HINT[l.status]} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: st.color, background: st.bg }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
        {l.status}
      </span>
      {withDate && <span className="text-[10px] text-zinc-400">{l.status_changed ? `since ${fmtDate(l.status_changed)}` : l.status === "For sale" ? `since ${fmtDate(l.first_seen)}` : `already so on ${fmtDate(l.first_seen)}`}</span>}
      {withDate && <span className="max-w-[220px] text-[10.5px] leading-snug text-zinc-500">{STATUS_HINT[l.status]}</span>}
    </span>
  );
}

function PoolTag({ pool }: { pool: Pool | null }) {
  if (!pool || pool === "No pool") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700">
      <Waves size={10} strokeWidth={2} />
      {pool}
    </span>
  );
}

/** "NEW" for listings found in the latest Index run, "PRICE ↓/↑" for prices that moved in it. */
/** Add / edit listings by hand (provided by the Dashboard). */
const MemberListingActions = createContext<{ add: () => void; edit: (id: string) => void; openListing: (ref: string) => void } | null>(null);

function MemberTag({ l }: { l: Listing }) {
  if (!l.member) return null;
  const priv = l.member.visibility === "private";
  return (
    <>
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${priv ? "bg-zinc-200 text-zinc-700" : "bg-lime text-zinc-950"}`}
        title={VISIBILITY_HINT[l.member.visibility]}
      >
        {priv && <Lock size={8} strokeWidth={2.5} />}
        {priv ? "ONLY ME" : "OFF-MARKET"}
      </span>
      {l.member.went_public && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-900" title={`Now also on a public site as ${l.member.went_public.listing_id}`}>
          NOW PUBLIC
        </span>
      )}
    </>
  );
}

function IndexTags({ l }: { l: Listing }) {
  const moved = l.last_price_change && l.last_price_change.date === arubaToday() ? l.last_price_change : null;
  return (
    <>
      <MemberTag l={l} />
      {l.is_new && <span className="rounded bg-zinc-950 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-lime">NEW</span>}
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
  const days = Math.round((Date.parse(`${arubaToday()}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

const DAY_MS = 86_400_000;
const dayTs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * What the listing should be worth today:
 * the estimate from similar homes. 0 = not scored, so no estimate.
 */
function estMarketValue(l: Listing) {
  return isScored(l) && l.category === "Property" ? l.comps_psf_usd * l.built_sqft : 0;
}

/** The recorded asking price (step line) and today's estimate, which has no history: one dot on the last day. */
function priceSeries(l: Listing) {
  const today = dayTs(arubaToday());
  const start = Math.min(dayTs(l.price_history[0].date), today - 30 * DAY_MS);
  const fair = estMarketValue(l);
  const stamps = new Set<number>([start, today, ...l.price_history.map((e) => dayTs(e.date))]);
  return [...stamps]
    .sort((a, b) => a - b)
    .map((t) => ({
      t,
      asking: [...l.price_history].reverse().find((e) => dayTs(e.date) <= t)?.price_usd ?? null,
      estimate: t === today && fair > 0 ? Math.round(fair) : null,
    }));
}

function ValueChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number | null }>; label?: number }) {
  if (!active || !payload?.length || label === undefined) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const asking = get("asking");
  const estimate = get("estimate");
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] shadow-md">
      <p className="text-zinc-500">{fmtDate(new Date(label).toISOString().slice(0, 10))}</p>
      {asking != null && (
        <p className={`${MONO} mt-1 text-zinc-950`}>
          Asking <b>{fmtUsdCompact(asking)}</b>
        </p>
      )}
      {estimate != null && (
        <p className={`${MONO} mt-0.5`} style={{ color: ESTIMATE_COLOR }}>
          Estimate today <b>{fmtUsdCompact(estimate)}</b>
        </p>
      )}
    </div>
  );
}

const ESTIMATE_COLOR = "#2E9E5B";

function PriceHistory({ l }: { l: Listing }) {
  const history = l.price_history;
  const series = priceSeries(l);
  const fair = estMarketValue(l);
  const hasFair = fair > 0; // no estimate without a size and comparables
  const gap = hasFair ? ((l.asking_price_usd - fair) / fair) * 100 : 0;
  const changed = history.length > 1;
  return (
    <div className="mt-8 border-t border-zinc-300/70 pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Price history</p>
        <p className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-zinc-950" /> Asking price
          </span>
          {hasFair && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: ESTIMATE_COLOR }} /> Est. market value today
            </span>
          )}
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
                  padding={{ right: 8 }}
                  tickFormatter={(t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
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
                <Line dataKey="estimate" stroke="none" dot={{ r: 4, fill: ESTIMATE_COLOR, stroke: "#fff", strokeWidth: 1.5 }} activeDot={{ r: 5, fill: ESTIMATE_COLOR }} isAnimationActive={false} />
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
            Asking <b className={`${MONO} text-zinc-950`}>{fmtUsdCompact(l.asking_price_usd)}</b>
            {hasFair ? (
              <>
                {" "}vs est. market value today{" "}
                <b className={MONO} style={{ color: ESTIMATE_COLOR }}>
                  {fmtUsdCompact(fair)}
                </b>
                {" · "}
                <span className="font-semibold" style={{ color: SIGNAL_STYLE[l.signal].color }}>
                  {l.signal === "AT_MARKET"
                    ? `within the normal range (${gap < 0 ? "−" : "+"}${Math.abs(gap).toFixed(0)}%)`
                    : `${Math.abs(gap).toFixed(0)}% ${gap < 0 ? "below" : "above"} market`}
                </span>
              </>
            ) : (
              <span className="text-zinc-500">
                {" "}· no market value estimate for this listing
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500">
            {changed ? `${history.length - 1} price change${history.length > 2 ? "s" : ""} since we first indexed it` : "No price changes since we first indexed it"}
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

/* ── Interested clients (per listing, agent CRM) ─────────────────────── */

const fieldCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-mint";

function ClientForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ClientInput;
  submitLabel: string;
  onSubmit: (c: ClientInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);
  const missing = !name.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (missing) return nameRef.current?.focus();
        onSubmit({ name, phone, comment });
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
    >
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-zinc-600">
          Name <span className="text-zinc-400">(required)</span>
        </span>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Maria Croes"
          autoComplete="off"
          aria-invalid={touched && missing}
          className={`${fieldCls} ${touched && missing ? "border-[#D64545]" : ""}`}
        />
        {touched && missing && <span className="mt-1 block text-[11px] text-[#D64545]">Add a name to save this client.</span>}
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-zinc-600">Phone</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder="+297 …"
          autoComplete="off"
          className={`${fieldCls} tabular-nums`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-zinc-600">Comments</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Budget, timing, what they asked about…"
          className={`${fieldCls} resize-y leading-relaxed`}
        />
      </label>
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[12px] font-medium text-zinc-600 transition-colors hover:bg-zinc-200/60 hover:text-zinc-950">
          Cancel
        </button>
        <button type="submit" className="rounded-lg bg-zinc-950 px-4 py-2 text-[12px] font-semibold text-lime transition-all hover:bg-zinc-800 active:scale-95">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function InterestedClients({ l }: { l: Listing }) {
  const { forListing, add, update, remove, restore } = useInterestedClients();
  const clients = forListing(l.listing_id);
  const [mode, setMode] = useState<{ kind: "idle" } | { kind: "add" } | { kind: "edit"; id: string }>({ kind: "idle" });
  const [removed, setRemoved] = useState<InterestedClient | null>(null);

  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(t);
  }, [removed]);

  const btn =
    "inline-flex size-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white" aria-label={`Interested clients for ${l.asset_name}`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-lime text-zinc-950">
            <Users size={14} strokeWidth={1.75} />
          </span>
          <span>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">Interested clients</span>
            <span className="block text-[13px] font-semibold text-zinc-950">
              {clients.length === 0 ? "None yet" : `${clients.length} ${clients.length === 1 ? "person" : "people"}`}
            </span>
          </span>
        </div>
        {mode.kind !== "add" && (
          <button
            type="button"
            onClick={() => setMode({ kind: "add" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3 py-1.5 text-[12px] font-semibold text-lime transition-all hover:bg-zinc-800 active:scale-95"
          >
            <Plus size={13} strokeWidth={2} /> Add
          </button>
        )}
      </div>

      <div className="space-y-2 border-t border-zinc-100 p-3">
        {mode.kind === "add" && (
          <ClientForm
            submitLabel="Save client"
            onCancel={() => setMode({ kind: "idle" })}
            onSubmit={(c) => {
              add(l.listing_id, c);
              setMode({ kind: "idle" });
            }}
          />
        )}

        {clients.length === 0 && mode.kind !== "add" && (
          <p className="px-1 py-1 text-[12px] leading-relaxed text-zinc-500">
            Keep track of who asked about this property: their name, number and what they are looking for.
          </p>
        )}

        {clients.length > 0 && (
          <ul className="space-y-2">
            {clients.map((c) =>
              mode.kind === "edit" && mode.id === c.id ? (
                <li key={c.id}>
                  <ClientForm
                    initial={c}
                    submitLabel="Save changes"
                    onCancel={() => setMode({ kind: "idle" })}
                    onSubmit={(input) => {
                      update(c.id, input);
                      setMode({ kind: "idle" });
                    }}
                  />
                </li>
              ) : (
                <li key={c.id} className="group rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 transition-colors hover:border-zinc-200">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-semibold text-lime" aria-hidden>
                      {initialsOf(c.name) || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-zinc-950">{c.name}</p>
                      {c.phone ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]">
                          <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="tabular-nums text-zinc-700 underline-offset-2 hover:text-zinc-950 hover:underline">
                            {c.phone}
                          </a>
                          {c.phone.replace(/\D/g, "").length >= 7 && (
                            <a
                              href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2E9E5B] hover:underline"
                            >
                              <MessageCircle size={11} strokeWidth={2} /> WhatsApp
                            </a>
                          )}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[12px] text-zinc-400">No phone</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100">
                      <button type="button" onClick={() => setMode({ kind: "edit", id: c.id })} className={btn} aria-label={`Edit ${c.name}`} title="Edit">
                        <Pencil size={13} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          remove(c.id);
                          setRemoved(c);
                        }}
                        className={`${btn} hover:text-[#D64545]`}
                        aria-label={`Remove ${c.name}`}
                        title="Remove"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  {c.comment && <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-zinc-700">{c.comment}</p>}
                  <p className="mt-2 text-[10px] text-zinc-400">
                    Added {fmtDate(c.added_at.slice(0, 10))}
                    {c.updated_at && <> · edited {fmtDate(c.updated_at.slice(0, 10))}</>}
                  </p>
                </li>
              ),
            )}
          </ul>
        )}

        {removed && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950 px-3 py-2 text-[12px] text-white">
            <span className="truncate">Removed {removed.name}</span>
            <button
              type="button"
              onClick={() => {
                restore(removed);
                setRemoved(null);
              }}
              className="shrink-0 font-semibold text-lime hover:underline"
            >
              Undo
            </button>
          </div>
        )}
      </div>
      <p className="border-t border-zinc-100 px-3 py-2 text-[10px] text-zinc-400">Private to you · saved on this device</p>
    </section>
  );
}

/** Small "2 interested" chip for rows and cards. */
function ClientCount({ id }: { id: string }) {
  const n = useInterestedClients().countFor(id);
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-lime px-1.5 py-px text-[10px] font-semibold text-zinc-950" title={`${n} interested ${n === 1 ? "client" : "clients"}`}>
      <Users size={10} strokeWidth={2} />
      {n} interested
    </span>
  );
}

/** Pin / unpin a listing on the watchlist. "icon" is the compact row/card version. */
function WatchButton({ l, variant = "full" }: { l: Listing; variant?: "full" | "icon" }) {
  const { isPinned, toggle } = useWatchlist();
  const pinned = isPinned(l.listing_id);
  const label = pinned ? `Remove ${l.asset_name} from watchlist` : `Add ${l.asset_name} to watchlist`;
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle(l.listing_id, l.asking_price_usd);
  };
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={pinned}
        aria-label={label}
        title={pinned ? "On your watchlist" : "Add to watchlist"}
        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${
          pinned ? "bg-zinc-950 text-lime" : "text-zinc-400 hover:bg-white hover:text-zinc-950"
        }`}
      >
        <Pin size={14} strokeWidth={1.75} fill={pinned ? "currentColor" : "none"} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pinned}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-all active:scale-95 ${
        pinned ? "bg-zinc-950 text-lime hover:bg-zinc-800" : "border border-zinc-950/20 bg-white text-zinc-900 hover:border-zinc-950"
      }`}
    >
      <Pin size={13} strokeWidth={1.75} fill={pinned ? "currentColor" : "none"} />
      {pinned ? "On your watchlist" : "Add to watchlist"}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * AI Signal — per-listing analyst note and the daily market brief
 * ──────────────────────────────────────────────────────────────────────── */

const VERDICT_STYLE: Record<Verdict, { color: string; bg: string }> = {
  Opportunity: { color: "#1F7A45", bg: "#E3F3E8" },
  "Fair value": { color: "#3F3F46", bg: "#F1F1F2" },
  "Above market": { color: "#B23A3A", bg: "#FBE9E9" },
  Watch: { color: "#B5650B", bg: "#FDF0DF" },
};

function AIMark({ size = 13, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-white" : "text-zinc-950"}`}>
      <span className={`relative grid size-5 place-items-center rounded-md ${dark ? "bg-lime text-zinc-950" : "bg-zinc-950 text-lime"}`}>
        <span className={`absolute inset-0 animate-[ai-breathe_2.8s_ease-in-out_infinite] rounded-md motion-reduce:animate-none ${dark ? "bg-lime" : "bg-zinc-950"}`} />
        <Sparkles size={size - 2} strokeWidth={2} className="relative" />
      </span>
      AI Signal
    </span>
  );
}

function AISourceLine({ source, className = "" }: { source: AISource; className?: string }) {
  return (
    <p className={`text-[10.5px] leading-snug text-zinc-400 ${className}`}>
      {source === "claude" ? "Written by AI from today's Index data. Check key facts before you advise a client." : "Computed from today's Index data."}
    </p>
  );
}

function AIShimmer({ lines = 3, dark = false }: { lines?: number; dark?: boolean }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 animate-pulse rounded ${dark ? "bg-white/10" : "bg-zinc-950/[0.07]"}`} style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

function AINote({ l }: { l: Listing }) {
  const { data, loading, error } = useListingNote(l.listing_id, `${l.asking_price_usd}:${l.status}:${l.last_scraped}`);
  return (
    <section aria-label="AI analysis" className="ai-ring mb-6 rounded-xl p-4 text-white [--ai-bg:#0b0b0d] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AIMark dark />
        {data && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ color: VERDICT_STYLE[data.verdict].color, background: VERDICT_STYLE[data.verdict].bg }}
          >
            {data.verdict}
          </span>
        )}
      </div>
      {loading && (
        <div className="mt-4">
          <p className="mb-3 text-[12px] text-zinc-400">Reading comps and price history…</p>
          <AIShimmer dark />
        </div>
      )}
      {error && <p className="mt-3 text-[12px] text-zinc-400">The analysis could not load right now. Close and reopen the listing to try again.</p>}
      {data && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          <p className="mt-3 font-display text-[15px] font-semibold leading-snug tracking-tight text-white sm:text-[16px]">{data.headline}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">{data.analysis}</p>
          {data.points.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {data.points.map((p, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-zinc-400">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-lime" />
                  {p}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-lime px-3 py-2.5 text-[12.5px] leading-snug text-zinc-950">
            <ArrowRight size={14} strokeWidth={2} className="mt-px shrink-0" />
            <span>
              <b className="font-semibold">Next step:</b> {data.next_step}
            </span>
          </p>
          <AISourceLine source={data.source} className="mt-3 !text-zinc-500" />
        </motion.div>
      )}
    </section>
  );
}

function ListingDetails({ l }: { l: Listing }) {
  const shared = (
    <>
      <DetailItem label="Status" value={<StatusBadge l={l} withDate />} />
      <DetailItem label={isClosed(l) ? "Last asking price" : "Asking price"} value={fmtUsd(l.asking_price_usd)} />
      <DetailItem
        label="Price change"
        value={<PriceMove pct={l.price_change_pct} />}
      />
      <DetailItem
        label="Land title"
        value={
          !l.tenure
            ? "Not stated by the agency"
            : l.tenure === "Eigendom"
              ? "Eigendom (freehold)"
              : l.lease_years_left
                ? `Erfpacht · ${l.lease_years_left} yrs left`
                : "Erfpacht (lease years not stated)"
        }
        color={l.tenure ? TENURE_COLOR[l.tenure] : undefined}
      />
      {l.member ? (
        <>
          <DetailItem label="Added" value={fmtDate(l.first_seen)} />
          <DetailItem label="Last updated" value={fmtTimestamp(l.last_scraped)} />
        </>
      ) : (
        <>
          <DetailItem label="First seen" value={fmtDate(l.first_seen)} />
          <DetailItem label="Last indexed" value={fmtTimestamp(l.last_scraped)} />
          <DetailItem label="Last found on source" value={fmtTimestamp(l.last_found_at)} />
        </>
      )}
    </>
  );

  let facts: React.ReactNode;
  if (l.category === "Land") {
    facts = (
      <>
        <DetailItem label="Type" value="Land parcel" />
        <DetailItem label="Zoning" value={l.zoning} />
        <DetailItem label="Lot size (land)" value={fmtArea(l.lot_sqft)} />
        <DetailItem label="Built-up size" value="None (vacant land)" />
        <DetailItem label="Price / m²" value={fmtPerArea(l.price_per_sqft_usd)} />
      </>
    );
  } else if (l.category === "Commercial") {
    facts = (
      <>
        <DetailItem label="Use" value={l.commercial_use} />
        <DetailItem label="Built-up size (total)" value={fmtArea(l.built_sqft)} />
        <DetailItem label="Lot size (land)" value={l.lot_sqft ? fmtArea(l.lot_sqft) : "No land (unit in building)"} />
        <DetailItem label="Pool" value={l.pool ?? "—"} />
        <DetailItem label="Price / m²" value={fmtPerArea(l.price_per_sqft_usd)} />
      </>
    );
  } else {
    facts = (
      <>
        <DetailItem label="Property type" value={l.property_type} />
        <DetailItem label="Bedrooms" value={l.bedrooms} />
        <DetailItem label="Bathrooms" value={l.bathrooms} />
        <DetailItem label="Built-up size (total)" value={fmtArea(l.built_sqft)} />
        <DetailItem label="Lot size (land)" value={l.lot_sqft ? fmtArea(l.lot_sqft) : "No land (unit in building)"} />
        <DetailItem
          label="Pool"
          value={
            <span className="inline-flex items-center gap-1.5">
              {l.pool && l.pool !== "No pool" && <Waves size={13} strokeWidth={1.75} className="text-sky-600" />}
              {l.pool}
            </span>
          }
        />
        <DetailItem label="Price / m²" value={fmtPerArea(l.price_per_sqft_usd)} />
        <DetailItem label="Similar homes / m² (estimate)" value={isScored(l) ? fmtPerArea(l.comps_psf_usd) : "—"} />
        <DetailItem
          label="Vs. similar homes"
          value={isScored(l) ? `${fmtDelta(l.price_vs_comps_pct)} ${l.price_vs_comps_pct < 0 ? "cheaper" : "pricier"}` : "No signal"}
          color={isScored(l) && l.signal !== "AT_MARKET" ? deltaColor(-l.price_vs_comps_pct) : undefined}
        />
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm shadow-zinc-900/5">
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3 border-b border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 lg:border-b-0 lg:border-r">
          {l.photo_url && (
            <ListingPhoto
              src={l.photo_url}
              alt={l.asset_name}
              w={360}
              h={230}
              className="aspect-[16/10] h-auto w-full rounded-xl bg-zinc-100 object-cover"
            />
          )}
          <ListedBy l={l} />
          <InterestedClients l={l} />
        </aside>
        <div className="min-w-0 p-4 sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-5">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Property details</p>
              <p className="mt-1 font-display text-[18px] font-bold leading-tight tracking-tight text-zinc-950 sm:text-[20px]">{l.asset_name}</p>
              <p className="mt-1 text-[12px] text-zinc-500">
                {l.district} · {l.listing_id}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-zinc-500">
                <StatusBadge l={l} />
                <span>
                  {l.status_changed
                    ? `${l.status === "For sale" ? "Back on sale" : "Marked"} ${fmtDate(l.status_changed)}`
                    : l.status === "For sale"
                      ? `For sale since ${fmtDate(l.first_seen)}`
                      : `Already marked when first indexed on ${fmtDate(l.first_seen)}`}
                </span>
              </p>
            </div>
            <WatchButton l={l} />
          </div>
          <AINote l={l} />
          {l.member ? <MemberListingPanel l={l} /> : !isClosed(l) && <ConfidencePanel l={l} />}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
            {facts}
            {shared}
          </dl>
          <PriceHistory l={l}  />
        </div>
      </div>
    </div>
  );
}

/** Shown before the first Index run and before anyone has added a listing. */
function EmptyMarket({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="mx-auto max-w-[46ch]">
      <p className="font-display text-[17px] font-bold text-zinc-950">No listings yet</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
        Listings appear here as soon as the daily Index of Aruba&rsquo;s agency sites starts. Have an off-market property? Add it now and every
        member sees it.
      </p>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-[12.5px] font-semibold text-lime transition-opacity hover:opacity-90"
        >
          <Plus size={13} strokeWidth={2} /> Add listing
        </button>
      )}
    </div>
  );
}

/** Is the whole island on screen? Then the list is not limited to the map area. */
const ISLAND: [number, number, number, number] = [-70.07, 12.41, -69.865, 12.63];
const coversIsland = ([w, s, e, n]: [number, number, number, number]) => w <= ISLAND[0] && s <= ISLAND[1] && e >= ISLAND[2] && n >= ISLAND[3];

function ActiveListings({
  members,
  initialDistrict,
  initialQuery,
  initialOpenId,
  initialNewToday,
  onExitTo,
  watched,
}: {
  /** Members' own listings (Off-market and Only me), already loaded by the dashboard. */
  members: Listing[];
  initialDistrict?: string;
  initialQuery?: string;
  /** A listing ref to open (links from the Watchlist, updates board and Market feed). */
  initialOpenId?: string;
  initialNewToday?: boolean;
  /** Leaving full-screen mode from the Watchlist or Market feed panel opens that tab. */
  onExitTo?: (tab: FullPanel) => void;
  /** Pinned listings, for the Watchlist panel in full-screen mode. */
  watched: Listing[];
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [tenure, setTenure] = useState<Tenure | "All" | "None">("All");
  // Available, Under contract and Sold are tabs: only one shows at a time
  const [status, setStatus] = useState<ListingStatus>("For sale");
  const [pool, setPool] = useState<"Any" | "Has pool" | Pool>("Any");
  const [newToday, setNewToday] = useState(Boolean(initialNewToday));
  const [offMarket, setOffMarket] = useState(false);
  const actions = useContext(MemberListingActions);
  const [category, setCategory] = useState<Category>("All");
  const [subtypes, setSubtypes] = useState<string[]>([]);
  const [district, setDistrict] = useState(initialDistrict ?? "All");
  const [agency, setAgency] = useState("All");
  const [signal, setSignal] = useState<Signal | "ALL">("ALL");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [bedsMin, setBedsMin] = useState(0);
  const [sizeMin, setSizeMin] = useState(0);
  const [newOnly, setNewOnly] = useState(false);
  const [dropsOnly, setDropsOnly] = useState(false);
  const [reliableOnly, setReliableOnly] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Newest & recent price drops first: what moved, not 10,000 rows in no order.
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "activity", dir: "desc" });
  // Rows, pins and the map card all use group keys ("p:…" project, "h:…" home, "m:…" member listing).
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [popupId, setPopupId] = useState<string | null>(null);
  // A group opened from the map or a link that is not among the rows loaded so far.
  const [focusId, setFocusId] = useState<string | null>(null);
  // Baseline opens in Normal view; the switch on the map opens Dashboard view (full screen).
  const [fullMap, setFullMap] = useState(false);
  const closeFullMap = useCallback((tab: FullPanel = "Listings") => {
    setFullMap(false);
    if (tab !== "Listings") onExitTo?.(tab);
  }, [onExitTo]);

  // "Search as I move the map": the list follows the visible map area.
  const [searchAsMove, setSearchAsMove] = useState(true);
  const [viewport, setViewport] = useState<[number, number, number, number] | null>(null);
  // Only the member's own moves narrow the list; when the map fits the pins or flies to a
  // pick by itself, the list stays on the whole island until the member moves it again.
  const onViewport = useCallback((v: { bbox: [number, number, number, number]; user: boolean }) => {
    if (v.user) setViewport(v.bbox);
  }, []);

  // The table scrolls sideways on narrower screens. An open listing's details
  // are pinned to the visible width so nothing is cut off on the right.
  const tableRef = useRef<HTMLDivElement>(null);
  const [paneW, setPaneW] = useState(0);
  const [edge, setEdge] = useState({ left: false, right: false });
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const update = () => {
      setPaneW(el.clientWidth);
      const left = el.scrollLeft > 4;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  const landOnly = category === "Land";
  const commercialOnly = category === "Commercial";
  const nonResidential = landOnly || commercialOnly;

  /* ── the data: asked for in pieces (lib/market-api.ts) ───────────── */
  const membersByRef = useMemo(() => new Map(members.map((l) => [l.listing_id, l])), [members]);
  const deferredQuery = useDeferredValue(query);
  const filters = useMemo<MarketFilters>(
    () => ({
      status,
      category: category === "All" ? undefined : category,
      subtypes,
      district: district === "All" ? undefined : district,
      agency: agency === "All" ? undefined : agency,
      signal: signal === "ALL" || signal === "NO_SIGNAL" ? undefined : signal,
      tenure: tenure === "All" ? undefined : tenure,
      pool: pool === "Any" ? undefined : pool,
      new_today: newToday,
      off_market: offMarket,
      price_min: priceMin,
      price_max: priceMax,
      beds_min: bedsMin,
      size_min_m2: sizeMin,
      new_7d: newOnly,
      drops: dropsOnly,
      reliable: reliableOnly,
      q: deferredQuery.trim(),
    }),
    [status, category, subtypes, district, agency, signal, tenure, pool, newToday, offMarket, priceMin, priceMax, bedsMin, sizeMin, newOnly, dropsOnly, reliableOnly, deferredQuery],
  );
  const [filtersSeen, setFiltersSeen] = useState(filters);
  if (filtersSeen !== filters) {
    setFiltersSeen(filters);
    setViewport(null);
  }
  const inView = searchAsMove && viewport !== null && !coversIsland(viewport);
  const listFilters = useMemo(() => ({ ...filters, bbox: inView ? viewport! : undefined }), [filters, inView, viewport]);
  const { flags } = useFlags();
  const { pins: allPins, error: pinsError } = useMapPins(filters);
  const pins = useMemo(() => allPins.filter((p) => !flags[p.rep_ref]), [allPins, flags]);
  const page = useListingPages(listFilters, sort, membersByRef);
  const groups = useMemo(() => page.groups.filter((g) => g.l && !flags[g.l.listing_id]), [page.groups, flags]);
  const { facets } = useMarketFacets(listFilters);
  const loaded = !page.loading || groups.length > 0;
  useEffect(() => publishMarket(groups.map((g) => g.l!).filter(Boolean)), [groups]);

  const statusCounts = useMemo(() => {
    const n: Record<ListingStatus, number> = { "For sale": 0, "Under contract": 0, Sold: 0, "De-listed": 0 };
    for (const st of LISTING_STATUSES) n[st] = facets?.status_counts[st] ?? 0;
    return n;
  }, [facets]);
  const otherTabs = LISTING_STATUSES.filter((st) => st !== status).reduce((a, st) => a + statusCounts[st], 0);
  const districts = useMemo(() => ["All", ...(facets?.districts ?? [])], [facets]);
  const agencies: AgencyOption[] = useMemo(() => (facets?.agencies ?? []).map((a) => ({ key: a.id, name: a.name.trim(), count: a.count })), [facets]);

  // A link that names a listing: open its group (it may be on no page loaded yet).
  useEffect(() => {
    if (!initialOpenId) return;
    let live = true;
    groupKeyOf(initialOpenId).then((k) => {
      if (!live || !k) return;
      setFocusId(k);
      setOpenId(k);
      window.setTimeout(() => scrollToRow(`row-${k}`, "start"), 200);
    });
    return () => {
      live = false;
    };
  }, [initialOpenId]);

  const listTopRef = useRef<HTMLDivElement>(null);
  /** Open a group's details in the list: its row if loaded, else the "Selected" card above the list. */
  const showGroup = (key: string) => {
    if (!groups.some((g) => g.key === key)) setFocusId(key);
    setOpenId(key);
    window.setTimeout(() => scrollToRow(`row-${key}`, "start"), 60);
  };

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
    if (c === "Property" && sort.key === "vsDistrict") setSort({ key: "activity", dir: "desc" });
    if ((c === "Land" || c === "Commercial") && (sort.key === "beds" || sort.key === "baths" || (c === "Land" && sort.key === "built")))
      setSort({ key: "activity", dir: "desc" });
  };
  const toggleSubtype = (t: string) => setSubtypes((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]));

  const moreCount =
    [priceMin, priceMax, bedsMin, sizeMin].filter(Boolean).length + (newOnly ? 1 : 0) + (dropsOnly ? 1 : 0) + (reliableOnly ? 1 : 0) + (pool !== "Any" ? 1 : 0);
  const filtersActive = Boolean(query) || tenure !== "All" || newToday || offMarket || category !== "All" || subtypes.length > 0 || district !== "All" || agency !== "All" || signal !== "ALL" || moreCount > 0;
  const clearAll = () => {
    setQuery("");
    setTenure("All");
    setPool("Any");
    setNewToday(false);
    setOffMarket(false);
    pickCategory("All");
    setDistrict("All");
    setAgency("All");
    setSignal("ALL");
    setPriceMin(0);
    setPriceMax(0);
    setBedsMin(0);
    setSizeMin(0);
    setNewOnly(false);
    setDropsOnly(false);
    setReliableOnly(false);
  };

  // a pin opens the glass window on the map; Full details jumps to the row
  const selectFromMap = (key: string) => setPopupId(key || null);
  const popupGroup = popupId ? groups.find((g) => g.key === popupId) ?? null : null;
  const popupPin = popupId ? pins.find((p) => p.group_key === popupId) ?? null : null;
  const focusGroup = focusId && !groups.some((g) => g.key === focusId) ? focusId : null;
  const focusPin = focusGroup ? pins.find((p) => p.group_key === focusGroup) ?? null : null;
  const renderGroup = (key: string, fallback: Listing | null = null) => (
    <GroupDetails groupKey={key} fallback={fallback} members={membersByRef} renderDetails={(l) => <ListingDetails l={l} />} />
  );

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllGroups(listFilters, sort, membersByRef);
      downloadCsv(all.map((g) => g.l).filter((l): l is Listing => Boolean(l)));
    } finally {
      setExporting(false);
    }
  };

  const selectCls = `${MONO} rounded-md border border-zinc-300 bg-white px-3 py-2 text-[12px] text-zinc-800 outline-none transition-colors hover:border-zinc-500 focus:border-zinc-950`;
  const segBtn = (on: boolean) =>
    `shrink-0 whitespace-nowrap px-3 py-2 text-[12px] font-medium transition-colors ${on ? "bg-zinc-950 text-lime" : "text-zinc-600 hover:text-zinc-950"}`;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-medium transition-[colors,transform] active:scale-[0.96] ${
      on ? "border-zinc-950 bg-zinc-950 text-lime" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
    }`;
  const toggleCls = (on: boolean) =>
    `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-[12px] font-medium transition-colors active:scale-[0.97] ${
      on ? "border-zinc-950 bg-zinc-950 text-lime" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
    }`;
  const td = "px-2.5 py-4 border-b border-zinc-200 align-top";
  const num = `${td} ${MONO} text-right text-[13px] text-zinc-800`;
  // listing, district, status, asking, $/sqft, signal, listed, chevron + the category-dependent columns
  const colCount = 9 + 1 + (landOnly ? 1 : 2) + 1;
  const marketEmpty = loaded && facets !== null && !filtersActive && !inView && facets.listings === 0 && otherTabs === 0;
  const countLine = `Showing ${int.format(groups.length)} of ${int.format(page.total)} ${page.total === 1 ? "property" : "properties"} ${inView ? "in view" : "on Aruba"}`;

  const loadMoreBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 py-4">
      <p className="text-[12px] tabular-nums text-zinc-500">{loaded ? countLine : "Loading…"}</p>
      {page.hasMore && (
        <button
          type="button"
          onClick={page.loadMore}
          disabled={page.loadingMore}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-[12.5px] font-semibold text-lime transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {page.loadingMore ? "Loading…" : `Load ${Math.min(PAGE_SIZE, page.total - groups.length)} more`}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="deck bleed relative isolate">
      <GrainField variant="ink" particles={false} className="-z-10" />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 py-6 sm:py-8">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Aruba · Read daily by AI Signal</p>
          <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-white sm:text-[34px]">{STATUS_TITLE[status]}</h1>
          <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-zinc-400">
            {status === "Sold"
              ? "Properties the agencies marked sold. Prices are the last asking price; the price it sold for is not published."
              : "Homes, condos, land and commercial property from Aruba's agencies. One pin per building project or home, however many agencies list it. Hover a pin for a quick look, click it for every unit and agency."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions && (
            <button
              type="button"
              onClick={actions.add}
              className="shine inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-[12px] font-semibold tracking-wide text-zinc-950 transition-colors hover:bg-white"
            >
              <Plus size={13} strokeWidth={2} />
              Add listing
            </button>
          )}
          <button
            type="button"
            onClick={exportCsv}
            disabled={!page.total || exporting}
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-[12px] font-semibold tracking-wide text-white transition-colors hover:border-white disabled:opacity-40"
          >
            <Download size={13} strokeWidth={1.5} />
            {exporting ? "Preparing…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-3 gap-x-4 lg:grid-cols-6 lg:gap-x-0">
        {[
          [inView ? "Listings in view" : "Listings shown", facets ? int.format(facets.listings) : "—", undefined],
          ["Residential", facets ? int.format(facets.residential) : "—", undefined],
          ["Land", facets ? int.format(facets.land) : "—", undefined],
          ["Commercial", facets ? int.format(facets.commercial) : "—", undefined],
          [isClosed({ status }) ? "Median last asking" : "Median asking", facets?.median_price ? fmtUsdCompact(facets.median_price) : "—", undefined],
          ["Below market", facets && !isClosed({ status }) ? int.format(facets.below_market) : "—", facets && !isClosed({ status }) ? "#7FD3A0" : undefined],
        ].map(([label, value, color], i) => (
          <div key={label} className={`py-3 sm:py-6 ${i > 0 ? "lg:border-l lg:border-white/10 lg:pl-6" : ""}`}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-zinc-500 sm:text-[10px] sm:tracking-[0.14em]">{label}</p>
            <p className={`${MONO} mt-1 font-display text-[19px] font-bold text-white sm:mt-1.5 sm:text-[26px]`} style={color ? { color } : undefined}>
              {value}
            </p>
          </div>
        ))}
      </div>
      </div>
      </div>

      {/* filters */}
      <div className="space-y-3 py-5">
        <div role="group" aria-label="Status" className="no-scrollbar flex gap-1.5 overflow-x-auto sm:gap-2">
          {LISTING_STATUSES.filter((st) => st !== "De-listed" || status === st || statusCounts[st] > 0).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatus(st);
                setOpenId(null);
                setPopupId(null);
              }}
              aria-pressed={status === st}
              title={STATUS_HINT[st]}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 font-display text-[13px] font-semibold sm:gap-2 sm:px-4 sm:text-[14px] transition-colors ${
                status === st ? "border-zinc-950 bg-zinc-950 text-lime" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-950 hover:text-zinc-950"
              }`}
            >
              {STATUS_TAB[st]}
              <span className={`${MONO} text-[12px] ${status === st ? "text-lime/70" : "text-zinc-400"}`}>{facets ? int.format(statusCounts[st]) : "—"}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-md border border-zinc-950" role="group" aria-label="Category">
            {CATEGORY_FILTERS.map((f) => (
              <button key={f.value} type="button" onClick={() => pickCategory(f.value)} aria-pressed={category === f.value} className={segBtn(category === f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-auto">
            <span className="sr-only">Search listings</span>
            <Search size={13} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, project, district, ID"
              className={`${selectCls} w-full pl-8 placeholder:text-zinc-400 sm:w-56`}
            />
          </label>
          <label className="sr-only" htmlFor="f-district">District</label>
          <select id="f-district" value={district} onChange={(e) => setDistrict(e.target.value)} className={selectCls}>
            {districts.map((d) => (
              <option key={d} value={d}>{d === "All" ? "All districts" : d}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="f-agency">Agency</label>
          <select id="f-agency" value={agency} onChange={(e) => setAgency(e.target.value)} className={`${selectCls} max-w-full`}>
            <option value="All">All agencies</option>
            {agencies.map((a) => (
              <option key={a.key} value={a.key}>{`${a.name} (${a.count})`}</option>
            ))}
          </select>
          {!isClosed({ status }) && (
            <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-md border border-zinc-300" role="group" aria-label="Value">
              {SIGNAL_FILTERS.map((f) => (
                <button key={f.value} type="button" onClick={() => setSignal(f.value)} aria-pressed={signal === f.value} className={segBtn(signal === f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-md border border-zinc-300" role="group" aria-label="Land title">
            {(["All", ...TENURES, "None"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTenure(t)}
                aria-pressed={tenure === t}
                title={t === "All" ? "Every land title" : t === "None" ? "The agency does not say whether the land is owned or leased" : TENURE_HINT[t]}
                className={segBtn(tenure === t)}
              >
                {t === "All" ? "Any title" : t === "None" ? "Not stated" : t}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setNewToday((v) => !v)} aria-pressed={newToday} className={toggleCls(newToday)}>
            New today
            {facets && (
              <span className={`${MONO} rounded-full px-1.5 text-[10px] ${newToday ? "bg-lime text-zinc-950" : "bg-zinc-950 text-lime"}`}>
                {facets.new_today}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setOffMarket((v) => !v)}
            aria-pressed={offMarket}
            className={toggleCls(offMarket)}
            title="Listings agents added by hand, not on public sites"
          >
            Off-market
            {facets && (
              <span className={`${MONO} rounded-full px-1.5 text-[10px] ${offMarket ? "bg-lime text-zinc-950" : "bg-zinc-950 text-lime"}`}>
                {facets.off_market}
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
                  <option key={s} value={s}>{`${int.format(s)}+ m² (${fmtSqft(toSqft(s))})`}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Pool</span>
              <select value={pool} onChange={(e) => setPool(e.target.value as typeof pool)} className={`${selectCls} mt-1.5 block`}>
                <option value="Any">Any</option>
                <option value="Has pool">Has a pool</option>
                <option value="Private pool">Private pool</option>
                <option value="Shared pool">Shared pool</option>
                <option value="No pool">No pool</option>
              </select>
            </label>
            <button type="button" onClick={() => setNewOnly((v) => !v)} aria-pressed={newOnly} className={toggleCls(newOnly)}>
              New this week
            </button>
            <button type="button" onClick={() => setDropsOnly((v) => !v)} aria-pressed={dropsOnly} className={toggleCls(dropsOnly)}>
              Price drops
            </button>
            <button type="button" onClick={() => setReliableOnly((v) => !v)} aria-pressed={reliableOnly} className={toggleCls(reliableOnly)} title="Confidence score 80% or higher">
              <ShieldCheck size={13} /> High confidence only
            </button>
          </div>
        )}
      </div>

      {/* map */}
      <div className="relative rounded-2xl">
        <RunLine speed={10} />
        <ArubaMap
          mode="pins"
          pins={pins}
          selectedId={popupId ?? openId}
          hoveredId={hoverId}
          onSelect={selectFromMap}
          onHover={setHoverId}
          onViewport={onViewport}
          height={560}
        />
        <label className="glass absolute bottom-3 left-1/2 z-[5] inline-flex -translate-x-1/2 cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-zinc-900 max-sm:bottom-auto max-sm:left-auto max-sm:right-3 max-sm:top-[50px] max-sm:translate-x-0">
          <input type="checkbox" checked={searchAsMove} onChange={(e) => setSearchAsMove(e.target.checked)} className="size-3.5 accent-zinc-950" />
          Search as I move the map
        </label>
        <ViewToggle value="normal" onChange={() => setFullMap(true)} className="absolute bottom-3 right-3 z-[5] max-sm:bottom-auto max-sm:top-[92px]" />
        <AnimatePresence>
          {popupId && (popupGroup || popupPin) && (
            <GroupPopup
              key={popupId}
              groupKey={popupId}
              fallback={popupGroup?.l ?? null}
              members={membersByRef}
              onClose={() => setPopupId(null)}
              onDetails={() => {
                const k = popupId;
                setPopupId(null);
                showGroup(k);
              }}
              className="absolute inset-x-3 bottom-16 sm:inset-x-auto sm:right-4 sm:top-14 sm:bottom-auto sm:w-[360px]"
            />
          )}
        </AnimatePresence>
        {pinsError && (
          <p className="absolute inset-x-3 top-3 z-[5] rounded-lg bg-white/95 px-3 py-2 text-[12px] text-[#D64545] shadow">Map unavailable: {pinsError}</p>
        )}
      </div>
      <MapFullscreen
        open={fullMap}
        groups={groups}
        pins={pins}
        total={page.total}
        inView={inView}
        hasMore={page.hasMore}
        loadingMore={page.loadingMore}
        onLoadMore={page.loadMore}
        onViewport={onViewport}
        members={membersByRef}
        watched={watched}
        selectedId={openId}
        hoveredId={hoverId}
        onSelect={(key) => setOpenId(key || null)}
        onHover={setHoverId}
        onExit={closeFullMap}
        renderGroup={(key) => renderGroup(key, groups.find((g) => g.key === key)?.l ?? null)}
        onAddListing={actions?.add}
        agency={agency}
        agencies={agencies}
        onAgency={setAgency}
        status={status}
        statusCounts={statusCounts}
        onStatus={(st) => {
          setStatus(st);
          setOpenId(null);
        }}
      />

      {/* a group picked on the map or linked to, before its row is loaded */}
      {focusGroup && (
        <section id={`row-${focusGroup}`} data-row={`row-${focusGroup}`} className="mt-8 scroll-mt-24 rounded-2xl border border-zinc-950 bg-mint-soft p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Selected{focusPin ? ` · ${focusPin.title}` : ""}
            </p>
            <button type="button" onClick={() => setFocusId(null)} aria-label="Close" className="grid size-7 place-items-center rounded-full text-zinc-600 hover:bg-white hover:text-zinc-950">
              <X size={14} />
            </button>
          </div>
          {renderGroup(focusGroup)}
        </section>
      )}

      {/* list */}
      <div ref={listTopRef} className="mt-8 flex scroll-mt-24 flex-wrap items-center justify-between gap-3">
        <p className="font-display text-[18px] font-bold text-zinc-950" aria-live="polite">
          {loaded ? countLine : "Loading listings…"}
        </p>
        <p className="hidden text-[12px] text-zinc-500 md:block">
          {inView ? "The list follows the map · " : ""}Click a row or a pin for full details · click a column to sort
        </p>
        <label className="flex items-center gap-2 text-[12px] text-zinc-500 md:hidden">
          Sort
          <select
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
              setSort({ key, dir });
            }}
            className={selectCls}
          >
            {MOBILE_SORTS.filter(([k]) => !(landOnly && (k === "beds" || k === "built"))).map(([k, d, label]) => (
              <option key={`${k}:${d}`} value={`${k}:${d}`}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* phones: cards */}
      <ul className="mt-3 divide-y divide-zinc-200 border-t border-zinc-950 md:hidden">
        {!loaded &&
          Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="py-4">
              <Skeleton className="h-20 w-full" />
            </li>
          ))}
        {marketEmpty && (
          <li className="py-12 text-center">
            <EmptyMarket onAdd={actions?.add} />
          </li>
        )}
        {loaded && !marketEmpty && !groups.length && (
          <li className="py-12 text-center text-[13px] text-zinc-500">
            {inView ? "Nothing matches in this part of the map. Zoom out or move the map. " : "No listings match these filters in this tab. "}
            {otherTabs > 0 && `${int.format(otherTabs)} in the other tabs. `}
            <button type="button" onClick={clearAll} className="underline underline-offset-4">
              Clear all
            </button>
          </li>
        )}
        {groups.map((g) => {
          const l = g.l!;
          const open = openId === g.key;
          const project = g.type === "project";
          return (
            <li key={g.key} data-row={`row-${g.key}`} className={`relative scroll-mt-24 ${open ? "bg-mint-soft" : ""}`}>
              {!project && (
                <span className="glass absolute left-1 top-5 z-10 rounded-full">
                  <WatchButton l={l} variant="icon" />
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpenId(open ? null : g.key)}
                aria-expanded={open}
                className="flex w-full gap-3 py-4 text-left transition-colors active:bg-mint-soft"
              >
                <span className="relative shrink-0">
                  <Thumb src={l.photo_url} alt={g.title} w={96} h={72} />
                  <span className="absolute -bottom-1.5 -right-1.5 rounded-[5px] ring-2 ring-white">
                    <AgencyLogo agency={l.agency} size={20} rounded={4} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[14px] font-medium leading-snug text-zinc-950">{g.title}</span>
                    <ChevronDown size={15} strokeWidth={1.5} className={`mt-0.5 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                    {l.district} · {project ? "Building project" : typeLine(l)}
                  </span>
                  {!project && <span className="mt-0.5 block text-[11.5px] tabular-nums text-zinc-700">{shortSize(l)}</span>}
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <GroupTags g={g} />
                    {!project && (
                      <>
                        <IndexTags l={l} />
                        <TenureTag l={l} />
                        <PoolTag pool={l.pool} />
                        <ClientCount id={l.listing_id} />
                      </>
                    )}
                  </span>
                  <span className="mt-2.5 flex items-end justify-between gap-2">
                    <span>
                      <span className={`${MONO} block font-display text-[16px] font-bold text-zinc-950`}>{groupPrice(g)}</span>
                      {!project && (
                        <span className="text-[11px]">
                          <PriceMove pct={l.price_change_pct} size={11} />
                        </span>
                      )}
                    </span>
                    {!project && (
                      <span className="flex flex-col items-end gap-1">
                        <StatusBadge l={l} align="end" />
                        {!isClosed(l) && (
                          <>
                            <SignalBadge signal={l.signal} />
                            <ConfidenceBadge l={l} />
                          </>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block truncate text-[11px] text-zinc-500">
                    {g.agencyIds.length > 1 ? `${g.agencyIds.length} agencies` : l.agency.name}
                    {!project && l.agent && <> · {l.agent.name}</>}
                    {" · "}
                    {l.is_new ? "Listed today" : `${l.days_on_market}d listed`}
                  </span>
                </span>
              </button>
              {open && <div className="pb-6">{renderGroup(g.key, l)}</div>}
            </li>
          );
        })}
      </ul>
      <div className="md:hidden">{loaded && groups.length > 0 && loadMoreBar}</div>

      <div className="relative mt-3 hidden md:block">
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-4 bg-gradient-to-r from-white to-transparent transition-opacity ${edge.left ? "opacity-100" : "opacity-0"}`} />
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-4 bg-gradient-to-l from-white to-transparent transition-opacity ${edge.right ? "opacity-100" : "opacity-0"}`} />
      <div ref={tableRef} className="overflow-x-auto border-t border-zinc-950">
        <table className="w-full min-w-[1180px] border-collapse text-left">
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
              {!landOnly && <SortHeader label="Built m²" k="built" sort={sort} onSort={onSort} />}
              <SortHeader label="Lot m²" k="lot" sort={sort} onSort={onSort} />
              <SortHeader label={isClosed({ status }) ? "Last asking" : "Asking"} k="asking" sort={sort} onSort={onSort} />
              <SortHeader label="$ / m²" k="psf" sort={sort} onSort={onSort} />
              <SortHeader label="Vs. similar" k="vsDistrict" sort={sort} onSort={onSort} />
              <SortHeader label="Status" k="status" sort={sort} onSort={onSort} />
              <SortHeader
                label="Confidence"
                k="confidence"
                sort={sort}
                onSort={onSort}
                align="right"
                tip={
                  <InfoTip label="What is the Confidence Score?">
                    <ConfidenceTip />
                  </InfoTip>
                }
              />
              <PlainHeader label="Value" />
              <SortHeader label="Activity" k="activity" sort={sort} onSort={onSort} />
              <th className="w-14 border-b border-zinc-300 pr-3" aria-label="Watch and details" />
            </tr>
          </thead>
          <tbody>
            {!loaded &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={colCount} className="border-b border-zinc-200 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            {marketEmpty && (
              <tr>
                <td colSpan={colCount} className="py-16 text-center">
                  <EmptyMarket onAdd={actions?.add} />
                </td>
              </tr>
            )}
            {loaded && !marketEmpty && !groups.length && (
              <tr>
                <td colSpan={colCount} className="py-16 text-center text-[13px] text-zinc-500">
                  {inView ? "Nothing matches in this part of the map. Zoom out or move the map. " : "No listings match these filters in this tab. "}
                  {otherTabs > 0 && `${int.format(otherTabs)} in the other tabs. `}
                  <button type="button" onClick={clearAll} className="underline underline-offset-4 hover:text-zinc-950">
                    Clear all
                  </button>
                </td>
              </tr>
            )}
            {groups.map((g) => {
              const l = g.l!;
              const open = openId === g.key;
              const hot = hoverId === g.key;
              const project = g.type === "project";
              const vsPct = l.category === "Property" ? l.price_vs_comps_pct : 0;
              const compsPsf = isScored(l) && l.category === "Property" ? l.comps_psf_usd : 0;
              return (
                <Fragment key={g.key}>
                  <tr
                    id={`row-${g.key}`}
                    data-row={`row-${g.key}`}
                    onClick={() => setOpenId(open ? null : g.key)}
                    onMouseEnter={() => setHoverId(g.key)}
                    onMouseLeave={() => setHoverId(null)}
                    className={`cursor-pointer scroll-mt-24 transition-colors hover:bg-mint-soft ${open || hot ? "bg-mint-soft" : ""}`}
                  >
                    <td className={`${td} min-w-[250px] pl-4`}>
                      <div className="flex items-start gap-3">
                        <span className="relative shrink-0" title={project ? "Building project" : `Listed by ${l.agency.name}`}>
                          <Thumb src={l.photo_url} alt={g.title} />
                          <span className="absolute -bottom-1.5 -right-1.5 rounded-[5px] ring-2 ring-white">
                            <AgencyLogo agency={l.agency} size={20} rounded={4} />
                          </span>
                        </span>
                        <div className="min-w-0 max-w-[230px]">
                          <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-zinc-950">
                            {g.title}
                            {!project && <IndexTags l={l} />}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                            {project ? "Building project" : <>{l.listing_id} · {typeLine(l)}</>}
                            {!project && <TenureTag l={l} />}
                            {!project && <PoolTag pool={l.pool} />}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-zinc-500">
                            <GroupTags g={g} />
                            {g.agencyIds.length <= 1 && (
                              <span className="truncate">
                                {l.agency.name}
                                {l.agent && <> · Agent <span className="text-zinc-800">{l.agent.name}</span></>}
                              </span>
                            )}
                            {!project && <ClientCount id={l.listing_id} />}
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
                      <td className={num}>
                        {!project && l.category === "Property" ? (
                          <>
                            {l.bedrooms}
                            <span className="text-zinc-400"> / </span>
                            {l.bathrooms}
                          </>
                        ) : (
                          DASH
                        )}
                      </td>
                    )}
                    {!landOnly && <td className={num}>{project || l.category === "Land" || !l.built_sqft ? DASH : <BothAreas sqft={l.built_sqft} />}</td>}
                    <td className={num}>{!project && l.lot_sqft ? <BothAreas sqft={l.lot_sqft} /> : DASH}</td>
                    <td className={`${num} text-zinc-950`}>
                      {project ? groupPrice(g) : fmtUsdCompact(l.asking_price_usd)}
                      <p className="mt-1 text-[11px]">
                        {project ? (
                          g.maxPrice > g.minPrice && <span className="text-zinc-500">to {fmtUsdCompact(g.maxPrice)}</span>
                        ) : (
                          <PriceMove pct={l.price_change_pct} size={11} />
                        )}
                      </p>
                    </td>
                    <td className={num}>
                      {!project && l.price_per_sqft_usd > 0 ? (
                        <>
                          {fmtUsd(pricePerM2(l))}
                          <p className="mt-1 whitespace-nowrap text-[11px] text-zinc-500">{fmtUsd(l.price_per_sqft_usd)} /ft²</p>
                        </>
                      ) : (
                        DASH
                      )}
                    </td>
                    <td className={`${td} ${MONO} text-right`}>
                      {!project && l.price_per_sqft_usd > 0 && compsPsf > 0 ? (
                        <>
                          <p className="text-[13px]" style={{ color: l.signal === "AT_MARKET" ? C.slate300 : deltaColor(-vsPct) }} title="Average of the two price checks. Coloured only when both agree.">
                            {fmtDelta(vsPct)}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">similar {fmtUsd(perM2(compsPsf))}/m²</p>
                        </>
                      ) : (
                        DASH
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      <StatusBadge l={l} align="end" />
                    </td>
                    <td className={`${td} text-right`}>{project || isClosed(l) ? DASH : <ConfidenceBadge l={l} />}</td>
                    <td className={`${td} text-right`}>{project || isClosed(l) ? DASH : <SignalBadge signal={l.signal} />}</td>
                    <td className={num}>
                      {l.is_new ? (
                        <span className="font-semibold text-zinc-950">Today</span>
                      ) : !project && l.last_price_change && l.last_price_change.event === "Price drop" ? (
                        <span title={`Price drop on ${fmtDate(l.last_price_change.date)}`} style={{ color: PRICE_DOWN }}>
                          ↓ {fmtDate(l.last_price_change.date).replace(/, \d{4}$/, "")}
                        </span>
                      ) : (
                        `${l.days_on_market}d`
                      )}
                    </td>
                    <td className={`${td} pr-3 text-right`}>
                      <span className="flex items-center justify-end gap-1">
                        {!project && <WatchButton l={l} variant="icon" />}
                        <ChevronDown size={14} strokeWidth={1.5} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-mint-soft">
                      <td colSpan={colCount} className="border-b border-zinc-300 p-0">
                        <div className="sticky left-0 px-4 pb-6 pt-1" style={paneW ? { width: paneW } : undefined}>
                          {renderGroup(g.key, l)}
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
      {loaded && groups.length > 0 && loadMoreBar}
      </div>
      {page.error && <p className="mt-3 text-[12px] text-[#D64545]">Could not load more listings: {page.error}</p>}
      <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-zinc-500">
        <p>
          <span className="text-zinc-700">One pin, one row per property.</span> A building project&apos;s units, and a home listed by
          several agencies, are shown together; open them to see every unit and each agency&apos;s own price and page.
        </p>
        <p>
          <span className="text-zinc-700">Homes and condos for sale</span> get two separate checks: the nearest homes of similar
          size, and a price model (size, plot, bedrooms, pool, land title, district). Below market or Above market means both
          put the price at least 20% away. The percentage shown is the average of the two. Asking prices, not sale prices.
        </p>
        <p>
          <span className="text-zinc-700">No signal:</span> land, commercial, homes not for sale, sizes not stated, fixer-uppers,
          homes sold with several apartments, and homes with too few similar ones nearby.
        </p>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Watchlist — listings the user pinned to keep track of
 * ──────────────────────────────────────────────────────────────────────── */

type WatchSort = "pinned" | "moved" | "price" | "listed";
const WATCH_SORTS: Array<[WatchSort, string]> = [
  ["pinned", "Recently pinned"],
  ["moved", "Biggest price move"],
  ["price", "Highest price"],
  ["listed", "Longest on market"],
];

interface WatchUpdate {
  id: string;
  date: string;
  text: string;
  color: string;
}

/** What the daily Index runs saw on pinned listings, newest first. */
function watchUpdates(ids: Set<string>, runs: IndexRun[]): WatchUpdate[] {
  const out: WatchUpdate[] = [];
  runs.forEach((run) => {
    run.price_changes
      .filter((c) => ids.has(c.listing.listing_id))
      .forEach((c) => {
        const pct = c.change.change_pct ?? 0;
        out.push({
          id: c.listing.listing_id,
          date: run.date,
          text: `${c.listing.asset_name}: price ${pct < 0 ? "dropped" : "raised"} ${Math.abs(pct).toFixed(1)}% to ${fmtUsdCompact(c.change.price_usd)}`,
          color: priceColor(pct),
        });
      });
    run.status_changes
      .filter((l) => ids.has(l.listing_id))
      .forEach((l) => out.push({ id: l.listing_id, date: run.date, text: `${l.asset_name}: now ${l.status.toLowerCase()}`, color: STATUS_STYLE[l.status].color }));
  });
  return out;
}

function Watchlist({ listings, runs, onOpenListing, onBrowse }: { listings?: Listing[]; runs: IndexRun[]; onOpenListing: (id: string) => void; onBrowse: () => void }) {
  const { entries, unpin, setNote, clear } = useWatchlist();
  const [sort, setSort] = useState<WatchSort>("pinned");
  const [openId, setOpenId] = useState<string | null>(null);

  const byId = useMemo(() => new Map((listings ?? []).map((l) => [l.listing_id, l])), [listings]);
  const rows = useMemo(() => {
    const r = entries
      .map((e) => ({ e, l: byId.get(e.id) }))
      .filter((x): x is { e: WatchEntry; l: Listing } => Boolean(x.l))
      .map((x) => ({ ...x, since: ((x.l.asking_price_usd - x.e.price_at_pin) / x.e.price_at_pin) * 100 }));
    const key: Record<WatchSort, (x: (typeof r)[number]) => number> = {
      pinned: (x) => -Date.parse(x.e.pinned_at),
      moved: (x) => -Math.abs(x.l.price_change_pct),
      price: (x) => -x.l.asking_price_usd,
      listed: (x) => -x.l.days_on_market,
    };
    return r.sort((a, b) => key[sort](a) - key[sort](b));
  }, [entries, byId, sort]);

  const ids = useMemo(() => new Set(rows.map((r) => r.l.listing_id)), [rows]);
  const updates = useMemo(() => watchUpdates(ids, runs), [ids, runs]);
  const today = runs[0].date;
  const todayCount = updates.filter((u) => u.date === today).length;
  const total = rows.reduce((a, r) => a + r.l.asking_price_usd, 0);
  const drops = rows.filter((r) => r.l.price_change_pct < 0).length;
  const offMarket = rows.filter((r) => r.l.status !== "For sale").length;

  if (!listings) {
    return (
      <div className="space-y-3 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="pb-8 sm:pb-10">
      <div className="deck bleed relative isolate">
      <GrainField variant="ink" particles={false} className="-z-10" />
      <div className="mx-auto max-w-[1400px] px-4 pb-8 pt-8 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Tracked by AI Signal every morning</p>
          <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-white sm:text-[34px]">Watchlist</h1>
          <p className="mt-1 max-w-xl text-[13px] text-zinc-400">
            Properties you are keeping track of. Every daily Index checks them for price changes and status updates.
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] text-zinc-400">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as WatchSort)} className={`${MONO} rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-[12px] text-zinc-100 outline-none transition-colors hover:border-white/30 focus:border-mint [&>option]:text-zinc-900`}>
                {WATCH_SORTS.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => window.confirm("Remove every listing from your watchlist?") && clear()}
              className="text-[12px] text-zinc-400 underline-offset-4 hover:text-white hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {(
              [
                ["Pinned", String(rows.length)],
                ["Total asking", fmtUsdCompact(total)],
                ["Price drops", String(drops)],
                ["Updates today", String(todayCount)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="bg-[#0d0d0f] px-4 py-4 sm:px-5">
                <dt className="text-[11px] text-zinc-500">{k}</dt>
                <dd className={`${MONO} mt-1 font-display text-[22px] font-bold text-white`}>{v}</dd>
              </div>
            ))}
          </dl>
          {offMarket > 0 && (
            <p className="mt-3 text-[12px] text-zinc-500">
              {offMarket} pinned {offMarket === 1 ? "listing is" : "listings are"} no longer for sale (under contract, sold or de-listed).
            </p>
          )}
        </>
      )}
      </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-zinc-300 bg-mint-soft/60 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-zinc-950 text-lime">
            <Pin size={18} strokeWidth={1.75} />
          </span>
          <h2 className="mt-5 font-display text-[20px] font-bold text-zinc-950">Nothing pinned yet</h2>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-zinc-600">
            Tap the <Pin size={12} strokeWidth={2} className="inline -translate-y-px" /> pin on any listing to add it here. You will see
            every price change and status update on the properties you care about, in one place.
          </p>
          <button
            type="button"
            onClick={onBrowse}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-[13px] font-medium text-lime transition-all hover:bg-zinc-800 active:scale-95"
          >
            Browse listings <ArrowRight size={14} strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <ul className="divide-y divide-zinc-200 border-t border-zinc-950">
              {rows.map(({ e, l, since }) => {
                const open = openId === l.listing_id;
                return (
                  <li key={l.listing_id} className={`py-4 transition-colors ${open ? "bg-mint-soft" : ""}`}>
                    <div className="flex gap-3 sm:gap-4">
                      <button type="button" onClick={() => setOpenId(open ? null : l.listing_id)} className="relative shrink-0 self-start" aria-label={`Details for ${l.asset_name}`}>
                        <span className="sm:hidden">
                          <Thumb src={l.photo_url} alt={l.asset_name} w={84} h={64} />
                        </span>
                        <span className="hidden sm:block">
                          <Thumb src={l.photo_url} alt={l.asset_name} w={112} h={84} />
                        </span>
                        <span className="absolute -bottom-1.5 -right-1.5 rounded-[5px] ring-2 ring-white">
                          <AgencyLogo agency={l.agency} size={20} rounded={4} />
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <button type="button" onClick={() => setOpenId(open ? null : l.listing_id)} className="min-w-0 text-left">
                            <span className="block text-[14px] font-semibold leading-snug text-zinc-950 hover:underline sm:text-[15px]">{l.asset_name}</span>
                            <span className="mt-0.5 block text-[11px] text-zinc-500">
                              {l.district} · {typeLine(l)}
                              <span className="hidden sm:inline"> · {l.listing_id}</span>
                            </span>
                            <span className="mt-0.5 block text-[11.5px] tabular-nums text-zinc-700">{shortSize(l)}</span>
                          </button>
                          <WatchButton l={l} variant="icon" />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusBadge l={l} />
                          <IndexTags l={l} />
                          <TenureTag l={l} />
                          {!isClosed(l) && <SignalBadge signal={l.signal} />}
                          <ClientCount id={l.listing_id} />
                        </div>
                      </div>
                    </div>
                    <div className="sm:pl-[128px]">
                      <div className={`${MONO} mt-3 grid grid-cols-3 gap-2 text-[11px] text-zinc-500 sm:max-w-md`}>
                        <span>
                          <span className="block font-display text-[16px] font-bold text-zinc-950">{fmtUsdCompact(l.asking_price_usd)}</span>
                          asking
                        </span>
                        <span>
                          <span className="block text-[13px]">
                            {Math.abs(since) < 0.05 ? <span className="font-semibold text-zinc-400">No change</span> : <PriceMove pct={since} size={11} />}
                          </span>
                          since pinned
                        </span>
                        <span>
                          <span className="block text-[13px]">
                            {l.price_change_pct === 0 ? <span className="font-semibold text-zinc-400">No change</span> : <PriceMove pct={l.price_change_pct} size={11} />}
                          </span>
                          since listed
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                        {l.agency.name}
                        {l.agent && <> · {l.agent.name}{l.agent.phone && <> · <span className="tabular-nums">{l.agent.phone}</span></>}</>}
                        {" · "}
                        {l.is_new ? "Listed today" : `${l.days_on_market}d on market`} · pinned {fmtDate(e.pinned_at.slice(0, 10))}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          defaultValue={e.note ?? ""}
                          onBlur={(ev) => setNote(l.listing_id, ev.target.value.trim())}
                          placeholder="Add a private note…"
                          aria-label={`Note for ${l.asset_name}`}
                          className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none sm:w-auto sm:min-w-0 sm:flex-1 sm:max-w-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : l.listing_id)}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-[12px] text-zinc-800 transition-colors hover:border-zinc-950"
                        >
                          {open ? "Hide details" : "Details"}
                          <ChevronDown size={12} strokeWidth={1.75} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenListing(l.listing_id)}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-[12px] text-zinc-800 transition-colors hover:border-zinc-950"
                        >
                          In listings <ArrowUpRight size={12} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => unpin(l.listing_id)}
                          className="ml-auto px-1 text-[12px] text-zinc-500 underline-offset-4 hover:text-zinc-950 hover:underline sm:ml-0"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div className="pt-6">
                        <ListingDetails l={l}  />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl border border-zinc-200 bg-white">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                  <h2 className="text-[13px] font-semibold text-zinc-950">Activity on your watchlist</h2>
                  <span className={`${MONO} text-[11px] text-zinc-500`}>Last 7 days</span>
                </div>
                {updates.length === 0 ? (
                  <p className="px-4 py-6 text-[12px] leading-relaxed text-zinc-500">
                    No price or status changes on your pinned listings this week. New changes show up here after each daily Index.
                  </p>
                ) : (
                  <ul className="max-h-[420px] divide-y divide-zinc-100 overflow-y-auto overscroll-contain" data-lenis-prevent>
                    {updates.map((u, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => setOpenId(u.id)} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50">
                          <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: u.color }} />
                          <span className="min-w-0">
                            <span className="block text-[12px] leading-snug text-zinc-800">{u.text}</span>
                            <span className={`${MONO} mt-0.5 block text-[11px] text-zinc-500`}>{u.date === today ? "Today" : fmtDate(u.date)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                Your watchlist is saved on this device for now. It will sync to your account once sign-in is live.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Baseline updates — message board fed by every daily Index
 * ──────────────────────────────────────────────────────────────────────── */

const fmtRunTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Aruba" });
const fmtRunDay = (run: IndexRun, i: number) =>
  i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(run.run_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Aruba" });

type BoardMessage =
  | { kind: "run"; run: IndexRun }
  | { kind: "new"; l: Listing }
  | { kind: "price"; l: Listing; from: number; e: PriceEvent }
  | { kind: "status"; l: Listing };

function runMessages(run: IndexRun): BoardMessage[] {
  return [
    { kind: "run", run },
    ...run.new_listings.map((l): BoardMessage => ({ kind: "new", l })),
    ...run.status_changes.map((l): BoardMessage => ({ kind: "status", l })),
    ...run.price_changes.map((c): BoardMessage => ({ kind: "price", l: c.listing, from: c.previous_price_usd, e: c.change })),
  ];
}

function TerminalUpdates({
  runs,
  allListings,
  marketSize,
  open,
  onToggle,
  onOpenListing,
  onShowNew,
}: {
  runs: IndexRun[];
  /** Listings it may name (recent, pinned, members'). */
  allListings: Listing[];
  /** How many listings the market holds (0 before the first Index). */
  marketSize: number;
  open: boolean;
  onToggle: () => void;
  onOpenListing: (id: string) => void;
  onShowNew: () => void;
}) {
  const latest = runs[0];
  // Re-brief when the market changes; nothing to brief before the first listing.
  const version = marketSize ? `${marketSize}:${latest.date}:${latest.new_listings.length}:${latest.price_changes.length}:${latest.status_changes.length}` : null;
  const brief = useMarketBrief(version);
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
    <div ref={boxRef} id="terminal-updates" className="deck bleed relative isolate z-30 scroll-mt-4">
      <GrainField variant="ink" particles={false} className="-z-10" />
      <div className="relative mx-auto max-w-[1400px] px-4 pt-4 sm:px-6">
      {/* slim bar */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="ai-ring flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 text-left text-[12px] text-zinc-300 [--ai-bg:#111113] transition-[filter] hover:brightness-125"
      >
        <span className="flex items-center gap-2 font-semibold text-white">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: PRICE_UP }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: PRICE_UP }} />
          </span>
          <Sparkles size={13} strokeWidth={2} />
          AI Signal
        </span>
        <span className="min-w-0 flex-1 basis-[260px] truncate text-zinc-200">
          {!marketSize ? (
            <span className="text-zinc-400">No listings yet. AI Signal starts reading the market with the first Index run.</span>
          ) : brief.data ? (
            brief.data.headline
          ) : brief.loading ? (
            <span className="text-zinc-500">Reading today&apos;s Index…</span>
          ) : (
            `Updated today ${fmtRunTime(latest.run_at)} AST`
          )}
        </span>
        <span className="flex items-center gap-3 text-zinc-400">
          <span>
            <b className={`${MONO} text-white`}>{latest.new_listings.length}</b> new
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowDown size={12} strokeWidth={2.5} style={{ color: PRICE_DOWN }} />
            <b className={MONO}>{drops}</b>
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowUp size={12} strokeWidth={2.5} style={{ color: PRICE_UP }} />
            <b className={MONO}>{ups}</b>
          </span>
          {latest.status_changes.length > 0 && (
            <span>
              <b className={`${MONO} text-white`}>{latest.status_changes.length}</b> status {latest.status_changes.length === 1 ? "change" : "changes"}
            </span>
          )}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-medium text-lime">
          {open ? "Close" : "Today's briefing"}
          <ChevronDown size={13} strokeWidth={1.75} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {/* dropdown feed */}
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-full max-w-[640px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_18px_40px_-12px_rgb(0_0_0/0.25)]">
          <div className="max-h-[min(72vh,620px)] overflow-y-auto overscroll-contain" data-lenis-prevent>
          <section aria-label="AI Signal briefing" className="deck relative isolate overflow-hidden border-b border-zinc-200 px-4 py-4 [background-attachment:scroll] sm:px-5">
            <GrainField variant="ink" particles={false} className="-z-10" />
            <RunLine speed={8} delay={-2} />
            <div className="flex items-center justify-between gap-2">
              <AIMark dark />
              <span className="text-[11px] text-zinc-500">
                {marketSize ? `${fmtRunDay(latest, 0)} · ${fmtRunTime(latest.run_at)} AST` : "Waiting for the first Index run"}
              </span>
            </div>
            {!marketSize && (
              <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">
                No listings yet. Once the daily Index of Aruba&rsquo;s agency sites starts, AI Signal briefs you here every morning: what&rsquo;s new,
                price cuts, status changes and the listings worth a look.
              </p>
            )}
            {brief.loading && (
              <div className="mt-4">
                <AIShimmer lines={4} dark />
              </div>
            )}
            {brief.error && <p className="mt-3 text-[12px] text-zinc-500">The briefing could not load right now. The Index log below is up to date.</p>}
            {brief.data && (
              <>
                <p className="mt-3 font-display text-[16px] font-semibold leading-snug tracking-tight text-white">{brief.data.headline}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">{brief.data.summary}</p>
                <ul className="mt-3 space-y-1.5">
                  {brief.data.points.map((p, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-zinc-400">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-lime" />
                      {p}
                    </li>
                  ))}
                </ul>
                {brief.data.watch.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Worth a look today</p>
                    <ul className="mt-2 space-y-1.5">
                      {brief.data.watch.map((w) => {
                        const wl = allListings.find((x) => x.listing_id === w.listing_id);
                        if (!wl) return null;
                        return (
                          <li key={w.listing_id}>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenListing(w.listing_id);
                                onToggle();
                              }}
                              className="flex w-full items-center gap-3 rounded-lg bg-white/[0.05] px-3 py-2 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-medium text-white">{wl.asset_name}</span>
                                <span className="block text-[11.5px] leading-snug text-zinc-400">{w.reason}</span>
                              </span>
                              <span className={`${MONO} shrink-0 text-[12px] font-semibold text-white`}>{fmtUsdCompact(wl.asking_price_usd)}</span>
                              <ArrowRight size={13} strokeWidth={1.75} className="shrink-0 text-zinc-500" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <AISourceLine source={brief.data.source} className="mt-3 !text-zinc-500" />
              </>
            )}
          </section>
          {marketSize > 0 && (
          <div role="log" aria-label="Index log">
            <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-950 sm:px-5">Index log</p>
            {runs.map((run, i) => (
              <div key={run.run_at}>
                <p className="sticky top-0 z-10 flex justify-between border-b border-zinc-100 bg-white/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 backdrop-blur">
                  <span>{fmtRunDay(run, i)}</span>
                  <span className="font-normal normal-case tracking-normal text-zinc-400">
                    {fmtRunTime(run.run_at)} · {run.listings_checked} listings checked
                  </span>
                </p>
                <ul>
                  {!run.new_listings.length && !run.price_changes.length && !run.status_changes.length && (
                    <li className="px-4 py-2 text-[12px] text-zinc-400">Baseline updated, no changes</li>
                  )}
                  {runMessages(run).map((m) => {
                      if (m.kind === "run") return null;
                      return (
                        <li key={`${m.kind}-${m.l.listing_id}-${m.kind === "price" ? m.e.date : ""}`} className={m.l.status === "Sold" && m.kind === "status" ? "opacity-90" : ""}>
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
                                <span className="rounded bg-zinc-950 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-lime">NEW</span>
                              ) : m.kind === "status" ? (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                                  style={{ color: STATUS_STYLE[m.l.status].color, background: STATUS_STYLE[m.l.status].bg }}
                                >
                                  {m.l.status === "Sold" ? "SOLD" : m.l.status === "De-listed" ? "DE-LISTED" : "CONTRACT"}
                                </span>
                              ) : (
                                <PriceMove pct={m.e.change_pct ?? 0} label={false} />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-zinc-950">{m.l.asset_name}</span>
                              <span className="block truncate text-[11px] text-zinc-500">
                                {typeLine(m.l)} · {m.l.district} · {m.l.tenure ?? TENURE_NOT_STATED}
                              </span>
                            </span>
                            <span className={`${MONO} shrink-0 text-right`}>
                              {m.kind === "new" || m.kind === "status" ? (
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
          )}
          </div>
          {latest.new_listings.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onShowNew();
                onToggle();
              }}
              className="flex w-full items-center justify-center gap-2 border-t border-zinc-200 bg-zinc-950 px-3 py-2.5 text-[12px] font-medium text-lime transition-colors hover:bg-zinc-800"
            >
              Show the {latest.new_listings.length} new listings
              <ArrowRight size={13} strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

const SLUG_TAB = {
  ...(Object.fromEntries(Object.entries(TAB_SLUG).map(([t, s]) => [s, t])) as Record<string, Tab>),
  feed: "Market feed", // the tab was called Feed, then Deals; keep old links working
  deals: "Market feed",
} as Record<string, Tab>;

function Dashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, ready } = useUser();
  // Baseline is for members: once accounts are live, signed-out visitors go to log in.
  // (Until then the dashboard stays open as the demo.)
  const locked = authConfigured && ready && !user;
  useEffect(() => {
    if (locked) router.replace("/login?next=terminal");
  }, [locked, router]);
  const [tab, setTabState] = useState<Tab>(SLUG_TAB[params.get("tab") ?? ""] ?? "Listings");
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
  // The market is asked for in pieces (lib/market-api.ts): the Listings tab loads its own
  // pins and pages; here only what the other parts need.
  const { recent, error } = useRecentActivity(7);
  const me = useProfile();
  // Listings agents added by hand: Off-market ones for every member, Only me ones for their agent.
  const agentListings = useAgentListings(me.profile);
  const memberListings = useMemo(
    () => agentListings.rows.map((r) => agentRowToListing(r, agentListings.myId)),
    [agentListings.rows, agentListings.myId],
  );
  const { entries: watchEntries } = useWatchlist();
  const watchRefs = useMemo(() => watchEntries.map((e) => e.id), [watchEntries]);
  const { byRef: watchedById, loading: watchedLoading } = useListingsByRef(watchRefs);
  const watched = useMemo(() => {
    const members = new Map(memberListings.map((l) => [l.listing_id, l]));
    return watchRefs.map((r) => watchedById.get(r) ?? members.get(r)).filter((l): l is Listing => Boolean(l));
  }, [watchRefs, watchedById, memberListings]);
  // Every listing this page knows about: what the updates board, the Watchlist, the Market feed and the flag notice may name.
  const known = useMemo(() => {
    const m = new Map<string, Listing>();
    for (const l of [...(recent?.listings ?? []), ...watched, ...memberListings]) m.set(l.listing_id, l);
    return [...m.values()];
  }, [recent, watched, memberListings]);
  useEffect(() => publishMarket(known, "dashboard"), [known]);
  const updatedAt = recent?.updatedAt ?? null;
  const marketSize = (recent?.total ?? 0) + memberListings.length;
  // Daily summaries (new, price moves, status changes) for the last 7 days. Listings outside
  // `recent` were all first seen before the window, so they count as checked every day.
  const runs = useMemo(
    () =>
      buildIndexRuns(recent?.listings ?? [], [], 7, updatedAt ?? new Date().toISOString(), Math.max(0, (recent?.total ?? 0) - (recent?.listings.length ?? 0))),
    [recent, updatedAt],
  );
  const updatesToday = runs[0].new_listings.length + runs[0].price_changes.length + runs[0].status_changes.length;
  const [listingDialog, setListingDialog] = useState<{ open: boolean; id?: string }>({ open: false });
  const watchCount = watchEntries.length;
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, "", `?tab=${TAB_SLUG[t]}`);
    window.scrollTo({ top: 0 });
  }, []);
  const openProfile = useCallback(() => setTab("Settings"), [setTab]);
  const openListing = (id: string) => {
    setListingsView((v) => ({ key: v.key + 1, openId: id }));
    setTabState("Listings");
    window.history.replaceState(null, "", "?tab=listings");
  };
  const showNewToday = () => {
    setListingsView((v) => ({ key: v.key + 1, newToday: true }));
    window.history.replaceState(null, "", "?tab=listings");
  };
  const listingActions = useMemo(
    () => ({
      add: () => setListingDialog({ open: true }),
      edit: (id: string) => setListingDialog({ open: true, id }),
      openListing: (ref: string) => {
        setListingsView((v) => ({ key: v.key + 1, openId: ref }));
        setTabState("Listings");
      },
    }),
    [],
  );
  const openUpdates = () => {
    setBoardOpen(true);
    setTabState("Listings");
    requestAnimationFrame(() => document.getElementById("terminal-updates")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (authConfigured && (!ready || locked))
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <span className="size-5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" aria-label="Loading" />
      </div>
    );

  return (
    <MemberListingActions.Provider value={listingActions}>
    <div className={`${inter.className} min-h-screen overflow-x-clip bg-white text-zinc-800 antialiased selection:bg-lime selection:text-zinc-950`}>
      <Header tab={tab} onTab={setTab} updates={updatesToday} onUpdates={openUpdates} watchCount={watchCount} onProfile={openProfile} updatedAt={updatedAt} />

      <main className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
        {error ? (
          <div className={`${MONO} py-24 text-center text-[12px]`} style={{ color: C.down }}>
            FEED ERROR — {error}
          </div>
        ) : tab === "Listings" ? (
          <>
            <TerminalUpdates runs={runs} allListings={known} marketSize={marketSize} open={boardOpen} onToggle={toggleBoard} onOpenListing={openListing} onShowNew={showNewToday} />
            <ActiveListings
              key={listingsView.key}
              members={memberListings}
              watched={watched}
              initialDistrict={listingsView.district}
              initialQuery={listingsView.query}
              initialOpenId={listingsView.openId}
              initialNewToday={listingsView.newToday}
              onExitTo={(t) => setTab(t)}
            />
          </>
        ) : tab === "Market feed" ? (
          <FeedView profile={me.profile} profileLoading={me.loading} shared={me.shared} onEditProfile={openProfile} onOpenListing={openListing} />
        ) : tab === "Pro" ? (
          <ProView />
        ) : tab === "Settings" ? (
          <SettingsView profile={{ draft: me.draft, loading: me.loading }} onSaveProfile={me.save} shared={me.shared} />
        ) : (
          <Watchlist listings={watchedLoading && !watched.length && watchRefs.length ? undefined : watched} runs={runs} onOpenListing={openListing} onBrowse={() => setTab("Listings")} />
        )}
      </main>

      <FlagToast listings={known} />

      <AddListingDialog
        open={listingDialog.open}
        onClose={() => setListingDialog({ open: false })}
        editing={listingDialog.id ? agentListings.byId.get(listingDialog.id) : undefined}
        listings={known}
        onSave={agentListings.save}
        onDelete={agentListings.remove}
        onOpenListing={openListing}
      />

      <footer className="border-t border-zinc-200">
        <div className={`${MONO} mx-auto flex max-w-[1400px] flex-wrap justify-between gap-2 px-6 py-5 text-[10px] tracking-wider text-zinc-500`}>
          <span>© 2026 BASELINE · POWERED BY SEQUENCE DATA · PROPRIETARY & CONFIDENTIAL</span>
          <span>NOT INVESTMENT ADVICE · FOR LICENSED SUBSCRIBERS ONLY</span>
        </div>
      </footer>
    </div>
    </MemberListingActions.Provider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <Dashboard />
    </Suspense>
  );
}
