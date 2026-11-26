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
 * Pricing: two plans, billed once a year.
 * Pro adds property auctions and listings indexed from social media; on
 * Standard those are shown locked. Who is on Pro: see lib/plan.ts.
 */
export type Plan = "standard" | "pro";
export const PLAN_ORDER: Plan[] = ["standard", "pro"];
export const PLANS: Record<Plan, { name: string; price: number; per: "year"; blurb: string }> = {
  standard: { name: "Standard", price: 550, per: "year", blurb: "Every agency listing, value signals, watchlist and Market feed." },
  pro: { name: "Pro", price: 1000, per: "year", blurb: "Everything in Standard, plus property auctions and social media listings." },
};
export const PRO_FEATURES = ["Property auctions in Aruba", "Listings posted on social media"];
export const fmtPlanPrice = (p: Plan) => `$${PLANS[p].price.toLocaleString("en-US")}/${PLANS[p].per}`;
/** Anything that is not "pro" (old "monthly"/"yearly" values included) is Standard. */
export const planOf = (v: unknown): Plan => (v === "pro" ? "pro" : "standard");
