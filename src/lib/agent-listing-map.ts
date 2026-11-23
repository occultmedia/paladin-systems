/*
 * Maps a row of `v_agent_listings` (a listing an agent added by hand) to the
 * dashboard's Listing type. Shared by the browser (lib/agent-listings.ts)
 * and the AI Signal route on the server.
 */

import type { AgentListingViewRow } from "./database.types";
import {
  DISTRICT_CENTERS,
  type Agency,
  type Listing,
  type ListingAgent,
  type ListingBase,
  type ListingStatus,
  type Signal,
} from "./aruba-data";

const DAY = 864e5;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const UNIT_TYPES = ["Condo", "Apartment", "Townhouse"];

/** Same idea as the indexed listings: compare $/sq ft with similar listings, same district when there are 3+. */
function compsFor(row: AgentListingViewRow, market: Listing[]) {
  const live = market.filter((l) => l.category === row.asset_class && !l.member && l.status !== "Sold" && l.status !== "De-listed");
  const kind =
    row.asset_class === "Property"
      ? live.filter((l) => UNIT_TYPES.includes(l.property_type) === UNIT_TYPES.includes(row.property_type))
      : live;
  const local = kind.filter((l) => l.district === row.district);
  const pool = local.length >= 3 ? local : kind;
  return { psf: Math.round(median(pool.map((l) => l.price_per_sqft_usd))), count: pool.length };
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
/** No pin: place it near the district centre (shown as approximate). */
function approxSpot(district: string, id: string) {
  const [lat, lng] = DISTRICT_CENTERS[district] ?? [12.52, -70.0];
  const h = hash(id);
  const a = ((h % 1000) / 1000) * Math.PI * 2;
  const r = 0.002 + (((h >> 10) % 100) / 100) * 0.003;
  return { lat: lat + Math.sin(a) * r, lng: lng + Math.cos(a) * r * 0.6 };
}

const STATUS_MAP: Record<AgentListingViewRow["listing_status"], ListingStatus> = {
  "For sale": "For sale",
  "Under contract": "Under contract",
  Sold: "Sold",
  Withdrawn: "De-listed",
};

export function agentRowToListing(row: AgentListingViewRow, market: Listing[], myId: string | null): Listing {
  const price = Number(row.asking_price_usd);
  const listed = row.created_at.slice(0, 10);
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(row.created_at)) / DAY));
  const company = row.owner_company.trim();
  const agency: Agency = {
    id: `member-${row.owner_id}`,
    name: company || row.owner_name,
    website: null,
    logo_url: row.owner_logo_url,
    color: "#0A0A0A",
  };
  const agent: ListingAgent = {
    id: row.owner_id,
    name: row.owner_name,
    title: row.owner_title ?? (row.owner_role === "Agent" ? "Agent" : row.owner_role),
    phone: row.owner_phone || row.owner_whatsapp || null,
    whatsapp: Boolean(row.owner_whatsapp),
    email: row.owner_email,
    photo_url: row.owner_photo_url,
    agency_id: agency.id,
  };
  const pinned = row.lat != null && row.lng != null;
  const spot = pinned ? { lat: row.lat!, lng: row.lng! } : approxSpot(row.district, row.id);
  const comps = compsFor(row, market);
  const size = row.asset_class === "Land" ? row.lot_sqft ?? 0 : row.built_sqft ?? 0;
  const psf = size ? Math.round(price / size) : 0;
  const vs = comps.psf && psf ? Math.round(((psf - comps.psf) / comps.psf) * 1000) / 10 : 0;
  const signal: Signal = comps.count < 2 || !psf ? "AT_MARKET" : vs <= -10 ? "UNDERVALUED" : vs >= 10 ? "OVERPRICED" : "AT_MARKET";

  const base: ListingBase = {
    listing_id: row.ref,
    market_id: row.market_id,
    asset_name: row.asset_name,
    district: row.district,
    ...spot,
    tenure: row.tenure,
    lease_years_left: row.lease_years_left,
    pool: row.asset_class === "Land" ? null : row.pool,
    is_new: days < 1,
    price_history: [{ date: listed, event: "Listed", price_usd: price, change_pct: null }],
    last_price_change: null,
    status: STATUS_MAP[row.listing_status],
    status_changed: row.listing_status === "For sale" ? null : row.updated_at.slice(0, 10),
    asking_price_usd: price,
    price_per_sqft_usd: psf,
    price_change_pct: 0,
    days_on_market: days,
    first_seen: listed,
    last_scraped: row.updated_at,
    last_found_at: row.updated_at,
    confidence_score: 100, // the listing agent vouches for it
    source: agency.name,
    source_url: null,
    agency,
    agent,
    signal,
    photo_url: row.photo_url,
    member: {
      id: row.id,
      visibility: row.visibility,
      mine: row.owner_id === myId,
      owner_id: row.owner_id,
      pinned,
      address: row.address,
      notes: row.notes,
      raw_status: row.listing_status,
      went_public: row.market_listing_id && row.went_public_at ? { listing_id: row.market_listing_id, at: row.went_public_at } : null,
      match:
        row.match_kind && row.match_ref && row.match_score != null
          ? { kind: row.match_kind, ref: row.match_ref, name: row.match_name ?? row.match_ref, score: row.match_score }
          : null,
      dup_acknowledged: row.dup_acknowledged,
    },
  };

  if (row.asset_class === "Land")
    return {
      ...base,
      category: "Land",
      property_type: "Land",
      lot_sqft: row.lot_sqft ?? 0,
      zoning: row.zoning ?? "Residential",
      district_land_psf_usd: comps.psf,
      price_vs_district_pct: vs,
    };
  if (row.asset_class === "Commercial")
    return {
      ...base,
      category: "Commercial",
      property_type: "Commercial",
      commercial_use: row.commercial_use ?? "Mixed-use",
      built_sqft: row.built_sqft ?? 0,
      lot_sqft: row.lot_sqft,
      district_commercial_psf_usd: comps.psf,
      price_vs_district_pct: vs,
    };
  return {
    ...base,
    category: "Property",
    property_type: row.property_type as Exclude<AgentListingViewRow["property_type"], "Land" | "Commercial">,
    bedrooms: row.bedrooms ?? 0,
    bathrooms: Number(row.bathrooms ?? 0),
    built_sqft: row.built_sqft ?? 0,
    lot_sqft: row.lot_sqft,
    comps_psf_usd: comps.psf,
    comps_count: comps.count,
    price_vs_comps_pct: vs,
  };
}

