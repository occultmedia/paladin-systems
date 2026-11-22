/*
 * Master Market: reads `v_master_market` (one flat row per active listing,
 * see supabase/migrations/20261122000000_delta_pipeline.sql) and maps each
 * row to the `Listing` type the dashboard already renders. RLS means members
 * only ever receive active listings with a Confidence Score above 0.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MasterMarketRow } from "./database.types";
import type {
  Agency,
  CommercialListing,
  LandListing,
  Listing,
  ListingAgent,
  ListingBase,
  ListingSignal,
  PriceEvent,
  PropertyType,
} from "./aruba-data";

const num = (n: number | null | undefined, fallback = 0) => (n == null ? fallback : Number(n));

/** Narrow a flat database row to the dashboard's Listing union. */
export function rowToListing(r: MasterMarketRow): Listing {
  const history: PriceEvent[] = r.price_history.map((e) => ({
    date: e.date,
    event: e.event,
    price_usd: Number(e.price_usd),
    change_pct: e.change_pct == null ? null : Number(e.change_pct),
  }));
  const agency: Agency = { ...r.agency };
  const agent: ListingAgent | null = r.agent ? { ...r.agent, title: r.agent.title ?? "" } : null;

  const base: ListingBase = {
    listing_id: r.listing_id,
    market_id: r.market_id,
    asset_name: r.asset_name,
    district: r.district,
    lat: r.lat,
    lng: r.lng,
    tenure: r.tenure,
    lease_years_left: r.lease_years_left,
    pool: r.pool,
    is_new: r.is_new,
    price_history: history,
    last_price_change: history.length > 1 ? history[history.length - 1] : null,
    status: r.status,
    status_changed: r.status_changed_at ? r.status_changed_at.slice(0, 10) : null,
    asking_price_usd: Number(r.asking_price_usd),
    price_per_sqft_usd: Math.round(num(r.price_per_sqft_usd)),
    price_change_pct: num(r.price_change_pct),
    days_on_market: r.days_on_market,
    first_seen: r.first_seen,
    last_scraped: r.last_scraped,
    last_found_at: r.last_found_at,
    confidence_score: r.confidence_score,
    source: r.source,
    source_url: r.source_url,
    agency,
    agent,
    signal: r.signal,
    photo_url: r.photo_url,
  };

  if (r.category === "Land") {
    const land: LandListing = {
      ...base,
      category: "Land",
      property_type: "Land",
      lot_sqft: num(r.lot_sqft),
      zoning: r.zoning ?? "Residential",
      district_land_psf_usd: num(r.district_psf_usd),
      price_vs_district_pct: num(r.price_vs_district_pct),
    };
    return land;
  }
  if (r.category === "Commercial") {
    const commercial: CommercialListing = {
      ...base,
      category: "Commercial",
      property_type: "Commercial",
      commercial_use: r.commercial_use ?? "Mixed-use",
      built_sqft: num(r.built_sqft),
      lot_sqft: r.lot_sqft,
      district_commercial_psf_usd: num(r.district_psf_usd),
      price_vs_district_pct: num(r.price_vs_district_pct),
    };
    return commercial;
  }
  const home: ListingSignal = {
    ...base,
    category: "Property",
    property_type: r.property_type as PropertyType,
    bedrooms: num(r.bedrooms),
    bathrooms: num(r.bathrooms),
    built_sqft: num(r.built_sqft),
    lot_sqft: r.lot_sqft,
    comps_psf_usd: num(r.comps_psf_usd),
    comps_count: num(r.comps_count),
    price_vs_comps_pct: num(r.price_vs_comps_pct),
  };
  return home;
}

/** Every listing in the Master Market view for one market. */
export async function fetchMasterMarket(sb: SupabaseClient<Database>, marketId: string): Promise<Listing[]> {
  const { data, error } = await sb
    .from("v_master_market")
    .select("*")
    .eq("market_id", marketId)
    .order("first_seen", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToListing);
}
