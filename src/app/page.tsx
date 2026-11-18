import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, MessageCircle, Phone, Pin, Search, Sparkles, TrendingDown, Users } from "lucide-react";
import { SequenceLockup, Wordmark } from "@/components/logo";
import { PlanPrice } from "@/components/landing/plan-price";
import { AIBadge, AIMarketScan, Spotlight } from "@/components/ai/ai-visuals";
import { NavAuth } from "@/components/auth/nav-auth";
import { MARKET_TOTAL, marketBrief, scanRows } from "@/lib/scan-data";
import { ClientsPane, HistoryPane, TerminalPreview, type PreviewData } from "@/components/landing/terminal-preview";
import { CountUp, MotionRoot, Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { CONTACT_EMAIL, PLANS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import {
  ALL_LISTINGS,
  ARUBA_PHOTOS,
  MOCK_SNAPSHOT,
  SCRAPE_RUNS,
  VILLA_PHOTOS,
  type Listing,
  type Signal,
} from "@/lib/aruba-data";

/* ─────────────────────────────────────────────────────────────────────────
 * Signal (powered by Sequence Data) — landing page.
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
const NEWEST = [...ALL_LISTINGS].sort((a, b) => a.days_on_market - b.days_on_market).slice(0, 6);
const AGENCIES = new Set(ALL_LISTINGS.map((l) => l.agency.id)).size;
const AGENTS = new Set(ALL_LISTINGS.map((l) => l.agent?.id).filter(Boolean)).size;
const NEW_PICK = NEWEST.find((l) => l.category === "Property") ?? NEWEST[0];

const TICKER: Array<[string, string, number | null]> = [
  ["For sale", String(ALL_LISTINGS.length), null],
  ["New this week", String(NEW_THIS_WEEK), null],
  ["Median ask", usdM(median(ALL_LISTINGS.map((l) => l.asking_price_usd))), null],
  ["Land parcels", String(LAND.length), null],
  ["Undervalued", String(UNDERVALUED), null],
  ["Price changes today", String(SCRAPE_RUNS[0].price_changes.length), null],
  ["Under contract, sold or de-listed today", String(SCRAPE_RUNS[0].status_changes.length), null],
  ["Median land price", `${usd(median(LAND.map((l) => l.price_per_sqft_usd)))}/sq ft`, null],
  ["Agencies tracked", String(AGENCIES), null],
];

/* ── Terminal preview (hero) ─────────────────────────────────────────── */

const RUN = SCRAPE_RUNS[0];
const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : `$${Math.round(n / 1000)}k`);
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A sample watchlist for the hero: two price moves, one under contract, one new. */
function watchPreview(): PreviewData["watchlist"] {
  const moved = RUN.price_changes.slice(0, 2);
  const status = RUN.status_changes.slice(0, 1);
  const fresh = RUN.new_listings.filter((l) => l.category === "Property").slice(0, 1);
  const pinnedAgo = (days: number) => shortDate(new Date(Date.parse(RUN.date) - days * 86_400_000).toISOString().slice(0, 10));
  const notes = ["Shortlist for a client", null, "Ask about the erfpacht term", null];
  const rows = [
    ...moved.map((c, i) => ({ l: c.listing, since: c.change.change_pct ?? 0, days: 12 + i * 9 })),
    ...status.map((l) => ({ l, since: 0, days: 21 })),
    ...fresh.map((l) => ({ l, since: 0, days: 0 })),
  ].map(({ l, since, days }, i) => ({
    id: l.listing_id,
    name: l.asset_name,
    district: l.district,
    photo: l.photo_url,
    price: usdShort(l.asking_price_usd),
    sincePct: since,
    pinned: days === 0 ? "today" : pinnedAgo(days),
    status: l.status,
    note: notes[i] ?? null,
  }));
  const activity = [
    ...moved.map((c) => {
      const p = c.change.change_pct ?? 0;
      return { text: `${c.listing.asset_name}: price ${p < 0 ? "dropped" : "raised"} ${Math.abs(p).toFixed(1)}%`, color: p < 0 ? "#D64545" : "#2E9E5B", when: "Today" };
    }),
    ...status.map((l) => ({ text: `${l.asset_name}: now ${l.status.toLowerCase()}`, color: "#E08A1E", when: "Today" })),
    ...fresh.map((l) => ({ text: `Pinned ${l.asset_name}`, color: "#0A0A0A", when: "Today" })),
  ];
  return { updatesToday: moved.length + status.length, rows, activity };
}

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
    clients: {
      listing: {
        name: f.asset_name,
        district: f.district,
        price: usdShort(f.asking_price_usd),
        photo: f.photo_url,
        agent: f.agent?.name ?? null,
      },
      // Fictional sample leads for the preview.
      people: [
        { name: "Sofia Ramirez", phone: "+297 555 0143", comment: "Budget up to $8M. Wants a viewing this Saturday, asks if the price is negotiable.", added: shortDate(RUN.date) },
        { name: "Mark de Vries", phone: "+31 6 5550 1188", comment: "Buying from the Netherlands. Needs the erfpacht terms and HOA costs by e-mail.", added: shortDate(new Date(Date.parse(RUN.date) - 2 * 86_400_000).toISOString().slice(0, 10)) },
        { name: "James Whitfield", phone: "+1 555 0177", comment: "Interested if it drops below $7.5M. Follow up after the next price change.", added: shortDate(new Date(Date.parse(RUN.date) - 6 * 86_400_000).toISOString().slice(0, 10)) },
      ],
    },
    watchlist: watchPreview(),
  };
}

const PREVIEW = previewData();
const BRIEF = marketBrief();
const SCAN = scanRows(12);


const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: `${SITE_NAME} Aruba Real Estate Market Intelligence`,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  brand: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, email: CONTACT_EMAIL },
  offers: (["monthly", "yearly"] as const).map((b) => ({
    "@type": "Offer",
    name: b === "monthly" ? "Monthly" : "Yearly",
    price: String(PLANS[b].price),
    priceCurrency: "USD",
    priceSpecification: { "@type": "UnitPriceSpecification", price: String(PLANS[b].price), priceCurrency: "USD", unitText: b === "monthly" ? "MONTH" : "ANN" },
  })),
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
      className={`shine group inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 font-display text-[14px] font-semibold transition-[background-color,transform] duration-300 active:scale-[0.97] ${
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
          <Link href="/" aria-label="Signal home">
            <Wordmark tagline />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["AI Signal", "#ai-signal"],
              ["Listings", "#listings"],
              ["Watchlist", "#watchlist"],
              ["Clients", "#clients"],
              ["Pricing", "#pricing"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="link-underline text-[14px] font-medium text-zinc-600 transition-colors hover:text-zinc-950">
                {label}
              </a>
            ))}
          </nav>
          <NavAuth />
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
                AI Signal read {MARKET_TOTAL} listings this morning · {PREVIEW.run.newCount} new
              </p>
              <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.02] tracking-tight text-zinc-950 sm:text-[56px] lg:text-[60px]">
                Aruba Real Estate Market Intelligence
              </h1>
              <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-zinc-600 sm:text-[17px]">
                Every morning Signal&apos;s AI reads every home, land and commercial listing in Aruba, then tells you what
                changed, what each property is worth a look for and who is selling it. Pin what you are watching and keep
                track of the clients who asked.
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
                    { icon: Building2, label: "All listings", href: DASHBOARD },
                    { icon: Sparkles, label: "New today", href: `${DASHBOARD}?tab=listings` },
                    { icon: TrendingDown, label: "Price drops", href: `${DASHBOARD}?tab=listings` },
                    { icon: Pin, label: "Watchlist", href: `${DASHBOARD}?tab=watchlist` },
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
                  [PREVIEW.run.newCount, "New today"],
                  [AGENCIES, "Agencies tracked"],
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
              <TerminalPreview data={{ ...PREVIEW, headline: BRIEF.headline }} />
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
              [AGENTS, "Listing agents"],
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

        {/* AI Signal */}
        <section id="ai-signal" className="scroll-mt-16 bg-zinc-950 text-white">
          <Spotlight>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgb(221_229_220/0.10)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]"
            />
            <div className="relative mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-12 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
              <div>
                <Reveal>
                  <AIBadge dark />
                  <h2 className="mt-5 max-w-[16ch] font-display text-[32px] font-bold leading-[1.06] tracking-tight sm:text-[48px]">
                    AI reads the whole Aruba market before you do.
                  </h2>
                  <p className="mt-5 max-w-[50ch] text-[16px] leading-relaxed text-zinc-400">
                    Every morning Signal reads every listing on Aruba&apos;s agency websites, checks each one against its comps and
                    its own history, and tells you what changed and what it means.
                  </p>
                </Reveal>
                <Stagger className="relative mt-10 space-y-7" gap={0.14}>
                  <span aria-hidden className="absolute bottom-3 left-[17px] top-3 w-px bg-gradient-to-b from-mint/60 via-white/10 to-transparent" />
                  {[
                    ["Read", `${MARKET_TOTAL} listings from ${AGENCIES} agencies, every morning: price, size, land title, status, agent and photos.`],
                    ["Compare", "Each listing against similar ones in its district: price per sq ft, days on market, price cuts and status changes."],
                    ["Explain", "A daily market briefing, plus a plain-English note on every listing with a verdict and the next step to take."],
                  ].map(([k, v], i) => (
                    <StaggerItem key={k} className="relative flex gap-5">
                      <span className="relative grid size-[35px] shrink-0 place-items-center rounded-full border border-mint/30 bg-zinc-950 font-display text-[13px] font-bold text-mint">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-display text-[17px] font-semibold">{k}</p>
                        <p className="mt-1 max-w-[46ch] text-[14px] leading-relaxed text-zinc-400">{v}</p>
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>

              <Reveal delay={0.1} y={24} className="min-w-0">
                <AIMarketScan dark rows={SCAN} total={MARKET_TOTAL} headline={BRIEF.headline} />
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Today&apos;s briefing</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-300">{BRIEF.summary}</p>
                  <Stagger className="mt-3 space-y-2" gap={0.1}>
                    {BRIEF.points.slice(0, 3).map((pt) => (
                      <StaggerItem key={pt} className="flex gap-2.5 text-[13px] leading-snug text-zinc-400">
                        <span className="mt-[7px] size-1 shrink-0 rounded-full bg-mint" />
                        {pt}
                      </StaggerItem>
                    ))}
                  </Stagger>
                </div>
              </Reveal>
            </div>
          </Spotlight>
        </section>

        {/* Overview bento */}
        <section className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
          <Reveal className="text-center">
            <Eyebrow>The Signal platform</Eyebrow>
            <h2 className="mx-auto mt-4 max-w-[22ch] font-display text-[30px] font-bold leading-[1.08] tracking-tight text-zinc-950 sm:text-[44px]">
              From first look to final offer
            </h2>
            <p className="mx-auto mt-5 max-w-[60ch] text-[16px] leading-relaxed text-zinc-600">
              Everything you need to find, check and price high-value real estate in Aruba, in one dashboard.
            </p>
          </Reveal>

          <Stagger className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 sm:mt-14 md:grid-cols-2" gap={0.1}>
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

            {/* Check */}
            <StaggerItem>
            <a href="#price-history" className="lift group block h-full overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft hover:shadow-xl">
              <div className="h-[240px] bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-zinc-500">{PREVIEW.featured.name}</p>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: PREVIEW.featured.verdictColor }}>
                    {PREVIEW.featured.verdict}
                  </span>
                </div>
                <ol className="mt-4 divide-y divide-zinc-100">
                  {PREVIEW.featured.events.map((e) => (
                    <li key={e.date + e.label} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                      <span className="text-zinc-500">{e.date}</span>
                      <span className="flex-1 font-medium text-zinc-800">{e.label}</span>
                      <span className="font-display font-bold tabular-nums text-zinc-950">{e.price}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[12px] text-zinc-500">
                  Est. market value <span className="font-semibold tabular-nums text-zinc-950">{PREVIEW.featured.marketLabel}</span>
                </p>
              </div>
              <div className="p-7">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-mint-deep">Check</span>
                <p className="mt-4 font-display text-[22px] font-bold text-zinc-950">Know the real price story</p>
                <p className="mt-1 text-[14px] text-zinc-600">Every price change since it was listed, against estimated market value.</p>
              </div>
            </a>
            </StaggerItem>

            {/* Track */}
            <StaggerItem>
            <a href="#watchlist" className="lift group block h-full overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft hover:shadow-xl">
              <div className="h-[240px] bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500">
                    <Pin size={12} strokeWidth={2} fill="currentColor" /> Your watchlist
                  </p>
                  <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-mint">
                    {PREVIEW.watchlist.updatesToday} updates today
                  </span>
                </div>
                <div className="mt-4 divide-y divide-zinc-100">
                  {PREVIEW.watchlist.rows.slice(0, 3).map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                      {r.photo && <Photo src={r.photo} alt={r.name} w={36} h={36} className="size-9 rounded-lg" />}
                      <span className="flex-1 truncate text-[13px] font-medium text-zinc-800">{r.name}</span>
                      <span className="text-right">
                        <span className="block font-display text-[13px] font-bold tabular-nums">{r.price}</span>
                        <span className="block text-[11px] font-semibold tabular-nums" style={{ color: r.status !== "For sale" ? "#E08A1E" : r.sincePct < 0 ? DOWN : r.sincePct > 0 ? UP : "#71717A" }}>
                          {r.status !== "For sale" ? r.status : r.sincePct === 0 ? "No change" : pct(r.sincePct)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-7">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-mint-deep">Track</span>
                <p className="mt-4 font-display text-[22px] font-bold text-zinc-950">Pin what matters</p>
                <p className="mt-1 text-[14px] text-zinc-600">Keep a watchlist and see every price cut and status change on it.</p>
              </div>
            </a>
            </StaggerItem>

            {/* Follow up */}
            <StaggerItem>
            <a href="#clients" className="lift group block h-full overflow-hidden rounded-3xl border border-zinc-200 bg-mint-soft hover:shadow-xl">
              <div className="h-[240px] bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-zinc-500">Interested clients</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[11px] font-semibold text-zinc-950">
                    <Users size={12} strokeWidth={2} /> {PREVIEW.clients.people.length} interested
                  </span>
                </div>
                <div className="mt-4 divide-y divide-zinc-100">
                  {PREVIEW.clients.people.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 py-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-semibold text-mint">
                        {c.name.split(" ").filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("").slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-zinc-800">{c.name}</span>
                        <span className="block truncate text-[11px] text-zinc-500">{c.comment}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-7">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-mint-deep">Follow up</span>
                <p className="mt-4 font-display text-[22px] font-bold text-zinc-950">Never lose a lead</p>
                <p className="mt-1 text-[14px] text-zinc-600">Keep the people who asked about each property, with phone and notes.</p>
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
                body="Every morning Signal checks the websites of Aruba's agencies, brokers and developers for homes, condos, land and commercial property. New listings, price changes and sales show up in one feed, so you see them first."
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
              {PROPERTIES.length} homes and condos, {LAND.length} land parcels and {COMMERCIAL_COUNT} commercial properties for sale right now. Search and filter by
              type, price, bedrooms, pool, land title and status, see everything on a 3D map, and export any list to CSV.
            </p>
          </div>
        </section>

        {/* 02 Check */}
        <section id="price-history" className="scroll-mt-16">
          <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="Step 02 · Check"
                title="See the full price story behind every listing."
                body="Open any listing to see every price change since we first found it, an estimate of what it is really worth, and exactly who to call about it."
              />
              <Bullets
                items={[
                  ["Price history", "Every drop and increase with the date, so you know how motivated the seller is."],
                  ["Estimated market value", "Asking price against our estimate, with a clear Undervalued, At market or Overpriced signal."],
                  ["Agency and listing agent", "The agency, the agent handling it, and one tap to call, WhatsApp or e-mail them, plus a link to the original listing."],
                  ["Daily updates feed", "New listings, price changes and properties going under contract, sold or de-listed, every morning."],
                ]}
              />
              <div className="mt-10">
                <PrimaryCta>Browse listings</PrimaryCta>
              </div>
            </div>
            <Reveal className="space-y-4">
              <div className="h-[330px] rounded-3xl border border-zinc-200 bg-mint-soft p-3 shadow-xl shadow-zinc-900/5 sm:h-[360px] sm:p-4">
                <HistoryPane data={PREVIEW} />
              </div>
              {PREVIEW.featured.agent && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: PREVIEW.featured.agency.color }}>
                      {PREVIEW.featured.agent.name.split(" ").filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("").slice(0, 2)}
                    </span>
                    <span>
                      <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">Listing agent · {PREVIEW.featured.agency.name}</span>
                      <span className="block text-[15px] font-semibold text-zinc-950">{PREVIEW.featured.agent.name}</span>
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      [Phone, "Call"],
                      [MessageCircle, "WhatsApp"],
                    ].map(([Icon, label]) => {
                      const I = Icon as typeof Phone;
                      return (
                        <span key={label as string} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-[12px] font-medium text-zinc-800">
                          <I size={13} strokeWidth={1.75} /> {label as string}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </Reveal>
          </div>
        </section>

        {/* 03 Track */}
        <section id="watchlist" className="scroll-mt-16 bg-mint-soft">
          <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <Reveal className="order-2 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 lg:order-1">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                <p className="inline-flex items-center gap-2 font-display text-[16px] font-bold text-zinc-950">
                  <span className="flex size-7 items-center justify-center rounded-full bg-zinc-950 text-mint">
                    <Pin size={13} strokeWidth={2} fill="currentColor" />
                  </span>
                  Watchlist
                </p>
                <span className="text-[12px] tabular-nums text-zinc-500">
                  {PREVIEW.watchlist.rows.length} pinned · {PREVIEW.watchlist.updatesToday} updates today
                </span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {PREVIEW.watchlist.rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                    {r.photo && <Photo src={r.photo} alt={r.name} w={72} h={54} className="h-[54px] w-[72px] shrink-0 rounded-lg" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-zinc-950">{r.name}</p>
                      <p className="truncate text-[12px] text-zinc-500">
                        {r.note ? <span className="italic">“{r.note}”</span> : <>{r.district} · pinned {r.pinned}</>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-[15px] font-bold tabular-nums text-zinc-950">{r.price}</p>
                      <p className="text-[12px] font-semibold tabular-nums" style={{ color: r.status !== "For sale" ? "#E08A1E" : r.sincePct < 0 ? DOWN : r.sincePct > 0 ? UP : "#71717A" }}>
                        {r.status !== "For sale" ? r.status : r.sincePct === 0 ? "No change" : `${pct(r.sincePct)} since pinned`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Activity</p>
                <ul className="mt-2.5 space-y-2">
                  {PREVIEW.watchlist.activity.map((a, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-[13px] text-zinc-700">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: a.color }} />
                      <span className="truncate">{a.text}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-zinc-400">{a.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <div className="order-1 lg:order-2">
              <SectionHeading
                eyebrow="Step 03 · Track"
                title="Pin the properties you are watching."
                body="Tap the pin on any listing and it goes on your watchlist. Every daily scrape checks your pinned properties, so you see a price cut or a sale the day it happens."
              />
              <Bullets
                items={[
                  ["One tap to pin", "Pin homes, land or commercial property from the list, the map or the listing details."],
                  ["Every move since you pinned", "Price change since you pinned it and since it was listed, plus status: for sale, under contract, sold or de-listed."],
                  ["Private notes", "Add a note to each property, like which client it is for or what to ask the agent."],
                ]}
              />
              <div className="mt-10">
                <PrimaryCta href={`${DASHBOARD}?tab=watchlist`}>Open your watchlist</PrimaryCta>
              </div>
            </div>
          </div>
        </section>

        {/* 04 Follow up */}
        <section id="clients" className="scroll-mt-16">
          <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="Step 04 · Follow up"
                title="Remember everyone who asked."
                body="Add the clients interested in a property right on the listing: name, phone and your notes. When the price drops, you know exactly who to call."
              />
              <Bullets
                items={[
                  ["Clients on every listing", "Add, edit or remove as many interested people as you need, with their phone number and comments."],
                  ["One tap to reach them", "Call or WhatsApp a client straight from the listing."],
                  ["See demand at a glance", "Listings with interested clients show how many people are waiting, in the list and on your watchlist."],
                  ["Private to you", "Your clients and notes are only visible to you."],
                ]}
              />
              <div className="mt-10">
                <PrimaryCta>Start tracking clients</PrimaryCta>
              </div>
            </div>
            <Reveal className="rounded-3xl border border-zinc-200 bg-mint-soft p-3 shadow-xl shadow-zinc-900/5 sm:p-4">
              <ClientsPane data={PREVIEW} />
            </Reveal>
          </div>
        </section>

        {/* Who it's for */}
        <section className="relative overflow-hidden bg-zinc-950 text-white">
          <Image src={img(ARUBA_PHOTOS.aerial, 1800, 900)} alt="" fill unoptimized className="object-cover opacity-25" />
          <div className="relative mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <SectionHeading eyebrow="Who it's for" title="Built for the people who move Aruba's market." light />
            <Stagger className="mt-10 grid gap-5 sm:mt-14 md:grid-cols-2" gap={0.12}>
              {[
                {
                  who: "Real estate agents",
                  points: [
                    "See every new listing and price drop on the island each morning",
                    "Price your own listings against what similar homes and land are asking",
                    "Keep every interested client on the property they asked about",
                    "Call them back the day the price drops, and export lists to CSV",
                  ],
                },
                {
                  who: "Investors",
                  points: [
                    "Find undervalued homes and land before they are gone",
                    "Check the full price history before you make an offer",
                    "Pin properties and catch every price cut on them",
                    "See how long listings sit and contact the agent in one tap",
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
                <div className="mt-5">
                  <PlanPrice />
                </div>
                <ul className="mt-8 space-y-3">
                  {[
                    "Every home, land and commercial listing in Aruba, checked daily",
                    "Daily feed of new listings, price changes and sales",
                    "Price history and estimated market value on every listing",
                    "Agency and listing agent with call, WhatsApp and e-mail",
                    "Watchlist for the properties you are tracking",
                    "Interested clients with phone and notes on every listing",
                    "AI Signal: a daily market briefing and an AI note on every listing",
                    "List and 3D map view · export to CSV",
                  ].map((f) => (
                    <li key={f} className="flex gap-3 text-[14px] text-zinc-700">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-zinc-950" />
                      {f}
                    </li>
                  ))}
                </ul>
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
                  href={`mailto:${CONTACT_EMAIL}?subject=Signal%20Team%20Access`}
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
            <div className="shrink-0 md:order-last md:hidden lg:order-none lg:block">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">Powered by</p>
              <SequenceLockup tone="white" className="mt-3 h-10 w-auto sm:h-14" />
            </div>
            <Reveal className="md:flex-1">
              <p className="flex items-center gap-2.5 text-[14px] font-semibold text-white/80">
                <span className="size-2 rounded-full bg-mint" />
                {NEW_THIS_WEEK} new listings this week
              </p>
              <h2 className="mt-5 max-w-[18ch] font-display text-[34px] font-bold leading-[1.05] tracking-tight text-white sm:text-[52px]">
                The market moved this morning. Signal already read it.
              </h2>
            </Reveal>
            <div className="flex flex-wrap gap-3">
              <PrimaryCta light href="/signup">
                Create your account
              </PrimaryCta>
              <Link
                href={DASHBOARD}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 font-display text-[14px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                See the dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Wordmark tagline />
          <p className="max-w-[64ch] text-[12px] leading-relaxed text-zinc-500 md:text-right">
            © 2026 Signal by Sequence Data · Oranjestad, Aruba · {CONTACT_EMAIL}
            <br />
            Data is for information only and is not investment advice. Photos: Unsplash.
          </p>
        </div>
      </footer>
    </div>
    </MotionRoot>
  );
}
