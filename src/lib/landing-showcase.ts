/*
 * The landing page's live showcase: the real market, read once an hour from
 * the database function landing_showcase() (supabase/migrations/
 * 20261128060000_landing_showcase.sql). It returns counts, one map pin per
 * home or building project and a few real homes to tour, and never an
 * agency, agent, link or photo. Server-side only; null when it cannot be
 * read, so the page falls back to its sample data.
 */

import type { AssetClass, SignalDb } from "@/lib/database.types";

export type ShowcaseHome = {
  ref: string;
  title: string;
  district: string;
  asset_class: AssetClass;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  built_sqft: number | null;
  lot_sqft: number | null;
  price: number;
  tenure: "Eigendom" | "Erfpacht" | null;
  signal: SignalDb | null;
  vs_comps: number | null;
  psf: number | null;
  comps_psf: number | null;
  comps_count: number | null;
  status: "For sale" | "Under contract" | "Sold" | "De-listed";
  agencies: number;
  first_seen: string;
  lat: number | null;
  lng: number | null;
};

export type Showcase = {
  as_of: string;
  counts: {
    indexed: number;
    for_sale: number;
    under_contract: number;
    sold: number;
    new_today: number;
    below_market: number;
    several_agencies: number;
    leasehold: number;
  };
  /** k: listing ref, or "p:<project id>"; c: asset class; s: signal; u: units; n: agencies; lo/hi: price range */
  pins: Array<{ k: string; lat: number; lng: number; c: AssetClass; s: SignalDb | "NO_SIGNAL"; u: number; n: number; lo: number; hi: number; fresh: boolean }>;
  picks: {
    newest: ShowcaseHome | null;
    below: ShowcaseHome | null;
    several: ShowcaseHome | null;
    project: { key: string; name: string; district: string | null; units: number; lo: number; hi: number; lat: number; lng: number } | null;
    leasehold: ShowcaseHome | null;
    contract: ShowcaseHome | null;
    sold: ShowcaseHome | null;
    reduced: ShowcaseHome | null;
    homes: ShowcaseHome[];
    auction: { district: string | null; property_type: string | null; tenure: string | null; date: string; status: string; lat: number; lng: number } | null;
  };
};

// Second line of defence: no agency name ever reaches the page, even in a title.
const AGENCY_WORDS = /\b(re\/?max|keller williams|kw|bold real estate|mpg|weichert|coldwell banker|all property aruba|berkshire hathaway|bhhs|sotheby'?s|century ?21)\b/i;
const scrub = (h: ShowcaseHome | null): ShowcaseHome | null =>
  h && AGENCY_WORDS.test(h.title) ? { ...h, title: `${h.property_type || "Home"} in ${h.district}` } : h;

export async function getShowcase(): Promise<Showcase | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/landing_showcase`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const s = (await res.json()) as Showcase;
    if (!s?.counts || !Array.isArray(s.pins)) return null;
    const p = s.picks;
    return {
      ...s,
      picks: {
        ...p,
        newest: scrub(p.newest),
        below: scrub(p.below),
        several: scrub(p.several),
        leasehold: scrub(p.leasehold),
        contract: scrub(p.contract),
        sold: scrub(p.sold),
        reduced: scrub(p.reduced),
        homes: (p.homes ?? []).map((h) => scrub(h)!).filter(Boolean),
        project: p.project && AGENCY_WORDS.test(p.project.name) ? { ...p.project, name: `Project in ${p.project.district ?? "Aruba"}` } : p.project,
      },
    };
  } catch {
    return null;
  }
}
