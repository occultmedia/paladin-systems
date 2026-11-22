"use client";

/*
 * Landing hero. Calm and product-first: an announcement pill, a tight
 * two-line headline, two small actions, then the real Terminal in a light
 * browser window over an Aruba photograph. The window is live: the 3D map
 * tours today's market events, the feed follows it, the numbers count up.
 * Motion stops for prefers-reduced-motion and while the hero is off screen.
 */

import { RunLine } from "@/components/run-line";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, LayoutList, Megaphone, Pin, Search, Settings, Sparkles } from "lucide-react";
import { CountUp } from "@/components/motion/reveal";
import { GrainField } from "./grain-field";
import type { Listing } from "@/lib/aruba-data";

const ArubaMap = dynamic(() => import("@/components/dashboard/aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

export type HeroEvent = { id: string; listingId: string; kind: string; tone: "up" | "down" | "warn" | "mint"; title: string; detail: string; value: string };
export type HeroKpi = { label: string; value: number; prefix?: string; suffix?: string; decimals?: number };

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 6500;
const DOT: Record<HeroEvent["tone"], string> = { up: "#4CA30D", down: "#E5484D", warn: "#E59A1E", mint: "#18181B" };
const TABS = [
  { label: "Listings", icon: LayoutList },
  { label: "Watchlist", icon: Pin },
  { label: "Deals", icon: Megaphone },
  { label: "Settings", icon: Settings },
];

/* ── the Terminal inside the window ──────────────────────────────────── */

function TerminalWindow({
  listings,
  events,
  step,
  onStep,
  running,
  kpis,
  brief,
  runTime,
  total,
}: {
  listings: Listing[];
  events: HeroEvent[];
  step: number;
  onStep: (n: number) => void;
  running: boolean;
  kpis: HeroKpi[];
  brief: string;
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
        <span className="mx-auto truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-zinc-500 ring-1 ring-zinc-200">terminal.sequencedata.aw / listings</span>
        <span className="w-[42px]" aria-hidden />
      </div>

      {/* Terminal app bar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-200 px-3 sm:px-4">
        <span className="flex items-end whitespace-nowrap font-display text-[12.5px] uppercase tracking-[0.22em] text-zinc-950">
          Terminal
          <span className="mb-[2px] ml-[2px] inline-block h-[2px] w-[7px] bg-zinc-950" />
        </span>
        <nav className="ml-3 hidden items-center gap-0.5 md:flex" aria-hidden>
          {TABS.map(({ label, icon: Icon }, i) => (
            <span key={label} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium ${i === 0 ? "bg-zinc-100 text-zinc-950" : "text-zinc-500"}`}>
              <Icon size={13} strokeWidth={1.8} />
              {label}
            </span>
          ))}
        </nav>
        <span className="ml-auto hidden items-center gap-2 rounded-md px-2.5 py-1 text-[12px] text-zinc-400 ring-1 ring-zinc-200 lg:inline-flex">
          <Search size={12} /> Search {total} listings
          <kbd className="ml-3 rounded border border-zinc-200 px-1 text-[10px]">⌘K</kbd>
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500 lg:ml-0">
          <span className="size-1.5 rounded-full bg-[#4CA30D]" />
          Updated {runTime}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[290px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* left: brief, numbers, today's moves */}
        <aside className="hidden min-h-0 flex-col border-r border-zinc-200 md:flex">
          <div className="border-b border-zinc-200 p-4">
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500">
              <Sparkles size={12} className="text-zinc-950" /> Today&apos;s brief
            </p>
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-zinc-950">{brief}</p>
          </div>
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
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: DOT[e.tone] }} />
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
          <ArubaMap mode="listings" listings={listings} selectedId={event?.listingId ?? null} interactive={false} fill />
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
                  <span className="size-1.5 rounded-full" style={{ background: DOT[event.tone] }} />
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
  listings,
  events,
  kpis,
  brief,
  runTime,
  total,
}: {
  listings: Listing[];
  events: HeroEvent[];
  kpis: HeroKpi[];
  brief: string;
  runLabel?: string;
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
    <section ref={ref} className="relative w-full bg-white" aria-label="Terminal: Aruba real estate market intelligence">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center px-5 pb-16 pt-32 text-center sm:pb-20 sm:pt-40">
        <motion.a {...fade(0)} href="#ai-signal" className="glass group inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] text-zinc-600 transition-colors hover:border-zinc-300">
          <span className="rounded-full bg-lime px-2 py-0.5 text-[11.5px] font-medium text-zinc-950">New</span>
          <span className="sm:hidden">AI Signal prices every listing</span>
          <span className="hidden sm:inline">AI Signal now prices every listing against its comps</span>
          <ChevronRight size={14} className="text-zinc-400 transition-transform group-hover:translate-x-0.5" />
        </motion.a>

        <motion.h1 {...fade(0.08)} className="mt-6 font-display text-[clamp(40px,6vw,72px)] leading-[1.02] tracking-[-0.035em] text-[#15171C]">
          The market terminal <br className="hidden sm:block" />
          for Aruba real estate.
        </motion.h1>

        <motion.p {...fade(0.16)} className="mt-6 max-w-[34rem] text-[16.5px] leading-relaxed text-zinc-500 sm:text-[17.5px]">
          Every morning Terminal scrapes every real estate website in Aruba, tracks what changed and lets AI analyze it: new listings, price cuts and what each property is worth against its comps. Built for agents, brokers and investors.
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
              <TerminalWindow listings={listings} events={events} step={step} onStep={setStep} running={running} kpis={kpis} brief={brief} runTime={runTime} total={total} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
