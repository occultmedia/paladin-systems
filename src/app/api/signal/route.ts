/*
 * POST /api/signal
 *   { kind: "brief" }                -> AI Signal market brief for the latest Index run
 *   { kind: "listing", id: string }  -> AI note for one listing
 *
 * Members only: the request carries the member's Supabase access token, and
 * the server reads the live market with it (`v_master_market` and the agent
 * listings that member can see), so row-level security decides what goes in.
 * The server builds the facts itself (the client only sends an id), asks
 * Claude for the write-up as structured JSON, and caches the answer until the
 * listing or the market changes.
 * Without ANTHROPIC_API_KEY, or if the call fails, it returns the computed
 * note from the same facts with `source: "computed"`.
 *
 * Later: generate these in the daily Index job and store them in Supabase
 * next to the listing, so page views never wait on the model.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { MARKET_ID, buildIndexRuns, type Listing } from "@/lib/aruba-data";
import { agentRowToListing } from "@/lib/agent-listing-map";
import type { AgentListingViewRow, Database } from "@/lib/database.types";
import { fetchMasterMarket } from "@/lib/master-market";
import {
  LISTING_NOTE_SCHEMA,
  MARKET_BRIEF_SCHEMA,
  VERDICTS,
  briefFacts,
  computedBrief,
  computedListingNote,
  listingFacts,
  type ListingNote,
  type MarketBrief,
  type WithSource,
} from "@/lib/signal-ai";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

const SYSTEM = `You are AI Signal, the market analyst inside Terminal (by Sequence Data), an Aruba real estate intelligence terminal used by real estate agents and investors.
You are given FACTS as JSON, computed from daily Index runs of agency websites. Write for a busy agent: plain English, specific, no hype, no emojis.
Rules:
- Use only numbers that appear in the facts (you may round them). Never invent comps, prices, dates, rents or names.
- Listing status: "For sale" = active on the agency site; "Under contract" = agency marks it under offer or pending; "Sold" = agency marks it sold; "De-listed" = removed from the agency site without being marked sold (withdrawn, expired or sold privately; do not call it sold).
- Prices are USD. "Erfpacht" is government leasehold land; "Eigendom" is freehold. If the tenure is not stated, say it is unknown; never assume it is owned.
- Sizes: Aruba's agents work in square metres. Give sizes and prices per m² first; sq ft may follow in brackets. A size or price per m² of null means the agency does not state it: say so, never call it cheap or expensive, and never compare it.
- days_on_market counts from the day Terminal first indexed the listing, not from when the agency first listed it. Never say a property sold after that many days.
- Wording: say "below market" (the facts call it UNDERVALUED), never "undervalued". Call the daily data collection "the Index", never "scrape" or "scraping".
- Value: compare the price only with estimate_per_m2_usd / vs_estimate_pct. They come from asking prices of similar homes, not sales. Call it below market only when scoring.signal is UNDERVALUED and overpriced only when it is OVERPRICED; AT_MARKET means within the normal range, whatever the percentage. When scoring says "not scored", say there is no value signal and why; never judge the price and never use the verdicts Opportunity or Overpriced.
- Prefer concrete comparisons ("24% under similar homes nearby") over adjectives.
- Do not give legal, tax or financial advice; frame it as market observations and next steps for an agent.
- Keep headline under 110 characters, analysis 2-3 sentences, each point one short sentence.`;

type Cached = WithSource<ListingNote> | WithSource<MarketBrief>;
const cache = new Map<string, Promise<Cached | null>>();

let client: Anthropic | null = null;
const getClient = () => (process.env.ANTHROPIC_API_KEY ? (client ??= new Anthropic()) : null);

async function askClaude<T>(task: string, facts: unknown, schema: Record<string, unknown>): Promise<T | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const res = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: SYSTEM,
      messages: [{ role: "user", content: `${task}\n\nFACTS:\n${JSON.stringify(facts)}` }],
    });
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
    const text = res.content.find((b) => b.type === "text");
    return text && text.type === "text" ? (JSON.parse(text.text) as T) : null;
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`[signal] Claude API ${err.status}: ${err.message}`);
    else console.error("[signal] Claude call failed", err);
    return null;
  }
}

/** The live market as this member sees it, or null when the token is missing or invalid. */
async function marketFor(req: Request): Promise<{ uid: string; visible: Listing[]; shared: Listing[] } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return null;
  const sb = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await sb.auth.getUser(token);
  if (!auth.user) return null;
  const [indexed, members] = await Promise.all([
    fetchMasterMarket(sb, MARKET_ID),
    sb.from("v_agent_listings").select("*").eq("market_id", MARKET_ID).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as AgentListingViewRow[];
    }),
  ]);
  const mine = members.map((r) => agentRowToListing(r, auth.user.id));
  const visible = [...mine, ...indexed];
  // Comps and the brief only use what every member can see, so shared cache entries never carry anyone's private listings.
  const shared = [...mine.filter((l) => l.member?.visibility === "members"), ...indexed];
  return { uid: auth.user.id, visible, shared };
}

/** Changes whenever a listing is added, removed, repriced or changes status. */
function fingerprint(listings: Listing[]) {
  let h = 0;
  for (const l of listings) for (const c of `${l.listing_id}:${l.asking_price_usd}:${l.status};`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${listings.length}-${h.toString(36)}`;
}

async function buildListing(l: Listing, comps: Listing[]): Promise<Cached | null> {
  const facts = listingFacts(l, comps.some((x) => x.listing_id === l.listing_id) ? comps : [l, ...comps]);
  const ai = await askClaude<ListingNote>(
    "Write the analyst note for this listing: a verdict (Opportunity, Fair value, Overpriced or Watch), a one-line headline, a 2-3 sentence analysis, 2-4 supporting points, and one concrete next step for the agent.",
    facts,
    LISTING_NOTE_SCHEMA,
  );
  const ok = ai && VERDICTS.includes(ai.verdict) && ai.headline;
  const note = ok ? { ...ai, points: ai.points.slice(0, 4) } : computedListingNote(facts);
  return { ...note, source: ok ? "claude" : "computed", generated_at: new Date().toISOString() };
}

async function buildBrief(all: Listing[]): Promise<Cached> {
  const latest = all.map((l) => l.last_scraped).sort().pop() ?? new Date().toISOString();
  const facts = briefFacts(buildIndexRuns(all, [], 7, latest), all);
  const ai = await askClaude<MarketBrief>(
    "Write today's AI Signal briefing from the latest Index runs: a headline, a 2-3 sentence summary of what changed and what it says about the market, 3-5 takeaways, and up to 3 listings (by listing_id from the facts) worth looking at today with a one-line reason each.",
    facts,
    MARKET_BRIEF_SCHEMA,
  );
  const ids = new Set(all.map((l) => l.listing_id));
  const ok = ai && ai.headline && Array.isArray(ai.points);
  const brief = ok ? { ...ai, points: ai.points.slice(0, 5), watch: ai.watch.filter((w) => ids.has(w.listing_id)).slice(0, 3) } : computedBrief(facts);
  return { ...brief, source: ok ? "claude" : "computed", generated_at: new Date().toISOString() };
}

function cached(key: string, make: () => Promise<Cached | null>): Promise<Cached | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = make();
  cache.set(key, p); // share the in-flight call between concurrent requests
  // keep only Claude answers; computed ones are cheap and should upgrade once a key is set
  p.then(
    (v) => (!v || v.source !== "claude") && cache.delete(key),
    () => cache.delete(key),
  );
  return p;
}

export async function POST(req: Request) {
  let body: { kind?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isBrief = body.kind === "brief";
  const isListing = body.kind === "listing" && typeof body.id === "string" && body.id.length < 64;
  if (!isBrief && !isListing) return Response.json({ error: "Expected { kind: 'brief' } or { kind: 'listing', id }" }, { status: 400 });

  let market: Awaited<ReturnType<typeof marketFor>>;
  try {
    market = await marketFor(req);
  } catch (err) {
    console.error("[signal] could not read the market", err);
    return Response.json({ error: "Market unavailable" }, { status: 503 });
  }
  if (!market) return Response.json({ error: "Sign in to use AI Signal" }, { status: 401 });

  if (isBrief) {
    if (!market.shared.length) return Response.json({ error: "No listings yet" }, { status: 404 });
    const brief = await cached(`brief:${fingerprint(market.shared)}`, () => buildBrief(market.shared));
    return Response.json(brief);
  }
  // Only listings this member can see; the cache is checked after that.
  const l = market.visible.find((x) => x.listing_id === body.id);
  if (!l) return Response.json({ error: "Unknown listing" }, { status: 404 });
  const key = `listing:${l.listing_id}:${l.asking_price_usd}:${l.status}:${l.last_scraped}:${fingerprint(market.shared)}`;
  const note = await cached(key, () => buildListing(l, market.shared));
  return note ? Response.json(note) : Response.json({ error: "Unknown listing" }, { status: 404 });
}
