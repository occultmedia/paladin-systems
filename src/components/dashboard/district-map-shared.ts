/** Shared (non-Mapbox) pieces of the district maps, safe to import anywhere. */

/* ── Value metrics ─────────────────────────────────────────────────────── */

export type DistrictMetric = "median_asking_usd" | "land_psf_usd" | "avg_property_yield_pct" | "score";

export const DISTRICT_METRICS: Record<DistrictMetric, { label: string; short: string; fmt: (n: number) => string }> = {
  median_asking_usd: {
    label: "Median asking price",
    short: "Median ask",
    fmt: (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : `$${Math.round(n / 1000)}k`),
  },
  land_psf_usd: { label: "Land value per sq ft", short: "Land $/sq ft", fmt: (n) => `$${Math.round(n)}` },
  avg_property_yield_pct: { label: "Average gross yield", short: "Avg. yield", fmt: (n) => `${n.toFixed(1)}%` },
  score: { label: "Sequence Score", short: "Score", fmt: (n) => `${Math.round(n)}` },
};

/** Light mint → deep green → near-black. */
export const RAMP = ["#E6EFE5", "#B9D3BC", "#7FAE8A", "#3F7A55", "#1E3F2C"];
export const NO_DATA = "#E4E4E7";

export function rampColor(t: number) {
  return RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.floor(t * RAMP.length - 1e-9)))];
}

/* ── ROPV zoning ───────────────────────────────────────────────────────── */

/** Official ROPV legend colours, English names, and what each zone means for a buyer. */
export const ROPV_ZONES: Record<string, { en: string; color: string; hint: string }> = {
  "Toeristisch gebied Westkust": { en: "Tourism zone (west coast)", color: "#FF94E8", hint: "Hotels, resorts and holiday rentals allowed" },
  "Toeristisch gebied Oostkust": { en: "Tourism zone (east coast)", color: "#E86FCB", hint: "Small-scale tourism" },
  "Stedelijk woongebied": { en: "Urban residential", color: "#B57800", hint: "Housing at city density" },
  "Woongebied met waarden": { en: "Residential (character area)", color: "#FF9E54", hint: "Housing; protects the area's character" },
  "Centrum Oranjestad": { en: "Oranjestad centre", color: "#FA5736", hint: "Mixed use: shops, offices, housing" },
  "Centrum San Nicolas": { en: "San Nicolas centre", color: "#F27A5E", hint: "Mixed use: shops, offices, housing" },
  "Havenfront Oranjestad": { en: "Oranjestad waterfront", color: "#E60000", hint: "Port City redevelopment" },
  Transformatiegebied: { en: "Transformation area", color: "#D5A79D", hint: "Earmarked for a change of use" },
  "Bedrijventerrein Barcadera": { en: "Industrial (Barcadera)", color: "#D79E9E", hint: "Business and industry" },
  "Bedrijventerrein San Nicolas": { en: "Industrial (San Nicolas)", color: "#730000", hint: "Business and industry (former refinery)" },
  Luchthaven: { en: "Airport", color: "#A900E6", hint: "Airport and noise zone" },
  "Landelijk gebied": { en: "Rural area", color: "#F2E85C", hint: "Limited building, mostly agricultural / open" },
  "Natuur en landschap": { en: "Nature & landscape", color: "#B3C200", hint: "Very limited building" },
  Natuurgebied: { en: "Nature reserve", color: "#709958", hint: "No new building" },
  Strand: { en: "Beach", color: "#FFF3A8", hint: "Public beach, no building" },
  Marinegebied: { en: "Marine area", color: "#00C5FF", hint: "Protected sea area" },
  Marinezones: { en: "Marine zones", color: "#70DAFF", hint: "Sea use zones" },
};

export const ZONE_ORDER = Object.keys(ROPV_ZONES);

