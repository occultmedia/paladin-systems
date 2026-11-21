import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MessageCircle, Phone, Pin, Users } from "lucide-react";
import { SequenceLockup, Wordmark } from "@/components/logo";
import { PlanPrice } from "@/components/landing/plan-price";
import { AIBadge, AIMarketScan } from "@/components/ai/ai-visuals";
import { Hero, type HeroEvent, type HeroKpi } from "@/components/landing/hero";
import { SiteHeader } from "@/components/landing/site-header";
import { AgentsSection, AiCapabilities, InvestorsSection, type AgentMorning, type AiExamples, type InvestorExample } from "@/components/landing/sell-sections";
import { computedListingNote, listingFacts } from "@/lib/signal-ai";
import { scoreConfidence } from "@/lib/confidence";
import { MARKET_TOTAL, marketBrief, scanRows } from "@/lib/scan-data";
import { ClientsPane, HistoryPane, TerminalPreview, type PreviewData } from "@/components/landing/terminal-preview";
import { MotionRoot, Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { CONTACT_EMAIL, PLANS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import {
  ALL_LISTINGS,
  ARUBA_PHOTOS,
  SCRAPE_RUNS,
  VILLA_PHOTOS,
  type Listing,
  type ListingSignal,
  type Signal,
} from "@/lib/aruba-data";

/* ─────────────────────────────────────────────────────────────────────────
 * Terminal (powered by Sequence Data) — landing page.
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
    f.category === "Property" ? f.comps_psf_usd * f.built_sqft : f.asking_price_usd;
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

/* ── hero: real pins, real events from today's read, live figures ─────── */

function heroData() {
  const at = (l: Listing) => ({ listingId: l.listing_id });
  const fresh = RUN.new_listings.filter((l) => l.category === "Property").slice(0, 2);
  const moves = RUN.price_changes.slice(0, 2);
  const status = RUN.status_changes.slice(0, 1);
  const doubt = [...ALL_LISTINGS].sort((a, b) => a.confidence_score - b.confidence_score)[0];
  const best = ALL_LISTINGS.filter((l): l is ListingSignal => l.category === "Property" && l.status === "For sale").sort(
    (a, b) => a.price_vs_comps_pct - b.price_vs_comps_pct,
  )[0];
  const events: HeroEvent[] = [];
  if (fresh[0]) events.push({ ...at(fresh[0]), id: `new-${fresh[0].listing_id}`, kind: "New listing", tone: "mint", title: fresh[0].asset_name, detail: `${fresh[0].district} · ${fresh[0].agency.name}`, value: `${usdM(fresh[0].asking_price_usd)} · ${SIGNAL[fresh[0].signal].label}` });
  moves.forEach((c, i) => {
    const p = c.change.change_pct ?? 0;
    events.push({ ...at(c.listing), id: `px-${c.listing.listing_id}-${i}`, kind: p < 0 ? "Price cut" : "Price raised", tone: p < 0 ? "down" : "up", title: c.listing.asset_name, detail: `${c.listing.district} · ${c.listing.agency.name}`, value: `${pct(p)} → ${usdM(c.change.price_usd)}` });
  });
  if (best)
    events.push({ ...at(best), id: `ai-${best.listing_id}`, kind: "AI Signal", tone: "up", title: best.asset_name, detail: `${usd(best.price_per_sqft_usd)}/ft² vs ${usd(best.comps_psf_usd)} for ${best.comps_count} comps`, value: `${pct(best.price_vs_comps_pct)} vs comps · Undervalued` });
  status.forEach((l) => events.push({ ...at(l), id: `st-${l.listing_id}`, kind: l.status, tone: "warn", title: l.asset_name, detail: `${l.district} · ${l.agency.name}`, value: `Was ${usdM(l.asking_price_usd)}` }));
  if (fresh[1]) events.push({ ...at(fresh[1]), id: `new-${fresh[1].listing_id}`, kind: "New listing", tone: "mint", title: fresh[1].asset_name, detail: `${fresh[1].district} · ${fresh[1].agency.name}`, value: usdM(fresh[1].asking_price_usd) });
  if (doubt && doubt.confidence_score < 80)
    events.push({ ...at(doubt), id: `cf-${doubt.listing_id}`, kind: `Confidence ${doubt.confidence_score}%`, tone: "warn", title: doubt.asset_name, detail: "Missing from the agency site, price unchanged", value: "Possible ghost listing" });

  const undervalued = ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED");
  const kpis: HeroKpi[] = [
    { label: "Listings", value: ALL_LISTINGS.length },
    { label: "New today", value: RUN.new_listings.length },
    { label: "Price moves", value: RUN.price_changes.length },
    { label: "Undervalued", value: undervalued.length },
  ];
  return { events, kpis, runLabel: `Read ${PREVIEW.run.time} · ${ALL_LISTINGS.length} listings · ${RUN.new_listings.length} new` };
}

const HERO = heroData();

/* ── selling sections: AI examples, an agent's morning, an investor post, the 3D map tour ── */

const FOR_SALE = ALL_LISTINGS.filter((l) => l.status === "For sale");
const HOMES_FOR_SALE = FOR_SALE.filter((l): l is ListingSignal => l.category === "Property");
const BEST = [...HOMES_FOR_SALE].sort((a, b) => a.price_vs_comps_pct - b.price_vs_comps_pct)[0];
// A realistic "priced above its comps" example for the agents section (not an outlier).
const PRICIEST = [...HOMES_FOR_SALE].filter((l) => l.price_vs_comps_pct <= 40).sort((a, b) => b.price_vs_comps_pct - a.price_vs_comps_pct)[0];
const GHOST = [...ALL_LISTINGS].sort((a, b) => a.confidence_score - b.confidence_score)[0];

function aiExamples(): AiExamples {
  const facts = listingFacts(BEST, ALL_LISTINGS);
  const note = computedListingNote(facts);
  const lastMove = GHOST.price_history[GHOST.price_history.length - 1]?.date ?? GHOST.first_seen;
  const why = scoreConfidence({ lastFoundAt: GHOST.last_found_at, daysOnMarket: GHOST.days_on_market, lastPriceChangeAt: `${lastMove}T00:00:00Z`, asOf: GHOST.last_scraped }).reasons;
  return {
    note: { listing: BEST.asset_name, district: BEST.district, verdict: note.verdict, headline: note.headline },
    brief: { headline: BRIEF.headline, time: PREVIEW.run.time },
    comps: { listing: BEST.asset_name, psf: BEST.price_per_sqft_usd, compsPsf: BEST.comps_psf_usd, pct: BEST.price_vs_comps_pct, basis: facts.comps.basis },
    ghost: { listing: GHOST.asset_name, score: GHOST.confidence_score, reason: why.map((r) => r.label).join(" · ") || "Missing from the agency site" },
  };
}

function agentMorning(): AgentMorning {
  const cut = RUN.price_changes.find((c) => (c.change.change_pct ?? 0) < 0);
  return {
    time: "7:00 AM",
    newCount: RUN.new_listings.length,
    moves: RUN.price_changes.length,
    contracts: RUN.status_changes.length,
    drop: cut ? { listing: cut.listing.asset_name, pct: cut.change.change_pct ?? 0, price: usdM(cut.change.price_usd) } : null,
    lead: PREVIEW.clients.people[0] ? { name: PREVIEW.clients.people[0].name, listing: cut?.listing.asset_name ?? "" } : null,
    pricing: PRICIEST ? { listing: PRICIEST.asset_name, district: PRICIEST.district, pct: PRICIEST.price_vs_comps_pct } : null,
  };
}

// Fictional member and project, same as the Feed's sample posts.
const INVESTOR: InvestorExample = {
  post: {
    name: "Elena Vos",
    company: "Coastline Ventures",
    title: "Investor wanted: 6-unit rental project in Noord",
    body: "Land secured and permits submitted for six 1-bed units. Looking for a capital partner for 40%. Projections and drawings on request.",
    amount: "$650,000",
    district: "Noord",
  },
  undervalued: ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED").length,
  offMarket: 0,
  photo: ARUBA_PHOTOS.aerial,
};

const AI_EX = aiExamples();
const DISTRICT_NAMES = [...new Set(ALL_LISTINGS.map((l) => l.district))].sort();
const STATS: Array<[string, string]> = [
  [String(ALL_LISTINGS.length), "listings tracked across Aruba today"],
  [String(AGENCIES), "agency websites read every night"],
  [String(RUN.new_listings.length + RUN.price_changes.length + RUN.status_changes.length), "market moves caught this morning"],
  [String(ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED").length), "listings priced below their comps"],
];
const AGENT_AM = agentMorning();
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
    <p className={`text-[13.5px] font-medium ${light ? "text-zinc-400" : "text-zinc-500"}`}>
      {children}
    </p>
  );
}

function PrimaryCta({ href = DASHBOARD, children, light }: { href?: string; children: React.ReactNode; light?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium shadow-sm transition-colors ${
        light ? "bg-white text-zinc-950 hover:bg-zinc-100" : "bg-zinc-950 text-white hover:bg-zinc-800"
      }`}
    >
      {children}
      <ArrowRight size={15} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-0.5" />
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
        className={`mt-4 max-w-[20ch] font-display text-[32px] leading-[1.05] tracking-[-0.03em] sm:text-[46px] ${light ? "text-white" : "text-zinc-950"}`}
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
              {pct(l.category === "Property" ? l.price_vs_comps_pct : l.price_vs_district_pct)}
            </p>
            <p className="text-[11px] text-zinc-500">${l.price_per_sqft_usd}/ft² vs comps</p>
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
    <div className="relative min-h-screen bg-white font-sans text-zinc-800 antialiased selection:bg-lime selection:text-zinc-950">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-[5] hidden w-full max-w-[1240px] -translate-x-1/2 border-x border-zinc-200 md:block" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteHeader />

      <main id="main">
        <Hero listings={ALL_LISTINGS} events={HERO.events} kpis={HERO.kpis} brief={BRIEF.headline} backdrop={ARUBA_PHOTOS.aerial} runLabel={HERO.runLabel} runTime={PREVIEW.run.time} total={ALL_LISTINGS.length} />

        {/* coverage */}
        <section aria-label="Coverage" className="border-y border-zinc-200 bg-white">
          <div className="mx-auto max-w-[1240px] px-5 py-8 text-center sm:px-6">
            <p className="text-[13px] text-zinc-500">Every district on the island, read every night</p>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[15px] font-medium text-zinc-400">
              {DISTRICT_NAMES.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* numbers */}
        <section aria-label="Today in numbers" className="border-b border-zinc-200 bg-white">
          <dl className="mx-auto grid max-w-[1240px] grid-cols-2 lg:grid-cols-4">
            {STATS.map(([v, l], i) => (
              <div key={l} className={`px-5 py-10 sm:px-8 sm:py-12 ${i % 2 ? "border-l border-zinc-200" : ""} ${i >= 2 ? "border-t border-zinc-200 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
                <dt className="font-display text-[40px] leading-none tracking-[-0.035em] text-[#15171C] sm:text-[52px]">{v}</dt>
                <dd className="mt-3 max-w-[22ch] text-[14px] leading-snug text-zinc-500">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* AI Signal */}
        <section id="ai-signal" className="scroll-mt-16 border-y border-zinc-200 bg-white text-zinc-950">
          <div className="relative">
            <div className="relative mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-12 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16 sm:pb-10">
              <div>
                <Reveal>
                  <AIBadge />
                  <h2 className="mt-5 max-w-[17ch] font-display text-[34px] font-bold leading-[1.04] tracking-[-0.025em] sm:text-[52px]">
                    An AI analyst that reads the whole market before you wake up.
                  </h2>
                  <p className="mt-5 max-w-[50ch] text-[16px] leading-relaxed text-zinc-600">
                    AI is the core of Terminal, not a chat box on the side. Every night it reads every listing on Aruba&apos;s agency
                    websites, prices each one against its comps, checks its history, catches the ghosts, and writes you a plain-English
                    take on what changed and what to do about it.
                  </p>
                </Reveal>
                <Stagger className="relative mt-10 space-y-7" gap={0.14}>
                  <span aria-hidden className="absolute bottom-3 left-[17px] top-3 w-px bg-gradient-to-b from-zinc-950/40 via-zinc-200 to-transparent" />
                  {[
                    ["Read", `${MARKET_TOTAL} listings from ${AGENCIES} agencies, every morning: price, size, land title, status, agent and photos.`],
                    ["Compare", "Each listing against similar ones in its district: price per sq ft, days on market, price cuts and status changes."],
                    ["Explain", "A daily market briefing, plus a plain-English note on every listing with a verdict and the next step to take."],
                  ].map(([k, v], i) => (
                    <StaggerItem key={k} className="relative flex gap-5">
                      <span className="relative grid size-[35px] shrink-0 place-items-center rounded-full bg-zinc-950 font-display text-[13px] font-bold text-lime">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-display text-[17px] font-semibold">{k}</p>
                        <p className="mt-1 max-w-[46ch] text-[14px] leading-relaxed text-zinc-600">{v}</p>
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>

              <Reveal delay={0.1} y={24} className="min-w-0">
                <AIMarketScan rows={SCAN} total={MARKET_TOTAL} headline={BRIEF.headline} />
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Today&apos;s briefing</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-800">{BRIEF.summary}</p>
                  <Stagger className="mt-3 space-y-2" gap={0.1}>
                    {BRIEF.points.slice(0, 3).map((pt) => (
                      <StaggerItem key={pt} className="flex gap-2.5 text-[13px] leading-snug text-zinc-600">
                        <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-zinc-950 ring-2 ring-lime" />
                        {pt}
                      </StaggerItem>
                    ))}
                  </Stagger>
                </div>
              </Reveal>
            </div>
            <div className="relative mx-auto max-w-[1240px] px-5 pb-20 sm:px-6 sm:pb-28">
              <AiCapabilities ex={AI_EX} />
            </div>
          </div>
        </section>

        {/* The product */}
        <section className="relative bg-gradient-to-b from-mint-soft to-white pb-20 sm:pb-28">
          <div className="mx-auto max-w-[1240px] px-5 pt-16 sm:px-6 sm:pt-24">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-[640px]">
                <p className="text-[12px] font-medium text-zinc-500">The terminal</p>
                <h2 className="mt-3 font-display text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-zinc-950 sm:text-[44px]">
                  This morning&apos;s market, on one screen.
                </h2>
              </div>
              <p className="max-w-[44ch] text-[15px] leading-relaxed text-zinc-600">
                What changed overnight, what each listing is worth against its comps, and who is selling it. Pin what you watch, log who asked.
              </p>
            </Reveal>
            <Reveal delay={0.1} y={28} className="mt-10 min-w-0 sm:mt-14">
              <TerminalPreview data={{ ...PREVIEW, headline: BRIEF.headline }} />
            </Reveal>
          </div>
        </section>

        <AgentsSection m={AGENT_AM} />

        <InvestorsSection ex={INVESTOR} />

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
            <Eyebrow>The Terminal platform</Eyebrow>
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
                  <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-lime">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-zinc-950">
                    <Users size={12} strokeWidth={2} /> {PREVIEW.clients.people.length} interested
                  </span>
                </div>
                <div className="mt-4 divide-y divide-zinc-100">
                  {PREVIEW.clients.people.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 py-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-semibold text-lime">
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
                body="Every morning Terminal checks the websites of Aruba's agencies, brokers and developers for homes, condos, land and commercial property. New listings, price changes and sales show up in one feed, so you see them first."
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
                  <span className="flex size-7 items-center justify-center rounded-full bg-zinc-950 text-lime">
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
                    "Deals: post off-market deals, buyer requests and rentals every member sees",
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
                  href={`mailto:${CONTACT_EMAIL}?subject=Terminal%20Team%20Access`}
                  className="mt-8 inline-flex items-center gap-2 self-start rounded-full border-2 border-zinc-950 px-5 py-3 font-display text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-950 hover:text-white"
                >
                  Contact us <ArrowUpRight size={15} strokeWidth={2} />
                </a>
              </StaggerItem>
            </Stagger>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden bg-[#0B0C0A]">
          {/* brand backdrop: ink black, a faint grid fading in from the right, a soft lime light and the wordmark */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 [background-image:linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
            <div className="absolute -bottom-40 -right-24 size-[520px] rounded-full bg-[radial-gradient(circle,rgb(172_250_104/0.16),transparent_65%)]" />
            <p className="absolute -bottom-[0.16em] right-6 hidden select-none items-end font-display text-[clamp(72px,10vw,150px)] uppercase leading-none tracking-[0.14em] text-white/[0.04] md:flex">
              Terminal
            </p>
          </div>
          <div className="relative mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-10 px-5 py-16 sm:px-6 sm:py-24 md:flex-row md:items-center">
            <div className="shrink-0 md:order-last md:hidden lg:order-none lg:block">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">Powered by</p>
              <SequenceLockup tone="white" className="mt-3 h-10 w-auto sm:h-14" />
            </div>
            <Reveal className="md:flex-1">
              <p className="flex items-center gap-2.5 text-[14px] font-semibold text-white/80">
                <span className="size-2 rounded-full bg-lime" />
                {NEW_THIS_WEEK} new listings this week
              </p>
              <h2 className="mt-5 max-w-[18ch] font-display text-[34px] font-bold leading-[1.05] tracking-tight text-white sm:text-[52px]">
                The market moved this morning. Terminal already read it.
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
            © 2026 Terminal by Sequence Data · Oranjestad, Aruba · {CONTACT_EMAIL}
            <br />
            Data is for information only and is not investment advice. Photos: Unsplash.
          </p>
        </div>
      </footer>
    </div>
    </MotionRoot>
  );
}
