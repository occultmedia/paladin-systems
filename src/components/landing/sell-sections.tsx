/*
 * Landing sections that sell Terminal to its two audiences, plus the AI
 * capability grid. White and clinical; black and lime are the only accents.
 * Every example is built from today's data by the page.
 */

import Image from "next/image";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

/* ── shared bits ─────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
      <span className="size-1.5 rounded-full bg-lime ring-1 ring-zinc-950/40" />
      {children}
    </p>
  );
}

function Benefit({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <StaggerItem className="flex gap-4 border-t border-zinc-200 py-5 first:border-t-0 first:pt-0">
      <span className="font-mono text-[12px] tabular-nums text-zinc-400">{String(n).padStart(2, "0")}</span>
      <div>
        <p className="font-display text-[18px] font-semibold text-zinc-950">{title}</p>
        <p className="mt-1 max-w-[52ch] text-[14.5px] leading-relaxed text-zinc-600">{text}</p>
      </div>
    </StaggerItem>
  );
}

function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex h-12 items-center gap-2 rounded-full bg-zinc-950 pl-6 pr-4 font-display text-[15px] font-semibold text-lime transition-colors hover:bg-zinc-800">
      {children}
      <span className="grid size-6 place-items-center rounded-full bg-lime text-zinc-950 transition-transform group-hover:translate-x-0.5">
        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" strokeLinecap="square" />
        </svg>
      </span>
    </Link>
  );
}

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
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-400">01 · A verdict on every listing</p>
        <div className="mt-4 flex-1 rounded-xl bg-zinc-950 p-4 text-white">
          <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
            AI Signal <span className="rounded bg-lime px-1.5 py-px font-semibold text-zinc-950">{ex.note.verdict}</span>
          </p>
          <p className="mt-2.5 text-[13.5px] font-semibold leading-snug">{ex.note.headline}</p>
          <p className="mt-2 text-[11.5px] text-zinc-400">
            {ex.note.listing} · {ex.note.district}
          </p>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-600">Plain-English note, verdict and next step on all listings, every morning.</p>
      </StaggerItem>

      <StaggerItem className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-400">02 · Your morning briefing</p>
        <div className="mt-4 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Ready at {ex.brief.time}</p>
          <p className="mt-2.5 text-[13.5px] font-semibold leading-snug text-zinc-950">{ex.brief.headline}</p>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-600">What moved overnight across the island, summed up before your first call.</p>
      </StaggerItem>

      <StaggerItem className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-400">03 · Comps in a second</p>
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
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-400">04 · Ghost listings caught</p>
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

export function AgentsSection({ m }: { m: AgentMorning }) {
  return (
    <section id="agents" className="scroll-mt-16 border-t border-zinc-200 bg-white">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <Eyebrow>For real estate agents</Eyebrow>
            <h2 className="mt-4 max-w-[16ch] font-display text-[34px] font-bold leading-[1.04] tracking-[-0.025em] text-zinc-950 sm:text-[52px]">
              Smart agents run on{" "}
              <span className="relative inline-block">
                <span aria-hidden className="absolute inset-x-[-0.05em] bottom-[0.06em] top-[0.55em] -z-10 rounded-[0.08em] bg-lime" />
                Terminal.
              </span>
            </h2>
            <p className="mt-5 max-w-[50ch] text-[16.5px] leading-relaxed text-zinc-600">
              The market intelligence that used to take a morning of browsing agency sites and calling around, ready before your first coffee. Walk into every conversation knowing more than the other side.
            </p>
          </Reveal>
          <Stagger className="mt-9" gap={0.1}>
            <Benefit n={1} title="Know first" text="Every new listing, price cut and contract on the island by 7:00, each with an AI note on what it means." />
            <Benefit n={2} title="Price with proof" text="Comparable $/ft² for the same kind of property in the same district. Show sellers exactly why your price is right." />
            <Benefit n={3} title="Never lose a lead" text="Keep every client on the property they asked about. When the price drops, Terminal tells you who to call." />
            <Benefit n={4} title="Off-market deal flow" text="Post and find off-market deals and buyer requests on members-only Deals, and co-broke with other agents." />
          </Stagger>
          <Reveal className="mt-8">
            <Cta href="/signup">Start as an agent</Cta>
          </Reveal>
        </div>

        {/* an agent's morning, from today's data */}
        <Reveal delay={0.1} y={24}>
          <div className="relative rounded-3xl border border-zinc-200 bg-zinc-50 p-4 sm:p-6">
            <p className="px-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">Your morning in Terminal · {m.time}</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl bg-zinc-950 p-5 text-white">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-lime">Market brief</p>
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
                  <p className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">
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
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">Pricing check</p>
                  <p className="mt-2 text-[14px] font-semibold text-zinc-950">
                    {m.pricing.listing} is priced {Math.abs(m.pricing.pct).toFixed(0)}% {m.pricing.pct > 0 ? "above" : "below"} comparable homes
                  </p>
                  <p className="mt-1 text-[12.5px] text-zinc-500">Bring the comps to the seller meeting, not a guess.</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── for investors ───────────────────────────────────────────────────── */

export type InvestorExample = {
  post: { name: string; company: string; title: string; body: string; amount: string; district: string };
  undervalued: number;
  offMarket: number;
  photo: string | null;
};

export function InvestorsSection({ ex }: { ex: InvestorExample }) {
  return (
    <section id="investors" className="scroll-mt-16 border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        {/* the network: a partnership post on members-only Deals */}
        <Reveal y={24} className="order-2 lg:order-1">
          <div className="relative">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_30px_70px_-35px_rgb(10_10_10/0.35)] sm:p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">Deals · Partnership</p>
                <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-lime">Members only</span>
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
              {ex.photo && (
                <Image src={`${ex.photo}?auto=format&fit=crop&w=900&h=380&q=70`} alt="" width={520} height={220} unoptimized className="mt-4 aspect-[2.4/1] h-auto w-full rounded-xl object-cover" />
              )}
              <p className="mt-4 font-display text-[18px] font-bold leading-snug text-zinc-950">{ex.post.title}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-600">{ex.post.body}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                <p className="text-[12.5px] text-zinc-500">
                  Capital needed <b className="font-display text-[15px] text-zinc-950">{ex.post.amount}</b> · {ex.post.district}
                </p>
                <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-[12.5px] font-semibold text-lime">Contact {ex.post.name.split(" ")[0]}</span>
              </div>
            </div>
            <div className="absolute -right-2 -top-4 hidden rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-lg sm:block">
              <p className="font-display text-[22px] font-bold leading-none text-zinc-950">{ex.undervalued}</p>
              <p className="mt-1 text-[11px] text-zinc-500">undervalued today</p>
            </div>
          </div>
        </Reveal>

        <div className="order-1 lg:order-2">
          <Reveal>
            <Eyebrow>For investors</Eyebrow>
            <h2 className="mt-4 max-w-[17ch] font-display text-[34px] font-bold leading-[1.04] tracking-[-0.025em] text-zinc-950 sm:text-[52px]">
              Where Aruba&apos;s serious capital meets.
            </h2>
            <p className="mt-5 max-w-[50ch] text-[16.5px] leading-relaxed text-zinc-600">
              Find undervalued property before it makes the rounds, and the partners to build it with. Terminal is a paid, members-only network of agents, brokerages and investors, so the conversations stay high-value.
            </p>
          </Reveal>
          <Stagger className="mt-9" gap={0.1}>
            <Benefit n={1} title="Find co-investors for projects" text="Post a partnership or a capital raise on Deals. Members contact you directly, nothing goes public." />
            <Benefit n={2} title="A high-value network" text="Members-only and paid. Every member has a real profile with name, photo and company: agents, brokerages and investors." />
            <Benefit n={3} title="Deal flow first" text="AI flags undervalued listings every morning, and agents share off-market deals on Deals before they hit the market." />
            <Benefit n={4} title="Diligence built in" text="Full price history, comparable $/ft² and a Confidence Score on every listing, so you only chase what is real." />
          </Stagger>
          <Reveal className="mt-8">
            <Cta href="/signup">Join as an investor</Cta>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
