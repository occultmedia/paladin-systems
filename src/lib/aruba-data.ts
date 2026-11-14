/**
 * Sequence Data — Aruba data layer.
 * Types mirror the Supabase Postgres tables; everything below "Mock data"
 * is placeholder until the scraper feed is live. Swap `repository` for the
 * Supabase implementation (sketch below) and the UI keeps working.
 */

/* ─────────────────────────────────────────────────────────────────────────
 * Types — mirror the Supabase Postgres tables (snake_case on the wire)
 * ──────────────────────────────────────────────────────────────────────── */

/** table: market_snapshots */
export interface MarketSnapshot {
  market_id: string;
  as_of: string; // ISO timestamp
  avg_occupancy_pct: number;
  avg_occupancy_yoy_pct: number;
  avg_daily_rate_usd: number;
  avg_daily_rate_yoy_pct: number;
  est_gross_yield_pct: number;
  est_gross_yield_yoy_pct: number;
  sample_size: number;
}

/** table: market_monthly_performance */
export interface MonthlyPerformance {
  market_id: string;
  month: string; // 'YYYY-MM-01'
  occupancy_pct: number;
  adr_usd: number;
  revpar_usd: number;
}

/** view: v_active_listing_signals (scraped_listings joined with yield model) */
export type Signal = "UNDERVALUED" | "AT_MARKET" | "OVERPRICED";
/** Residential types (scored on short-term-rental yield). */
export type PropertyType = "Villa" | "Estate" | "Penthouse" | "Beach House" | "Condo" | "Apartment" | "Townhouse";
export const RESIDENTIAL_TYPES: PropertyType[] = ["Villa", "Estate", "Penthouse", "Beach House", "Condo", "Apartment", "Townhouse"];
export type CommercialUse = "Retail" | "Office" | "Hospitality" | "Mixed-use" | "Warehouse";
export const COMMERCIAL_USES: CommercialUse[] = ["Retail", "Office", "Hospitality", "Mixed-use", "Warehouse"];

export type Zoning = "Residential" | "Tourism" | "Commercial" | "Agricultural";
export const ZONINGS: Zoning[] = ["Residential", "Tourism", "Commercial", "Agricultural"];

/** Columns shared by every scraped listing. */
export interface ListingBase {
  listing_id: string;
  market_id: string;
  asset_name: string;
  district: string;
  asking_price_usd: number;
  price_per_sqft_usd: number; // built area for properties, lot for land
  price_change_pct: number; // since first scraped
  days_on_market: number;
  first_seen: string; // ISO date
  last_scraped: string; // ISO timestamp
  source: string;
  source_url: string | null;
  signal: Signal;
  lat: number;
  lng: number;
  photo_url: string | null; // main listing photo (scraped)
}

/** A house, villa or condo: scored on projected short-term-rental yield. */
export interface ListingSignal extends ListingBase {
  category: "Property";
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  built_sqft: number;
  lot_sqft: number | null; // null for penthouses
  sequence_adr_usd: number;
  projected_occupancy_pct: number;
  projected_annual_revenue_usd: number;
  projected_gross_yield_pct: number;
  yield_spread_bps: number; // vs market est_gross_yield_pct
}

/** A land parcel: scored on price per sq ft vs. the district's land average. */
export interface LandListing extends ListingBase {
  category: "Land";
  property_type: "Land";
  lot_sqft: number;
  zoning: Zoning;
  district_land_psf_usd: number;
  price_vs_district_pct: number; // negative = cheaper than district average
}

/** A commercial building: scored on price per sq ft vs. the district's commercial average. */
export interface CommercialListing extends ListingBase {
  category: "Commercial";
  property_type: "Commercial";
  commercial_use: CommercialUse;
  built_sqft: number;
  lot_sqft: number | null;
  district_commercial_psf_usd: number;
  price_vs_district_pct: number; // negative = cheaper than district average
}

/**
 * Supabase returns one flat row per listing (category = 'Property' | 'Land' |
 * 'Commercial', non-applicable columns null). Narrow on `category` in the client.
 */
export type Listing = ListingSignal | LandListing | CommercialListing;

export interface DashboardRepository {
  getMarketSnapshot(marketId: string): Promise<MarketSnapshot>;
  getMonthlyPerformance(marketId: string, months: number): Promise<MonthlyPerformance[]>;
  /** Featured property rows for the Yield Radar on the Rental Market tab. */
  getActiveListingSignals(marketId: string, limit: number): Promise<ListingSignal[]>;
  /** Every active scraped listing (properties and land), for the Active Listings tab. */
  getActiveListings(marketId: string): Promise<Listing[]>;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Mock data (shaped exactly like the rows Supabase will return)
 * ──────────────────────────────────────────────────────────────────────── */

export const MARKET_ID = "aw-lux";

export const MOCK_SNAPSHOT: MarketSnapshot = {
  market_id: MARKET_ID,
  as_of: "2026-11-13T10:00:00Z",
  avg_occupancy_pct: 76.4,
  avg_occupancy_yoy_pct: 4.2,
  avg_daily_rate_usd: 1480,
  avg_daily_rate_yoy_pct: 8.7,
  est_gross_yield_pct: 12.2,
  est_gross_yield_yoy_pct: -0.3,
  sample_size: 214,
};

export const MOCK_MONTHLY: MonthlyPerformance[] = (
  [
    ["2025-12-01", 84.1, 1890],
    ["2026-01-01", 88.6, 1820],
    ["2026-02-01", 90.2, 1760],
    ["2026-03-01", 87.4, 1690],
    ["2026-04-01", 81.0, 1450],
    ["2026-05-01", 71.3, 1240],
    ["2026-06-01", 74.8, 1310],
    ["2026-07-01", 76.9, 1340],
    ["2026-08-01", 63.2, 1120],
    ["2026-09-01", 61.5, 1080],
    ["2026-10-01", 66.8, 1180],
    ["2026-11-01", 71.0, 1360],
  ] as const
).map(([month, occupancy_pct, adr_usd]) => ({
  market_id: MARKET_ID,
  month,
  occupancy_pct,
  adr_usd,
  revpar_usd: Math.round((adr_usd * occupancy_pct) / 100),
}));

export const SCRAPED_AT = "2026-11-13T10:00:00Z";

/* id, name, type, district, beds, baths, built sqft, lot sqft, asking, ADR, occ %, days listed, price change %, source */
type RawRow = readonly [string, string, PropertyType, string, number, number, number, number | null, number, number, number, number, number, string];

export const RAW_LISTINGS: readonly RawRow[] = [
  ["AW-0412", "Malmok Beach Estate", "Estate", "Malmok", 7, 8, 9200, 21000, 12_500_000, 6850, 62, 41, 0, "Broker site"],
  ["AW-0388", "Noord Luxury Retreat", "Villa", "Noord", 6, 6.5, 6400, 14500, 7_950_000, 5200, 58, 73, -4.2, "Agency portal"],
  ["AW-0457", "Villa Serena, Eagle Beach", "Villa", "Eagle Beach", 5, 6, 5800, 9800, 9_800_000, 5400, 57, 22, 0, "Broker site"],
  ["AW-0291", "Palm Beach Ocean Pavilion", "Estate", "Palm Beach", 8, 9, 11200, 26000, 14_250_000, 7400, 49, 118, -6.5, "Agency portal"],
  ["AW-0503", "Savaneta Cove House", "Beach House", "Savaneta", 5, 5, 5100, 12000, 6_100_000, 5050, 51, 9, 0, "Private listing"],
  ["AW-0517", "Tierra del Sol Fairway Villa", "Villa", "Tierra del Sol", 5, 5.5, 5600, 11000, 5_400_000, 5000, 44, 15, 0, "Broker site"],
  ["AW-0322", "Arashi Dunes Residence", "Villa", "Arashi", 6, 7, 7000, 16000, 10_900_000, 6200, 52, 96, -3.1, "Agency portal"],
  ["AW-0466", "Gold Coast Ridge Villa", "Villa", "Gold Coast", 6, 6, 6600, 15500, 8_600_000, 5600, 53, 34, 0, "Broker site"],
  ["AW-0249", "Boca Catalina Cliff House", "Beach House", "Boca Catalina", 4, 4.5, 4300, 8200, 6_900_000, 5300, 55, 141, -8.0, "Private listing"],
  ["AW-0398", "Pos Chiquito Waterfront", "Villa", "Pos Chiquito", 5, 5, 5200, 10500, 5_950_000, 5000, 43, 63, -2.5, "Agency portal"],
  ["AW-0533", "Eagle Beach Sky Penthouse", "Penthouse", "Eagle Beach", 4, 4.5, 4800, null, 7_200_000, 5800, 50, 6, 0, "Developer"],
  ["AW-0187", "Palm Beach Grand Penthouse", "Penthouse", "Palm Beach", 5, 5.5, 6100, null, 11_400_000, 6900, 47, 204, -5.0, "Developer"],
  ["AW-0441", "Malmok Reef Villa", "Villa", "Malmok", 6, 6, 6900, 15800, 9_300_000, 6100, 55, 28, 0, "Broker site"],
  ["AW-0372", "Noord Hillcrest Estate", "Estate", "Noord", 7, 8, 10400, 32000, 16_800_000, 8200, 46, 87, 0, "Broker site"],
  ["AW-0549", "Santa Cruz Hacienda", "Estate", "Santa Cruz", 6, 6, 7800, 40000, 4_900_000, 5000, 38, 3, 0, "Private listing"],
  ["AW-0265", "Oranjestad Harbour Residence", "Penthouse", "Oranjestad", 4, 4, 4200, null, 4_600_000, 5000, 33, 152, -4.0, "Agency portal"],
  ["AW-0418", "Tierra del Sol Ocean Villa", "Villa", "Tierra del Sol", 7, 7.5, 8300, 18500, 11_900_000, 7100, 50, 47, 0, "Broker site"],
  ["AW-0306", "Arashi Beachfront Compound", "Estate", "Arashi", 9, 10, 13500, 34000, 18_500_000, 9500, 54, 176, -7.5, "Broker site"],
  ["AW-0492", "Savaneta Lagoon Villa", "Villa", "Savaneta", 5, 5, 5400, 13000, 5_750_000, 5100, 42, 19, 0, "Agency portal"],
  ["AW-0359", "Malmok Sunset House", "Beach House", "Malmok", 5, 5.5, 5700, 11800, 8_250_000, 5900, 48, 58, -1.8, "Private listing"],
  ["AW-0521", "Gold Coast Signature Villa", "Villa", "Gold Coast", 5, 6, 6200, 13400, 7_600_000, 5500, 47, 12, 0, "Developer"],
  ["AW-0233", "Eagle Beach Casa Blanca", "Villa", "Eagle Beach", 6, 6.5, 6500, 12500, 10_200_000, 5700, 49, 133, -3.5, "Broker site"],
  ["AW-0611", "Palm Beach Ocean Tower 1204", "Condo", "Palm Beach", 2, 2, 1450, null, 1_250_000, 680, 62, 14, 0, "Agency portal"],
  ["AW-0624", "Eagle Beach Residences 3B", "Condo", "Eagle Beach", 3, 3, 1900, null, 1_650_000, 820, 60, 31, -3.0, "Broker site"],
  ["AW-0637", "Oranjestad Harbourview 502", "Apartment", "Oranjestad", 2, 2, 1250, null, 690_000, 420, 58, 52, 0, "Agency portal"],
  ["AW-0642", "Noord Garden Apartment", "Apartment", "Noord", 2, 1.5, 1100, null, 520_000, 380, 61, 8, 0, "Private listing"],
  ["AW-0655", "Malmok Townhouse 7", "Townhouse", "Malmok", 3, 3.5, 2400, 3200, 1_480_000, 890, 57, 26, 0, "Broker site"],
  ["AW-0668", "Gold Coast Golf Townhouse", "Townhouse", "Gold Coast", 4, 4, 3100, 4200, 1_950_000, 1150, 52, 3, 0, "Developer"],
  ["AW-0673", "Savaneta Waterfront Condo", "Condo", "Savaneta", 2, 2, 1350, null, 780_000, 520, 55, 61, -5.0, "Agency portal"],
];

/** Mirrors the SQL in v_active_listing_signals so mock and prod agree. */
/*
 * Placeholder photos (Unsplash, free to use) until the scraper stores each
 * listing's own photo. Not photos of the actual listings.
 */
const U = (id: string) => `https://images.unsplash.com/photo-${id}`;
export const VILLA_PHOTOS = [
  "1596178067639-5c6e68aea6dc", "1724688078741-6d89e587e809", "1594479125841-ff7800c6afcc",
  "1613977257365-aaae5a9817ff", "1543489822-c49534f3271f", "1599777560450-e462cffc5368",
  "1582610116397-edb318620f90", "1670589953903-b4e2f17a70a9", "1615722440048-da4ccf6de048",
  "1664876080601-acf03b40c5e3", "1544984243-ec57ea16fe25", "1692736933760-8a8a9b8c1b6f",
  "1721989518229-3e84837fc398", "1692736933732-ad902fc34626", "1669123547614-5c0a12d6f4b4",
].map(U);
export const LAND_PHOTOS = [
  "1616555846456-6d53b92669a8", "1625736102294-96f0268f49de", "1728237362376-b71382b76e06",
  "1647861945045-16a625618203", "1647861944604-428e076ecd6e", "1514130667032-770bbfe7b7b2",
  "1514130546524-5da6eaa36b72", "1748810859309-b943147cdda2",
].map(U);
export const CONDO_PHOTOS = [
  "1768568080301-053390aed2df", "1768568080838-99d3db4ec953", "1791719422920-e4a9c0881cec",
  "1768568080576-bcf6bc50336f", "1771457362598-eb92f9f4bf42", "1780483705909-5db833a63590",
  "1771190252113-aa988822596f",
].map(U);
export const COMMERCIAL_PHOTOS: Record<CommercialUse, string[]> = {
  Retail: ["1791732773810-cc14ffe172de"].map(U),
  Office: ["1786853156529-3bab0ff01c3b"].map(U),
  Hospitality: ["1772860812099-30373d1f3045", "1791732773909-1d2e5d621e90"].map(U),
  "Mixed-use": ["1790214120372-4b3b06e2360a"].map(U),
  Warehouse: ["1769778674824-e69f58d7c55d"].map(U),
};
const COMPACT_TYPES: PropertyType[] = ["Condo", "Apartment", "Townhouse"];
export const ARUBA_PHOTOS = {
  beach: U("1761254462343-1f46ef277b9a"),
  resort: U("1763402084674-a3a45263ee2c"),
  flamingos: U("1625869581767-c36368b25fd3"),
  aerial: U("1625736102294-96f0268f49de"),
};

/* Approximate district centres (lat, lng) used to place listings on the map. */
export const DISTRICT_CENTERS: Record<string, [number, number]> = {
  Arashi: [12.6105, -70.0505],
  "Tierra del Sol": [12.6055, -70.0405],
  Malmok: [12.5985, -70.0485],
  "Boca Catalina": [12.5915, -70.0505],
  "Gold Coast": [12.6005, -70.0395],
  "Palm Beach": [12.5735, -70.0445],
  Noord: [12.5800, -70.0310],
  "Eagle Beach": [12.5545, -70.0545],
  Oranjestad: [12.5190, -70.0355],
  "Pos Chiquito": [12.4760, -69.9700],
  Savaneta: [12.4545, -69.9450],
  "Santa Cruz": [12.5060, -69.9840],
};

/** Deterministic small offset from the district centre (real rows carry their own coordinates). */
function locate(district: string, id: string): { lat: number; lng: number } {
  const [lat, lng] = DISTRICT_CENTERS[district] ?? [12.52, -70.0];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = ((h % 1000) / 1000) * Math.PI * 2;
  const r = 0.0015 + ((h >> 10) % 100) / 100 * 0.0035;
  return { lat: lat + Math.sin(a) * r, lng: lng + Math.cos(a) * r * 0.6 };
}

export function deriveSignal(r: RawRow, marketYieldPct: number): ListingSignal {
  const [id, name, type, district, beds, baths, built, lot, price, adr, occ, dom, chg, source] = r;
  const revenue = Math.round(adr * 365 * (occ / 100));
  const yieldPct = (revenue / price) * 100;
  const spreadBps = Math.round((yieldPct - marketYieldPct) * 100);
  const signal: Signal =
    spreadBps >= 100 ? "UNDERVALUED" : spreadBps <= -100 ? "OVERPRICED" : "AT_MARKET";
  const firstSeen = new Date(Date.parse(SCRAPED_AT) - dom * 86_400_000).toISOString().slice(0, 10);
  return {
    category: "Property",
    listing_id: id,
    market_id: MARKET_ID,
    asset_name: name,
    property_type: type,
    district,
    bedrooms: beds,
    bathrooms: baths,
    built_sqft: built,
    lot_sqft: lot,
    asking_price_usd: price,
    price_per_sqft_usd: Math.round(price / built),
    price_change_pct: chg,
    days_on_market: dom,
    first_seen: firstSeen,
    last_scraped: SCRAPED_AT,
    source,
    source_url: null,
    ...locate(district, id),
    photo_url: COMPACT_TYPES.includes(type)
      ? CONDO_PHOTOS[RAW_LISTINGS.filter((x) => COMPACT_TYPES.includes(x[2])).indexOf(r) % CONDO_PHOTOS.length]
      : VILLA_PHOTOS[RAW_LISTINGS.indexOf(r) % VILLA_PHOTOS.length],
    sequence_adr_usd: adr,
    projected_occupancy_pct: occ,
    projected_annual_revenue_usd: revenue,
    projected_gross_yield_pct: Math.round(yieldPct * 10) / 10,
    yield_spread_bps: spreadBps,
    signal,
  };
}

/* id, name, district, lot sq ft, asking, zoning, days listed, price change %, source */
type RawLandRow = readonly [string, string, string, number, number, Zoning, number, number, string];

export const RAW_LAND: readonly RawLandRow[] = [
  ["AW-L602", "Malmok Oceanview Lot", "Malmok", 21_500, 2_400_000, "Residential", 18, 0, "Broker site"],
  ["AW-L611", "Tierra del Sol Golf Parcel", "Tierra del Sol", 16_000, 1_150_000, "Residential", 44, -4.0, "Agency portal"],
  ["AW-L587", "Palm Beach Development Site", "Palm Beach", 64_000, 9_800_000, "Tourism", 162, 0, "Broker site"],
  ["AW-L624", "Noord Hilltop Acreage", "Noord", 87_000, 3_900_000, "Residential", 71, -2.5, "Private listing"],
  ["AW-L595", "Arashi Bluff Lot", "Arashi", 19_800, 2_050_000, "Residential", 5, 0, "Broker site"],
  ["AW-L633", "Savaneta Waterfront Parcel", "Savaneta", 42_000, 2_600_000, "Residential", 29, 0, "Agency portal"],
  ["AW-L578", "Eagle Beach Commercial Corner", "Eagle Beach", 23_000, 4_600_000, "Commercial", 118, -3.0, "Developer"],
  ["AW-L640", "Santa Cruz Ranch Land", "Santa Cruz", 215_000, 2_200_000, "Agricultural", 2, 0, "Private listing"],
];

/** Average land price per sq ft by district (table: district_land_benchmarks). */
export const DISTRICT_LAND_PSF: Record<string, number> = {
  Malmok: 125,
  "Tierra del Sol": 85,
  "Palm Beach": 150,
  Noord: 46,
  Arashi: 100,
  Savaneta: 66,
  "Eagle Beach": 175,
  "Santa Cruz": 11,
};

/** Land signal: ≥10% below district average = Undervalued, ≥10% above = Overpriced. */
export function deriveLand(r: RawLandRow): LandListing {
  const [id, name, district, lot, price, zoning, dom, chg, source] = r;
  const psf = Math.round(price / lot);
  const bench = DISTRICT_LAND_PSF[district];
  const diff = Math.round(((price / lot - bench) / bench) * 1000) / 10;
  const signal: Signal = diff <= -10 ? "UNDERVALUED" : diff >= 10 ? "OVERPRICED" : "AT_MARKET";
  return {
    category: "Land",
    listing_id: id,
    market_id: MARKET_ID,
    asset_name: name,
    property_type: "Land",
    district,
    lot_sqft: lot,
    zoning,
    asking_price_usd: price,
    price_per_sqft_usd: psf,
    district_land_psf_usd: bench,
    price_vs_district_pct: diff,
    price_change_pct: chg,
    days_on_market: dom,
    first_seen: new Date(Date.parse(SCRAPED_AT) - dom * 86_400_000).toISOString().slice(0, 10),
    last_scraped: SCRAPED_AT,
    source,
    source_url: null,
    signal,
    ...locate(district, id),
    photo_url: LAND_PHOTOS[RAW_LAND.indexOf(r) % LAND_PHOTOS.length],
  };
}

/* id, name, district, use, built sq ft, lot sq ft, asking, days listed, price change %, source */
type RawCommercialRow = readonly [string, string, string, CommercialUse, number, number | null, number, number, number, string];

export const RAW_COMMERCIAL: readonly RawCommercialRow[] = [
  ["AW-C701", "Palm Beach Retail Strip", "Palm Beach", "Retail", 8200, 14000, 6_400_000, 33, 0, "Broker site"],
  ["AW-C712", "Oranjestad Main Street Offices", "Oranjestad", "Office", 6400, null, 2_900_000, 88, -6.0, "Agency portal"],
  ["AW-C718", "Eagle Beach Boutique Hotel", "Eagle Beach", "Hospitality", 18500, 26000, 14_800_000, 140, -4.0, "Broker site"],
  ["AW-C725", "Noord Mixed-Use Plaza", "Noord", "Mixed-use", 11200, 20000, 4_100_000, 12, 0, "Developer"],
  ["AW-C731", "Savaneta Marina Warehouse", "Savaneta", "Warehouse", 15000, 30000, 2_250_000, 47, 0, "Private listing"],
  ["AW-C744", "Malmok Beach Restaurant", "Malmok", "Hospitality", 4200, 9000, 3_350_000, 5, 0, "Broker site"],
];

/** Average commercial price per sq ft (built) by district (table: district_commercial_benchmarks). */
export const DISTRICT_COMMERCIAL_PSF: Record<string, number> = {
  "Palm Beach": 720,
  Oranjestad: 520,
  "Eagle Beach": 760,
  Noord: 330,
  Savaneta: 175,
  Malmok: 690,
};

/** Commercial signal: ≥10% below district average = Undervalued, ≥10% above = Overpriced. */
export function deriveCommercial(r: RawCommercialRow): CommercialListing {
  const [id, name, district, use, built, lot, price, dom, chg, source] = r;
  const bench = DISTRICT_COMMERCIAL_PSF[district];
  const diff = Math.round(((price / built - bench) / bench) * 1000) / 10;
  const signal: Signal = diff <= -10 ? "UNDERVALUED" : diff >= 10 ? "OVERPRICED" : "AT_MARKET";
  const photos = COMMERCIAL_PHOTOS[use];
  return {
    category: "Commercial",
    listing_id: id,
    market_id: MARKET_ID,
    asset_name: name,
    property_type: "Commercial",
    commercial_use: use,
    district,
    built_sqft: built,
    lot_sqft: lot,
    asking_price_usd: price,
    price_per_sqft_usd: Math.round(price / built),
    district_commercial_psf_usd: bench,
    price_vs_district_pct: diff,
    price_change_pct: chg,
    days_on_market: dom,
    first_seen: new Date(Date.parse(SCRAPED_AT) - dom * 86_400_000).toISOString().slice(0, 10),
    last_scraped: SCRAPED_AT,
    source,
    source_url: null,
    signal,
    ...locate(district, id),
    photo_url: photos[RAW_COMMERCIAL.filter((x) => x[3] === use).indexOf(r) % photos.length],
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Data layer — swap `repository` for the Supabase implementation later
 * ──────────────────────────────────────────────────────────────────────── */

const latency = <T,>(value: T, ms = 320) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

const mockRepository: DashboardRepository = {
  getMarketSnapshot: async () => latency(MOCK_SNAPSHOT),
  getMonthlyPerformance: async (_id, months) => latency(MOCK_MONTHLY.slice(-months)),
  getActiveListingSignals: async (_id, limit) =>
    latency(
      RAW_LISTINGS.map((l) => deriveSignal(l, MOCK_SNAPSHOT.est_gross_yield_pct)).slice(0, limit),
    ),
  getActiveListings: async () =>
    latency<Listing[]>([
      ...RAW_LISTINGS.map((l) => deriveSignal(l, MOCK_SNAPSHOT.est_gross_yield_pct)),
      ...RAW_LAND.map(deriveLand),
      ...RAW_COMMERCIAL.map(deriveCommercial),
    ]),
};

/*
 * import { createClient } from "@supabase/supabase-js";
 * const supabase = createClient(
 *   process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 * );
 *
 * const supabaseRepository: DashboardRepository = {
 *   async getMarketSnapshot(marketId) {
 *     const { data, error } = await supabase
 *       .from("market_snapshots").select("*")
 *       .eq("market_id", marketId).order("as_of", { ascending: false })
 *       .limit(1).single();
 *     if (error) throw error;
 *     return data;
 *   },
 *   async getMonthlyPerformance(marketId, months) {
 *     const { data, error } = await supabase
 *       .from("market_monthly_performance").select("*")
 *       .eq("market_id", marketId).order("month", { ascending: false })
 *       .limit(months);
 *     if (error) throw error;
 *     return data.reverse();
 *   },
 *   async getActiveListingSignals(marketId, limit) {
 *     const { data, error } = await supabase
 *       .from("v_active_listing_signals").select("*")
 *       .eq("market_id", marketId)
 *       .order("yield_spread_bps", { ascending: false }).limit(limit);
 *     if (error) throw error;
 *     return data;
 *   },
 *   async getActiveListings(marketId) {
 *     const { data, error } = await supabase
 *       .from("v_active_listing_signals").select("*")
 *       .eq("market_id", marketId)
 *       .order("last_scraped", { ascending: false });
 *     if (error) throw error;
 *     return data;
 *   },
 * };
 */

export const repository: DashboardRepository = mockRepository;

/* ─────────────────────────────────────────────────────────────────────────
 * Synchronous snapshots (for server-rendered pages like the landing page)
 * ──────────────────────────────────────────────────────────────────────── */

export const ALL_LISTINGS: Listing[] = [
  ...RAW_LISTINGS.map((l) => deriveSignal(l, MOCK_SNAPSHOT.est_gross_yield_pct)),
  ...RAW_LAND.map(deriveLand),
  ...RAW_COMMERCIAL.map(deriveCommercial),
];

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Districts (table: district_stats) — rental performance + for-sale supply
 * ──────────────────────────────────────────────────────────────────────── */

export interface DistrictStats {
  district: string;
  score: number; // 0–100 Sequence Score
  rentals_tracked: number;
  adr_usd: number;
  occupancy_pct: number;
  revpar_usd: number;
  revpar_yoy_pct: number;
  rental_supply_yoy_pct: number;
  properties_for_sale: number;
  land_for_sale: number;
  commercial_for_sale: number;
  median_asking_usd: number | null;
  avg_property_yield_pct: number | null;
  land_psf_usd: number | null;
  lat: number;
  lng: number;
}

/* district: ADR, occupancy %, RevPAR YoY %, rental supply YoY %, rentals tracked */
const RAW_DISTRICT_RENTALS: ReadonlyArray<readonly [string, number, number, number, number, number]> = [
  ["Malmok", 6200, 56, 9.4, 6.1, 31],
  ["Arashi", 6800, 54, 11.2, 4.0, 18],
  ["Palm Beach", 6400, 52, 5.1, 8.7, 42],
  ["Eagle Beach", 5900, 55, 7.3, 5.5, 29],
  ["Noord", 5300, 53, 6.0, 7.9, 24],
  ["Tierra del Sol", 6100, 49, 8.2, 3.2, 21],
  ["Gold Coast", 5600, 51, 10.1, 4.4, 15],
  ["Boca Catalina", 5500, 56, 12.4, 2.1, 9],
  ["Oranjestad", 5000, 41, 2.2, 9.3, 11],
  ["Pos Chiquito", 5000, 44, 4.8, 6.0, 6],
  ["Savaneta", 5100, 46, 13.7, 3.5, 5],
  ["Santa Cruz", 5000, 39, 3.1, 1.2, 3],
];

/**
 * Sequence Score (0–100): rental demand + growth + buy-side value − new supply.
 * Placeholder weights; tune once real data is flowing.
 */
function scoreDistrict(occ: number, revparYoy: number, supplyYoy: number, avgYield: number | null): number {
  const y = avgYield ?? MOCK_SNAPSHOT.est_gross_yield_pct;
  const raw = 40 + (occ - 45) * 1.2 + revparYoy * 2.2 - supplyYoy * 1.6 + (y - 12) * 4;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export const DISTRICTS: DistrictStats[] = RAW_DISTRICT_RENTALS.map(([district, adr, occ, revparYoy, supplyYoy, rentals]) => {
  const here = ALL_LISTINGS.filter((l) => l.district === district);
  const props = here.filter((l): l is ListingSignal => l.category === "Property");
  const land = here.filter((l): l is LandListing => l.category === "Land");
  const avgYield = props.length ? Math.round((props.reduce((a, p) => a + p.projected_gross_yield_pct, 0) / props.length) * 10) / 10 : null;
  const [lat, lng] = DISTRICT_CENTERS[district];
  return {
    district,
    score: scoreDistrict(occ, revparYoy, supplyYoy, avgYield),
    rentals_tracked: rentals,
    adr_usd: adr,
    occupancy_pct: occ,
    revpar_usd: Math.round((adr * occ) / 100),
    revpar_yoy_pct: revparYoy,
    rental_supply_yoy_pct: supplyYoy,
    properties_for_sale: props.length,
    land_for_sale: land.length,
    commercial_for_sale: here.filter((l) => l.category === "Commercial").length,
    median_asking_usd: here.length ? median(here.map((l) => l.asking_price_usd)) : null,
    avg_property_yield_pct: avgYield,
    land_psf_usd: DISTRICT_LAND_PSF[district] ?? null,
    lat,
    lng,
  };
}).sort((a, b) => b.score - a.score);

/* ─────────────────────────────────────────────────────────────────────────
 * Revenue Estimator — what would a property earn as a luxury rental?
 * ──────────────────────────────────────────────────────────────────────── */

export interface EstimateInput {
  district: string;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  beachfront: boolean;
  asking_price_usd?: number | null;
}

export interface RentalComp {
  comp_id: string;
  label: string;
  bedrooms: number;
  adr_usd: number;
  occupancy_pct: number;
  annual_revenue_usd: number;
}

export interface Estimate {
  adr_usd: number;
  occupancy_pct: number;
  annual_revenue_usd: number;
  revenue_low_usd: number;
  revenue_high_usd: number;
  revpar_usd: number;
  monthly: Array<{ month: string; revenue_usd: number }>;
  comps: RentalComp[];
  gross_yield_pct: number | null;
  signal: Signal | null;
}

const TYPE_FACTOR: Record<PropertyType, number> = {
  Villa: 1,
  Estate: 1.06,
  Penthouse: 0.92,
  "Beach House": 1.03,
  Condo: 0.14,
  Apartment: 0.11,
  Townhouse: 0.18,
};

/** Comp-based estimate. Mock model; production version queries rental comps within the district. */
export function estimateRevenue(input: EstimateInput): Estimate {
  const d = DISTRICTS.find((x) => x.district === input.district) ?? DISTRICTS[0];
  const bedroomFactor = 1 + 0.07 * (input.bedrooms - 5) + 0.02 * (input.bathrooms - input.bedrooms);
  const adr = Math.round((d.adr_usd * bedroomFactor * TYPE_FACTOR[input.property_type] * (input.beachfront ? 1.12 : 1)) / 10) * 10;
  const occ = Math.max(25, Math.min(80, Math.round(d.occupancy_pct * (input.bedrooms >= 8 ? 0.9 : 1) * (input.beachfront ? 1.04 : 1))));
  const revenue = Math.round(adr * 365 * (occ / 100));

  const avgRevpar = MOCK_MONTHLY.reduce((a, m) => a + m.revpar_usd, 0) / MOCK_MONTHLY.length;
  const monthly = MOCK_MONTHLY.map((m) => ({
    month: m.month,
    revenue_usd: Math.round(((revenue / 12) * m.revpar_usd) / avgRevpar),
  }));

  const comps: RentalComp[] = [-1, 0, 0, 1, 1].map((delta, i) => {
    const beds = Math.max(2, input.bedrooms + delta);
    const wobble = 1 + ((i * 37) % 11 - 5) / 100;
    const cAdr = Math.round((adr * (1 + 0.07 * delta) * wobble) / 10) * 10;
    const cOcc = Math.max(25, Math.min(85, occ + ((i * 13) % 9) - 4));
    return {
      comp_id: `R-${d.district.slice(0, 3).toUpperCase()}-${101 + i * 17}`,
      label: `${beds}BR ${input.property_type.toLowerCase()}, ${d.district}`,
      bedrooms: beds,
      adr_usd: cAdr,
      occupancy_pct: cOcc,
      annual_revenue_usd: Math.round(cAdr * 365 * (cOcc / 100)),
    };
  });

  const price = input.asking_price_usd && input.asking_price_usd > 0 ? input.asking_price_usd : null;
  const yieldPct = price ? Math.round((revenue / price) * 1000) / 10 : null;
  const spread = yieldPct !== null ? (yieldPct - MOCK_SNAPSHOT.est_gross_yield_pct) * 100 : null;
  const signal: Signal | null = spread === null ? null : spread >= 100 ? "UNDERVALUED" : spread <= -100 ? "OVERPRICED" : "AT_MARKET";

  return {
    adr_usd: adr,
    occupancy_pct: occ,
    annual_revenue_usd: revenue,
    revenue_low_usd: Math.round(revenue * 0.85),
    revenue_high_usd: Math.round(revenue * 1.12),
    revpar_usd: Math.round((adr * occ) / 100),
    monthly,
    comps,
    gross_yield_pct: yieldPct,
    signal,
  };
}
