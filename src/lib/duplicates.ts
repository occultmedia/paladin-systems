/*
 * Duplicate watch for listings. Same scoring as the database function
 * `listing_match_score` (supabase/migrations/20261123000000_agent_listings.sql),
 * so the form can warn while the agent types and the database refuses the
 * same duplicates when they are saved.
 *
 * 0-100. The category must match. Location (map pins, else the district),
 * size, bedrooms, price and the name or address each add points; a clear
 * mismatch in size or bedrooms takes points away.
 */

import type { Listing } from "./aruba-data";

export const DUP_LIKELY = 70; // refused on save unless the agent confirms it is a different property
export const DUP_POSSIBLE = 50; // shown as a heads-up

export interface MatchFields {
  category: "Property" | "Land" | "Commercial";
  lat: number | null;
  lng: number | null;
  district: string;
  bedrooms: number | null;
  built_sqft: number | null;
  lot_sqft: number | null;
  asking_price_usd: number;
  name: string; // address when known, else the listing name
}

/** pg_trgm-style trigram similarity (0-1). */
function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    const p = `  ${w} `;
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  }
  return out;
}
export function similarity(a: string, b: string): number {
  const x = trigrams(a);
  const y = trigrams(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  x.forEach((t) => y.has(t) && both++);
  return both / (x.size + y.size - both);
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dy = (bLat - aLat) * 111_320;
  const dx = (bLng - aLng) * 111_320 * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

export function matchScore(a: MatchFields, b: MatchFields): number {
  if (a.category !== b.category) return 0;
  let s = 0;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const d = distanceM(a.lat, a.lng, b.lat, b.lng);
    if (d > 1000) return 0;
    s += d <= 40 ? 40 : d <= 120 ? 28 : d <= 300 ? 12 : 0;
  } else if (a.district.trim().toLowerCase() === b.district.trim().toLowerCase()) {
    s += 25;
  } else return 0;

  let sizeDiff: number | null = null;
  if (a.built_sqft && b.built_sqft) sizeDiff = Math.abs(a.built_sqft - b.built_sqft) / Math.max(a.built_sqft, b.built_sqft);
  else if (a.lot_sqft && b.lot_sqft) sizeDiff = Math.abs(a.lot_sqft - b.lot_sqft) / Math.max(a.lot_sqft, b.lot_sqft);
  if (sizeDiff != null) s += sizeDiff <= 0.02 ? 30 : sizeDiff <= 0.06 ? 20 : sizeDiff <= 0.12 ? 8 : sizeDiff > 0.25 ? -20 : 0;

  if (a.bedrooms != null && b.bedrooms != null) s += a.bedrooms === b.bedrooms ? 10 : -15;

  if (a.asking_price_usd > 0 && b.asking_price_usd > 0) {
    const p = Math.abs(a.asking_price_usd - b.asking_price_usd) / Math.max(a.asking_price_usd, b.asking_price_usd);
    s += p <= 0.03 ? 12 : p <= 0.1 ? 7 : 0;
  }

  const sim = similarity(a.name, b.name);
  s += sim >= 0.55 ? 15 : sim >= 0.35 ? 7 : 0;
  return Math.max(0, Math.min(100, s));
}

/** The match fields of a dashboard listing. Approximate map positions count as district only. */
export function listingMatchFields(l: Listing): MatchFields {
  const exact = !l.member || l.member.pinned;
  return {
    category: l.category,
    lat: exact ? l.lat : null,
    lng: exact ? l.lng : null,
    district: l.district,
    bedrooms: l.category === "Property" ? l.bedrooms : null,
    built_sqft: l.category === "Land" ? null : l.built_sqft,
    lot_sqft: l.lot_sqft,
    asking_price_usd: l.asking_price_usd,
    name: l.member?.address || l.asset_name,
  };
}

export interface DuplicateMatch {
  listing: Listing;
  score: number;
}

/** Listings that look like the same property, best first (score >= 50). */
export function findDuplicates(candidate: MatchFields, listings: Listing[], excludeId?: string, limit = 3): DuplicateMatch[] {
  return listings
    .filter((l) => l.listing_id !== excludeId && l.status !== "Sold" && l.status !== "De-listed")
    .map((listing) => ({ listing, score: matchScore(candidate, listingMatchFields(listing)) }))
    .filter((m) => m.score >= DUP_POSSIBLE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Map pin from a pasted Google/Apple Maps link or "12.55, -70.05". Null when none is found. */
export function parsePin(text: string): { lat: number; lng: number } | null {
  const t = decodeURIComponent(text.trim());
  if (!t) return null;
  const patterns = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&](?:q|ll|query|sll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/];
  for (const re of patterns) {
    const m = re.exec(t);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (lat >= 12.3 && lat <= 12.7 && lng >= -70.2 && lng <= -69.8) return { lat, lng };
  }
  return null;
}
