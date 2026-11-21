/*
 * Confidence Score: how sure Terminal is that a listing is really still for
 * sale, from 0 to 100. Broker sites keep "ghost listings" up long after a
 * deal closes, so a listing is never simply true or false.
 *
 * The nightly job (scripts/confidence_score.py) runs this same algorithm over
 * the `property_master` table and overwrites `confidence_score`. Keep the two
 * in step: same rules, same numbers. The app only reads the stored score; it
 * runs this file itself for the mock data until the scraper is live.
 *
 * Rules (start at 100, clamp to 0..100):
 *  - Missing from the source site: -5 for every full week since the scraper
 *    last found it there (`last_scraped_at`).
 *  - Long on the market: -10 after 180 days, -20 after 365 days.
 *  - Price flatlined: -10 when the price has not moved for 120+ days, -15
 *    after 240 days (no seller adjusts a price on a home that is gone).
 *  - Flagged delisted by a member (the Kill Switch): forced to 0 and removed
 *    from the Master Market view for everyone.
 */

export const CONFIDENCE_RULES = {
  missingPerWeek: 5,
  domSoft: { days: 180, penalty: 10 },
  domHard: { days: 365, penalty: 20 },
  flatSoft: { days: 120, penalty: 10 },
  flatHard: { days: 240, penalty: 15 },
} as const;

/** Scores at or below this are hidden from the Master Market view. */
export const HIDDEN_AT = 0;

export interface ConfidenceInput {
  /** When the scraper last found the listing on its source site. */
  lastFoundAt: string;
  daysOnMarket: number;
  /** When the asking price last changed (or when it was first listed). */
  lastPriceChangeAt: string;
  archived?: boolean;
  /** Defaults to now; the nightly job passes its run time. */
  asOf?: string;
}

export interface ConfidenceReason {
  label: string;
  points: number; // negative
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: number) => Math.max(0, Math.floor((to - Date.parse(from)) / DAY));

export function scoreConfidence(i: ConfidenceInput): { score: number; reasons: ConfidenceReason[] } {
  if (i.archived) return { score: 0, reasons: [{ label: "Flagged delisted by a member", points: -100 }] };
  const now = i.asOf ? Date.parse(i.asOf) : Date.now();
  const r = CONFIDENCE_RULES;
  const reasons: ConfidenceReason[] = [];

  const weeksMissing = Math.floor(daysBetween(i.lastFoundAt, now) / 7);
  if (weeksMissing > 0)
    reasons.push({ label: `Not found on the source site for ${weeksMissing} week${weeksMissing === 1 ? "" : "s"}`, points: -weeksMissing * r.missingPerWeek });

  if (i.daysOnMarket > r.domHard.days) reasons.push({ label: `On the market over ${r.domHard.days} days`, points: -r.domHard.penalty });
  else if (i.daysOnMarket > r.domSoft.days) reasons.push({ label: `On the market over ${r.domSoft.days} days`, points: -r.domSoft.penalty });

  const flat = daysBetween(i.lastPriceChangeAt, now);
  if (flat > r.flatHard.days) reasons.push({ label: `Price unchanged for ${flat} days`, points: -r.flatHard.penalty });
  else if (flat > r.flatSoft.days) reasons.push({ label: `Price unchanged for ${flat} days`, points: -r.flatSoft.penalty });

  const score = Math.max(0, Math.min(100, 100 + reasons.reduce((s, x) => s + x.points, 0)));
  return { score, reasons };
}

export type ConfidenceBand = "High" | "Medium" | "Low";
export const confidenceBand = (score: number): ConfidenceBand => (score >= 80 ? "High" : score >= 50 ? "Medium" : "Low");
export const BAND_COLOR: Record<ConfidenceBand, string> = { High: "#1F7A45", Medium: "#9A5B00", Low: "#B42318" };
