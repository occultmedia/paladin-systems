/*
 * Landing sections that sell Terminal to its two audiences, plus the AI
 * capability grid. White and clinical; black and lime are the only accents.
 * Every example is built from today's data by the page.
 */

import { RunLine } from "@/components/run-line";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { FloorPlan } from "./floor-plan";

/* ── AI capabilities ─────────────────────────────────────────────────── */

export type AiExamples = {
  note: { listing: string; district: string; verdict: string; headline: string };
  brief: { headline: string; time: string };
  comps: { listing: string; psf: number; compsPsf: number; pct: number; basis: string };
  ghost: { listing: string; score: number; reason: string };
};

export function AiCapabilities({ ex }: { ex: AiExamples }) {
  const ratio = Math.max(0.08, Math.min(1, ex.comps.psf / ex.comps.compsPsf));
  return (
    <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.08}>
      <StaggerItem className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-[12.5px] font-medium text-zinc-500">01 · A verdict on every listing</p>
        <div className="mt-4 flex-1 rounded-xl bg-zinc-950 p-4 text-white">
          <p className="flex items-center justify-between text-[12px] font-medium text-zinc-400">
            AI Signal <span className="rounded bg-lime px-1.5 py-px font-semibold text-zinc-950">🔥 {ex.note.verdict}</span>
          </p>
          <p className="mt-2.5 text-[13.5px] font-semibold leading-snug">{ex.note.headline}</p>
          <p className="mt-2 text-[11.5px] text-zinc-400">
            {ex.note.listing} · {ex.note.district}
          </p>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-600">Plain-English note, verdict and next step on all listings, every morning.</p>
      </StaggerItem>

      <StaggerItem className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-[12.5px] font-medium text-zinc-500">02 · Your morning briefing</p>
        <div className="mt-4 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[12px] font-medium text-zinc-500">Ready at {ex.brief.time}</p>
          <p className="mt-2.5 text-[13.5px] font-semibold leading-snug text-zinc-950">{ex.brief.headline}</p>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-600">What moved overnight across the island, summed up before your first call.</p>
      </StaggerItem>

      <StaggerItem className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-[12.5px] font-medium text-zinc-500">03 · Comps in a second</p>
        <div className="mt-4 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="truncate text-[13px] font-semibold text-zinc-950">{ex.comps.listing}</p>
          <div className="mt-3 space-y-2 text-[11.5px] text-zinc-500">
            <div>
              <div className="flex justify-between">
                <span>This listing</span>
                <b className="tabular-nums text-zinc-950">${ex.comps.psf.toLocaleString("en-US")}/ft²</b>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-zinc-200">
                <div className="h-full rounded-full bg-zinc-950" style={{ width: `${ratio * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between">
                <span>Comps median</span>
                <b className="tabular-nums text-zinc-950">${ex.comps.compsPsf.toLocaleString("en-US")}/ft²</b>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-lime" />
            </div>
          </div>
          <p className="mt-3 inline-flex rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-[10.5px] text-lime">{ex.comps.pct.toFixed(0)}% vs {ex.comps.basis}</p>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-600">Every price checked against the same kind of property in the same district.</p>
      </StaggerItem>

      <StaggerItem className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-[12.5px] font-medium text-zinc-500">04 · Ghost listings caught</p>
        <div className="mt-4 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="truncate text-[13px] font-semibold text-zinc-950">{ex.ghost.listing}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[28px] font-bold leading-none text-[#B42318]">{ex.ghost.score}%</span>
            <span className="text-[11.5px] text-zinc-500">confidence</span>
          </p>
          <p className="mt-2 text-[11.5px] leading-snug text-zinc-600">{ex.ghost.reason}</p>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-600">Listings the agency forgot to take down are scored down before you waste a call.</p>
      </StaggerItem>
    </Stagger>
  );
}

/* ── for agents ──────────────────────────────────────────────────────── */

export type AgentMorning = {
  time: string;
  newCount: number;
  moves: number;
  contracts: number;
  drop: { listing: string; pct: number; price: string } | null;
  lead: { name: string; listing: string } | null;
  pricing: { listing: string; district: string; pct: number } | null;
};

/** An agent's morning in Terminal, built from today's data. */
export function AgentMorningCard({ m }: { m: AgentMorning }) {
  return (
    <div className="relative rounded-3xl border border-zinc-200 bg-zinc-50 p-4 sm:p-6">
      <RunLine speed={9} delay={-4} />
      <p className="px-1 text-[12px] font-medium text-zinc-500">Your morning in Terminal · {m.time}</p>
      <div className="mt-3 space-y-3">
        <div className="rounded-2xl bg-zinc-950 p-5 text-white">
          <p className="text-[12px] font-medium text-lime">Market brief</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              [m.newCount, "new listings"],
              [m.moves, "price changes"],
              [m.contracts, "contracts & sales"],
            ].map(([v, l]) => (
              <div key={String(l)}>
                <p className="font-display text-[30px] font-bold leading-none">{v}</p>
                <p className="mt-1 text-[11.5px] text-zinc-400">{l}</p>
              </div>
            ))}
          </div>
        </div>
        {m.drop && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="flex items-center justify-between text-[12px] font-medium text-zinc-500">
              Price cut on a listing you watch <span className="rounded bg-zinc-950 px-1.5 py-px text-[#FF9A9A]">{m.drop.pct.toFixed(1)}%</span>
            </p>
            <p className="mt-2 text-[14px] font-semibold text-zinc-950">
              {m.drop.listing} · now {m.drop.price}
            </p>
            {m.lead && (
              <p className="mt-2 flex items-center justify-between gap-3 border-t border-zinc-100 pt-2 text-[12.5px] text-zinc-600">
                <span>
                  <b className="text-zinc-950">{m.lead.name}</b> asked about this one
                </span>
                <span className="rounded-full bg-lime px-2.5 py-1 text-[11.5px] font-semibold text-zinc-950">Call now</span>
              </p>
            )}
          </div>
        )}
        {m.pricing && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[12px] font-medium text-zinc-500">Pricing check</p>
            <p className="mt-2 text-[14px] font-semibold text-zinc-950">
              {m.pricing.listing} is priced {Math.abs(m.pricing.pct).toFixed(0)}% {m.pricing.pct > 0 ? "above" : "below"} comparable homes
            </p>
            <p className="mt-1 text-[12.5px] text-zinc-500">Bring the comps to the seller meeting, not a guess.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── for investors ───────────────────────────────────────────────────── */

export type InvestorExample = {
  post: { name: string; company: string; title: string; body: string; amount: string; district: string };
  belowMarket: number;
  offMarket: number;
};

/** A partnership post on members-only Deals (fictional member). */
export function InvestorPostCard({ ex }: { ex: InvestorExample }) {
  return (
    <div className="relative">
      <div className="relative rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_30px_70px_-35px_rgb(10_10_10/0.35)] sm:p-6">
        <RunLine speed={9} delay={-6} />
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-zinc-500">Deals · Partnership</p>
          <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[12px] font-medium text-lime">Members only</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-zinc-950 font-display text-[15px] font-bold text-lime">
            {ex.post.name
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </span>
          <div>
            <p className="text-[14px] font-semibold text-zinc-950">{ex.post.name}</p>
            <p className="text-[12px] text-zinc-500">Investor · {ex.post.company}</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <FloorPlan className="block h-auto w-full" />
        </div>
        <p className="mt-4 font-display text-[18px] font-bold leading-snug text-zinc-950">{ex.post.title}</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-600">{ex.post.body}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <p className="text-[12.5px] text-zinc-500">
            Capital needed <b className="font-display text-[15px] text-zinc-950">{ex.post.amount}</b> · {ex.post.district}
          </p>
          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-[12.5px] font-semibold text-lime">Contact {ex.post.name.split(" ")[0]}</span>
        </div>
      </div>
      <div className="glass absolute -right-2 -top-4 z-30 hidden rounded-2xl px-4 py-3 sm:block">
        <p className="font-display text-[22px] font-bold leading-none text-zinc-950">{ex.belowMarket}</p>
        <p className="mt-1 text-[11px] text-zinc-500">below market today</p>
      </div>
    </div>
  );
}

/* ── for brokers ─────────────────────────────────────────────────────── */

export type BrokerExample = {
  rows: Array<{ name: string; district: string; price: string; agency: string; color: string; change: string }>;
  agencies: number;
};

/** Today's moves across every agency, with the CSV export a brokerage uses. */
export function BrokerBoardCard({ ex }: { ex: BrokerExample }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_30px_70px_-35px_rgb(10_10_10/0.35)]">
      <RunLine speed={9} delay={-2} />
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div>
          <p className="font-display text-[15px] font-bold text-zinc-950">Today across {ex.agencies} agencies</p>
          <p className="text-[12px] text-zinc-500">Every competitor&apos;s new listings and price moves</p>
        </div>
        <span className="rounded-full bg-zinc-950 px-3 py-1.5 text-[12px] font-semibold text-lime">Export CSV</span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {ex.rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 px-5 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: r.color }}>
              {r.agency
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-zinc-950">{r.name}</span>
              <span className="block truncate text-[11.5px] text-zinc-500">
                {r.agency} · {r.district}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-display text-[13.5px] font-bold tabular-nums text-zinc-950">{r.price}</span>
              <span className="block text-[11px] font-semibold text-zinc-500">{r.change}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
