/*
 * Sizes are stored in sq ft. Aruba's agents work in square metres, so the UI
 * shows m² first and sq ft beside it. 0 means the agency does not state it.
 */

import type { Listing } from "./aruba-data";

export const SQFT_PER_M2 = 10.7639;

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const toM2 = (sqft: number) => Math.round(sqft / SQFT_PER_M2);
export const toSqft = (m2: number) => Math.round(m2 * SQFT_PER_M2);
/** Price per sq ft → price per m². */
export const perM2 = (psf: number) => Math.round(psf * SQFT_PER_M2);

export const fmtM2 = (sqft: number) => `${int.format(toM2(sqft))} m²`;
export const fmtSqft = (sqft: number) => `${int.format(sqft)} sq ft`;

/** "300 m² (3,229 sq ft)" */
export const fmtArea = (sqft: number | null | undefined) => (sqft && sqft > 0 ? `${fmtM2(sqft)} (${fmtSqft(sqft)})` : "Not stated");

/** "$3,618 / m² ($336 / sq ft)" */
export const fmtPerArea = (psf: number) => (psf > 0 ? `$${int.format(perM2(psf))} / m² ($${int.format(psf)} / sq ft)` : "—");

/** The size a listing is priced on: the plot for land, the building for the rest. */
export const pricedSize = (l: Listing) => (l.category === "Land" ? l.lot_sqft : l.built_sqft) || 0;

/** Asking price per m², from the exact price and size (0 when the size is not stated). */
export function pricePerM2(l: Listing) {
  const size = pricedSize(l);
  return size > 0 && l.price_per_sqft_usd > 0 ? Math.round(l.asking_price_usd / (size / SQFT_PER_M2)) : 0;
}

/** One short line for list rows: "300 m² · 3,229 sq ft". */
export function shortSize(l: Listing) {
  const size = pricedSize(l);
  if (size > 0) return `${fmtM2(size)} · ${fmtSqft(size)}`;
  return l.lot_sqft ? `Lot ${fmtM2(l.lot_sqft)} · ${fmtSqft(l.lot_sqft)}` : "Size not stated";
}

/** Built and lot size for cards, one entry per line. */
export function sizeLines(l: Listing): string[] {
  const out: string[] = [];
  if (l.category !== "Land" && l.built_sqft) out.push(`Built ${fmtArea(l.built_sqft)}`);
  if (l.lot_sqft) out.push(`Lot ${fmtArea(l.lot_sqft)}`);
  return out.length ? out : ["Size not stated"];
}
