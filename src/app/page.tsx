import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, Calculator, Download, Map as MapIcon, Search } from "lucide-react";
import { SequenceLogo, Wordmark } from "@/components/logo";
import { HeroMap } from "@/components/landing/hero-map";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import {
  ALL_LISTINGS,
  ARUBA_PHOTOS,
  DISTRICTS,
  MOCK_SNAPSHOT,
  VILLA_PHOTOS,
  estimateRevenue,
  type Listing,
  type Signal,
} from "@/lib/aruba-data";

/* ─────────────────────────────────────────────────────────────────────────
 * Sequence Data — landing page.
 * Every number is read from src/lib/aruba-data.ts, the same source as the
 * dashboard. Photos are Unsplash placeholders until real listing photos.
 * ──────────────────────────────────────────────────────────────────────── */

const DASHBOARD = "/dashboard";
const UP = "#3F7A55";
const DOWN = "#A05A5D";
const SIGNAL: Record<Signal, { label: string; color: string; bg: string }> = {
  UNDERVALUED: { label: "Undervalued", color: UP, bg: "#E8F1EB" },
  AT_MARKET: { label: "At Market", color: "#3F3F46", bg: "#F1F1F3" },
  OVERPRICED: { label: "Overpriced", color: DOWN, bg: "#F6ECEC" },
};

/* ── derived figures ─────────────────────────────────────────────────── */

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const usdM = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : usd(n));
const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;
const img = (url: string, w: number, h: number) => `${url}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const LAND = ALL_LISTINGS.filter((l) => l.category === "Land");
const PROPERTIES = ALL_LISTINGS.filter((l) => l.category === "Property");
const NEW_THIS_WEEK = ALL_LISTINGS.filter((l) => l.days_on_market <= 7).length;
const UNDERVALUED = ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED").length;
const RENTALS_TRACKED = DISTRICTS.reduce((a, d) => a + d.rentals_tracked, 0);
const NEWEST = [...ALL_LISTINGS].sort((a, b) => a.days_on_market - b.days_on_market).slice(0, 6);
const TOP_DISTRICTS = DISTRICTS.slice(0, 6);
const FEATURED = ALL_LISTINGS.find((l) => l.listing_id === "AW-0412") ?? ALL_LISTINGS[0];
const NEW_PICK = NEWEST.find((l) => l.category === "Property") ?? NEWEST[0];

const EXAMPLE_INPUT = {
  district: "Malmok",
  property_type: "Villa" as const,
  bedrooms: 5,
  bathrooms: 5.5,
  beachfront: true,
  asking_price_usd: 8_500_000,
};
const EXAMPLE = estimateRevenue(EXAMPLE_INPUT);
const EXAMPLE_MAX = Math.max(...EXAMPLE.monthly.map((m) => m.revenue_usd));

const TICKER: Array<[string, string, number | null]> = [
  ["For sale", String(ALL_LISTINGS.length), null],
  ["New this week", String(NEW_THIS_WEEK), null],
  ["Median ask", usdM(median(ALL_LISTINGS.map((l) => l.asking_price_usd))), null],
  ["Land parcels", String(LAND.length), null],
  ["Undervalued", String(UNDERVALUED), null],
  ["Rental occupancy", `${MOCK_SNAPSHOT.avg_occupancy_pct}%`, MOCK_SNAPSHOT.avg_occupancy_yoy_pct],
  ["Nightly rate", usd(MOCK_SNAPSHOT.avg_daily_rate_usd), MOCK_SNAPSHOT.avg_daily_rate_yoy_pct],
  ["Gross yield", `${MOCK_SNAPSHOT.est_gross_yield_pct}%`, MOCK_SNAPSHOT.est_gross_yield_yoy_pct],
  ...TOP_DISTRICTS.slice(0, 3).map((d): [string, string, number | null] => [`${d.district} score`, String(d.score), d.revpar_yoy_pct]),
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: `${SITE_NAME} Aruba Real Estate Market Intelligence`,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  brand: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, email: CONTACT_EMAIL },
  offers: {
    "@type": "Offer",
    price: "150",
    priceCurrency: "USD",
    priceSpecification: { "@type": "UnitPriceSpecification", price: "150", priceCurrency: "USD", unitText: "MONTH" },
  },
};

/* ── building blocks ─────────────────────────────────────────────────── */

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`font-display text-[12px] font-semibold uppercase tracking-[0.14em] ${light ? "text-zinc-400" : "text-zinc-500"}`}>
      {children}
    </p>
  );
}

function PrimaryCta({ href = DASHBOARD, children, light }: { href?: string; children: React.ReactNode; light?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 font-display text-[14px] font-semibold transition-colors ${
        light ? "bg-mint text-zinc-950 hover:bg-white" : "bg-zinc-950 text-mint hover:bg-zinc-800"
      }`}
    >
      {children}
      <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SignalPill({ signal }: { signal: Signal }) {
  const s = SIGNAL[signal];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function Photo({ src, alt, w, h, className = "" }: { src: string; alt: string; w: number; h: number; className?: string }) {
  return (
    <Image src={img(src, w * 2, h * 2)} alt={alt} width={w} height={h} unoptimized className={`bg-zinc-100 object-cover ${className}`} />
  );
}

function SectionHeading({ eyebrow, title, body, light }: { eyebrow: string; title: string; body?: string; light?: boolean }) {
  return (
    <div>
      <Eyebrow light={light}>{eyebrow}</Eyebrow>
      <h2
        className={`mt-4 max-w-[20ch] font-display text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[44px] ${light ? "text-white" : "text-zinc-950"}`}
      >
        {title}
      </h2>
      {body && <p className={`mt-5 max-w-[56ch] text-[16px] leading-relaxed ${light ? "text-zinc-300" : "text-zinc-600"}`}>{body}</p>}
    </div>
  );
}

function Bullets({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="mt-10 space-y-6">
      {items.map(([k, v]) => (
        <div key={k} className="flex gap-4">
          <span className="mt-2 size-2 shrink-0 rounded-full bg-zinc-950" />
          <div>
            <dt className="font-display text-[15px] font-semibold text-zinc-950">{k}</dt>
            <dd className="mt-1 text-[14px] leading-relaxed text-zinc-600">{v}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function ListingCard({ l }: { l: Listing }) {
  return (
    <Link
      href={`${DASHBOARD}?q=${l.listing_id}`}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
    >
      <div className="relative">
        {l.photo_url && <Photo src={l.photo_url} alt={l.asset_name} w={400} h={250} className="h-[170px] w-full" />}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-zinc-900">{l.property_type}</span>
          {l.days_on_market <= 7 && <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white">New</span>}
        </div>
      </div>
      <div className="p-4">
        <p className="font-display text-[15px] font-semibold leading-snug text-zinc-950">{l.asset_name}</p>
        <p className="mt-0.5 text-[12px] text-zinc-500">{l.district}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="font-display text-[17px] font-bold tabular-nums text-zinc-950">{usdM(l.asking_price_usd)}</p>
            <p className="text-[11px] text-zinc-500">Asking price</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[17px] font-bold tabular-nums text-zinc-950">
              {l.category === "Property" ? `${l.projected_gross_yield_pct.toFixed(1)}%` : `$${l.price_per_sqft_usd}`}
            </p>
            <p className="text-[11px] text-zinc-500">{l.category === "Property" ? "Rental yield" : "Per sq ft"}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
          <SignalPill signal={l.signal} />
          <span className="text-[11px] tabular-nums text-zinc-400">{l.days_on_market} days listed</span>
        </div>
      </div>
    </Link>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */

export default function Home() {
  const tickerItems = [...TICKER, ...TICKER];

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-800 antialiased selection:bg-mint selection:text-zinc-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <header className="sticky top-0 z-[1000] border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6">
          <Link href="/" aria-label="Sequence Data home">
            <Wordmark tagline />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["Listings", "#listings"],
              ["Districts", "#districts"],
              ["Revenue Estimator", "#estimator"],
              ["Pricing", "#pricing"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-[14px] font-medium text-zinc-600 transition-colors hover:text-zinc-950">
                {label}
              </a>
            ))}
          </nav>
          <Link
            href={DASHBOARD}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2 font-display text-[13px] font-semibold text-mint transition-colors hover:bg-zinc-800"
          >
            <span className="hidden sm:inline">Open </span>Dashboard
            <ArrowUpRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-mint to-white">
          <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1fr_1.05fr] lg:pt-20">
            <div>
              <Eyebrow>Aruba · Updated daily</Eyebrow>
              <h1 className="mt-5 font-display text-[44px] font-bold leading-[1.02] tracking-tight text-zinc-950 sm:text-[62px]">
                Aruba Real Estate Market Intelligence
              </h1>
              <p className="mt-6 max-w-[50ch] text-[17px] leading-relaxed text-zinc-600">
                We scrape every high-value property and land listing in Aruba every day, plus vacation-rental data, and show
                you what is for sale, what it would earn, and whether the price is right.
              </p>

              <div className="mt-9 max-w-[540px] rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-900/5">
                <form action={DASHBOARD} method="get" className="flex items-center">
                  <label className="flex flex-1 items-center gap-3 px-3">
                    <Search size={18} strokeWidth={2} className="shrink-0 text-zinc-400" />
                    <span className="sr-only">Search listings</span>
                    <input
                      name="q"
                      placeholder="Search a district, property or listing ID"
                      className="w-full bg-transparent py-3 text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400"
                    />
                  </label>
                  <button type="submit" className="rounded-xl bg-zinc-950 px-5 py-3 font-display text-[14px] font-semibold text-mint hover:bg-zinc-800">
                    Search
                  </button>
                </form>
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-zinc-100 px-1 pt-2">
                  {[
                    { icon: Building2, label: "Browse listings", href: DASHBOARD },
                    { icon: MapIcon, label: "Compare districts", href: `${DASHBOARD}?tab=districts` },
                    { icon: Calculator, label: "Estimate revenue", href: `${DASHBOARD}?tab=estimator` },
                  ].map(({ icon: Icon, label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
              <p className="mt-5 text-[14px] text-zinc-500">Built for real estate agents and investors in Aruba.</p>
            </div>

            {/* Map visual with floating cards */}
            <div className="relative">
              <div className="overflow-hidden rounded-3xl border border-zinc-200 shadow-2xl shadow-zinc-900/10">
                <HeroMap listings={ALL_LISTINGS} height={520} />
              </div>

              <Link
                href={`${DASHBOARD}?q=${FEATURED.listing_id}`}
                className="absolute -right-2 top-8 z-[500] flex w-[280px] items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl sm:-right-6"
              >
                {FEATURED.photo_url && <Photo src={FEATURED.photo_url} alt={FEATURED.asset_name} w={64} h={64} className="size-16 rounded-xl" />}
                <div className="min-w-0">
                  <p className="truncate font-display text-[14px] font-semibold text-zinc-950">{FEATURED.asset_name}</p>
                  <p className="text-[12px] text-zinc-500">{FEATURED.district}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="font-display text-[14px] font-bold tabular-nums">{usdM(FEATURED.asking_price_usd)}</span>
                    <SignalPill signal={FEATURED.signal} />
                  </div>
                </div>
              </Link>

              {FEATURED.category === "Property" && (
                <div className="absolute -right-2 bottom-20 z-[500] w-[210px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:-right-6">
                  <p className="text-[12px] font-medium text-zinc-500">Projected revenue</p>
                  <p className="mt-1 font-display text-[28px] font-bold tabular-nums leading-none text-zinc-950">
                    {usdM(FEATURED.projected_annual_revenue_usd)}
                    <span className="text-[13px] font-semibold text-zinc-400">/yr</span>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
                    <div>
                      <p className="font-display text-[15px] font-bold tabular-nums">{FEATURED.projected_occupancy_pct}%</p>
                      <p className="text-[11px] text-zinc-500">Occupancy</p>
                    </div>
                    <div>
                      <p className="font-display text-[15px] font-bold tabular-nums">{usd(FEATURED.sequence_adr_usd)}</p>
                      <p className="text-[11px] text-zinc-500">Per night</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-6 left-6 z-[500] flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-[13px] font-semibold text-white shadow-lg">
                <span className="size-2 rounded-full bg-mint" />
                {UNDERVALUED} undervalued listings today
              </div>
            </div>
          </div>
        </section>

        {/* Stats band */}
        <section className="bg-zinc-950 text-white">
          <dl className="mx-auto grid max-w-[1240px] grid-cols-2 gap-y-10 px-6 py-14 lg:grid-cols-4">
            {[
              [String(ALL_LISTINGS.length), "Listings for sale"],
              [String(LAND.length), "Land parcels"],
              [String(RENTALS_TRACKED), "Rentals tracked"],
              [String(DISTRICTS.length), "Districts covered"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-[48px] font-bold leading-none tabular-nums text-mint sm:text-[60px]">{v}</dt>
                <dd className="mt-2 text-[14px] text-zinc-400">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Ticker */}
        <div className="overflow-hidden border-b border-mint-deep bg-mint-soft">
          <div className="flex w-max animate-[ticker_52s_linear_infinite] gap-10 whitespace-nowrap py-3.5 motion-reduce:animate-none">
            {tickerItems.map(([k, v, d], i) => (
              <span key={i} className="text-[13px] text-zinc-500">
                {k} <span className="font-semibold tabular-nums text-zinc-950">{v}</span>
                {d !== null && (
                  <span className="ml-1 font-semibold tabular-nums" style={{ color: d >= 0 ? UP : DOWN }}>
                    {pct(d)}
                  </span>
                )}
              </span>
            ))}
          </div>
          <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
        </div>

        {/* Overview bento */}
        <section className="mx-auto max-w-[1240px] px-6 py-24">
          <div className="text-center">
            <Eyebrow>The Sequence Data platform</Eyebrow>
            <h2 className="mx-auto mt-4 max-w-[22ch] font-display text-[34px] font-bold leading-[1.08] tracking-tight text-zinc-950 sm:text-[44px]">
              From first look to final offer
            </h2>
            <p className="mx-auto mt-5 max-w-[60ch] text-[16px] leading-relaxed text-zinc-600">
              Everything you need to find, check and price high-value real estate in Aruba, in one dashboard.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {/* Find */}
            <a href="#listings" className="group overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft transition-shadow hover:shadow-xl">
              <div className="relative h-[240px] overflow-hidden">
                <Photo src={NEW_PICK.photo_url ?? VILLA_PHOTOS[3]} alt={NEW_PICK.asset_name} w={620} h={240} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                <div className="absolute bottom-4 left-4 rounded-2xl bg-white p-3 shadow-lg">
                  <p className="text-[11px] font-medium text-zinc-500">New listing · {NEW_PICK.district}</p>
                  <p className="font-display text-[18px] font-bold tabular-nums">{usdM(NEW_PICK.asking_price_usd)}</p>
                </div>
                <div className="absolute right-4 top-4"><SignalPill signal={NEW_PICK.signal} /></div>
              </div>
              <div className="p-7">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-mint-deep">Find</span>
                <p className="mt-4 font-display text-[22px] font-bold text-zinc-950">Every listing, every day</p>
                <p className="mt-1 text-[14px] text-zinc-600">Homes, villas and land for sale across Aruba, with a deal signal on each.</p>
              </div>
            </a>

            {/* Research */}
            <a href="#districts" className="group overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft transition-shadow hover:shadow-xl">
              <div className="h-[240px] bg-white p-6">
                <p className="text-[12px] font-semibold text-zinc-500">District ranking</p>
                <div className="mt-4 space-y-3.5">
                  {DISTRICTS.slice(0, 5).map((d) => (
                    <div key={d.district} className="flex items-center gap-3">
                      <span className="w-28 truncate text-[13px] font-medium text-zinc-800">{d.district}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <span className="block h-full rounded-full bg-zinc-950" style={{ width: `${d.score}%` }} />
                      </span>
                      <span className="w-7 text-right font-display text-[14px] font-bold tabular-nums">{d.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-7">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-mint-deep">Research</span>
                <p className="mt-4 font-display text-[22px] font-bold text-zinc-950">Know where to buy</p>
                <p className="mt-1 text-[14px] text-zinc-600">Every district scored on rental demand, growth, value and competition.</p>
              </div>
            </a>

            {/* Validate */}
            <a href="#estimator" className="group overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft transition-shadow hover:shadow-xl">
              <div className="relative h-[240px] overflow-hidden">
                <Photo src={VILLA_PHOTOS[12]} alt="Villa with pool" w={620} h={240} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                <div className="absolute right-4 top-4 w-[190px] rounded-2xl bg-white p-4 shadow-lg">
                  <p className="text-[11px] font-medium text-zinc-500">Projected revenue</p>
                  <p className="font-display text-[22px] font-bold tabular-nums">{usdM(EXAMPLE.annual_revenue_usd)}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {EXAMPLE.occupancy_pct}% occupancy · {usd(EXAMPLE.adr_usd)}/night
                  </p>
                </div>
              </div>
              <div className="p-7">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-mint-deep">Validate</span>
                <p className="mt-4 font-display text-[22px] font-bold text-zinc-950">See what it would earn</p>
                <p className="mt-1 text-[14px] text-zinc-600">Rental income and yield for any property, from comparable rentals.</p>
              </div>
            </a>

            {/* Act */}
            <a href="#pricing" className="group overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft transition-shadow hover:shadow-xl">
              <div className="h-[240px] bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-zinc-500">Undervalued in Aruba</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-semibold text-white">
                    <Download size={12} strokeWidth={2} /> Export CSV
                  </span>
                </div>
                <div className="mt-4 divide-y divide-zinc-100">
                  {ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED")
                    .slice(0, 3)
                    .map((l) => (
                      <div key={l.listing_id} className="flex items-center gap-3 py-2.5">
                        {l.photo_url && <Photo src={l.photo_url} alt={l.asset_name} w={36} h={36} className="size-9 rounded-lg" />}
                        <span className="flex-1 truncate text-[13px] font-medium text-zinc-800">{l.asset_name}</span>
                        <span className="font-display text-[13px] font-bold tabular-nums">{usdM(l.asking_price_usd)}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="p-7">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-mint-deep">Act</span>
                <p className="mt-4 font-display text-[22px] font-bold text-zinc-950">Move before the market</p>
                <p className="mt-1 text-[14px] text-zinc-600">Spot price drops and new deals first, and share them with clients.</p>
              </div>
            </a>
          </div>
        </section>

        {/* 01 Find */}
        <section id="listings" className="scroll-mt-16 bg-mint-soft">
          <div className="mx-auto max-w-[1240px] px-6 py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading
                eyebrow="Step 01 · Find"
                title="Every high-value listing in Aruba, in one place."
                body="Our scrapers pull homes, villas and land for sale from broker, agency, developer and private listings every day, so you see new listings and price drops before everyone else."
              />
              <PrimaryCta>Browse all listings</PrimaryCta>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {NEWEST.map((l) => (
                <ListingCard key={l.listing_id} l={l} />
              ))}
            </div>
            <p className="mt-6 text-[13px] text-zinc-500">
              {PROPERTIES.length} homes and {LAND.length} land parcels for sale right now. Search, filter and sort the full list,
              or see everything on a map.
            </p>
          </div>
        </section>

        {/* 02 Research */}
        <section id="districts" className="scroll-mt-16">
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 px-6 py-24 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="Step 02 · Research"
                title="Know which districts are worth it."
                body="Compare Aruba's districts side by side: how luxury rentals perform there, how fast that is growing, how much new competition is coming, and what is for sale."
              />
              <Bullets
                items={[
                  ["Sequence Score", "One number from 0 to 100 that ranks each district on rental demand, growth, value for buyers and new supply."],
                  ["Rental performance", "Nightly rates, occupancy and revenue per night for luxury rentals in each district."],
                  ["Land prices", "Average price per sq ft of land in each district, so you can spot cheap parcels."],
                ]}
              />
              <div className="mt-10">
                <PrimaryCta href={`${DASHBOARD}?tab=districts`}>Compare districts</PrimaryCta>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {TOP_DISTRICTS.map((d, i) => (
                <Link
                  key={d.district}
                  href={`${DASHBOARD}?tab=listings&district=${encodeURIComponent(d.district)}`}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-[12px] font-bold">#{i + 1}</span>
                    <span className="text-[12px] font-medium text-zinc-500">
                      Score <span className="font-display text-[18px] font-bold tabular-nums text-zinc-950">{d.score}</span>
                    </span>
                  </div>
                  <p className="mt-3 font-display text-[19px] font-bold tracking-tight text-zinc-950">{d.district}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: d.score >= 70 ? UP : d.score >= 50 ? "#52525B" : DOWN }} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-zinc-500">
                    <span>
                      <span className="block font-display text-[14px] font-bold tabular-nums" style={{ color: d.revpar_yoy_pct >= 0 ? UP : DOWN }}>
                        {pct(d.revpar_yoy_pct)}
                      </span>
                      RevPAR YoY
                    </span>
                    <span>
                      <span className="block font-display text-[14px] font-bold tabular-nums text-zinc-950">{d.properties_for_sale + d.land_for_sale}</span>
                      For sale
                    </span>
                    <span>
                      <span className="block font-display text-[14px] font-bold tabular-nums text-zinc-950">{d.occupancy_pct}%</span>
                      Occupancy
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 03 Validate */}
        <section id="estimator" className="scroll-mt-16 bg-mint-soft">
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 px-6 py-24 lg:grid-cols-2">
            <div className="order-2 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 lg:order-1">
              <div className="relative">
                <Photo src={VILLA_PHOTOS[13]} alt="Beachfront villa" w={600} h={220} className="h-[200px] w-full" />
                <div className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-zinc-900">
                  {EXAMPLE_INPUT.bedrooms}-bedroom beachfront villa · {EXAMPLE_INPUT.district}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-4">
                {[
                  ["Yearly revenue", usdM(EXAMPLE.annual_revenue_usd)],
                  ["Nightly rate", usd(EXAMPLE.adr_usd)],
                  ["Occupancy", `${EXAMPLE.occupancy_pct}%`],
                  ["Yield at $8.5M", `${EXAMPLE.gross_yield_pct?.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white px-5 py-4">
                    <p className="text-[11px] font-medium text-zinc-500">{k}</p>
                    <p className="mt-1 font-display text-[20px] font-bold tabular-nums text-zinc-950">{v}</p>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-5 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-zinc-500">Revenue by month</span>
                  {EXAMPLE.signal && <SignalPill signal={EXAMPLE.signal} />}
                </div>
                <div className="flex h-28 items-end gap-1.5">
                  {EXAMPLE.monthly.map((m) => (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="w-full rounded-t-md bg-zinc-950" style={{ height: `${(m.revenue_usd / EXAMPLE_MAX) * 96}px` }} />
                      <span className="text-[10px] text-zinc-400">
                        {new Date(`${m.month}T00:00:00Z`).toLocaleString("en-US", { month: "narrow", timeZone: "UTC" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <SectionHeading
                eyebrow="Step 03 · Validate"
                title="See what any property could earn."
                body="Found a villa you like? Describe it and the Revenue Estimator shows what it would earn as a luxury vacation rental, based on comparable rentals in the same district."
              />
              <Bullets
                items={[
                  ["Yearly revenue", "Estimated revenue with a low and high range, plus nightly rate and occupancy."],
                  ["Month by month", "See how high and low season change the income through the year."],
                  ["One click from a listing", "Open any listing in the estimator with its details already filled in."],
                ]}
              />
              <div className="mt-10">
                <PrimaryCta href={`${DASHBOARD}?tab=estimator`}>Estimate a property</PrimaryCta>
              </div>
            </div>
          </div>
        </section>

        {/* 04 Who it's for */}
        <section className="relative overflow-hidden bg-zinc-950 text-white">
          <Image src={img(ARUBA_PHOTOS.aerial, 1800, 900)} alt="" fill unoptimized className="object-cover opacity-25" />
          <div className="relative mx-auto max-w-[1240px] px-6 py-24">
            <SectionHeading eyebrow="Step 04 · Act" title="Built for the people who move Aruba's market." light />
            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {[
                {
                  who: "Real estate agents",
                  points: [
                    "Price new listings with data on what similar homes and land are asking",
                    "Show buyers what a villa would earn as a rental",
                    "Spot new listings and price drops the day they happen",
                    "Export any list to CSV for your clients",
                  ],
                },
                {
                  who: "Investors",
                  points: [
                    "Find undervalued homes and land before they are gone",
                    "Compare districts on rental demand, growth and competition",
                    "Check the yield on any property before you make an offer",
                    "Track how long listings sit and when sellers cut prices",
                  ],
                },
              ].map((c) => (
                <div key={c.who} className="rounded-3xl border border-white/10 bg-zinc-950/70 p-8 backdrop-blur sm:p-10">
                  <p className="font-display text-[24px] font-bold">{c.who}</p>
                  <ul className="mt-6 space-y-3.5">
                    {c.points.map((p) => (
                      <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-zinc-200">
                        <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-white" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How we score */}
        <section id="methodology" className="mx-auto max-w-[1240px] scroll-mt-16 px-6 py-24">
          <SectionHeading eyebrow="How we score" title="Simple math. Data nobody else has." />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 p-8 sm:p-10">
              <p className="font-display text-[20px] font-bold text-zinc-950">Homes and villas</p>
              <p className="mt-5 rounded-xl bg-mint-soft px-5 py-4 font-display text-[16px] font-semibold leading-relaxed text-zinc-950">
                Yield = Nightly rate × 365 × Occupancy ÷ Asking price
              </p>
              <p className="mt-5 text-[14px] leading-relaxed text-zinc-600">
                Nightly rate and occupancy come from comparable luxury rentals in the same district. 1 point or more above the
                Aruba average ({MOCK_SNAPSHOT.est_gross_yield_pct}%) is Undervalued; 1 point or more below is Overpriced.
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-200 p-8 sm:p-10">
              <p className="font-display text-[20px] font-bold text-zinc-950">Land</p>
              <p className="mt-5 rounded-xl bg-mint-soft px-5 py-4 font-display text-[16px] font-semibold leading-relaxed text-zinc-950">
                Price per sq ft vs. district average
              </p>
              <p className="mt-5 text-[14px] leading-relaxed text-zinc-600">
                10% or more below the district&apos;s average land price is Undervalued; 10% or more above is Overpriced.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-16 bg-mint-soft">
          <div className="mx-auto max-w-[1240px] px-6 py-24">
            <div className="text-center">
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="mt-4 font-display text-[34px] font-bold tracking-tight text-zinc-950 sm:text-[44px]">One plan. The whole market.</h2>
            </div>
            <div className="mx-auto mt-12 grid max-w-[1000px] gap-5 lg:grid-cols-[1.35fr_1fr]">
              <div className="rounded-3xl border-2 border-zinc-950 bg-white p-8 shadow-xl shadow-zinc-900/5 sm:p-10">
                <p className="font-display text-[18px] font-bold text-zinc-950">Aruba</p>
                <p className="mt-4 font-display text-[56px] font-bold leading-none tracking-tight tabular-nums text-zinc-950">
                  $150<span className="ml-1 text-[16px] font-semibold text-zinc-500">/month</span>
                </p>
                <ul className="mt-8 space-y-3">
                  {[
                    "Every high-value property and land listing, updated daily",
                    "Deal signals on every listing",
                    "List and map views with search and filters",
                    "District rankings with Sequence Score",
                    "Revenue Estimator for any property",
                    "Rental market dashboard and 12-month trends",
                    "Export to CSV · cancel anytime",
                  ].map((f) => (
                    <li key={f} className="flex gap-3 text-[14px] text-zinc-700">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-zinc-950" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <PrimaryCta>Open the Dashboard</PrimaryCta>
                </div>
              </div>
              <div className="flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-8 sm:p-10">
                <div>
                  <p className="font-display text-[18px] font-bold text-zinc-950">Teams &amp; data access</p>
                  <p className="mt-4 font-display text-[40px] font-bold leading-none text-zinc-950">Custom</p>
                  <p className="mt-5 text-[14px] leading-relaxed text-zinc-600">
                    Multiple seats for a brokerage, raw data by API or CSV, and custom reports.
                  </p>
                </div>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Sequence%20Labs%20Team%20Access`}
                  className="mt-8 inline-flex items-center gap-2 self-start rounded-full border-2 border-zinc-950 px-5 py-3 font-display text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-950 hover:text-white"
                >
                  Contact us <ArrowUpRight size={15} strokeWidth={2} />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden bg-zinc-950">
          <Image src={img(ARUBA_PHOTOS.beach, 1800, 800)} alt="" fill unoptimized className="object-cover opacity-40" />
          <div className="relative mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-10 px-6 py-24 md:flex-row md:items-center">
            <SequenceLogo tone="white" className="hidden h-56 w-auto shrink-0 opacity-95 lg:block" />
            <div className="md:flex-1">
              <p className="flex items-center gap-2.5 text-[14px] font-semibold text-white/80">
                <span className="size-2 rounded-full bg-mint" />
                {NEW_THIS_WEEK} new listings this week
              </p>
              <h2 className="mt-5 max-w-[18ch] font-display text-[38px] font-bold leading-[1.05] tracking-tight text-white sm:text-[52px]">
                See the market before the market does.
              </h2>
            </div>
            <PrimaryCta light>Open the Dashboard</PrimaryCta>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <Wordmark tagline />
          <p className="max-w-[64ch] text-[12px] leading-relaxed text-zinc-500 md:text-right">
            © 2026 Sequence Data · Oranjestad, Aruba · {CONTACT_EMAIL}
            <br />
            Data is for information only and is not investment advice. Photos: Unsplash.
          </p>
        </div>
      </footer>
    </div>
  );
}
