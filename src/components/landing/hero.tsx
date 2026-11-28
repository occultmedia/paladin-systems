"use client";

/*
 * Landing hero. Calm and product-first: what Baseline is in one headline
 * and one sentence, two small actions, then Baseline itself in a light
 * browser window. The window shows what members get today: the AI Signal
 * line, the market numbers, Available / Under contract / Sold, grouped map
 * pins (a home listed by several agencies is one pin), Pro notary auctions
 * and the day's moves, which the map tours. Sample data, and never an agency
 * or agent name. Motion stops for prefers-reduced-motion and off screen.
 */

import { RunLine } from "@/components/run-line";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BaselineLogo } from "@/components/logo";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Crown, Gavel, LayoutList, Megaphone, Pin, Search, Settings, Sparkles } from "lucide-react";
import { ProBadge } from "@/components/pro-badge";
import type { MapPin } from "@/lib/market-api";
import { CountUp } from "@/components/motion/reveal";
import { GrainField } from "./grain-field";

const ArubaMap = dynamic(() => import("@/components/dashboard/aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

export type HeroEvent = { id: string; listingId: string; auctionId?: string; kind: string; tone: "up" | "down" | "warn" | "mint"; title: string; detail: string; value: string };
export type HeroAuction = { id: string; lat: number; lng: number; title: string; tracked: boolean };
export type HeroStatuses = { available: number; contract: number; sold: number };
export type HeroKpi = { label: string; value: number; prefix?: string; suffix?: string; decimals?: number };

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 6500;
const DOT: Record<HeroEvent["tone"], string> = { up: "#4CA30D", down: "#E5484D", warn: "#E59A1E", mint: "#18181B" };
const TABS = [
  { label: "Listings", icon: LayoutList },
  { label: "Watchlist", icon: Pin },
  { label: "Market feed", icon: Megaphone },
  { label: "Pro", icon: Crown },
  { label: "Settings", icon: Settings },
];

/* ── Baseline inside the window ──────────────────────────────────── */

function TerminalWindow({
  pins,
  auctions,
  events,
  step,
  onStep,
  running,
  kpis,
  statuses,
  signal,
  runTime,
  total,
}: {
  pins: MapPin[];
  auctions: HeroAuction[];
  events: HeroEvent[];
  step: number;
  onStep: (n: number) => void;
  running: boolean;
  kpis: HeroKpi[];
  statuses: HeroStatuses;
  signal: string;
  runTime: string;
  total: number;
}) {
  const active = events.length ? step % events.length : 0;
  const event = events[active];
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-t-xl bg-white shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_30px_80px_-24px_rgb(15_23_42/0.45)] ring-1 ring-black/5">
      <RunLine speed={8} delay={-3} />
      {/* browser chrome */}
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-zinc-50 px-3.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-zinc-300" />
          <span className="size-2.5 rounded-full bg-zinc-300" />
          <span className="size-2.5 rounded-full bg-zinc-300" />
        </span>
        <span className="mx-auto truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-zinc-500 ring-1 ring-zinc-200">baseline.sequencedata.aw / listings</span>
        <span className="w-[42px]" aria-hidden />
      </div>

      {/* Baseline app bar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-200 px-3 sm:px-4">
        <BaselineLogo size={11} />
        <nav className="ml-3 hidden items-center gap-0.5 md:flex" aria-hidden>
          {TABS.map(({ label, icon: Icon }, i) => (
            <span key={label} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium lg:px-2.5 ${i === 0 ? "bg-zinc-100 text-zinc-950" : "text-zinc-500"}`}>
              <Icon size={13} strokeWidth={1.8} />
              {label}
            </span>
          ))}
        </nav>
        <span className="ml-auto hidden items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] text-zinc-400 ring-1 ring-zinc-200 xl:inline-flex">
          <Search size={12} /> Search {total} listings
          <kbd className="ml-3 rounded border border-zinc-200 px-1 text-[10px]">⌘K</kbd>
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-zinc-500 xl:ml-0">
          <span className="size-1.5 rounded-full bg-[#4CA30D]" />
          Updated today {runTime}
        </span>
        <ProBadge size="xs" className="hidden sm:inline-flex" />
      </div>

      {/* the AI Signal line, as at the top of the dashboard */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50/60 px-3 text-[12px] sm:px-4">
        <span className="size-1.5 shrink-0 rounded-full bg-[#4CA30D]" />
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-zinc-950">
          <Sparkles size={12} /> AI Signal
        </span>
        <span className="min-w-0 truncate text-zinc-600">Market steady: {signal}</span>
        <span className="ml-auto hidden shrink-0 font-medium text-zinc-950 sm:inline">Today&apos;s briefing</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[290px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* left: brief, numbers, today's moves */}
        <aside className="hidden min-h-0 flex-col border-r border-zinc-200 md:flex">
          <div className="grid grid-cols-2 border-b border-zinc-200">
            {kpis.map((k, i) => (
              <div key={k.label} className={`p-3.5 ${i % 2 ? "border-l border-zinc-200" : ""} ${i > 1 ? "border-t border-zinc-200" : ""}`}>
                <p className="text-[11px] text-zinc-500">{k.label}</p>
                <p className="mt-1 font-display text-[22px] leading-none tracking-[-0.02em] text-zinc-950">
                  <CountUp value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} onMount delay={0.8 + i * 0.1} />
                </p>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 border-b border-zinc-200 px-3 py-2.5 text-[11.5px]">
            <span className="rounded-full bg-zinc-950 px-2.5 py-1 font-semibold text-white">
              Available <span className="ml-0.5 text-lime">{statuses.available}</span>
            </span>
            <span className="rounded-full px-2.5 py-1 font-medium text-zinc-700 ring-1 ring-zinc-200">
              Under contract <span className="text-zinc-400">{statuses.contract}</span>
            </span>
            <span className="rounded-full px-2.5 py-1 font-medium text-zinc-700 ring-1 ring-zinc-200">
              Sold <span className="text-zinc-400">{statuses.sold}</span>
            </span>
          </div>
          <p className="px-4 pb-1.5 pt-3 text-[11.5px] font-medium text-zinc-500">Today&apos;s market moves</p>
          <ul className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
            {events.map((e, i) => {
              const on = i === active;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onStep(i)}
                    className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left transition-colors ${on ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
                  >
                    {e.auctionId ? (
                      <span className="grid size-3.5 shrink-0 place-items-center rounded-[4px] bg-zinc-950 text-lime">
                        <Gavel size={9} strokeWidth={2.4} />
                      </span>
                    ) : (
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: DOT[e.tone] }} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-zinc-950">{e.title}</span>
                      <span className="block truncate text-[11px] text-zinc-500">{e.kind}</span>
                    </span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-zinc-600">{e.value.split(" · ")[0]}</span>
                    {on && running && (
                      <motion.span
                        key={`p-${step}`}
                        aria-hidden
                        className="absolute inset-x-2.5 bottom-0 h-px origin-left bg-zinc-950"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* right: the live 3D map */}
        <div className="relative min-h-0 min-w-0">
          <ArubaMap
            mode="pins"
            pins={pins}
            auctions={auctions}
            selectedId={event && !event.auctionId ? event.listingId : null}
            selectedAuctionId={event?.auctionId ?? null}
            interactive={false}
            fill
          />
          <div className="pointer-events-none absolute left-3 right-3 top-3 hidden flex-wrap items-center gap-x-3 gap-y-1 rounded-full px-3 py-1.5 text-[10.5px] font-medium text-zinc-700 glass sm:flex sm:right-auto" aria-hidden>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#3F7A55]" />Below market</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#3F3F46]" />At Market</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#A05A5D]" />Above market</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-zinc-400 ring-2 ring-lime" />Several agencies</span>
            {auctions.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="grid size-3.5 place-items-center rounded-[4px] bg-zinc-950 text-lime"><Gavel size={9} strokeWidth={2.4} /></span>
                Notary auction
              </span>
            )}
          </div>
          <span className="pointer-events-none absolute bottom-4 right-4 hidden items-center gap-2 rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-zinc-900 glass lg:inline-flex" aria-hidden>
            <span className="grid size-3.5 place-items-center rounded-[3px] bg-zinc-950 text-[9px] text-white">✓</span>
            Search as I move the map
          </span>
          <AnimatePresence mode="wait">
            {event && (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="pointer-events-none absolute bottom-4 left-4 right-4 max-w-[300px] rounded-xl p-3.5 glass"
              >
                <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500">
                  {event.auctionId ? <Gavel size={11} className="text-zinc-950" /> : <span className="size-1.5 rounded-full" style={{ background: DOT[event.tone] }} />}
                  {event.kind}
                </p>
                <p className="mt-1.5 truncate text-[14px] font-semibold text-zinc-950">{event.title}</p>
                <p className="mt-0.5 truncate text-[12px] text-zinc-500">{event.detail}</p>
                <p className="mt-2.5 border-t border-zinc-100 pt-2.5 text-[13px] font-medium tabular-nums text-zinc-950">{event.value}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── hero ────────────────────────────────────────────────────────────── */

export function Hero({
  pins,
  auctions,
  events,
  kpis,
  statuses,
  signal,
  runTime,
  total,
}: {
  pins: MapPin[];
  auctions: HeroAuction[];
  events: HeroEvent[];
  kpis: HeroKpi[];
  statuses: HeroStatuses;
  signal: string;
  brief?: string;
  runTime: string;
  total: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const running = !reduce && visible && events.length > 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setStep((n) => n + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [running, step]);

  const fade = (delay: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: EASE, delay } });

  return (
    <section ref={ref} className="relative w-full bg-white" aria-label="Baseline: Aruba real estate market intelligence">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center px-5 pb-16 pt-32 text-center sm:pb-20 sm:pt-40">
        <motion.h1 {...fade(0.08)} className="font-display text-[clamp(40px,6vw,72px)] leading-[1.02] tracking-[-0.035em] text-[#15171C]">
          Aruba Real Estate <br className="hidden sm:block" />
          Market Intelligence Tool
        </motion.h1>

        <motion.p {...fade(0.16)} className="mt-6 max-w-[34rem] text-[16.5px] leading-relaxed text-zinc-500 sm:text-[17.5px]">
          Baseline tracks listings from Aruba&rsquo;s real estate agencies and follows their prices. AI then analyzes the data, comparing each listing with similar properties, so agents, brokers and investors can read the market at a glance.
        </motion.p>

        <motion.div {...fade(0.24)} className="mt-8 flex items-center gap-2.5">
          <Link href="/login" className="inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-4 text-[14px] font-medium text-zinc-950 shadow-sm transition-colors hover:bg-zinc-50">
            Log in
          </Link>
          <Link href="/signup" className="relative inline-flex h-10 items-center rounded-full bg-zinc-950 px-4 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
            <RunLine speed={3.5} glow={4} />
            Get access
          </Link>
        </motion.div>
        <motion.p {...fade(0.3)} className="mt-4 text-[12.5px] text-zinc-400">
          Members only · Monthly or yearly · Cancel anytime
        </motion.p>
      </div>

      {/* the product, in a window over Aruba */}
      <div className="mx-auto max-w-[1240px]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.35 }}
          className="relative overflow-hidden rounded-t-2xl sm:mx-0"
        >
          {/* brand backdrop: grainy lime-to-black gradient with drifting particles */}
          <GrainField variant="rise" />
          <RunLine speed={10} width={1.5} glow={8} />
          <div className="relative px-3 pt-10 sm:px-12 sm:pt-16 lg:px-20 lg:pt-20">
            <div className="h-[440px] sm:h-[560px] lg:h-[620px]">
              <TerminalWindow pins={pins} auctions={auctions} events={events} step={step} onStep={setStep} running={running} kpis={kpis} statuses={statuses} signal={signal} runTime={runTime} total={total} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
