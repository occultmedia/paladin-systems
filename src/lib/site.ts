/* Canonical site configuration. Update SITE_URL when the real domain is live. */
export const SITE_URL = "https://paladin-systems.vercel.app";
export const SITE_NAME = "Tide";
export const SITE_TITLE =
  "Tide · Aruba Real Estate Market Intelligence | Powered by Sequence Data";
export const SITE_DESCRIPTION =
  "Every home, land and commercial listing in Aruba, checked daily: price history, estimated market value, listing agents, a watchlist and interested clients on every property. For real estate agents and investors.";
export const CONTACT_EMAIL = "ops@sequencedata.aw";

/** Pricing: one plan, billed monthly or once a year. */
export type Billing = "monthly" | "yearly";
export const PLANS: Record<Billing, { price: number; per: string }> = {
  monthly: { price: 99, per: "month" },
  yearly: { price: 1000, per: "year" },
};
export const YEARLY_SAVINGS_USD = PLANS.monthly.price * 12 - PLANS.yearly.price; // $188
