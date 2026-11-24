/*
 * Data for the "AI reads the market" visuals on the landing and auth pages.
 * Built from the same Index data and comps the dashboard uses.
 */

import type { ScanRow } from "@/components/ai/ai-visuals";
import { ALL_LISTINGS, INDEX_RUNS, type Listing } from "./aruba-data";
import { briefFacts, computedBrief, listingFacts, type MarketBrief } from "./signal-ai";

const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const kind = (l: Listing) => (l.category === "Property" ? l.property_type : l.category === "Land" ? "Land" : l.commercial_use);

function tagFor(l: Listing): Pick<ScanRow, "tag" | "tone"> {
  if (l.status !== "For sale") return { tag: l.status, tone: "flat" };
  if (l.is_new) return { tag: "New today", tone: "new" };
  const last = l.last_price_change;
  if (last && last.event === "Price drop" && last.change_pct !== null) return { tag: `Cut ${Math.abs(last.change_pct).toFixed(1)}%`, tone: "down" };
  if (last && last.event === "Price increase" && last.change_pct !== null) return { tag: `Up ${last.change_pct.toFixed(1)}%`, tone: "up" };
  const vs = listingFacts(l, ALL_LISTINGS).comps.vs_median_pct;
  if (vs === null) return { tag: l.district, tone: "flat" };
  if (vs <= -10) return { tag: `${Math.abs(vs).toFixed(0)}% under comps`, tone: "up" };
  if (vs >= 15) return { tag: `${vs.toFixed(0)}% over comps`, tone: "down" };
  return { tag: "In line with comps", tone: "flat" };
}

export function scanRows(count = 12): ScanRow[] {
  // A varied sample: a few of each kind of finding, interleaved.
  const rows = ALL_LISTINGS.map((l) => ({ l, ...tagFor(l) }));
  const groups = (["new", "down", "up", "flat"] as const).map((t) => rows.filter((r) => r.tone === t));
  const out: typeof rows = [];
  for (let i = 0; out.length < count && i < 20; i++) groups.forEach((g) => g[i] && out.length < count && out.push(g[i]));
  return out.map(({ l, tag, tone }) => ({
    id: l.listing_id,
    name: l.asset_name,
    meta: `${kind(l)} · ${l.district}`,
    price: usdShort(l.asking_price_usd),
    tag,
    tone,
  }));
}

export function marketBrief(): MarketBrief {
  return computedBrief(briefFacts(INDEX_RUNS, ALL_LISTINGS));
}

export const MARKET_TOTAL = INDEX_RUNS[0].listings_checked;
