"use client";

/*
 * Landing hero: full viewport, dark. The visual is the product itself, not an
 * illustration: every listing Terminal tracks is pinned at its coordinates on
 * a dot-matrix Aruba, a scan line sweeps the island (the morning AI read) and
 * lights each pin as it passes, and callouts cycle through today's real
 * market events. Everything comes from the same data as the dashboard.
 *
 * Motion: headline line reveal, scan sweep + pin hits (CSS), cycling event
 * callouts, pointer-follow light and a slight map parallax. All of it stops
 * for prefers-reduced-motion.
 */

import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/motion/reveal";

export type HeroPin = { id: string; lat: number; lng: number; tone: "up" | "flat" | "down" };
export type HeroEvent = { id: string; lat: number; lng: number; kind: string; tone: "up" | "down" | "warn" | "mint"; title: string; detail: string; value: string };
export type HeroKpi = { label: string; value: number; prefix?: string; suffix?: string; decimals?: number; note?: string };

const EASE = [0.22, 1, 0.36, 1] as const;
const SCAN_S = 7; // one sweep of the island, seconds
const CYCLE_MS = 3600;

/* ── geometry: Aruba, projected ──────────────────────────────────────── */

// Simplified coastline (lat, lng), clockwise from California Point.
const COAST: Array<[number, number]> = [
  [12.6235, -70.0535], [12.6175, -70.04], [12.603, -70.026], [12.585, -70.016], [12.565, -70.002], [12.545, -69.988],
  [12.53, -69.972], [12.515, -69.955], [12.5, -69.937], [12.485, -69.918], [12.47, -69.898], [12.45, -69.878],
  [12.435, -69.866], [12.42, -69.873], [12.415, -69.885], [12.425, -69.905], [12.438, -69.93], [12.448, -69.947],
  [12.462, -69.964], [12.472, -69.978], [12.488, -69.998], [12.5, -70.015], [12.507, -70.0335], [12.514, -70.045],
  [12.535, -70.056], [12.555, -70.064], [12.575, -70.054], [12.595, -70.059], [12.61, -70.062],
];
const LAT_MAX = 12.632;
const LAT_MIN = 12.405;
const LNG_MIN = -70.075;
const LNG_MAX = -69.855;
const K = Math.cos((12.52 * Math.PI) / 180);
const SPAN = Math.max(LAT_MAX - LAT_MIN, (LNG_MAX - LNG_MIN) * K);
const project = (lat: number, lng: number) => ({
  x: (((lng - LNG_MIN) * K) / SPAN) * 1000,
  y: ((LAT_MAX - lat) / SPAN) * 1000,
});
// Closed Catmull-Rom curve through the coast points, so the outline reads organic.
const COAST_PATH = (() => {
  const pts = COAST.map(([la, ln]) => project(la, ln));
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d}Z`;
})();
const GRID_LATS = [12.6, 12.55, 12.5, 12.45];
const GRID_LNGS = [-70.05, -70.0, -69.95, -69.9];

const TONE: Record<HeroPin["tone"], string> = { up: "#6FCF97", flat: "#A1A1AA", down: "#F28B82" };
const EVENT_TONE: Record<HeroEvent["tone"], string> = { up: "#6FCF97", down: "#F28B82", warn: "#F2B45A", mint: "#DDE5DC" };

/* ── the map ─────────────────────────────────────────────────────────── */

function IslandMap({ pins, events, active, still, runTime }: { pins: HeroPin[]; events: HeroEvent[]; active: number; still: boolean; runTime: string }) {
  const ev = events[active];
  const at = ev ? project(ev.lat, ev.lng) : null;
  return (
    <div className="relative aspect-square w-full">
      <svg viewBox="0 0 1000 1000" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <pattern id="hero-dots" width="11" height="11" patternUnits="userSpaceOnUse">
            <circle cx="5.5" cy="5.5" r="1.7" fill="#DDE5DC" opacity="0.26" />
          </pattern>
          <linearGradient id="hero-scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#DDE5DC" stopOpacity="0" />
            <stop offset="0.85" stopColor="#DDE5DC" stopOpacity="0.16" />
            <stop offset="1" stopColor="#DDE5DC" stopOpacity="0.55" />
          </linearGradient>
          <clipPath id="hero-island">
            <path d={COAST_PATH} />
          </clipPath>
        </defs>

        {/* graticule with real coordinates */}
        {GRID_LATS.map((la) => {
          const y = project(la, LNG_MIN).y;
          return (
            <g key={la}>
              <line x1="0" x2="1000" y1={y} y2={y} stroke="#fff" strokeOpacity="0.05" strokeDasharray="2 6" />
              <text x="4" y={y - 6} className="fill-zinc-600 font-mono text-[15px]">
                {la.toFixed(2)}°N
              </text>
            </g>
          );
        })}
        {GRID_LNGS.map((ln) => {
          const x = project(LAT_MIN, ln).x;
          return (
            <g key={ln}>
              <line y1="0" y2="1000" x1={x} x2={x} stroke="#fff" strokeOpacity="0.05" strokeDasharray="2 6" />
              <text x={x + 6} y="994" className="fill-zinc-600 font-mono text-[15px]">
                {Math.abs(ln).toFixed(2)}°W
              </text>
            </g>
          );
        })}

        {/* island: dot matrix + hairline coast */}
        <path d={COAST_PATH} fill="url(#hero-dots)" />
        <path d={COAST_PATH} fill="none" stroke="#DDE5DC" strokeOpacity="0.28" strokeWidth="1.2" />

        {/* scan sweep, clipped to the island */}
        {!still && (
          <g clipPath="url(#hero-island)">
            <rect x="0" width="1000" height="160" fill="url(#hero-scan)" className="hero-scan" style={{ animationDuration: `${SCAN_S}s` }} />
          </g>
        )}

        {/* listings */}
        {pins.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          // The scan's bright edge travels 0 → 1160 units per sweep; light the pin as it passes.
          const delay = `${(y / 1160) * SCAN_S - SCAN_S}s`;
          return (
            <g key={p.id} transform={`translate(${x} ${y})`}>
              {!still && <circle r="10" fill="none" stroke={TONE[p.tone]} strokeWidth="1.5" className="hero-hit" style={{ animationDelay: delay, animationDuration: `${SCAN_S}s` }} />}
              <circle r="5" fill={TONE[p.tone]} stroke="#08090A" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* active event: target ring */}
        {at && (
          <g transform={`translate(${at.x} ${at.y})`}>
            <motion.circle
              key={ev.id}
              r="18"
              fill="none"
              stroke={EVENT_TONE[ev.tone]}
              strokeWidth="1.5"
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            />
            <circle r="6" fill={EVENT_TONE[ev.tone]} />
          </g>
        )}
      </svg>

      {/* event callout, anchored to its pin */}
      <AnimatePresence mode="wait">
        {ev && at && (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="pointer-events-none absolute hidden lg:block"
            style={{
              top: `${(at.y / 1000) * 100}%`,
              ...(at.x > 520 ? { right: `${100 - (at.x / 1000) * 100}%`, marginRight: 34 } : { left: `${(at.x / 1000) * 100}%`, marginLeft: 34 }),
            }}
          >
            <div className="w-[272px] -translate-y-1/2 rounded-xl border border-white/10 bg-zinc-950/85 p-3.5 shadow-2xl shadow-black/60 backdrop-blur-md">
              <p className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em]" style={{ color: EVENT_TONE[ev.tone] }}>
                <span>{ev.kind}</span>
                <span className="text-zinc-500">{runTime}</span>
              </p>
              <p className="mt-2 text-[14px] font-semibold leading-snug text-white">{ev.title}</p>
              <p className="mt-0.5 text-[12px] text-zinc-400">{ev.detail}</p>
              <p className="mt-2.5 border-t border-white/10 pt-2.5 font-mono text-[13px] tabular-nums text-white">{ev.value}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── hero ────────────────────────────────────────────────────────────── */

const LINES = ["Know the market", "before it moves."];

export function Hero({
  pins,
  events,
  kpis,
  runLabel,
  runTime,
  total,
}: {
  pins: HeroPin[];
  events: HeroEvent[];
  kpis: HeroKpi[];
  runLabel: string;
  runTime: string;
  total: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLElement>(null);

  // Cycle the callouts while the hero is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduce || !visible || events.length < 2) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % events.length), CYCLE_MS);
    return () => window.clearInterval(t);
  }, [reduce, visible, events.length]);

  // Pointer light + a few pixels of parallax on the map.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const px = useTransform(sx, [0, 1], [10, -10]);
  const py = useTransform(sy, [0, 1], [8, -8]);
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    mx.set(x);
    my.set(y);
    e.currentTarget.style.setProperty("--hx", `${x * 100}%`);
    e.currentTarget.style.setProperty("--hy", `${y * 100}%`);
  };

  return (
    <section
      ref={ref}
      onPointerMove={onMove}
      className="hero-root relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#08090A] text-white"
      aria-label="Terminal: Aruba real estate market intelligence"
    >
      {/* light: fixed glow + pointer spotlight + fine grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-[10%] top-[-20%] size-[70vmax] rounded-full bg-[radial-gradient(circle,rgb(221_229_220/0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_var(--hx,70%)_var(--hy,40%),rgb(221_229_220/0.07),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.03)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_60%_40%,black,transparent_75%)]" />
      </div>

      {/* map: background on phones/tablets, right side on desktop */}
      <motion.div
        aria-hidden
        style={reduce ? undefined : { x: px, y: py }}
        className="pointer-events-none absolute -right-[35%] top-20 -z-[5] w-[min(120vw,700px)] opacity-30 sm:right-[-10%] sm:opacity-45 lg:pointer-events-auto lg:right-[3vw] lg:top-1/2 lg:w-[min(47vw,calc(100svh-150px))] lg:-translate-y-[55%] lg:opacity-100"
      >
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}>
          <IslandMap pins={pins} events={events} active={active} still={reduce} runTime={runTime} />
        </motion.div>
      </motion.div>

      {/* copy */}
      <div className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-5 pb-8 pt-24 sm:px-8 sm:pb-10 lg:px-12">
        <div className="max-w-[600px]">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-2.5 pr-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-300 backdrop-blur"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#6FCF97] opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-[#6FCF97]" />
            </span>
            <span className="sm:hidden">Live · {runTime}</span>
            <span className="hidden sm:inline">Live · {runLabel}</span>
          </motion.p>

          <h1 className="mt-5 font-display sm:mt-7 text-[clamp(42px,5.1vw,84px)] font-bold leading-[0.96] tracking-[-0.035em]">
            {LINES.map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]">
                <motion.span
                  className={`block ${i === 1 ? "text-mint" : ""}`}
                  initial={{ y: "105%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.12 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
            className="mt-5 max-w-[50ch] text-[15.5px] leading-relaxed text-zinc-400 sm:mt-7 sm:text-[18px]"
          >
            Every home, parcel and commercial listing in Aruba, read every morning by AI. New listings, price cuts and contracts, each one checked against its comps and scored for how likely it is to still be for sale.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
            className="mt-7 flex flex-wrap items-center gap-2.5 sm:mt-9 sm:gap-3"
          >
            <Link
              href="/signup"
              className="group relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-full bg-mint pl-5 pr-3.5 sm:h-12 sm:pl-6 sm:pr-5 font-display text-[15px] font-semibold text-zinc-950 transition-transform active:scale-[0.98]"
            >
              <span className="absolute inset-0 -translate-x-full bg-white transition-transform duration-500 ease-out group-hover:translate-x-0" aria-hidden />
              <span className="relative">Get access</span>
              <span className="relative grid size-6 place-items-center rounded-full bg-zinc-950 text-mint transition-transform duration-300 group-hover:translate-x-0.5">
                <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" strokeLinecap="square" />
                </svg>
              </span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 font-display sm:h-12 sm:px-6 text-[15px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.04]"
            >
              <span className="sm:hidden">Live terminal</span>
              <span className="hidden sm:inline">Open the live terminal</span>
            </Link>
          </motion.div>

          <motion.form
            action="/dashboard"
            method="get"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.6 }}
            className="group mt-5 flex max-w-[460px] sm:mt-6 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur transition-colors focus-within:border-white/30 hover:border-white/20"
          >
            <span className="font-mono text-[13px] text-mint" aria-hidden>
              &gt;
            </span>
            <label className="sr-only" htmlFor="hero-q">
              Search listings
            </label>
            <input
              id="hero-q"
              name="q"
              placeholder={`Search ${total} listings or an ID`}
              className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-white outline-none placeholder:text-zinc-500"
            />
            <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-500 sm:block">Enter</kbd>
          </motion.form>
        </div>
      </div>

      {/* live figures rail */}
      <motion.dl
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.7 }}
        className="no-scrollbar relative flex w-full snap-x snap-mandatory gap-px overflow-x-auto border-t border-white/10 bg-white/10 sm:grid sm:grid-cols-5 sm:overflow-visible"
      >
        {kpis.map((k, i) => (
          <div key={k.label} className="min-w-[42%] shrink-0 snap-start bg-[#08090A] px-5 py-4 sm:min-w-0 sm:px-6 sm:py-5 lg:px-10">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">{k.label}</dt>
            <dd className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-[26px] font-bold leading-none text-white sm:text-[30px]">
                <CountUp value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} onMount delay={0.8 + i * 0.08} />
              </span>
              {k.note && <span className="font-mono text-[11px] text-zinc-500">{k.note}</span>}
            </dd>
          </div>
        ))}
      </motion.dl>
    </section>
  );
}
