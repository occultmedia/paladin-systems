/*
 * POST /api/signal
 *   { kind: "brief" }                -> AI Signal market brief for the latest scrape
 *   { kind: "listing", id: string }  -> AI note for one listing
 *
 * The server builds the facts itself from the scrape data (the client only
 * sends an id), asks Claude for the write-up as structured JSON, and caches
 * the answer per scrape so each note is generated once a day per instance.
 * Without ANTHROPIC_API_KEY, or if the call fails, it returns the computed
 * note from the same facts with `source: "computed"`.
 *
 * Later: generate these in the daily scrape job and store them in Supabase
 * next to the listing, so page views never wait on the model.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ALL_LISTINGS, SCRAPE_RUNS, SCRAPED_AT } from "@/lib/aruba-data";
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

const SYSTEM = `You are Signal, the market analyst inside an Aruba real estate intelligence terminal used by real estate agents and investors.
You are given FACTS as JSON, computed from daily scrapes of agency websites. Write for a busy agent: plain English, specific, no hype, no emojis.
Rules:
- Use only numbers that appear in the facts (you may round them). Never invent comps, prices, dates, rents or names.
- Prices are USD. "Erfpacht" is government leasehold land; "Eigendom" is freehold.
- Prefer concrete comparisons ("12% under the district median per sq ft") over adjectives.
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

async function buildListing(id: string): Promise<Cached | null> {
  const l = ALL_LISTINGS.find((x) => x.listing_id === id);
  if (!l) return null;
  const facts = listingFacts(l, ALL_LISTINGS);
  const ai = await askClaude<ListingNote>(
    "Write the analyst note for this listing: a verdict (Opportunity, Fair value, Overpriced or Watch), a one-line headline, a 2-3 sentence analysis, 2-4 supporting points, and one concrete next step for the agent.",
    facts,
    LISTING_NOTE_SCHEMA,
  );
  const ok = ai && VERDICTS.includes(ai.verdict) && ai.headline;
  const note = ok ? { ...ai, points: ai.points.slice(0, 4) } : computedListingNote(facts);
  return { ...note, source: ok ? "claude" : "computed", generated_at: new Date().toISOString() };
}

async function buildBrief(): Promise<Cached> {
  const facts = briefFacts(SCRAPE_RUNS, ALL_LISTINGS);
  const ai = await askClaude<MarketBrief>(
    "Write today's AI Signal briefing from the latest scrapes: a headline, a 2-3 sentence summary of what changed and what it says about the market, 3-5 takeaways, and up to 3 listings (by listing_id from the facts) worth looking at today with a one-line reason each.",
    facts,
    MARKET_BRIEF_SCHEMA,
  );
  const ids = new Set(ALL_LISTINGS.map((l) => l.listing_id));
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

  if (body.kind === "brief") {
    const brief = await cached(`brief:${SCRAPED_AT}`, buildBrief);
    return Response.json(brief);
  }
  if (body.kind === "listing" && typeof body.id === "string" && body.id.length < 64) {
    const id = body.id;
    const note = await cached(`listing:${id}:${SCRAPED_AT}`, () => buildListing(id));
    return note ? Response.json(note) : Response.json({ error: "Unknown listing" }, { status: 404 });
  }
  return Response.json({ error: "Expected { kind: 'brief' } or { kind: 'listing', id }" }, { status: 400 });
}
