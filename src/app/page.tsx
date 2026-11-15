import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BedDouble, Building2, Calculator, Download, Map as MapIcon, Search } from "lucide-react";
import { SequenceLogo, Wordmark } from "@/components/logo";
import { TerminalPreview, type PreviewData } from "@/components/landing/terminal-preview";
import { CountUp, MotionRoot, Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { DISTRICT_METRICS, ROPV_ZONES, rampColor } from "@/components/dashboard/district-map-shared";
import { DISTRICT_SHAPES, ZONING_SHAPES, SVG_H, project } from "@/lib/svg-geo";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import {
  ALL_LISTINGS,
  ARUBA_PHOTOS,
  DISTRICTS,
  MOCK_SNAPSHOT,
  SCRAPE_RUNS,
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
const COMMERCIAL_COUNT = ALL_LISTINGS.filter((l) => l.category === "Commercial").length;
const PROPERTIES = ALL_LISTINGS.filter((l) => l.category === "Property");
const NEW_THIS_WEEK = ALL_LISTINGS.filter((l) => l.days_on_market <= 7).length;
const UNDERVALUED = ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED").length;
const RENTALS_TRACKED = DISTRICTS.reduce((a, d) => a + d.rentals_tracked, 0);
const NEWEST = [...ALL_LISTINGS].sort((a, b) => a.days_on_market - b.days_on_market).slice(0, 6);
const TOP_DISTRICTS = DISTRICTS.slice(0, 6);
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

/* ── Terminal preview (hero) ─────────────────────────────────────────── */

const RUN = SCRAPE_RUNS[0];
const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : `$${Math.round(n / 1000)}k`);
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function previewData(): PreviewData {
  const priceToday = new Map(RUN.price_changes.map((c) => [c.listing.listing_id, c.change.change_pct ?? 0]));
  // A mix that shows every tag: new today, price moved today, under contract / sold, land.
  const pickIds = [
    ...RUN.new_listings.filter((l) => l.category === "Property").slice(0, 2).map((l) => l.listing_id),
    ...RUN.price_changes.slice(0, 2).map((c) => c.listing.listing_id),
    ...RUN.status_changes.slice(0, 1).map((l) => l.listing_id),
    ...ALL_LISTINGS.filter((l) => l.category === "Land").slice(0, 1).map((l) => l.listing_id),
  ];
  const rows = [...new Set(pickIds)]
    .map((id) => ALL_LISTINGS.find((l) => l.listing_id === id))
    .filter((l): l is Listing => Boolean(l))
    .slice(0, 6)
    .map((l) => {
      const pt = priceToday.get(l.listing_id);
      return {
        id: l.listing_id,
        name: l.asset_name,
        district: l.district,
        type: l.category === "Property" ? `${l.bedrooms} bd ${l.property_type}` : l.category === "Land" ? "Land" : "Commercial",
        photo: l.photo_url,
        price: usdShort(l.asking_price_usd),
        changePct: l.price_change_pct,
        isNew: l.is_new,
        priceToday: pt === undefined ? null : pt < 0 ? ("down" as const) : ("up" as const),
        tenure: l.tenure,
        status: l.status,
        agency: { name: l.agency.name, color: l.agency.color },
        agent: l.agent?.name ?? null,
      };
    });

  // Featured listing for the price-history pane: one with a price drop.
  const f = ALL_LISTINGS.find((l) => l.listing_id === "AW-0388") ?? ALL_LISTINGS[0];
  const marketNow =
    f.category === "Property" ? f.projected_annual_revenue_usd / (MOCK_SNAPSHOT.est_gross_yield_pct / 100) : f.asking_price_usd;
  const DAYMS = 86_400_000;
  const today = Date.parse(RUN.date);
  const first = Date.parse(f.price_history[0].date);
  const start = first - 4 * DAYMS;
  const span = today - start;
  const events = f.price_history.map((e) => ({ t: Date.parse(e.date), p: e.price_usd }));
  const steps = 10;
  const market = Array.from({ length: steps + 1 }, (_, i) => {
    const t = start + (span * i) / steps;
    const monthsBack = (today - t) / (30 * DAYMS);
    return { t, p: marketNow / Math.pow(1.004, monthsBack) };
  });
  const all = [...events.map((e) => e.p), ...market.map((m) => m.p)];
  const pad = (Math.max(...all) - Math.min(...all)) * 0.25;
  const lo = Math.min(...all) - pad;
  const hi = Math.max(...all) + pad;
  const nx = (t: number) => (t - start) / span;
  const ny = (p: number) => (p - lo) / (hi - lo);
  const asking: Array<[number, number]> = [
    ...events.map((e) => [nx(e.t), ny(e.p)] as [number, number]),
    [1, ny(events[events.length - 1].p)],
  ];
  const gap = (f.asking_price_usd - marketNow) / marketNow;
  const verdict =
    gap <= -0.03 ? `${Math.abs(gap * 100).toFixed(0)}% below market` : gap >= 0.03 ? `${(gap * 100).toFixed(0)}% above market` : "In line with market";

  // District value map (median asking price)
  const metric = "median_asking_usd" as const;
  const vals = DISTRICTS.map((d) => d[metric]).filter((v): v is number => v !== null);
  const vlo = Math.min(...vals);
  const vhi = Math.max(...vals);
  const byName = Object.fromEntries(DISTRICTS.map((d) => [d.district, d]));
  const ranked = DISTRICTS.filter((d) => d[metric] !== null).sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  const labelled = new Set(["Palm Beach", "Eagle Beach", "Oranjestad", "Savaneta", "Santa Cruz", "Pos Chiquito", "Arashi"]);

  return {
    run: {
      time: `${new Date(RUN.run_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Aruba" })} AST`,
      newCount: RUN.new_listings.length,
      drops: RUN.price_changes.filter((c) => (c.change.change_pct ?? 0) < 0).length,
      ups: RUN.price_changes.filter((c) => (c.change.change_pct ?? 0) > 0).length,
      statusChanges: RUN.status_changes.length,
      checked: RUN.listings_checked,
    },
    rows,
    featured: {
      id: f.listing_id,
      name: f.asset_name,
      district: f.district,
      photo: f.photo_url,
      price: usdShort(f.asking_price_usd),
      tenure: f.tenure,
      agency: { name: f.agency.name, color: f.agency.color },
      agent: f.agent ? { name: f.agent.name, title: f.agent.title } : null,
      asking,
      market: market.map((m) => [nx(m.t), ny(m.p)] as [number, number]),
      askingLabel: usdShort(f.asking_price_usd),
      marketLabel: usdShort(marketNow),
      verdict,
      verdictColor: gap <= -0.03 ? "#2E9E5B" : gap >= 0.03 ? "#D64545" : "#E08A1E",
      events: [...f.price_history]
        .reverse()
        .slice(0, 3)
        .map((e) => ({ date: shortDate(e.date), label: e.event, price: usdShort(e.price_usd), pct: e.change_pct })),
    },
    districts: {
      svgH: SVG_H,
      shapes: DISTRICT_SHAPES.map((sh) => {
        const v = byName[sh.key]?.[metric] ?? null;
        return { ...sh, color: v === null ? "#E4E4E7" : rampColor(vhi === vlo ? 1 : (v - vlo) / (vhi - vlo)) };
      }),
      labels: DISTRICTS.filter((d) => labelled.has(d.district) && d[metric] !== null).map((d) => {
        const [x, y] = project([d.lng, d.lat]);
        return { key: d.district, x, y: y + 3, text: DISTRICT_METRICS[metric].fmt(d[metric] as number) };
      }),
      top: ranked.slice(0, 6).map((d) => ({
        name: d.district,
        value: DISTRICT_METRICS[metric].fmt(d[metric] as number),
        pct: ((d[metric] as number) / vhi) * 100,
      })),
    },
    zoning: {
      svgH: SVG_H,
      shapes: ZONING_SHAPES.map((sh) => ({ ...sh, color: ROPV_ZONES[sh.key]?.color ?? "#ccc" })),
      outlines: ZONING_SHAPES.map((sh) => ({ key: sh.key, d: sh.d })),
      legend: [
        "Toeristisch gebied Westkust",
        "Woongebied met waarden",
        "Stedelijk woongebied",
        "Centrum Oranjestad",
        "Landelijk gebied",
        "Natuur en landschap",
        "Natuurgebied",
        "Luchthaven",
      ].map((z) => ({ en: ROPV_ZONES[z].en, color: ROPV_ZONES[z].color })),
    },
    estimator: {
      title: `${EXAMPLE_INPUT.bedrooms}-bedroom beachfront villa · ${EXAMPLE_INPUT.district} · asking $8.5M`,
      annual: usdM(EXAMPLE.annual_revenue_usd),
      adr: usd(EXAMPLE.adr_usd),
      occ: `${EXAMPLE.occupancy_pct}%`,
      yieldPct: `${EXAMPLE.gross_yield_pct?.toFixed(1)}%`,
      months: EXAMPLE.monthly.map((m) => ({
        m: new Date(`${m.month}T00:00:00Z`).toLocaleString("en-US", { month: "narrow", timeZone: "UTC" }),
        v: m.revenue_usd,
      })),
    },
  };
}

const PREVIEW = previewData();


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
      className={`group inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 font-display text-[14px] font-semibold transition-[background-color,transform] duration-300 active:scale-[0.97] ${
        light ? "bg-mint text-zinc-950 hover:bg-white" : "bg-zinc-950 text-mint hover:bg-zinc-800"
      }`}
    >
      {children}
      <ArrowRight size={16} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-1" />
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
    <Reveal>
      <Eyebrow light={light}>{eyebrow}</Eyebrow>
      <h2
        className={`mt-4 max-w-[20ch] font-display text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[44px] ${light ? "text-white" : "text-zinc-950"}`}
      >
        {title}
      </h2>
      {body && <p className={`mt-5 max-w-[56ch] text-[16px] leading-relaxed ${light ? "text-zinc-300" : "text-zinc-600"}`}>{body}</p>}
    </Reveal>
  );
}

function Bullets({ items }: { items: Array<[string, string]> }) {
  return (
    <Stagger className="mt-10 space-y-6">
      {items.map(([k, v]) => (
        <StaggerItem key={k} className="flex gap-4">
          <span className="mt-2 size-2 shrink-0 rounded-full bg-zinc-950" />
          <div>
            <p className="font-display text-[15px] font-semibold text-zinc-950">{k}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-zinc-600">{v}</p>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function ListingCard({ l }: { l: Listing }) {
  return (
    <Link
      href={`${DASHBOARD}?q=${l.listing_id}`}
      className="lift group block h-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-xl"
    >
      <div className="relative">
        <div className="overflow-hidden">
          {l.photo_url && <Photo src={l.photo_url} alt={l.asset_name} w={400} h={250} className="h-[170px] w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]" />}
        </div>
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-zinc-900">{l.property_type}</span>
          {l.is_new && <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white">New</span>}
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
    <MotionRoot>
    <div className="min-h-screen bg-white font-sans text-zinc-800 antialiased selection:bg-mint selection:text-zinc-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <header className="sticky top-0 z-[1000] border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-6">
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
              <a key={href} href={href} className="link-underline text-[14px] font-medium text-zinc-600 transition-colors hover:text-zinc-950">
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
        <section className="relative overflow-hidden bg-gradient-to-b from-mint via-mint-soft to-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgb(10_10_10/0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
          />
          <div className="relative mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-10 px-5 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12 lg:pt-16">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-zinc-950/10 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-zinc-700 backdrop-blur">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#2E9E5B] opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[#2E9E5B]" />
                </span>
                Terminal updated today · {PREVIEW.run.newCount} new listings
              </p>
              <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.02] tracking-tight text-zinc-950 sm:text-[56px] lg:text-[60px]">
                Aruba Real Estate Market Intelligence
              </h1>
              <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-zinc-600 sm:text-[17px]">
                Every property, land and commercial listing in Aruba, scraped daily, with price history, the agent
                handling it, district values, ROPV zoning and what each home would earn as a vacation rental.
              </p>

              <div className="mt-8 max-w-[540px] rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-900/5">
                <form action={DASHBOARD} method="get" className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-3 pl-3">
                    <Search size={18} strokeWidth={2} className="shrink-0 text-zinc-400" />
                    <span className="sr-only">Search listings</span>
                    <input
                      name="q"
                      placeholder="District, property or listing ID"
                      className="w-full min-w-0 bg-transparent py-3 text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400"
                    />
                  </label>
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl bg-zinc-950 px-4 py-3 font-display text-[14px] font-semibold text-mint transition-colors hover:bg-zinc-800 sm:px-5"
                  >
                    Search
                  </button>
                </form>
                <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto border-t border-zinc-100 px-1 pt-2">
                  {[
                    { icon: Building2, label: "Listings", href: DASHBOARD },
                    { icon: MapIcon, label: "Districts", href: `${DASHBOARD}?tab=districts` },
                    { icon: BedDouble, label: "Rentals", href: `${DASHBOARD}?tab=listings&view=rentals` },
                    { icon: Calculator, label: "Estimator", href: `${DASHBOARD}?tab=estimator` },
                  ].map(({ icon: Icon, label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
              <dl className="mt-8 grid max-w-[540px] grid-cols-3 gap-4 border-t border-zinc-950/10 pt-6">
                {[
                  [ALL_LISTINGS.length, "Listings for sale"],
                  [RENTALS_TRACKED, "Rentals tracked"],
                  [DISTRICTS.length, "Districts scored"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt className="font-display text-[26px] font-bold leading-none text-zinc-950 sm:text-[30px]">
                      <CountUp value={Number(v)} />
                    </dt>
                    <dd className="mt-1.5 text-[12px] text-zinc-500">{l}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={0.12} y={24} className="min-w-0">
              <TerminalPreview data={PREVIEW} />
            </Reveal>
          </div>
        </section>

        {/* Stats band */}
        <section className="bg-zinc-950 text-white">
          <dl className="mx-auto grid max-w-[1240px] grid-cols-2 gap-x-6 gap-y-10 px-5 py-12 sm:px-6 sm:py-14 lg:grid-cols-4">
            {[
              [PREVIEW.run.checked, "Listings checked today"],
              [LAND.length, "Land parcels"],
              [PREVIEW.run.newCount + PREVIEW.run.drops + PREVIEW.run.ups + PREVIEW.run.statusChanges, "Market moves today"],
              [ZONING_SHAPES.length, "ROPV zone types mapped"],
            ].map(([v, l]) => (
              <div key={String(l)}>
                <dt className="font-display text-[44px] font-bold leading-none text-mint sm:text-[60px]">
                  <CountUp value={Number(v)} />
                </dt>
                <dd className="mt-2 text-[13px] text-zinc-400 sm:text-[14px]">{l}</dd>
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
        <section className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
          <Reveal className="text-center">
            <Eyebrow>The Sequence Data platform</Eyebrow>
            <h2 className="mx-auto mt-4 max-w-[22ch] font-display text-[30px] font-bold leading-[1.08] tracking-tight text-zinc-950 sm:text-[44px]">
              From first look to final offer
            </h2>
            <p className="mx-auto mt-5 max-w-[60ch] text-[16px] leading-relaxed text-zinc-600">
              Everything you need to find, check and price high-value real estate in Aruba, in one dashboard.
            </p>
          </Reveal>

          <Stagger className="mt-10 grid gap-5 sm:mt-14 md:grid-cols-2" gap={0.1}>
            {/* Find */}
            <StaggerItem>
            <a href="#listings" className="lift group block h-full overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft hover:shadow-xl">
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
            </StaggerItem>

            {/* Research */}
            <StaggerItem>
            <a href="#districts" className="lift group block h-full overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft hover:shadow-xl">
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
            </StaggerItem>

            {/* Validate */}
            <StaggerItem>
            <a href="#estimator" className="lift group block h-full overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft hover:shadow-xl">
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
            </StaggerItem>

            {/* Act */}
            <StaggerItem>
            <a href="#pricing" className="lift group block h-full overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft hover:shadow-xl">
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
            </StaggerItem>
          </Stagger>
        </section>

        {/* 01 Find */}
        <section id="listings" className="scroll-mt-16 bg-mint-soft">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading
                eyebrow="Step 01 · Find"
                title="Every high-value listing in Aruba, in one place."
                body="Our scrapers pull homes, condos, land and commercial property for sale from broker, agency, developer and private listings every day, so you see new listings and price drops before everyone else."
              />
              <PrimaryCta>Browse all listings</PrimaryCta>
            </div>
            <Stagger className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
              {NEWEST.map((l) => (
                <StaggerItem key={l.listing_id}>
                  <ListingCard l={l} />
                </StaggerItem>
              ))}
            </Stagger>
            <p className="mt-6 text-[13px] text-zinc-500">
              {PROPERTIES.length} homes and condos, {LAND.length} land parcels and {COMMERCIAL_COUNT} commercial properties for sale right now. Search, filter and sort the full list,
              or see everything on a map.
            </p>
          </div>
        </section>

        {/* 02 Research */}
        <section id="districts" className="scroll-mt-16">
          <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
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
            <Stagger className="grid gap-4 sm:grid-cols-2">
              {TOP_DISTRICTS.map((d, i) => (
                <StaggerItem key={d.district}>
                <Link
                  href={`${DASHBOARD}?tab=listings&district=${encodeURIComponent(d.district)}`}
                  className="lift block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-lg"
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
                      <span className="block font-display text-[14px] font-bold tabular-nums text-zinc-950">{d.properties_for_sale + d.land_for_sale + d.commercial_for_sale}</span>
                      For sale
                    </span>
                    <span>
                      <span className="block font-display text-[14px] font-bold tabular-nums text-zinc-950">{d.occupancy_pct}%</span>
                      Occupancy
                    </span>
                  </div>
                </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* 03 Validate */}
        <section id="estimator" className="scroll-mt-16 bg-mint-soft">
          <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <Reveal className="order-2 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 lg:order-1">
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
            </Reveal>
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
          <div className="relative mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <SectionHeading eyebrow="Step 04 · Act" title="Built for the people who move Aruba's market." light />
            <Stagger className="mt-10 grid gap-5 sm:mt-14 md:grid-cols-2" gap={0.12}>
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
                <StaggerItem key={c.who} className="h-full rounded-3xl border border-white/10 bg-zinc-950/70 p-7 backdrop-blur sm:p-10">
                  <p className="font-display text-[24px] font-bold">{c.who}</p>
                  <ul className="mt-6 space-y-3.5">
                    {c.points.map((p) => (
                      <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-zinc-200">
                        <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-white" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* How we score */}
        <section id="methodology" className="mx-auto max-w-[1240px] scroll-mt-16 px-5 py-16 sm:px-6 sm:py-24">
          <SectionHeading eyebrow="How we score" title="Simple math. Data nobody else has." />
          <Stagger className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-2" gap={0.12}>
            <StaggerItem className="h-full rounded-3xl border border-zinc-200 p-7 sm:p-10">
              <p className="font-display text-[20px] font-bold text-zinc-950">Homes and villas</p>
              <p className="mt-5 rounded-xl bg-mint-soft px-5 py-4 font-display text-[16px] font-semibold leading-relaxed text-zinc-950">
                Yield = Nightly rate × 365 × Occupancy ÷ Asking price
              </p>
              <p className="mt-5 text-[14px] leading-relaxed text-zinc-600">
                Nightly rate and occupancy come from comparable luxury rentals in the same district. 1 point or more above the
                Aruba average ({MOCK_SNAPSHOT.est_gross_yield_pct}%) is Undervalued; 1 point or more below is Overpriced.
              </p>
            </StaggerItem>
            <StaggerItem className="h-full rounded-3xl border border-zinc-200 p-7 sm:p-10">
              <p className="font-display text-[20px] font-bold text-zinc-950">Land</p>
              <p className="mt-5 rounded-xl bg-mint-soft px-5 py-4 font-display text-[16px] font-semibold leading-relaxed text-zinc-950">
                Price per sq ft vs. district average
              </p>
              <p className="mt-5 text-[14px] leading-relaxed text-zinc-600">
                10% or more below the district&apos;s average land price is Undervalued; 10% or more above is Overpriced.
              </p>
            </StaggerItem>
          </Stagger>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-16 bg-mint-soft">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <Reveal className="text-center">
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="mt-4 font-display text-[30px] font-bold tracking-tight text-zinc-950 sm:text-[44px]">One plan. The whole market.</h2>
            </Reveal>
            <Stagger className="mx-auto mt-10 grid max-w-[1000px] gap-5 sm:mt-12 lg:grid-cols-[1.35fr_1fr]" gap={0.12}>
              <StaggerItem className="rounded-3xl border-2 border-zinc-950 bg-white p-7 shadow-xl shadow-zinc-900/5 sm:p-10">
                <p className="font-display text-[18px] font-bold text-zinc-950">Aruba</p>
                <p className="mt-4 font-display text-[48px] font-bold sm:text-[56px] leading-none tracking-tight tabular-nums text-zinc-950">
                  $150<span className="ml-1 text-[16px] font-semibold text-zinc-500">/month</span>
                </p>
                <ul className="mt-8 space-y-3">
                  {[
                    "Every property, land and commercial listing, scraped daily",
                    "New-listing, price-drop and status alerts (under contract / sold)",
                    "Price history vs. estimated market value on every listing",
                    "Listing agency and agent on every listing, with a link to the original",
                    "District value map, Sequence Score and official ROPV zoning",
                    "Revenue Estimator and vacation-rental market data",
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
              </StaggerItem>
              <StaggerItem className="flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-7 sm:p-10">
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
              </StaggerItem>
            </Stagger>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden bg-zinc-950">
          <Image src={img(ARUBA_PHOTOS.beach, 1800, 800)} alt="" fill unoptimized className="object-cover opacity-40" />
          <div className="relative mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-10 px-5 py-16 sm:px-6 sm:py-24 md:flex-row md:items-center">
            <SequenceLogo tone="white" className="hidden h-56 w-auto shrink-0 opacity-95 lg:block" />
            <Reveal className="md:flex-1">
              <p className="flex items-center gap-2.5 text-[14px] font-semibold text-white/80">
                <span className="size-2 rounded-full bg-mint" />
                {NEW_THIS_WEEK} new listings this week
              </p>
              <h2 className="mt-5 max-w-[18ch] font-display text-[34px] font-bold leading-[1.05] tracking-tight text-white sm:text-[52px]">
                See the market before the market does.
              </h2>
            </Reveal>
            <PrimaryCta light>Open the Dashboard</PrimaryCta>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Wordmark tagline />
          <p className="max-w-[64ch] text-[12px] leading-relaxed text-zinc-500 md:text-right">
            © 2026 Sequence Data · Oranjestad, Aruba · {CONTACT_EMAIL}
            <br />
            Data is for information only and is not investment advice. Photos: Unsplash.
          </p>
        </div>
      </footer>
    </div>
    </MotionRoot>
  );
}
