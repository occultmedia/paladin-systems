"use client";

/*
 * Landing hero: full viewport, white and clinical; black and lime are the only
 * accents. The visual is the Terminal's own full-screen map, live and in 3D:
 * it tours today's real market events (new listings, price cuts, contracts,
 * an AI pick, a low-confidence listing), flying in and tilting so the
 * buildings stand up, with each event's card on top. Hover a feature in the
 * rail below and the map shows only the listings that feature found.
 *
 * Motion: headline line reveal, lime highlighter, 3D fly-throughs, cycling
 * event cards with a progress line, feature-to-map filtering. The tour stops
 * for prefers-reduced-motion and while the hero is off screen.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/aruba-data";

const ArubaMap = dynamic(() => import("@/components/dashboard/aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

export type HeroEvent = { id: string; listingId: string; kind: string; tone: "up" | "down" | "warn" | "mint"; title: string; detail: string; value: string };
export type HeroFeature = { id: string; name: string; text: string; stat: string; tone: "up" | "down" | "warn" | "mint"; ids: string[] };

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 6500; // time on each event (the fly-in takes ~1.8 s)
const LIME = "#ACFA68";
/** Accent of a feature / event as a dot on white. */
const ACCENT: Record<HeroEvent["tone"], string> = { up: LIME, down: "#E5484D", warn: "#F5A524", mint: "#0A0A0A" };
/** The same accents as text on a black chip. */
const ON_INK: Record<HeroEvent["tone"], string> = { up: LIME, down: "#FF9A9A", warn: "#FBC15E", mint: "#FFFFFF" };

/* ── the live map window ─────────────────────────────────────────────── */

function LiveMap({
  listings,
  event,
  step,
  focus,
  running,
  runTime,
}: {
  listings: Listing[];
  event: HeroEvent | undefined;
  step: number;
  focus: HeroFeature | null;
  running: boolean;
  runTime: string;
}) {
  // Hovering a feature narrows the map to what it found; otherwise every listing.
  const shown = useMemo(() => (focus && focus.ids.length ? listings.filter((l) => focus.ids.includes(l.listing_id)) : listings), [focus, listings]);
  const selected = focus ? null : (event?.listingId ?? null);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_40px_90px_-40px_rgb(10_10_10/0.45)]">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 bg-zinc-950 px-4 text-white">
        <p className="flex min-w-0 items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-300">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-lime" />
          </span>
          <span className="truncate">
            Live map · <span className="text-white">{shown.length}</span> listing{shown.length === 1 ? "" : "s"}
            {focus && <span className="text-lime"> · {focus.name}</span>}
          </span>
          <span className="rounded bg-lime px-1.5 py-px font-semibold text-zinc-950">3D</span>
        </p>
        <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 sm:inline">Read {runTime}</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <ArubaMap mode="listings" listings={shown} selectedId={selected} interactive={false} fill />

        {/* the event the map is showing */}
        <AnimatePresence mode="wait">
          {event && !focus && (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              transition={{ duration: 0.45, ease: EASE }}
              className="pointer-events-none absolute bottom-3 left-3 right-3 max-w-[330px] overflow-hidden rounded-xl border border-zinc-200 bg-white/95 shadow-xl backdrop-blur sm:bottom-4 sm:left-4"
            >
              <div className="p-2.5 sm:p-3.5">
                <p className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-zinc-950 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: ON_INK[event.tone] }}>
                    {event.kind}
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-400">{runTime}</span>
                </p>
                <p className="mt-1.5 truncate text-[13px] font-semibold leading-snug text-zinc-950 sm:mt-2.5 sm:text-[14px]">{event.title}</p>
                <p className="mt-0.5 hidden text-[12px] text-zinc-500 sm:block">{event.detail}</p>
                <p className="mt-2.5 hidden border-t border-zinc-100 pt-2.5 font-mono text-[13px] tabular-nums text-zinc-950 sm:block">{event.value}</p>
              </div>
              {running && (
                <motion.div
                  key={`progress-${step}`}
                  aria-hidden
                  className="h-[3px] origin-left bg-lime"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── hero ────────────────────────────────────────────────────────────── */

export function Hero({
  listings,
  events,
  features,
  runLabel,
  runTime,
  total,
}: {
  listings: Listing[];
  events: HeroEvent[];
  features: HeroFeature[];
  runLabel: string;
  runTime: string;
  total: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const [step, setStep] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const focus = features.find((f) => f.id === focusId) ?? null;
  const running = !reduce && visible && !focusId && events.length > 1;

  // Tour today's events while the hero is on screen and no feature is being explored.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setStep((n) => n + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [running, step]);

  const event = events.length ? events[step % events.length] : undefined;

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-white text-zinc-950" aria-label="Terminal: Aruba real estate market intelligence">
      {/* light: faint lime wash and a fine grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_620px_at_74%_46%,rgb(172_250_104/0.18),transparent_65%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(rgb(10_10_10/0.045)_1px,transparent_1px),linear-gradient(90deg,rgb(10_10_10/0.045)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_55%_45%,black,transparent_75%)]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-[minmax(0,1fr)] content-center gap-6 px-5 pb-6 pt-20 sm:gap-8 sm:px-8 sm:pb-8 sm:pt-24 sm:pb-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-12 lg:px-12">
        {/* copy */}
        <div className="max-w-[620px]">
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

          <h1 className="mt-5 font-display text-[clamp(40px,4.8vw,76px)] font-bold leading-[0.98] tracking-[-0.035em] sm:mt-7">
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span className="block whitespace-nowrap" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}>
                Know the market
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.08em]">
              <motion.span className="block whitespace-nowrap" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.22 }}>
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
            className="mt-5 max-w-[50ch] text-[15.5px] leading-relaxed text-zinc-600 sm:mt-7 sm:text-[18px]"
          >
            Every home, parcel and commercial listing in Aruba, read overnight by AI and placed on a live 3D map. New listings, price cuts and contracts, each one priced against its comps.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
            className="mt-7 flex flex-wrap items-center gap-2.5 sm:mt-9 sm:gap-3"
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

          <motion.form
            action="/dashboard"
            method="get"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.6 }}
            className="mt-5 hidden max-w-[460px] items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm sm:flex transition-[border-color,box-shadow] focus-within:border-zinc-950 focus-within:shadow-[0_0_0_3px_rgb(172_250_104/0.5)] hover:border-zinc-300 sm:mt-6"
          >
            <span className="font-mono text-[13px] font-semibold text-zinc-950" aria-hidden>
              &gt;
            </span>
            <label className="sr-only" htmlFor="hero-q">
              Search listings
            </label>
            <input
              id="hero-q"
              name="q"
              placeholder={`Search ${total} listings or an ID`}
              className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-zinc-950 outline-none placeholder:text-zinc-400"
            />
            <kbd className="hidden rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-400 sm:block">Enter</kbd>
          </motion.form>
        </div>

        {/* the live 3D map */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: EASE, delay: 0.3 }}
          className="h-[clamp(200px,calc(100svh-610px),300px)] min-w-0 sm:h-[420px] lg:h-[min(640px,calc(100svh-268px))]"
        >
          <LiveMap listings={listings} event={event} step={step} focus={focus} running={running} runTime={runTime} />
        </motion.div>
      </div>

      {/* features rail: each one is live, hover to see what it found on the map */}
      <motion.ul
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
        aria-label="Features"
        className="no-scrollbar relative flex w-full snap-x snap-mandatory gap-px overflow-x-auto border-t border-zinc-200 bg-zinc-200 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6"
        onMouseLeave={() => setFocusId(null)}
      >
        {features.map((f, i) => {
          const on = focusId === f.id;
          return (
            <li key={f.id} className="min-w-[68%] shrink-0 snap-start sm:min-w-0">
              <button
                type="button"
                onMouseEnter={() => setFocusId(f.ids.length ? f.id : null)}
                onFocus={() => setFocusId(f.ids.length ? f.id : null)}
                onBlur={() => setFocusId(null)}
                onClick={() => setFocusId(on ? null : f.ids.length ? f.id : null)}
                aria-pressed={on}
                className={`group relative block h-full w-full overflow-hidden px-5 py-4 text-left transition-colors sm:px-6 sm:py-5 ${on ? "bg-zinc-950" : "bg-white hover:bg-zinc-50"}`}
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] origin-left bg-lime transition-transform duration-500 ease-out" style={{ transform: on ? "scaleX(1)" : "scaleX(0)" }} />
                <span className={`flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] ${on ? "text-zinc-500" : "text-zinc-400"}`}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span className={`inline-flex items-center gap-1.5 ${on ? "text-white" : "text-zinc-700"}`}>
                    <span className="size-1.5 rounded-full ring-1 ring-zinc-950/30" style={{ background: on ? ON_INK[f.tone] : ACCENT[f.tone] }} />
                    {f.stat}
                  </span>
                </span>
                <span className={`mt-2.5 block font-display text-[16px] font-semibold ${on ? "text-white" : "text-zinc-950"}`}>{f.name}</span>
                <span className={`mt-1 block text-[12.5px] leading-snug transition-colors ${on ? "text-zinc-400" : "text-zinc-500 group-hover:text-zinc-700"}`}>{f.text}</span>
              </button>
            </li>
          );
        })}
      </motion.ul>
    </section>
  );
}
