/*
 * AI Signal: analysis of the daily scrape (the "message of the day") and a
 * short analyst note on every listing.
 *
 * This module is pure (no React, no fetch) so it runs on the server route and
 * in tests. It does two things:
 *   1. builds the FACTS the model is allowed to use (comps, price history,
 *      what changed in the scrape), so the AI never has to guess numbers;
 *   2. writes a COMPUTED version of the same note from those facts. The API
 *      route returns it when no ANTHROPIC_API_KEY is set or the call fails,
 *      and marks it `source: "computed"` so the UI never claims otherwise.
 */

import type { Listing, ScrapeRun } from "./aruba-data";

/* ── Shapes returned to the UI ─────────────────────────────────────────── */

export type Verdict = "Opportunity" | "Fair value" | "Overpriced" | "Watch";
export const VERDICTS: Verdict[] = ["Opportunity", "Fair value", "Overpriced", "Watch"];

export interface ListingNote {
  verdict: Verdict;
  headline: string; // one line, the take
  analysis: string; // 2-3 sentences
  points: string[]; // 2-4 short supporting facts
  next_step: string; // what an agent should do with it
}

export interface MarketBrief {
  headline: string;
  summary: string; // 2-3 sentences
  points: string[]; // 3-5 takeaways from the latest scrapes
  watch: Array<{ listing_id: string; reason: string }>; // up to 3 to look at today
}

export type AISource = "claude" | "computed";
export type WithSource<T> = T & { source: AISource; generated_at: string };

/* ── helpers ────────────────────────────────────────────────────────────── */

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const usd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString("en-US")}`);
const pct = (n: number, d = 1) => `${n > 0 ? "+" : ""}${n.toFixed(d)}%`;
const kindOf = (l: Listing) =>
  l.category === "Property" ? l.property_type.toLowerCase() : l.category === "Land" ? "land parcel" : `${l.commercial_use.toLowerCase()} building`;

const COMPACT = new Set(["Condo", "Apartment", "Penthouse", "Townhouse"]);
/** Comparable group: "villas & estates", "condos & apartments", "land" or "commercial". */
const segmentOf = (l: Listing) =>
  l.category === "Property" ? (COMPACT.has(l.property_type) ? "condos & apartments" : "villas & estates") : l.category === "Land" ? "land" : "commercial";

/* ── Listing facts ─────────────────────────────────────────────────────── */

export interface ListingFacts {
  listing_id: string;
  name: string;
  kind: string;
  district: string;
  status: string;
  tenure: string;
  lease_years_left: number | null;
  asking_price_usd: number;
  price_per_sqft_usd: number;
  days_on_market: number;
  change_since_listed_pct: number;
  price_history: Array<{ date: string; event: string; price_usd: number; change_pct: number | null }>;
  drops: number;
  increases: number;
  size: Record<string, number | string | null>;
  comps: {
    basis: string;
    count: number;
    median_psf_usd: number;
    vs_median_pct: number; // this listing's $/sqft vs the comp median
    median_days_on_market: number;
    rank_cheapest_psf: number; // 1 = cheapest per sqft among comps
  };
  scoring: Record<string, number | string>;
}

export function listingFacts(l: Listing, all: Listing[]): ListingFacts {
  // Comps: same segment in the same district, falling back to island-wide.
  // Homes split into villas/estates vs apartments/condos/townhouses, since
  // their price per sq ft is not comparable.
  const seg = segmentOf(l);
  const sameCat = all.filter((x) => segmentOf(x) === seg && x.status !== "Sold");
  const inDistrict = sameCat.filter((x) => x.district === l.district);
  const pool = inDistrict.length >= 3 ? inDistrict : sameCat;
  const psfs = pool.map((x) => x.price_per_sqft_usd);
  const medPsf = median(psfs);
  const rank = [...psfs].sort((a, b) => a - b).indexOf(l.price_per_sqft_usd) + 1;

  const size: ListingFacts["size"] =
    l.category === "Property"
      ? { bedrooms: l.bedrooms, bathrooms: l.bathrooms, built_sqft: l.built_sqft, lot_sqft: l.lot_sqft, pool: l.pool }
      : l.category === "Land"
        ? { lot_sqft: l.lot_sqft, zoning: l.zoning }
        : { built_sqft: l.built_sqft, lot_sqft: l.lot_sqft, use: l.commercial_use };

  const scoring: ListingFacts["scoring"] =
    l.category === "Property"
      ? {
          signal: l.signal,
          projected_nightly_rate_usd: l.sequence_adr_usd,
          projected_occupancy_pct: l.projected_occupancy_pct,
          projected_gross_yield_pct: l.projected_gross_yield_pct,
          yield_vs_market_bps: l.yield_spread_bps,
        }
      : l.category === "Land"
        ? { signal: l.signal, district_land_psf_usd: l.district_land_psf_usd, price_vs_district_pct: l.price_vs_district_pct }
        : { signal: l.signal, district_commercial_psf_usd: l.district_commercial_psf_usd, price_vs_district_pct: l.price_vs_district_pct };

  return {
    listing_id: l.listing_id,
    name: l.asset_name,
    kind: kindOf(l),
    district: l.district,
    status: l.status,
    tenure: l.tenure,
    lease_years_left: l.lease_years_left,
    asking_price_usd: l.asking_price_usd,
    price_per_sqft_usd: l.price_per_sqft_usd,
    days_on_market: l.days_on_market,
    change_since_listed_pct: l.price_change_pct,
    price_history: l.price_history.map((e) => ({ date: e.date, event: e.event, price_usd: e.price_usd, change_pct: e.change_pct })),
    drops: l.price_history.filter((e) => e.event === "Price drop").length,
    increases: l.price_history.filter((e) => e.event === "Price increase").length,
    size,
    comps: {
      basis: pool === inDistrict ? `${seg} in ${l.district}` : `${seg} island-wide`,
      count: pool.length,
      median_psf_usd: Math.round(medPsf),
      vs_median_pct: medPsf ? Math.round(((l.price_per_sqft_usd - medPsf) / medPsf) * 1000) / 10 : 0,
      median_days_on_market: Math.round(median(pool.map((x) => x.days_on_market))),
      rank_cheapest_psf: rank,
    },
    scoring,
  };
}

/** Rule-based note from the facts (used when the model is unavailable). */
export function computedListingNote(f: ListingFacts): ListingNote {
  const c = f.comps;
  const cheap = c.vs_median_pct <= -10;
  const rich = c.vs_median_pct >= 15;
  const stale = f.days_on_market > Math.max(90, c.median_days_on_market * 1.5);
  const cut = f.change_since_listed_pct <= -3;
  const yieldBps = typeof f.scoring.yield_vs_market_bps === "number" ? f.scoring.yield_vs_market_bps : null;

  const verdict: Verdict =
    f.status !== "Available"
      ? "Watch"
      : (cheap || (yieldBps ?? 0) >= 100) && !rich
        ? "Opportunity"
        : rich || (yieldBps ?? 0) <= -100
          ? "Overpriced"
          : stale || cut
            ? "Watch"
            : "Fair value";

  const segName = c.basis.replace(/ (in .*|island-wide)$/, "");
  const psfLine = `${usd(f.price_per_sqft_usd)}/sq ft is ${Math.abs(c.vs_median_pct).toFixed(0)}% ${c.vs_median_pct < 0 ? "below" : "above"} the ${usd(c.median_psf_usd)} median for ${c.basis} (${c.count} comps).`;
  const headline =
    f.status !== "Available"
      ? `${f.status} after ${f.days_on_market} days; useful as a pricing comp for ${f.district}.`
      : verdict === "Opportunity"
        ? cheap
          ? `${Math.abs(c.vs_median_pct).toFixed(0)}% under comparable ${segName} per sq ft${cut ? " after a price cut" : ""}: worth a call today.`
          : `Projected rental yield ${f.scoring.projected_gross_yield_pct}% beats the market by ${yieldBps} bps: worth a call today.`
        : verdict === "Overpriced"
          ? rich
            ? `${c.vs_median_pct.toFixed(0)}% above comparable ${segName} per sq ft; expect room to negotiate.`
            : `Priced above what it would earn as a rental: ${f.scoring.projected_gross_yield_pct}% yield, ${Math.abs(yieldBps ?? 0)} bps under market.`
          : verdict === "Watch"
            ? stale
              ? `${f.days_on_market} days listed with ${f.drops ? `${f.drops} price cut${f.drops > 1 ? "s" : ""}` : "no cuts yet"}; the seller may be ready to move.`
              : `Price is moving: ${pct(f.change_since_listed_pct)} since listed.`
            : `In line with its comps; a fair ask for ${f.district}.`;

  const points = [psfLine];
  if (f.drops || f.increases)
    points.push(`${f.drops} price drop${f.drops === 1 ? "" : "s"}, ${f.increases} increase${f.increases === 1 ? "" : "s"}; ${pct(f.change_since_listed_pct)} since first listed.`);
  else if (f.days_on_market === 0) points.push("Listed today, so there is no price history yet.");
  else points.push(`No price changes since it was listed ${f.days_on_market} day${f.days_on_market === 1 ? "" : "s"} ago.`);
  if (f.days_on_market > 0) points.push(`${f.days_on_market} days on market vs a ${c.median_days_on_market}-day median for its comps.`);
  if (yieldBps !== null)
    points.push(`Projected gross rental yield ${f.scoring.projected_gross_yield_pct}% (${yieldBps >= 0 ? "+" : ""}${yieldBps} bps vs market).`);
  if (f.tenure === "Erfpacht") points.push(`Leasehold (erfpacht)${f.lease_years_left ? ` with ${f.lease_years_left} years left` : ""}; check the lease terms.`);

  const analysis =
    `This ${f.kind} in ${f.district} is asking ${usd(f.asking_price_usd)}. ` +
    (cheap ? "On price per square foot it is one of the cheaper options in its set. " : rich ? "On price per square foot it is one of the dearer options in its set. " : "On price per square foot it sits close to its comps. ") +
    (f.days_on_market === 0 ? "It first appeared in today's scrape, so expect interest from other agents quickly." : stale ? "Time on market is long for this segment, which usually means a softer seller." : cut ? "The seller has already lowered the price, so there may be more flexibility." : "Nothing in the history suggests pressure on the seller yet.");

  const next_step =
    f.status !== "Available"
      ? "Use the final ask as a comp when pricing similar listings."
      : verdict === "Opportunity"
        ? "Match it with interested clients and book a viewing before it moves."
        : verdict === "Overpriced"
          ? `Pin it and wait for a cut; a fair offer is closer to ${usd(c.median_psf_usd * (f.asking_price_usd / f.price_per_sqft_usd))}.`
          : verdict === "Watch"
            ? "Pin it and call the listing agent to test how flexible the seller is."
            : "Send it to clients who want this area and budget.";

  return { verdict, headline, analysis, points: points.slice(0, 4), next_step };
}

/* ── Market brief facts ────────────────────────────────────────────────── */

export interface BriefFacts {
  scrape_date: string;
  listings_checked_today: number;
  today: { new: number; price_drops: number; price_increases: number; under_contract: number; sold: number };
  last_7_days: { new: number; price_drops: number; price_increases: number; under_contract_or_sold: number };
  biggest_moves_7d: Array<{ listing_id: string; name: string; district: string; kind: string; from_usd: number; to_usd: number; change_pct: number; date: string }>;
  new_today: Array<{ listing_id: string; name: string; district: string; kind: string; asking_usd: number; vs_comp_median_psf_pct: number }>;
  went_off_market_7d: Array<{ listing_id: string; name: string; district: string; status: string; asking_usd: number; days_on_market: number }>;
  active_by_district: Array<{ district: string; active: number; median_asking_usd: number }>;
  stale_with_cuts: Array<{ listing_id: string; name: string; district: string; days_on_market: number; change_since_listed_pct: number }>;
}

export function briefFacts(runs: ScrapeRun[], all: Listing[]): BriefFacts {
  const today = runs[0];
  const week = runs.slice(0, 7);
  const moves = week.flatMap((r) => r.price_changes);
  const isDrop = (c: { change: { event: string } }) => c.change.event === "Price drop";

  const active = all.filter((l) => l.status === "Available");
  const byDistrict = new Map<string, Listing[]>();
  active.forEach((l) => byDistrict.set(l.district, [...(byDistrict.get(l.district) ?? []), l]));

  return {
    scrape_date: today.date,
    listings_checked_today: today.listings_checked,
    today: {
      new: today.new_listings.length,
      price_drops: today.price_changes.filter(isDrop).length,
      price_increases: today.price_changes.filter((c) => !isDrop(c)).length,
      under_contract: today.status_changes.filter((l) => l.status === "Under contract").length,
      sold: today.status_changes.filter((l) => l.status === "Sold").length,
    },
    last_7_days: {
      new: week.reduce((n, r) => n + r.new_listings.length, 0),
      price_drops: moves.filter(isDrop).length,
      price_increases: moves.filter((c) => !isDrop(c)).length,
      under_contract_or_sold: week.reduce((n, r) => n + r.status_changes.length, 0),
    },
    biggest_moves_7d: [...moves]
      .sort((a, b) => Math.abs(b.change.change_pct ?? 0) - Math.abs(a.change.change_pct ?? 0))
      .slice(0, 5)
      .map((c) => ({
        listing_id: c.listing.listing_id,
        name: c.listing.asset_name,
        district: c.listing.district,
        kind: kindOf(c.listing),
        from_usd: c.previous_price_usd,
        to_usd: c.change.price_usd,
        change_pct: c.change.change_pct ?? 0,
        date: c.change.date,
      })),
    new_today: today.new_listings.slice(0, 6).map((l) => ({
      listing_id: l.listing_id,
      name: l.asset_name,
      district: l.district,
      kind: kindOf(l),
      asking_usd: l.asking_price_usd,
      vs_comp_median_psf_pct: listingFacts(l, all).comps.vs_median_pct,
    })),
    went_off_market_7d: week
      .flatMap((r) => r.status_changes)
      .slice(0, 5)
      .map((l) => ({ listing_id: l.listing_id, name: l.asset_name, district: l.district, status: l.status, asking_usd: l.asking_price_usd, days_on_market: l.days_on_market })),
    active_by_district: [...byDistrict.entries()]
      .map(([district, ls]) => ({ district, active: ls.length, median_asking_usd: Math.round(median(ls.map((l) => l.asking_price_usd))) }))
      .sort((a, b) => b.active - a.active)
      .slice(0, 6),
    stale_with_cuts: active
      .filter((l) => l.days_on_market > 120 && l.price_change_pct < 0)
      .sort((a, b) => a.price_change_pct - b.price_change_pct)
      .slice(0, 4)
      .map((l) => ({ listing_id: l.listing_id, name: l.asset_name, district: l.district, days_on_market: l.days_on_market, change_since_listed_pct: l.price_change_pct })),
  };
}

export function computedBrief(f: BriefFacts): MarketBrief {
  const t = f.today;
  const w = f.last_7_days;
  const tone = w.price_drops > w.price_increases * 1.5 ? "softening" : w.price_increases > w.price_drops * 1.5 ? "firming" : "steady";
  const top = f.biggest_moves_7d[0];
  const busiest = f.active_by_district[0];

  const points: string[] = [];
  if (t.new) points.push(`${t.new} new listing${t.new > 1 ? "s" : ""} today${f.new_today[0] ? `, including ${f.new_today[0].name} in ${f.new_today[0].district} at ${usd(f.new_today[0].asking_usd)}` : ""}.`);
  if (top) points.push(`Biggest move this week: ${top.name} (${top.district}) ${top.change_pct < 0 ? "cut" : "raised"} ${Math.abs(top.change_pct).toFixed(1)}% to ${usd(top.to_usd)}.`);
  points.push(`${w.price_drops} price drops vs ${w.price_increases} increases over 7 days: sellers are ${tone === "softening" ? "giving ground" : tone === "firming" ? "holding firm" : "mostly holding"}.`);
  if (w.under_contract_or_sold) points.push(`${w.under_contract_or_sold} listing${w.under_contract_or_sold > 1 ? "s" : ""} went under contract or sold this week.`);
  if (busiest) points.push(`${busiest.district} has the most supply: ${busiest.active} active listings, median ask ${usd(busiest.median_asking_usd)}.`);

  const watch = [
    ...f.new_today.filter((n) => n.vs_comp_median_psf_pct <= -5).map((n) => ({ listing_id: n.listing_id, reason: `New today and ${Math.abs(n.vs_comp_median_psf_pct).toFixed(0)}% under its comps per sq ft.` })),
    ...f.biggest_moves_7d.filter((m) => m.change_pct < 0).map((m) => ({ listing_id: m.listing_id, reason: `Price cut ${Math.abs(m.change_pct).toFixed(1)}% to ${usd(m.to_usd)}.` })),
    ...f.stale_with_cuts.map((s) => ({ listing_id: s.listing_id, reason: `${s.days_on_market} days listed and ${pct(s.change_since_listed_pct)} since listing; seller may negotiate.` })),
  ]
    .filter((x, i, arr) => arr.findIndex((y) => y.listing_id === x.listing_id) === i)
    .slice(0, 3);

  return {
    headline: `Market ${tone}: ${t.new} new, ${t.price_drops} cut${t.price_drops === 1 ? "" : "s"}, ${t.price_increases} increase${t.price_increases === 1 ? "" : "s"} today.`,
    summary: `Today's scrape checked ${f.listings_checked_today} listings. Over the past week there were ${w.new} new listings and ${w.price_drops + w.price_increases} price changes, with ${w.price_drops > w.price_increases ? "cuts outnumbering increases" : w.price_increases > w.price_drops ? "increases outnumbering cuts" : "cuts and increases evenly split"}.`,
    points: points.slice(0, 5),
    watch,
  };
}

/* ── JSON schemas for Claude structured output ─────────────────────────── */

export const LISTING_NOTE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: VERDICTS },
    headline: { type: "string" },
    analysis: { type: "string" },
    points: { type: "array", items: { type: "string" } },
    next_step: { type: "string" },
  },
  required: ["verdict", "headline", "analysis", "points", "next_step"],
  additionalProperties: false,
} as const;

export const MARKET_BRIEF_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    points: { type: "array", items: { type: "string" } },
    watch: {
      type: "array",
      items: {
        type: "object",
        properties: { listing_id: { type: "string" }, reason: { type: "string" } },
        required: ["listing_id", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["headline", "summary", "points", "watch"],
  additionalProperties: false,
} as const;
