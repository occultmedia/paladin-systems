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

/**
 * Land title in Aruba. Eigendom = freehold (you own the land outright).
 * Erfpacht = long lease on government land: you own the building, the land is
 * leased from the Land Aruba for a set term (usually 60 years) with yearly canon.
 */
export type Tenure = "Eigendom" | "Erfpacht";
export const TENURES: Tenure[] = ["Eigendom", "Erfpacht"];
export const TENURE_HINT: Record<Tenure, string> = {
  Eigendom: "Freehold: land and building owned outright",
  Erfpacht: "Leasehold: land leased from the government, building owned",
};

/** Where the listing is in the sale process, read from the listing site on every scrape. */
export type ListingStatus = "Available" | "Under contract" | "Sold";
export const LISTING_STATUSES: ListingStatus[] = ["Available", "Under contract", "Sold"];

/** The real-estate company whose site the listing was scraped from. */
export interface Agency {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null; // scraped from the agency site; null = show a monogram
  color: string; // monogram background until the real logo is stored
}

/*
 * Placeholder agencies for the mock data (fictional names, no websites).
 * The scraper fills this table (table: agencies) with each real site's name,
 * logo and URL, and stores every listing's own page in source_url.
 */
export const AGENCIES: Record<string, Agency> = {
  tradewind: { id: "tradewind", name: "Trade Wind Estates", website: null, logo_url: null, color: "#0F4C5C" },
  seagrape: { id: "seagrape", name: "Seagrape Realty", website: null, logo_url: null, color: "#3D6B35" },
  islaazul: { id: "islaazul", name: "Isla Azul Properties", website: null, logo_url: null, color: "#1F5AA6" },
  coralridge: { id: "coralridge", name: "Coral Ridge Developments", website: null, logo_url: null, color: "#B5523B" },
  northshore: { id: "northshore", name: "Northshore Land Co.", website: null, logo_url: null, color: "#8A6A2E" },
  harbourpoint: { id: "harbourpoint", name: "Harbour Point Commercial", website: null, logo_url: null, color: "#2B2B2B" },
};

/** Which placeholder agency a mock listing came from, by listing channel and category. */
function agencyFor(channel: string, category: "Property" | "Land" | "Commercial", id: string): Agency {
  const h = hashId(id);
  if (channel === "Developer") return AGENCIES.coralridge;
  if (category === "Commercial") return h % 3 ? AGENCIES.harbourpoint : AGENCIES.tradewind;
  if (category === "Land") return h % 3 ? AGENCIES.northshore : AGENCIES.islaazul;
  const pool = [AGENCIES.tradewind, AGENCIES.seagrape, AGENCIES.islaazul];
  return pool[h % pool.length];
}

/** The agent at the agency who handles the listing (scraped from the listing page). */
export interface ListingAgent {
  id: string;
  name: string;
  title: string;
  phone: string | null; // as shown on the listing, international format
  whatsapp: boolean; // phone also reachable on WhatsApp
  email: string | null;
  photo_url: string | null; // null = initials avatar
  agency_id: string;
}

/*
 * Placeholder agents (fictional people, reserved .example e-mail domain and
 * 555 test numbers). The scraper replaces these with the agent named on each
 * listing page.
 */
const mkAgent = (agency: string, slug: string, name: string, title: string, n: number): ListingAgent => ({
  id: `${agency}-${slug}`,
  name,
  title,
  phone: `+297 555 01${String(n).padStart(2, "0")}`,
  whatsapp: n % 3 !== 0,
  email: `${slug}@${agency}.example`,
  photo_url: null,
  agency_id: agency,
});

export const AGENTS: Record<string, ListingAgent[]> = {
  tradewind: [
    mkAgent("tradewind", "m.croes", "Marisol Croes", "Senior broker", 11),
    mkAgent("tradewind", "d.vanderlinde", "Daan van der Linde", "Luxury property advisor", 12),
    mkAgent("tradewind", "r.tromp", "Rafael Tromp", "Sales agent", 13),
  ],
  seagrape: [
    mkAgent("seagrape", "a.kock", "Anouk Kock", "Broker / owner", 21),
    mkAgent("seagrape", "j.werleman", "Jayden Werleman", "Sales agent", 22),
  ],
  islaazul: [
    mkAgent("islaazul", "l.geerman", "Lucia Geerman", "Managing broker", 31),
    mkAgent("islaazul", "t.boekhoudt", "Thomas Boekhoudt", "Sales agent", 32),
    mkAgent("islaazul", "s.maduro", "Sofia Maduro", "Investment property advisor", 33),
  ],
  coralridge: [mkAgent("coralridge", "sales", "Nadia Arends", "Developer sales manager", 41)],
  northshore: [
    mkAgent("northshore", "p.henriquez", "Pedro Henriquez", "Land specialist", 51),
    mkAgent("northshore", "e.ras", "Emma Ras", "Sales agent", 52),
  ],
  harbourpoint: [
    mkAgent("harbourpoint", "k.dekker", "Kevin Dekker", "Commercial broker", 61),
    mkAgent("harbourpoint", "i.lacle", "Isabel Lacle", "Leasing & sales agent", 62),
  ],
};

function agentFor(agency: Agency, id: string): ListingAgent | null {
  const list = AGENTS[agency.id];
  if (!list?.length) return null;
  return list[(hashId(id) >>> 5) % list.length];
}

export type Pool = "Private pool" | "Shared pool" | "No pool";
export const POOLS: Pool[] = ["Private pool", "Shared pool", "No pool"];

/** One change seen between two scrapes (table: listing_price_history). */
export interface PriceEvent {
  date: string; // ISO date of the scrape that saw it
  event: "Listed" | "Price drop" | "Price increase";
  price_usd: number;
  change_pct: number | null; // vs the previous price, null for "Listed"
}

/** Columns shared by every scraped listing. */
export interface ListingBase {
  tenure: Tenure;
  lease_years_left: number | null; // erfpacht only
  is_new: boolean; // first found in the latest scrape
  price_history: PriceEvent[]; // oldest first; last entry = current price
  last_price_change: PriceEvent | null;
  status: ListingStatus;
  status_changed: string | null; // ISO date the scrape saw the current status (null = available since listed)
  pool: Pool | null; // null for land
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
  source: string; // listing agency name (= agency.name)
  source_url: string | null; // the listing's own page on the agency's site
  agency: Agency;
  agent: ListingAgent | null; // the agent handling it; null when the site names none
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

/** table: vacation_rentals — scraped from Airbnb, Vrbo and direct-booking sites. */
export type RentalPlatform = "Airbnb" | "Vrbo" | "Direct";
export const RENTAL_PLATFORMS: RentalPlatform[] = ["Airbnb", "Vrbo", "Direct"];
export const PLATFORM_LABEL: Record<RentalPlatform, string> = {
  Airbnb: "Airbnb",
  Vrbo: "Vrbo",
  Direct: "Direct booking site",
};

export interface VacationRental {
  rental_id: string;
  market_id: string;
  name: string;
  platform: RentalPlatform;
  host_type: string; // e.g. "Superhost", "Property manager", "Owner website"
  property_type: PropertyType;
  district: string;
  bedrooms: number;
  bathrooms: number;
  sleeps: number;
  nightly_rate_usd: number; // average quoted rate, next 30 days
  low_season_rate_usd: number;
  high_season_rate_usd: number;
  cleaning_fee_usd: number;
  occupancy_pct: number; // booked nights, trailing 12 months (from calendar)
  annual_revenue_usd: number; // estimated, trailing 12 months
  rating: number | null; // null = no reviews yet
  reviews: number;
  first_seen: string; // ISO date
  last_scraped: string; // ISO timestamp
  source_url: string | null;
  lat: number;
  lng: number;
  photo_url: string | null;
}

export interface DashboardRepository {
  getMarketSnapshot(marketId: string): Promise<MarketSnapshot>;
  getMonthlyPerformance(marketId: string, months: number): Promise<MonthlyPerformance[]>;
  /** Featured property rows for the Yield Radar on the Rental Market tab. */
  getActiveListingSignals(marketId: string, limit: number): Promise<ListingSignal[]>;
  /** Every active scraped listing (properties and land), for the Active Listings tab. */
  getActiveListings(marketId: string): Promise<Listing[]>;
  /** Every tracked vacation rental (Airbnb, Vrbo, direct sites), for the rentals map. */
  getVacationRentals(marketId: string): Promise<VacationRental[]>;
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

export const SCRAPED_AT = "2026-11-15T06:00:00Z";

/* id, name, type, district, beds, baths, built sqft, lot sqft, asking, ADR, occ %, days listed, price change %, source */
type RawRow = readonly [string, string, PropertyType, string, number, number, number, number | null, number, number, number, number, number, string];

export const RAW_LISTINGS: readonly RawRow[] = [
  ["AW-0412", "Malmok Beach Estate", "Estate", "Malmok", 7, 8, 9200, 21000, 12_500_000, 6850, 62, 41, 0, "Broker site"],
  ["AW-0388", "Noord Luxury Retreat", "Villa", "Noord", 6, 6.5, 6400, 14500, 7_950_000, 5200, 58, 73, -4.2, "Agency portal"],
  ["AW-0457", "Villa Serena, Eagle Beach", "Villa", "Eagle Beach", 5, 6, 5800, 9800, 9_800_000, 5400, 57, 22, 0, "Broker site"],
  ["AW-0291", "Palm Beach Ocean Pavilion", "Estate", "Palm Beach", 8, 9, 11200, 26000, 14_250_000, 7400, 49, 118, -6.5, "Agency portal"],
  ["AW-0503", "Savaneta Cove House", "Beach House", "Savaneta", 5, 5, 5100, 12000, 6_100_000, 5050, 51, 2, 0, "Private listing"],
  ["AW-0517", "Tierra del Sol Fairway Villa", "Villa", "Tierra del Sol", 5, 5.5, 5600, 11000, 5_400_000, 5000, 44, 15, 0, "Broker site"],
  ["AW-0322", "Arashi Dunes Residence", "Villa", "Arashi", 6, 7, 7000, 16000, 10_900_000, 6200, 52, 96, -3.1, "Agency portal"],
  ["AW-0466", "Gold Coast Ridge Villa", "Villa", "Gold Coast", 6, 6, 6600, 15500, 8_600_000, 5600, 53, 34, 0, "Broker site"],
  ["AW-0249", "Boca Catalina Cliff House", "Beach House", "Boca Catalina", 4, 4.5, 4300, 8200, 6_900_000, 5300, 55, 141, -8.0, "Private listing"],
  ["AW-0398", "Pos Chiquito Waterfront", "Villa", "Pos Chiquito", 5, 5, 5200, 10500, 5_950_000, 5000, 43, 63, -2.5, "Agency portal"],
  ["AW-0533", "Eagle Beach Sky Penthouse", "Penthouse", "Eagle Beach", 4, 4.5, 4800, null, 7_200_000, 5800, 50, 6, 0, "Developer"],
  ["AW-0187", "Palm Beach Grand Penthouse", "Penthouse", "Palm Beach", 5, 5.5, 6100, null, 11_400_000, 6900, 47, 204, -5.0, "Developer"],
  ["AW-0441", "Malmok Reef Villa", "Villa", "Malmok", 6, 6, 6900, 15800, 9_300_000, 6100, 55, 28, 0, "Broker site"],
  ["AW-0372", "Noord Hillcrest Estate", "Estate", "Noord", 7, 8, 10400, 32000, 16_800_000, 8200, 46, 87, 3.5, "Broker site"],
  ["AW-0549", "Santa Cruz Hacienda", "Estate", "Santa Cruz", 6, 6, 7800, 40000, 4_900_000, 5000, 38, 0, 0, "Private listing"],
  ["AW-0265", "Oranjestad Harbour Residence", "Penthouse", "Oranjestad", 4, 4, 4200, null, 4_600_000, 5000, 33, 152, -4.0, "Agency portal"],
  ["AW-0418", "Tierra del Sol Ocean Villa", "Villa", "Tierra del Sol", 7, 7.5, 8300, 18500, 11_900_000, 7100, 50, 47, 0, "Broker site"],
  ["AW-0306", "Arashi Beachfront Compound", "Estate", "Arashi", 9, 10, 13500, 34000, 18_500_000, 9500, 54, 176, -7.5, "Broker site"],
  ["AW-0492", "Savaneta Lagoon Villa", "Villa", "Savaneta", 5, 5, 5400, 13000, 5_750_000, 5100, 42, 19, 0, "Agency portal"],
  ["AW-0359", "Malmok Sunset House", "Beach House", "Malmok", 5, 5.5, 5700, 11800, 8_250_000, 5900, 48, 58, -1.8, "Private listing"],
  ["AW-0521", "Gold Coast Signature Villa", "Villa", "Gold Coast", 5, 6, 6200, 13400, 7_600_000, 5500, 47, 1, 0, "Developer"],
  ["AW-0233", "Eagle Beach Casa Blanca", "Villa", "Eagle Beach", 6, 6.5, 6500, 12500, 10_200_000, 5700, 49, 133, -3.5, "Broker site"],
  ["AW-0611", "Palm Beach Ocean Tower 1204", "Condo", "Palm Beach", 2, 2, 1450, null, 1_250_000, 680, 62, 14, 0, "Agency portal"],
  ["AW-0624", "Eagle Beach Residences 3B", "Condo", "Eagle Beach", 3, 3, 1900, null, 1_650_000, 820, 60, 31, -3.0, "Broker site"],
  ["AW-0637", "Oranjestad Harbourview 502", "Apartment", "Oranjestad", 2, 2, 1250, null, 690_000, 420, 58, 52, 0, "Agency portal"],
  ["AW-0642", "Noord Garden Apartment", "Apartment", "Noord", 2, 1.5, 1100, null, 520_000, 380, 61, 0, 0, "Private listing"],
  ["AW-0655", "Malmok Townhouse 7", "Townhouse", "Malmok", 3, 3.5, 2400, 3200, 1_480_000, 890, 57, 26, 0, "Broker site"],
  ["AW-0668", "Gold Coast Golf Townhouse", "Townhouse", "Gold Coast", 4, 4, 3100, 4200, 1_950_000, 1150, 52, 0, 0, "Developer"],
  ["AW-0673", "Savaneta Waterfront Condo", "Condo", "Savaneta", 2, 2, 1350, null, 780_000, 520, 55, 61, -5.0, "Agency portal"],
  ["AW-0681", "Eagle Beach Bungalow Suite 12", "Condo", "Eagle Beach", 1, 1, 820, null, 465_000, 260, 63, 0, 0, "Agency portal"],
  ["AW-0686", "Palm Beach Lagoon Villa", "Villa", "Palm Beach", 4, 4.5, 3900, 7600, 3_250_000, 1700, 56, 0, 0, "Broker site"],
  ["AW-0692", "Noord Family Townhouse", "Townhouse", "Noord", 3, 2.5, 1850, 2600, 640_000, 400, 54, 0, 0, "Private listing"],
  ["AW-0697", "Oranjestad Seaport Loft", "Apartment", "Oranjestad", 1, 1, 760, null, 395_000, 230, 60, 0, 0, "Agency portal"],
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

const DAY = 86_400_000;
const isoDaysAgo = (days: number) => new Date(Date.parse(SCRAPED_AT) - days * DAY).toISOString().slice(0, 10);
const hashId = (id: string) => {
  let h = 7;
  for (const c of id) h = (h * 131 + c.charCodeAt(0)) >>> 0;
  return h;
};
const roundPrice = (n: number) => Math.round(n / (n >= 1_000_000 ? 5_000 : 1_000)) * (n >= 1_000_000 ? 5_000 : 1_000);

/** Price changes the latest scrape picked up (mock; prod reads listing_price_history). */
const CHANGED_IN_LATEST_SCRAPE = new Set(["AW-0388", "AW-0291", "AW-C712", "AW-0372"]);

/** Listings no longer simply available: status and how many days ago the scrape saw it (mock). */
const STATUS_CHANGES: Record<string, [ListingStatus, number]> = {
  "AW-0637": ["Under contract", 0],
  "AW-L611": ["Under contract", 0],
  "AW-0457": ["Under contract", 2],
  "AW-0359": ["Under contract", 5],
  "AW-C725": ["Under contract", 3],
  "AW-0265": ["Sold", 1],
  "AW-0249": ["Sold", 4],
  "AW-L624": ["Sold", 6],
};

/** Pool from the listing text (mock): houses mostly private, units mostly shared, land none. */
function poolFor(kind: string, h: number): Pool | null {
  const r = (h >> 3) % 100;
  if (kind === "Land") return null;
  if (["Villa", "Estate", "Beach House"].includes(kind)) return r < 88 ? "Private pool" : "No pool";
  if (kind === "Townhouse") return r < 40 ? "Private pool" : r < 85 ? "Shared pool" : "No pool";
  if (kind === "Condo" || kind === "Penthouse") return kind === "Penthouse" && r < 45 ? "Private pool" : r < 85 ? "Shared pool" : "No pool";
  if (kind === "Apartment") return r < 45 ? "Shared pool" : "No pool";
  if (kind === "Hospitality") return "Private pool";
  return "No pool";
}

/** Share of listings on erfpacht land, by category (mock assignment). */
const ERFPACHT_SHARE = { Property: 0.35, Land: 0.6, Commercial: 0.5 } as const;

/**
 * Columns that come from comparing scrapes: tenure, the "new" flag and the
 * price history rebuilt from the current price and the change since first seen.
 */
function scrapeMeta(
  id: string,
  category: keyof typeof ERFPACHT_SHARE,
  price: number,
  changePct: number,
  dom: number,
  kind: string, // property type, "Land", or commercial use
): Pick<ListingBase, "tenure" | "lease_years_left" | "is_new" | "price_history" | "last_price_change" | "status" | "status_changed" | "pool"> {
  const h = hashId(id);
  const status = STATUS_CHANGES[id];
  const tenure: Tenure = (h % 100) / 100 < ERFPACHT_SHARE[category] ? "Erfpacht" : "Eigendom";
  const history: PriceEvent[] = [];
  const original = changePct ? roundPrice(price / (1 + changePct / 100)) : price;
  history.push({ date: isoDaysAgo(dom), event: "Listed", price_usd: original, change_pct: null });
  if (changePct) {
    const lastAgo = CHANGED_IN_LATEST_SCRAPE.has(id) ? 0 : 1 + (h % Math.max(1, Math.min(dom - 1, 21)));
    const steps: Array<[number, number]> = [];
    if (Math.abs(changePct) >= 5 && dom >= 60) steps.push([Math.round(dom * 0.55), roundPrice(original * (1 + changePct / 200))]);
    steps.push([lastAgo, price]);
    for (const [ago, p] of steps) {
      const prev = history[history.length - 1].price_usd;
      history.push({
        date: isoDaysAgo(ago),
        event: p < prev ? "Price drop" : "Price increase",
        price_usd: p,
        change_pct: Math.round(((p - prev) / prev) * 1000) / 10,
      });
    }
  }
  return {
    tenure,
    lease_years_left: tenure === "Erfpacht" ? 22 + (h % 37) : null,
    is_new: dom === 0,
    price_history: history,
    last_price_change: history.length > 1 ? history[history.length - 1] : null,
    status: status ? status[0] : "Available",
    status_changed: status ? isoDaysAgo(status[1]) : null,
    pool: poolFor(kind, h),
  };
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
    ...scrapeMeta(id, "Property", price, chg, dom, type),
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
    source: agencyFor(source, "Property", id).name,
    source_url: null,
    agency: agencyFor(source, "Property", id),
    agent: agentFor(agencyFor(source, "Property", id), id),
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
  ["AW-L587", "Palm Beach Development Site", "Palm Beach", 64_000, 9_800_000, "Tourism", 162, 4.0, "Broker site"],
  ["AW-L624", "Noord Hilltop Acreage", "Noord", 87_000, 3_900_000, "Residential", 71, -2.5, "Private listing"],
  ["AW-L595", "Arashi Bluff Lot", "Arashi", 19_800, 2_050_000, "Residential", 5, 0, "Broker site"],
  ["AW-L633", "Savaneta Waterfront Parcel", "Savaneta", 42_000, 2_600_000, "Residential", 29, 0, "Agency portal"],
  ["AW-L578", "Eagle Beach Commercial Corner", "Eagle Beach", 23_000, 4_600_000, "Commercial", 118, -3.0, "Developer"],
  ["AW-L640", "Santa Cruz Ranch Land", "Santa Cruz", 215_000, 2_200_000, "Agricultural", 0, 0, "Private listing"],
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
    ...scrapeMeta(id, "Land", price, chg, dom, "Land"),
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
    source: agencyFor(source, "Land", id).name,
    source_url: null,
    agency: agencyFor(source, "Land", id),
    agent: agentFor(agencyFor(source, "Land", id), id),
    signal,
    ...locate(district, id),
    photo_url: LAND_PHOTOS[RAW_LAND.indexOf(r) % LAND_PHOTOS.length],
  };
}

/* id, name, district, use, built sq ft, lot sq ft, asking, days listed, price change %, source */
type RawCommercialRow = readonly [string, string, string, CommercialUse, number, number | null, number, number, number, string];

export const RAW_COMMERCIAL: readonly RawCommercialRow[] = [
  ["AW-C701", "Palm Beach Retail Strip", "Palm Beach", "Retail", 8200, 14000, 6_400_000, 33, 2.5, "Broker site"],
  ["AW-C712", "Oranjestad Main Street Offices", "Oranjestad", "Office", 6400, null, 2_900_000, 88, -6.0, "Agency portal"],
  ["AW-C718", "Eagle Beach Boutique Hotel", "Eagle Beach", "Hospitality", 18500, 26000, 14_800_000, 140, -4.0, "Broker site"],
  ["AW-C725", "Noord Mixed-Use Plaza", "Noord", "Mixed-use", 11200, 20000, 4_100_000, 12, 0, "Developer"],
  ["AW-C731", "Savaneta Marina Warehouse", "Savaneta", "Warehouse", 15000, 30000, 2_250_000, 47, 0, "Private listing"],
  ["AW-C744", "Malmok Beach Restaurant", "Malmok", "Hospitality", 4200, 9000, 3_350_000, 0, 0, "Broker site"],
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
    ...scrapeMeta(id, "Commercial", price, chg, dom, use),
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
    source: agencyFor(source, "Commercial", id).name,
    source_url: null,
    agency: agencyFor(source, "Commercial", id),
    agent: agentFor(agencyFor(source, "Commercial", id), id),
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
  getVacationRentals: async () => latency(VACATION_RENTALS),
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
 *   async getVacationRentals(marketId) {
 *     const { data, error } = await supabase
 *       .from("vacation_rentals").select("*")
 *       .eq("market_id", marketId).order("annual_revenue_usd", { ascending: false });
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
 * Vacation rentals (mock) — one row per tracked rental, matching each
 * district's "rentals tracked" count. Deterministic so the page is stable.
 * ──────────────────────────────────────────────────────────────────────── */

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const RESORT_DISTRICTS = ["Palm Beach", "Eagle Beach"];
const LUXURY_DISTRICTS = ["Malmok", "Arashi", "Tierra del Sol", "Gold Coast", "Boca Catalina"];
const TYPE_MIX: Record<"resort" | "luxury" | "local", Array<[PropertyType, number]>> = {
  resort: [["Condo", 45], ["Apartment", 15], ["Penthouse", 10], ["Villa", 15], ["Townhouse", 15]],
  luxury: [["Villa", 45], ["Estate", 15], ["Beach House", 15], ["Townhouse", 15], ["Condo", 10]],
  local: [["Apartment", 30], ["Villa", 25], ["Townhouse", 20], ["Condo", 15], ["Beach House", 10]],
};
/* 2-bedroom base nightly rate, bedroom range, occupancy adjustment */
const RENTAL_TYPE: Record<PropertyType, { base: number; beds: [number, number]; occAdj: number }> = {
  Condo: { base: 620, beds: [1, 3], occAdj: 10 },
  Apartment: { base: 400, beds: [1, 3], occAdj: 8 },
  Townhouse: { base: 600, beds: [2, 4], occAdj: 4 },
  Penthouse: { base: 3300, beds: [3, 5], occAdj: -2 },
  Villa: { base: 2500, beds: [3, 7], occAdj: 0 },
  Estate: { base: 2600, beds: [6, 9], occAdj: -6 },
  "Beach House": { base: 2300, beds: [3, 6], occAdj: 0 },
};
const NAME_WORDS = [
  "Casa Azul", "Sunset", "Coral", "Trade Wind", "Bougainvillea", "Sea Breeze", "Cunucu", "Aloe",
  "Turquoise", "Seagrape", "Mangrove", "Blue Bay", "Flamingo", "Kadushi", "Hibiscus", "Palm Grove",
  "Shell", "Lighthouse", "Dune", "Island Breeze", "Moonrise", "Salt Pond", "Watapana", "Kibrahacha",
];
const NAME_SUFFIX: Record<PropertyType, string[]> = {
  Condo: ["Suite", "Condo", "Residence"],
  Apartment: ["Apartment", "Studio Loft", "Garden Apartment"],
  Townhouse: ["Townhome", "Townhouse"],
  Penthouse: ["Penthouse", "Sky Penthouse"],
  Villa: ["Villa", "House", "Retreat"],
  Estate: ["Estate", "Compound"],
  "Beach House": ["Beach House", "Beach Cottage"],
};

function buildRentals(): VacationRental[] {
  const out: VacationRental[] = [];
  for (const [district, adr, occ, , , count] of RAW_DISTRICT_RENTALS) {
    const rand = seeded(district.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
    const mix = TYPE_MIX[RESORT_DISTRICTS.includes(district) ? "resort" : LUXURY_DISTRICTS.includes(district) ? "luxury" : "local"];
    const total = mix.reduce((a, [, w]) => a + w, 0);
    const code = district.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    for (let i = 0; i < count; i++) {
      let r = rand() * total;
      const type = (mix.find(([, w]) => (r -= w) < 0) ?? mix[0])[0];
      const spec = RENTAL_TYPE[type];
      const beds = spec.beds[0] + Math.floor(rand() * (spec.beds[1] - spec.beds[0] + 1));
      const baths = Math.max(1, beds - (rand() < 0.4 ? 1 : 0) + (rand() < 0.3 ? 0.5 : 0));
      const districtFactor = adr / 5500;
      const nightly = Math.round((spec.base * (1 + 0.32 * (beds - 2)) * districtFactor * (0.82 + rand() * 0.36)) / 5) * 5;
      const occupancy = Math.max(25, Math.min(92, Math.round(occ + spec.occAdj + (rand() - 0.5) * 16)));
      const reviews = rand() < 0.06 ? 0 : Math.floor(rand() * 380);
      const roll = rand();
      const platform: RentalPlatform = roll < 0.55 ? "Airbnb" : roll < 0.83 ? "Vrbo" : "Direct";
      const id = `R-${code}-${String(101 + i)}`;
      const luxury = nightly >= 1500;
      out.push({
        rental_id: id,
        market_id: MARKET_ID,
        name: `${pick(NAME_WORDS)} ${pick(NAME_SUFFIX[type])}${type === "Condo" ? ` ${1 + Math.floor(rand() * 14)}${pick(["A", "B", "C"])}` : ""}`,
        platform,
        host_type:
          platform === "Direct"
            ? pick(["Owner website", "Property manager site"])
            : pick(platform === "Airbnb" ? ["Superhost", "Host", "Property manager"] : ["Premier host", "Owner", "Property manager"]),
        property_type: type,
        district,
        bedrooms: beds,
        bathrooms: baths,
        sleeps: beds * 2 + (rand() < 0.4 ? 1 : 0),
        nightly_rate_usd: nightly,
        low_season_rate_usd: Math.round((nightly * 0.72) / 5) * 5,
        high_season_rate_usd: Math.round((nightly * 1.38) / 5) * 5,
        cleaning_fee_usd: Math.round(((60 + beds * 35) * (luxury ? 2.2 : 1)) / 5) * 5,
        occupancy_pct: occupancy,
        annual_revenue_usd: Math.round(nightly * 365 * (occupancy / 100)),
        rating: reviews ? Math.round((4.55 + rand() * 0.45) * 100) / 100 : null,
        reviews,
        first_seen: new Date(Date.parse(SCRAPED_AT) - Math.floor(10 + rand() * 900) * 86_400_000).toISOString().slice(0, 10),
        last_scraped: SCRAPED_AT,
        source_url: null,
        ...locate(district, id),
        photo_url: COMPACT_TYPES.includes(type)
          ? CONDO_PHOTOS[Math.floor(rand() * CONDO_PHOTOS.length)]
          : VILLA_PHOTOS[Math.floor(rand() * VILLA_PHOTOS.length)],
      });
    }
  }
  return out;
}

export const VACATION_RENTALS: VacationRental[] = buildRentals();

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

/* ─────────────────────────────────────────────────────────────────────────
 * Terminal updates (table: scrape_runs) — one entry per daily scrape:
 * what was checked, what is new, which prices moved.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ScrapePriceChange {
  listing: Listing;
  change: PriceEvent;
  previous_price_usd: number;
}

export interface ScrapeRun {
  run_at: string; // ISO timestamp
  date: string; // ISO date
  listings_checked: number;
  rentals_checked: number;
  new_listings: Listing[];
  price_changes: ScrapePriceChange[];
  status_changes: Listing[]; // went under contract or sold in this scrape
}

export function buildScrapeRuns(listings: Listing[], rentals: VacationRental[], days = 7): ScrapeRun[] {
  return Array.from({ length: days }, (_, ago) => {
    const runAt = new Date(Date.parse(SCRAPED_AT) - ago * DAY).toISOString();
    const date = runAt.slice(0, 10);
    const price_changes: ScrapePriceChange[] = [];
    for (const l of listings) {
      l.price_history.forEach((e, i) => {
        if (i > 0 && e.date === date) price_changes.push({ listing: l, change: e, previous_price_usd: l.price_history[i - 1].price_usd });
      });
    }
    return {
      run_at: runAt,
      date,
      listings_checked: listings.filter((l) => l.price_history[0].date <= date).length,
      rentals_checked: rentals.filter((r) => r.first_seen <= date).length,
      new_listings: listings.filter((l) => l.price_history[0].date === date),
      status_changes: listings.filter((l) => l.status_changed === date),
      price_changes,
    };
  });
}

/** Newest first. */
export const SCRAPE_RUNS: ScrapeRun[] = buildScrapeRuns(ALL_LISTINGS, VACATION_RENTALS);
