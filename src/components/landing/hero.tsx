"use client";

/*
 * Landing hero, product-first: a centred headline and actions, and below it
 * the real Terminal dashboard in a big frame over an Aruba backdrop. The
 * dashboard is live and moving: the 3D map tours today's real market events
 * (flying in and tilting so the buildings stand up), the events feed follows
 * the map with a progress line, the KPIs count up and the AI brief sits on
 * top. White and clinical; black and lime are the only accents.
 *
 * The frame runs off the bottom of the viewport on purpose (the hero is
 * exactly one screen). Motion stops for prefers-reduced-motion and while the
 * hero is off screen.
 */

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LayoutList, Megaphone, Pin, Search, Settings, Sparkles } from "lucide-react";
import { CountUp } from "@/components/motion/reveal";
import type { Listing } from "@/lib/aruba-data";

const ArubaMap = dynamic(() => import("@/components/dashboard/aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

export type HeroEvent = { id: string; listingId: string; kind: string; tone: "up" | "down" | "warn" | "mint"; title: string; detail: string; value: string };
export type HeroKpi = { label: string; value: number; prefix?: string; suffix?: string; decimals?: number };

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 6500; // time on each event (the fly-in takes ~1.8 s)
const LIME = "#ACFA68";
/** Event accents as a dot on white. */
const DOT: Record<HeroEvent["tone"], string> = { up: LIME, down: "#E5484D", warn: "#F5A524", mint: "#0A0A0A" };
/** The same accents as text on a black chip. */
const ON_INK: Record<HeroEvent["tone"], string> = { up: LIME, down: "#FF9A9A", warn: "#FBC15E", mint: "#FFFFFF" };
const TABS = [
  { label: "Listings", icon: LayoutList },
  { label: "Watchlist", icon: Pin },
  { label: "Deals", icon: Megaphone },
  { label: "Settings", icon: Settings },
];

/* ── the dashboard inside the frame ──────────────────────────────────── */

function LiveDashboard({
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
    <div className="flex h-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/40 bg-white shadow-[0_40px_120px_-30px_rgb(10_10_10/0.55)] sm:rounded-t-[22px]">
      {/* Terminal top bar */}
      <div className="flex h-12 shrink-0 items-center gap-3 bg-zinc-950 px-3 sm:px-4">
        <span className="flex items-end whitespace-nowrap font-display text-[13px] font-bold uppercase tracking-[0.22em] text-white">
          Terminal
          <span className="mb-[2px] ml-[2px] inline-block h-[2px] w-[8px] bg-lime motion-safe:animate-[st-cursor_1.2s_steps(1)_infinite]" />
        </span>
        <nav className="ml-2 hidden gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 md:flex" aria-hidden>
          {TABS.map(({ label, icon: Icon }, i) => (
            <span key={label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium ${i === 0 ? "bg-lime text-zinc-950" : "text-zinc-400"}`}>
              <Icon size={12} strokeWidth={1.9} />
              {label}
            </span>
          ))}
        </nav>
        <span className="ml-auto hidden items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] text-zinc-400 ring-1 ring-white/10 lg:inline-flex">
          <Search size={12} /> Search {total} listings
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 lg:ml-0">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex size-1.5 rounded-full bg-lime" />
          </span>
          <span className="hidden sm:inline">Updated</span> {runTime}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* left: brief, KPIs, today's events */}
        <aside className="hidden min-h-0 flex-col gap-3 border-r border-zinc-200 bg-zinc-50/60 p-3 md:flex lg:p-4">
          <div className="rounded-xl bg-zinc-950 p-3.5 text-white">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-lime">
              <Sparkles size={11} /> AI Signal · today&apos;s brief
            </p>
            <p className="mt-2 text-[12.5px] font-medium leading-snug">{brief}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {kpis.map((k, i) => (
              <div key={k.label} className="rounded-xl border border-zinc-200 bg-white p-2.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-400">{k.label}</p>
                <p className="mt-1 font-display text-[20px] font-bold leading-none text-zinc-950">
                  <CountUp value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} onMount delay={0.9 + i * 0.1} />
                </p>
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <p className="border-b border-zinc-100 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Today&apos;s market moves</p>
            <ul>
              {events.map((e, i) => {
                const on = i === active;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onStep(i)}
                      className={`relative flex w-full items-center gap-2.5 overflow-hidden px-3 py-2 text-left transition-colors ${on ? "bg-zinc-950 text-white" : "hover:bg-zinc-50"}`}
                    >
                      <span className="size-2 shrink-0 rounded-full ring-1 ring-zinc-950/30" style={{ background: on ? ON_INK[e.tone] : DOT[e.tone] }} />
                      <span className="min-w-0 flex-1">
                        <span className={`block font-mono text-[9.5px] uppercase tracking-[0.12em] ${on ? "text-zinc-400" : "text-zinc-400"}`}>{e.kind}</span>
                        <span className="block truncate text-[12px] font-semibold">{e.title}</span>
                      </span>
                      <span className={`shrink-0 font-mono text-[10.5px] tabular-nums ${on ? "text-lime" : "text-zinc-500"}`}>{e.value.split(" · ")[0]}</span>
                      {on && running && (
                        <motion.span
                          key={`p-${step}`}
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-lime"
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
          </div>
        </aside>

        {/* right: the live 3D map */}
        <div className="relative min-h-0 min-w-0">
          <ArubaMap mode="listings" listings={listings} selectedId={event?.listingId ?? null} interactive={false} fill />
          <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white">
            <span className="rounded bg-lime px-1 font-semibold text-zinc-950">3D</span> Live map · {listings.length} listings
          </span>
          <AnimatePresence mode="wait">
            {event && (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: EASE }}
                className="pointer-events-none absolute left-3 right-3 top-12 max-w-[320px] rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:left-4"
              >
                <p className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-zinc-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: ON_INK[event.tone] }}>
                    {event.kind}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">{runTime}</span>
                </p>
                <p className="mt-2 truncate text-[13.5px] font-semibold text-zinc-950">{event.title}</p>
                <p className="mt-0.5 hidden truncate text-[11.5px] text-zinc-500 sm:block">{event.detail}</p>
                <p className="mt-2 border-t border-zinc-100 pt-2 font-mono text-[12px] tabular-nums text-zinc-950">{event.value}</p>
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
  backdrop,
  runLabel,
  runTime,
  total,
}: {
  listings: Listing[];
  events: HeroEvent[];
  kpis: HeroKpi[];
  brief: string;
  backdrop: string;
  runLabel: string;
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
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setStep((n) => n + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [running, step]);

  return (
    <section ref={ref} className="relative isolate flex h-[100svh] min-h-[640px] w-full flex-col overflow-hidden bg-white text-zinc-950" aria-label="Terminal: Aruba real estate market intelligence">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(rgb(10_10_10/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(10_10_10/0.04)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_50%_20%,black,transparent_65%)]" />

      {/* headline and actions, centred */}
      <div className="mx-auto flex w-full max-w-[980px] shrink-0 flex-col items-center px-5 pt-20 text-center sm:pt-24">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="inline-flex items-center gap-2.5 rounded-full border border-zinc-200 bg-white/80 py-1.5 pl-2.5 pr-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 shadow-sm backdrop-blur"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-90 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-lime ring-1 ring-zinc-950/30" />
          </span>
          <span className="sm:hidden">Live · {runTime}</span>
          <span className="hidden sm:inline">Live · {runLabel}</span>
        </motion.p>

        <h1 className="mt-4 font-display text-[clamp(36px,4.6vw,66px)] font-bold leading-[0.98] tracking-[-0.035em] sm:mt-5">
          <span className="block overflow-hidden pb-[0.06em]">
            <motion.span className="block" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}>
              Know the Aruba market
            </motion.span>
          </span>
          <span className="block overflow-hidden pb-[0.08em]">
            <motion.span className="block" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.22 }}>
              before it{" "}
              <span className="relative inline-block">
                <motion.span
                  aria-hidden
                  className="absolute inset-x-[-0.06em] bottom-[0.08em] top-[0.52em] -z-10 origin-left rounded-[0.08em] bg-lime"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.9 }}
                />
                moves.
              </span>
            </motion.span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
          className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-zinc-600 sm:mt-4 sm:text-[16.5px]"
        >
          Every home, parcel and commercial listing in Aruba, read overnight by AI, priced against its comps and placed on a live 3D map. One terminal for agents and investors.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:mt-6 sm:gap-3"
        >
          <Link
            href="/signup"
            className="group relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-full bg-zinc-950 pl-5 pr-3.5 font-display text-[15px] font-semibold text-lime shadow-[0_10px_30px_-10px_rgb(10_10_10/0.5)] transition-transform active:scale-[0.98] sm:h-12 sm:pl-6 sm:pr-5"
          >
            <span className="absolute inset-0 -translate-x-full bg-zinc-800 transition-transform duration-500 ease-out group-hover:translate-x-0" aria-hidden />
            <span className="relative">Get access</span>
            <span className="relative grid size-6 place-items-center rounded-full bg-lime text-zinc-950 transition-transform duration-300 group-hover:translate-x-0.5">
              <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" strokeLinecap="square" />
              </svg>
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 font-display text-[15px] font-semibold text-zinc-950 transition-colors hover:border-zinc-950 sm:h-12 sm:px-6"
          >
            Log in
          </Link>
        </motion.div>
      </div>

      {/* the live dashboard, framed over Aruba, running off the bottom of the screen */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.35 }}
        className="relative mx-auto mt-7 w-full max-w-[1320px] min-h-0 flex-1 px-3 sm:mt-8 sm:px-6"
      >
        <div className="relative h-full overflow-hidden rounded-t-[26px] sm:rounded-t-[32px]">
          <Image src={`${backdrop}?auto=format&fit=crop&w=2400&h=1300&q=70`} alt="" fill priority unoptimized className="object-cover" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-zinc-950/10 via-transparent to-zinc-950/30" />
          <div className="relative h-full px-3 pt-4 sm:px-8 sm:pt-7 lg:px-12 lg:pt-9">
            <div className="h-[560px] sm:h-[620px] lg:h-[680px]">
              <LiveDashboard
                listings={listings}
                events={events}
                step={step}
                onStep={setStep}
                running={running}
                kpis={kpis}
                brief={brief}
                runTime={runTime}
                total={total}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
