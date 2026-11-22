/*
 * Canonical site configuration. SITE_URL is used for link previews, the
 * sitemap and search engines. When a custom domain is live, set
 * NEXT_PUBLIC_SITE_URL in Vercel (no code change needed).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sequence-labs-psi.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Terminal";
export const SITE_TITLE =
  "Terminal · Aruba Real Estate Market Intelligence | Powered by Sequence Data";
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
