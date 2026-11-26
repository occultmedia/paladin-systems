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
  "Aruba real estate market intelligence: listings from local agencies checked daily, with price history, estimated market value, listing agents, a watchlist and interested clients. For real estate agents and investors.";
export const CONTACT_EMAIL = "ops@sequencedata.aw";

/**
 * Pricing: two plans, each billed monthly or once a year.
 * Pro adds property auctions, listings indexed from social media and
 * Airbnb rental income for investors; on
 * Standard those are shown locked. Who is on Pro: see lib/plan.ts.
 */
export type Plan = "standard" | "pro";
export type Billing = "monthly" | "yearly";
export const PLAN_ORDER: Plan[] = ["standard", "pro"];
export const BILLING_ORDER: Billing[] = ["monthly", "yearly"];
export const BILLING_LABEL: Record<Billing, string> = { monthly: "Monthly", yearly: "Yearly" };
export const PER: Record<Billing, "month" | "year"> = { monthly: "month", yearly: "year" };
export const PLANS: Record<Plan, { name: string; price: Record<Billing, number>; blurb: string }> = {
  standard: { name: "Standard", price: { monthly: 50, yearly: 550 }, blurb: "Every agency listing, value signals, watchlist and Market feed." },
  pro: { name: "Pro", price: { monthly: 99, yearly: 1000 }, blurb: "Everything in Standard, plus property auctions, social media listings and Airbnb rental income." },
};
export const PRO_FEATURES = ["Property auctions in Aruba", "Listings posted on social media", "Airbnb rental income by area, with a yield calculator"];
export const fmtPlanPrice = (p: Plan, b: Billing) => `$${PLANS[p].price[b].toLocaleString("en-US")}/${PER[b]}`;
/** What paying yearly saves against 12 monthly payments ($50 Standard, $188 Pro). */
export const yearlySavings = (p: Plan) => PLANS[p].price.monthly * 12 - PLANS[p].price.yearly;
/** Anything that is not "pro" (old "monthly"/"yearly" values included) is Standard. */
export const planOf = (v: unknown): Plan => (v === "pro" ? "pro" : "standard");
export const billingOf = (v: unknown): Billing => (v === "yearly" ? "yearly" : "monthly");
