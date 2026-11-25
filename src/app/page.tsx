import { perM2 } from "@/lib/units";
import { RunLine } from "@/components/run-line";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileSpreadsheet, Flag, Handshake, LineChart, Map as MapIcon, MessageCircle, Pin, Rss, Scale, ShieldCheck, Sparkles, Users } from "lucide-react";
import { SequenceLockup, Wordmark } from "@/components/logo";
import { PlanPrice } from "@/components/landing/plan-price";
import { AIBadge } from "@/components/ai/ai-visuals";
import { Hero, type HeroEvent, type HeroKpi } from "@/components/landing/hero";
import { SiteHeader } from "@/components/landing/site-header";
import { GrainField } from "@/components/landing/grain-field";
import { AgentMorningCard, AiCapabilities, BrokerBoardCard, InvestorPostCard, type AgentMorning, type AiExamples, type BrokerExample, type InvestorExample } from "@/components/landing/sell-sections";
import { AudienceTabs, type Audience } from "@/components/landing/audience-tabs";
import { computedListingNote, listingFacts } from "@/lib/signal-ai";
import { scoreConfidence } from "@/lib/confidence";
import { marketBrief } from "@/lib/scan-data";
import { TerminalPreview, type PreviewData } from "@/components/landing/terminal-preview";
import { MotionRoot, Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { CONTACT_EMAIL, PLANS, SITE_DESCRIPTION, SITE_NAME, SITE_URL, YEARLY_SAVINGS_USD } from "@/lib/site";
import { Faq, type FaqItem } from "@/components/landing/faq";
import {
  ALL_LISTINGS,
  INDEX_RUNS,
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
  UNDERVALUED: { label: "Below market", color: UP, bg: "#E8F1EB" },
  AT_MARKET: { label: "At Market", color: "#3F3F46", bg: "#F1F1F3" },
  OVERPRICED: { label: "Overpriced", color: DOWN, bg: "#F6ECEC" },
  NO_SIGNAL: { label: "No signal", color: "#71717A", bg: "#F1F1F3" },
};

/* ── derived figures ─────────────────────────────────────────────────── */

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const usdM = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : usd(n));
const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;

const AGENCIES = new Set(ALL_LISTINGS.map((l) => l.agency.id)).size;
const NEW_THIS_WEEK = ALL_LISTINGS.filter((l) => l.days_on_market <= 7).length;


/* ── Terminal preview (hero) ─────────────────────────────────────────── */

const RUN = INDEX_RUNS[0];
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
        tenure: l.tenure ?? "",
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
      tenure: f.tenure ?? "",
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
    events.push({ ...at(best), id: `ai-${best.listing_id}`, kind: "AI Signal", tone: "up", title: best.asset_name, detail: `${usd(perM2(best.price_per_sqft_usd))}/m² vs ${usd(perM2(best.comps_psf_usd))} for ${best.comps_count} comps`, value: `${pct(best.price_vs_comps_pct)} vs comps · Below market 🔥` });
  status.forEach((l) => events.push({ ...at(l), id: `st-${l.listing_id}`, kind: l.status, tone: "warn", title: l.asset_name, detail: `${l.district} · ${l.agency.name}`, value: `Was ${usdM(l.asking_price_usd)}` }));
  if (fresh[1]) events.push({ ...at(fresh[1]), id: `new-${fresh[1].listing_id}`, kind: "New listing", tone: "mint", title: fresh[1].asset_name, detail: `${fresh[1].district} · ${fresh[1].agency.name}`, value: usdM(fresh[1].asking_price_usd) });
  if (doubt && doubt.confidence_score < 80)
    events.push({ ...at(doubt), id: `cf-${doubt.listing_id}`, kind: `Confidence ${doubt.confidence_score}%`, tone: "warn", title: doubt.asset_name, detail: "Missing from the agency site, price unchanged", value: "Possible ghost listing" });

  const belowMarket = ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED");
  const kpis: HeroKpi[] = [
    { label: "Listings", value: ALL_LISTINGS.length },
    { label: "New today", value: RUN.new_listings.length },
    { label: "Price moves", value: RUN.price_changes.length },
    { label: "Below market", value: belowMarket.length },
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
    comps: { listing: BEST.asset_name, perM2: perM2(BEST.price_per_sqft_usd), compsPerM2: perM2(BEST.comps_psf_usd), pct: BEST.price_vs_comps_pct, basis: facts.comps.basis },
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
  belowMarket: ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED").length,
  offMarket: 0,
};

const AI_EX = aiExamples();
const STATS: Array<[string, string]> = [
  [String(ALL_LISTINGS.length), "listings for sale, in one place"],
  [String(AGENCIES), "agency websites checked every morning"],
  [String(RUN.new_listings.length + RUN.price_changes.length + RUN.status_changes.length), "changes caught this morning"],
  [String(ALL_LISTINGS.filter((l) => l.signal === "UNDERVALUED").length), "priced 20%+ below similar homes"],
];
const AGENT_AM = agentMorning();

function brokerExample(): BrokerExample {
  const rows = [
    ...RUN.new_listings.slice(0, 3).map((l) => ({ l, change: "New listing" })),
    ...RUN.price_changes.slice(0, 2).map((c) => ({ l: c.listing, change: `${pct(c.change.change_pct ?? 0)} price` })),
  ].map(({ l, change }) => ({ name: l.asset_name, district: l.district, price: usdShort(l.asking_price_usd), agency: l.agency.name, color: l.agency.color, change }));
  return { rows, agencies: AGENCIES };
}
const BROKER = brokerExample();

const AUDIENCES: Audience[] = [
  {
    id: "agents",
    label: "Agents",
    title: "Know the market before your first call.",
    points: [
      "Every new listing, price cut and sale on the island, ready by 7 AM.",
      "Price with proof: $/m² against comparable homes in the same district.",
      "Save interested clients on each listing. When the price drops, call them first.",
    ],
    cta: { label: "Start as an agent", href: "/signup" },
    visual: <AgentMorningCard m={AGENT_AM} />,
  },
  {
    id: "brokers",
    label: "Brokers",
    title: "Your whole office on one market picture.",
    points: [
      "Every competing agency's new listings, price moves and sales in one daily feed.",
      "The Confidence Score flags stale and ghost listings, so your team chases what is real.",
      "Team seats, CSV export and raw data access for your brokerage.",
    ],
    cta: { label: "Get team access", href: `mailto:${CONTACT_EMAIL}?subject=Terminal%20Team%20Access` },
    visual: <BrokerBoardCard ex={BROKER} />,
  },
  {
    id: "investors",
    label: "Investors",
    title: "Find the deal before it makes the rounds.",
    points: [
      "AI flags homes priced 20% or more below similar homes every morning.",
      "Full price history and a Confidence Score on every listing for quick diligence.",
      "Off-market deals and co-investment posts on the members-only Market feed.",
    ],
    cta: { label: "Join as an investor", href: "/signup" },
    visual: <InvestorPostCard ex={INVESTOR} />,
  },
];

const HOW: Array<[string, string]> = [
  ["We collect", "Listings from agency, broker and developer websites across Aruba, checked each morning and gathered in one place."],
  ["AI analyzes", "Each price against comparable listings. Below market, overpriced and ghost listings flagged."],
  ["You act first", "Read the morning brief, watch your pins and call the listing agent in one tap."],
];

const FEATURES: Array<[typeof Rss, string, string]> = [
  [Rss, "Daily feed", "New listings, price changes and sales, every morning."],
  [Scale, "Value signal", "Below market, At market or Overpriced against similar homes."],
  [LineChart, "Price history", "Every price change since the day it was listed."],
  [ShieldCheck, "Confidence Score", "Spots listings the agency forgot to take down."],
  [Sparkles, "AI Signal", "A morning briefing and a plain-English note per listing."],
  [Pin, "Watchlist", "Pin properties and see every move since you pinned."],
  [Users, "Interested clients", "Buyers on each listing with phone and notes."],
  [MessageCircle, "Agent contact", "Call, WhatsApp or e-mail the listing agent in one tap."],
  [Handshake, "Market feed", "The one page every member sees: off-market deals, buyer requests and rentals."],
  [MapIcon, "3D map", "Tracked listings on a map of the island, with filters."],
  [FileSpreadsheet, "CSV export", "Take any filtered list into your own spreadsheet."],
  [Flag, "Flag sold listings", "Mark a listing as gone and it disappears for every member."],
];


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
      className={`group relative inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium shadow-sm transition-colors ${
        light ? "bg-white text-zinc-950 hover:bg-zinc-100" : "bg-zinc-950 text-white hover:bg-zinc-800"
      }`}
    >
      <RunLine speed={4} delay={-2} glow={4} />
      {children}
      <ArrowRight size={15} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-0.5" />
    </Link>
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

/* ── FAQ ─────────────────────────────────────────────────────────────── */

const FAQ: FaqItem[] = [
  {
    q: "Where does Terminal get its listings?",
    a: `Every morning Terminal reads the public listing pages of Aruba's real estate agencies, brokers and developers (${AGENCIES} websites today) and collects every home, condo, villa, plot of land and commercial property for sale. Each listing shows the agency's logo and links back to the original page on its website.`,
  },
  {
    q: "How often is the data updated?",
    a: "Once a day, early in the morning, Aruba time. Each run picks up new listings, price changes and properties that went under contract, sold or came off the market, and adds them to the daily feed and to the price history of every listing.",
  },
  {
    q: "What do Below market, At market and Overpriced mean?",
    a: "Each home or condo for sale gets two separate checks: the nearest homes of similar size, and a price model that uses its size, plot, bedrooms, pool, land title and district. It is marked Below market or Overpriced only when both checks put it at least 20% away; otherwise it is At market. Asking prices are compared, not sale prices. Land, commercial property, fixer-uppers, homes sold with several apartments and homes with too few similar ones nearby get no signal.",
  },
  {
    q: "What is the Confidence Score?",
    a: "A score from 0 to 100 for how sure Terminal is that a listing is really still for sale. Agency sites often leave listings up long after a deal closes. The score starts at 100 and drops when a listing disappears from its source website, stays on the market for more than 6 months (more again after a year), or keeps the same price for more than 4 months.",
  },
  {
    q: "What if a listing has already been sold?",
    a: "Flag it from the listing. A flagged listing is marked as gone, its Confidence Score drops to 0 and it is removed from the market view for every member, so nobody else wastes a call on it.",
  },
  {
    q: "Does Terminal sell property or act as an agent?",
    a: "No. Terminal is a market intelligence tool, not a broker or a listing portal. Every listing belongs to the agency that published it, and the call, WhatsApp and e-mail buttons go straight to that agency's listing agent.",
  },
  {
    q: "Is the AI Signal financial advice?",
    a: "No. AI Signal writes a daily market briefing and a plain-English note on each listing from the same data you see in the table: price history, comparable listings and time on the market. Treat it as a starting point and check the details with the listing agent before you make an offer.",
  },
  {
    q: "Who can see my watchlist, clients and Market feed posts?",
    a: "Your watchlist and the interested clients you save on a listing are yours alone. Posts on the Market feed (off-market deals, buyer requests and rentals) are shared with every member for 14 days. Post blind and members only see your role: they tap “I’m interested”, and you decide who to contact.",
  },
  {
    q: "How much does it cost?",
    a: `One plan with everything in it: $${PLANS.monthly.price} a month, or $${PLANS.yearly.price.toLocaleString("en-US")} a year, which saves $${YEARLY_SAVINGS_USD}. Teams that need several seats can contact us for team access.`,
  },
  {
    q: "My agency's listings are missing or wrong. What do I do?",
    a: `E-mail ${CONTACT_EMAIL} with your website address and we will add it to the daily run or fix the listing.`,
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

/* ── page ────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <MotionRoot>
    <div className="relative min-h-screen bg-white font-sans text-zinc-800 antialiased selection:bg-lime selection:text-zinc-950">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-[5] hidden w-full max-w-[1240px] -translate-x-1/2 border-x border-zinc-200 md:block" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <SiteHeader />

      <main id="main">
        <Hero listings={ALL_LISTINGS} events={HERO.events} kpis={HERO.kpis} brief={BRIEF.headline} runLabel={HERO.runLabel} runTime={PREVIEW.run.time} total={ALL_LISTINGS.length} />

        {/* numbers */}
        <section aria-label="Today in numbers" className="border-y border-zinc-200 bg-white">
          <dl className="mx-auto grid max-w-[1240px] grid-cols-2 lg:grid-cols-4">
            {STATS.map(([v, l], i) => (
              <div key={l} className={`px-5 py-8 sm:px-8 sm:py-10 ${i % 2 ? "border-l border-zinc-200" : ""} ${i >= 2 ? "border-t border-zinc-200 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
                <dt className="font-display text-[36px] leading-none tracking-[-0.035em] text-[#15171C] sm:text-[46px]">{v}</dt>
                <dd className="mt-2.5 max-w-[22ch] text-[13.5px] leading-snug text-zinc-500">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16 bg-white">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <SectionHeading eyebrow="How it works" title="One screen. Fresh market data every morning." />
            <Stagger className="mt-10 grid gap-4 md:grid-cols-3" gap={0.1}>
              {HOW.map(([k, v], i) => (
                <StaggerItem key={k} className="glass relative rounded-2xl p-6">
                  <span className="grid size-9 place-items-center rounded-full bg-zinc-950 font-display text-[14px] font-bold text-lime">{i + 1}</span>
                  <p className="mt-5 font-display text-[19px] font-semibold text-zinc-950">{k}</p>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-zinc-600">{v}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who" className="scroll-mt-16 border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <Reveal>
              <Eyebrow>Built for professionals</Eyebrow>
              <h2 className="mt-4 mb-8 max-w-[22ch] font-display text-[32px] leading-[1.05] tracking-[-0.03em] text-zinc-950 sm:text-[46px]">
                Agents, brokers and investors.
              </h2>
            </Reveal>
            <AudienceTabs items={AUDIENCES} />
          </div>
        </section>

        {/* The product */}
        <section className="relative bg-gradient-to-b from-mint-soft to-white pb-16 sm:pb-24">
          <div className="mx-auto max-w-[1240px] px-5 pt-16 sm:px-6 sm:pt-24">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-[640px]">
                <Eyebrow>The dashboard</Eyebrow>
                <h2 className="mt-3 font-display text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-zinc-950 sm:text-[44px]">
                  What you see when you log in.
                </h2>
              </div>
              <p className="max-w-[40ch] text-[15px] leading-relaxed text-zinc-600">
                What changed overnight, what each listing is worth and who is selling it.
              </p>
            </Reveal>
            <Reveal delay={0.1} y={28} className="mt-10 min-w-0 sm:mt-12">
              <TerminalPreview data={{ ...PREVIEW, headline: BRIEF.headline }} />
            </Reveal>
          </div>
        </section>

        {/* AI Signal */}
        <section id="ai-signal" className="scroll-mt-16 border-t border-zinc-200 bg-white text-zinc-950">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <AIBadge />
                <h2 className="mt-5 max-w-[20ch] font-display text-[32px] font-bold leading-[1.05] tracking-[-0.025em] sm:text-[46px]">
                  An AI analyst that reads the market before you wake up.
                </h2>
              </div>
              <p className="max-w-[40ch] text-[15px] leading-relaxed text-zinc-600">
                It prices every listing against its comps, catches ghost listings and tells you what changed.
              </p>
            </Reveal>
            <AiCapabilities ex={AI_EX} />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-t border-zinc-200 bg-mint-soft">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading eyebrow="Features" title="Everything in one dashboard." />
              <PrimaryCta>See the dashboard</PrimaryCta>
            </div>
            <Stagger className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" gap={0.05}>
              {FEATURES.map(([Icon, k, v]) => (
                <StaggerItem key={k} className="flex gap-3.5 rounded-2xl border border-white/80 bg-white/70 p-5 backdrop-blur-xl">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 text-lime">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <div>
                    <p className="font-display text-[15px] font-semibold text-zinc-950">{k}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-zinc-600">{v}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative scroll-mt-16 overflow-hidden bg-mint-soft">
          <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-6 sm:py-24">
            <Reveal className="text-center">
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="mt-4 font-display text-[30px] font-bold tracking-tight text-zinc-950 sm:text-[44px]">One plan. Full access.</h2>
            </Reveal>
            <div className="relative mx-auto mt-10 max-w-[1000px] sm:mt-12">
            {/* soft shapes behind the glass so the frost has something to blur */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -left-10 top-6 size-[340px] rounded-full bg-lime/70 blur-3xl sm:size-[420px]" />
              <div className="absolute bottom-0 left-[38%] size-[220px] rounded-full bg-zinc-950/25 blur-3xl" />
              <div className="absolute -right-6 -top-6 size-[260px] rounded-full bg-[#d8f7b8] blur-3xl" />
              <div className="hero-grain absolute inset-0 opacity-[0.25] mix-blend-overlay" />
            </div>
            <Stagger className="relative grid gap-5 lg:grid-cols-[1.35fr_1fr]" gap={0.12}>
              <StaggerItem className="relative rounded-3xl border border-white/80 bg-white/50 shadow-[inset_0_1px_0_rgb(255_255_255/0.95),inset_0_0_0_1px_rgb(255_255_255/0.35),0_24px_60px_-28px_rgb(10_10_10/0.35)] ring-1 ring-zinc-950/[0.06] backdrop-blur-2xl backdrop-saturate-150 p-7 sm:p-10">
                <RunLine speed={9} width={2} />
                <p className="font-display text-[18px] font-bold text-zinc-950">Aruba</p>
                <div className="mt-5">
                  <PlanPrice />
                </div>
                <ul className="mt-8 space-y-3">
                  {[
                    "Listings from Aruba agencies, updated daily",
                    "Value signal, price history and Confidence Score",
                    "AI morning briefing and a note on every listing",
                    "Watchlist and interested clients",
                    "Members-only Market feed",
                    "3D map, agent contact and CSV export",
                  ].map((f) => (
                    <li key={f} className="flex gap-3 text-[14px] text-zinc-700">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-zinc-950" />
                      {f}
                    </li>
                  ))}
                </ul>
              </StaggerItem>
              <StaggerItem className="flex flex-col justify-between rounded-3xl border border-white/80 bg-white/50 shadow-[inset_0_1px_0_rgb(255_255_255/0.95),inset_0_0_0_1px_rgb(255_255_255/0.35),0_24px_60px_-28px_rgb(10_10_10/0.35)] ring-1 ring-zinc-950/[0.06] backdrop-blur-2xl backdrop-saturate-150 p-7 sm:p-10">
                <div>
                  <p className="font-display text-[18px] font-bold text-zinc-950">Teams &amp; data access</p>
                  <p className="mt-4 font-display text-[40px] font-bold leading-none text-zinc-950">Custom</p>
                  <p className="mt-5 text-[14px] leading-relaxed text-zinc-600">
                    Multiple seats for a brokerage, raw data by API or CSV, and custom reports.
                  </p>
                </div>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Terminal%20Team%20Access`}
                  className="mt-8 inline-flex items-center gap-2 self-start rounded-full border border-zinc-950/15 bg-white/60 px-5 py-3 font-display text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-950 hover:text-white"
                >
                  Contact us <ArrowUpRight size={15} strokeWidth={2} />
                </a>
              </StaggerItem>
            </Stagger>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="relative scroll-mt-16 overflow-hidden bg-white">
          <div aria-hidden className="pointer-events-none absolute -right-24 top-24 size-[380px] rounded-full bg-lime/25 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionHeading
                eyebrow="FAQ"
                title="How Terminal works."
                body="Where the listings come from, how often they update and what the numbers mean."
              />
              <Reveal>
                <p className="mt-6 text-[14px] text-zinc-500">
                  Still have a question?{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-zinc-950 underline decoration-lime decoration-2 underline-offset-4">
                    E-mail us
                  </a>
                </p>
              </Reveal>
            </div>
            <Reveal>
              <Faq items={FAQ} />
            </Reveal>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden bg-[#0B0C0A]">
          {/* brand backdrop: grainy lime-to-black gradient with drifting particles */}
          <GrainField variant="corner" />
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
                className="glass-dark inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-display text-[14px] font-semibold text-white transition-colors hover:bg-white/15"
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
