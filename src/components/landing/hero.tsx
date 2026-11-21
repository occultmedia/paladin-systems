"use client";

/*
 * Landing hero: full viewport. The visual is the product itself: every
 * listing Terminal tracks, pinned on Aruba's real coastline (geoBoundaries),
 * a scan line sweeping the island (the overnight AI read) and callouts that
 * cycle through today's real market events. The features rail along the
 * bottom is live too: hover a feature and the listings it found light up.
 *
 * Motion: headline line reveal, scan sweep + pin hits (CSS), cycling event
 * callouts, feature-to-map highlighting, pointer-follow light and a slight map
 * parallax. All of it stops for prefers-reduced-motion.
 */

import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ARUBA_COAST } from "@/lib/aruba-coast";

export type HeroPin = { id: string; lat: number; lng: number; tone: "up" | "flat" | "down" };
export type HeroEvent = { id: string; lat: number; lng: number; kind: string; tone: "up" | "down" | "warn" | "mint"; title: string; detail: string; value: string };
export type HeroFeature = { id: string; name: string; text: string; stat: string; tone: "up" | "down" | "warn" | "mint"; ids: string[] };
export type HeroPlace = { name: string; lat: number; lng: number; align?: "left" | "right" };

const EASE = [0.22, 1, 0.36, 1] as const;
const SCAN_S = 7; // one sweep of the island, seconds
const CYCLE_MS = 3600;

/* ── geometry: Aruba, projected (north up) ───────────────────────────── */

const LAT_MAX = 12.648;
const LAT_MIN = 12.396;
const LNG_MIN = -70.078;
const LNG_MAX = -69.852;
const K = Math.cos((12.52 * Math.PI) / 180);
const SPAN = Math.max(LAT_MAX - LAT_MIN, (LNG_MAX - LNG_MIN) * K);
const project = (lat: number, lng: number) => ({
  x: (((lng - LNG_MIN) * K) / SPAN) * 1000,
  y: ((LAT_MAX - lat) / SPAN) * 1000,
});
const COAST_PTS = ARUBA_COAST.map(([la, ln]) => project(la, ln));
const COAST_PATH = `M${COAST_PTS.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}Z`;
const CENTROID = COAST_PTS.reduce((a, p) => ({ x: a.x + p.x / COAST_PTS.length, y: a.y + p.y / COAST_PTS.length }), { x: 0, y: 0 });
// Depth contours: the coast pushed outward from the island's centre.
const CONTOURS = [1.07, 1.16, 1.28, 1.43].map((k) =>
  `M${COAST_PTS.map((p) => `${(CENTROID.x + (p.x - CENTROID.x) * k).toFixed(1)} ${(CENTROID.y + (p.y - CENTROID.y) * k).toFixed(1)}`).join("L")}Z`,
);
const GRID_LATS = [12.6, 12.55, 12.5, 12.45];
const GRID_LNGS = [-70.05, -70.0, -69.95, -69.9];

const TONE: Record<HeroPin["tone"], string> = { up: "#ACFA68", flat: "#D4DACB", down: "#F28B82" };
const ACCENT: Record<HeroEvent["tone"], string> = { up: "#ACFA68", down: "#F28B82", warn: "#F2B45A", mint: "#E4FCC9" };

/* ── the map ─────────────────────────────────────────────────────────── */

function IslandMap({
  pins,
  places,
  event,
  focus,
  still,
  runTime,
}: {
  pins: HeroPin[];
  places: HeroPlace[];
  event: HeroEvent | undefined;
  focus: HeroFeature | null;
  still: boolean;
  runTime: string;
}) {
  const lit = useMemo(() => (focus && focus.ids.length ? new Set(focus.ids) : null), [focus]);
  const at = event ? project(event.lat, event.lng) : null;
  return (
    <div className="relative aspect-square w-full">
      <svg viewBox="0 0 1000 1000" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <pattern id="hero-dots" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="1.55" fill="#DDE5DC" opacity="0.42" />
          </pattern>
          <radialGradient id="hero-land" cx="45%" cy="40%" r="70%">
            <stop offset="0" stopColor="#5C8C28" stopOpacity="0.42" />
            <stop offset="1" stopColor="#1C2A0C" stopOpacity="0.18" />
          </radialGradient>
          <radialGradient id="hero-sea" cx="50%" cy="50%" r="55%">
            <stop offset="0" stopColor="#3E6420" stopOpacity="0.38" />
            <stop offset="1" stopColor="#3E6420" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hero-scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#DDE5DC" stopOpacity="0" />
            <stop offset="0.85" stopColor="#ACFA68" stopOpacity="0.22" />
            <stop offset="1" stopColor="#E4FCC9" stopOpacity="0.8" />
          </linearGradient>
          <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <clipPath id="hero-island">
            <path d={COAST_PATH} />
          </clipPath>
        </defs>

        {/* sea: soft light and depth contours */}
        <circle cx={CENTROID.x} cy={CENTROID.y} r="620" fill="url(#hero-sea)" />
        {CONTOURS.map((d, i) => (
          <path key={d} d={d} fill="none" stroke="#ACFA68" strokeOpacity={0.26 - i * 0.05} strokeWidth="1" strokeDasharray={i % 2 ? "3 7" : undefined} />
        ))}

        {/* graticule with real coordinates */}
        {GRID_LATS.map((la) => {
          const y = project(la, LNG_MIN).y;
          return (
            <g key={la}>
              <line x1="0" x2="1000" y1={y} y2={y} stroke="#fff" strokeOpacity="0.05" strokeDasharray="2 8" />
              <text x="6" y={y - 7} className="fill-zinc-500 font-mono text-[14px]">
                {la.toFixed(2)}°N
              </text>
            </g>
          );
        })}
        {GRID_LNGS.map((ln) => {
          const x = project(LAT_MIN, ln).x;
          return (
            <g key={ln}>
              <line y1="0" y2="1000" x1={x} x2={x} stroke="#fff" strokeOpacity="0.05" strokeDasharray="2 8" />
              <text x={x + 6} y="992" className="fill-zinc-500 font-mono text-[14px]">
                {Math.abs(ln).toFixed(2)}°W
              </text>
            </g>
          );
        })}

        {/* island: tint, dot matrix, glowing coast */}
        <path d={COAST_PATH} fill="url(#hero-land)" />
        <path d={COAST_PATH} fill="url(#hero-dots)" />
        <path d={COAST_PATH} fill="none" stroke="#ACFA68" strokeOpacity="0.5" strokeWidth="6" filter="url(#hero-glow)" />
        <path d={COAST_PATH} fill="none" stroke="#EEFBDD" strokeOpacity="0.85" strokeWidth="1.4" strokeLinejoin="round" />

        {/* scan sweep, clipped to the island */}
        {!still && (
          <g clipPath="url(#hero-island)">
            <rect x="0" width="1000" height="170" fill="url(#hero-scan)" className="hero-scan" style={{ animationDuration: `${SCAN_S}s` }} />
          </g>
        )}

        {/* place names */}
        {places.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const right = p.align === "right";
          return (
            <text
              key={p.name}
              x={right ? x + 16 : x - 16}
              y={y + 4}
              textAnchor={right ? "start" : "end"}
              className="fill-zinc-400 font-mono text-[13px] uppercase tracking-[0.18em]"
            >
              {p.name}
            </text>
          );
        })}

        {/* listings */}
        {pins.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const on = !lit || lit.has(p.id);
          // The scan's bright edge travels 0 → 1170 units per sweep; light the pin as it passes.
          const delay = `${(y / 1170) * SCAN_S - SCAN_S}s`;
          const color = lit && on && focus ? ACCENT[focus.tone] : TONE[p.tone];
          return (
            <g key={p.id} transform={`translate(${x} ${y})`} style={{ opacity: on ? 1 : 0.18, transition: "opacity 300ms ease" }}>
              <circle r={lit && on ? 16 : 11} fill={color} opacity="0.35" filter="url(#hero-glow)" />
              {!still && <circle r="10" fill="none" stroke={color} strokeWidth="1.6" className="hero-hit" style={{ animationDelay: delay, animationDuration: `${SCAN_S}s` }} />}
              <circle r={lit && on ? 7 : 5.2} fill={color} stroke="#0A0D05" strokeWidth="1.6" />
            </g>
          );
        })}

        {/* active event: target ring */}
        {at && event && !lit && (
          <g transform={`translate(${at.x} ${at.y})`}>
            <motion.circle
              key={event.id}
              r="20"
              fill="none"
              stroke={ACCENT[event.tone]}
              strokeWidth="1.6"
              initial={{ scale: 2.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            />
          </g>
        )}
      </svg>

      {/* event callout, anchored to its pin */}
      <AnimatePresence mode="wait">
        {event && at && !lit && (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="pointer-events-none absolute hidden lg:block"
            style={{
              top: `${(at.y / 1000) * 100}%`,
              ...(at.x > 480 ? { right: `${100 - (at.x / 1000) * 100}%`, marginRight: 30 } : { left: `${(at.x / 1000) * 100}%`, marginLeft: 30 }),
            }}
          >
            <div className="w-[280px] -translate-y-1/2 overflow-hidden rounded-xl border border-white/12 bg-[#0E1208]/85 shadow-2xl shadow-black/60 backdrop-blur-md">
              <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT[event.tone]}, transparent)` }} />
              <div className="p-3.5">
                <p className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em]" style={{ color: ACCENT[event.tone] }}>
                  <span>{event.kind}</span>
                  <span className="text-zinc-500">{runTime}</span>
                </p>
                <p className="mt-2 text-[14px] font-semibold leading-snug text-white">{event.title}</p>
                <p className="mt-0.5 text-[12px] text-zinc-400">{event.detail}</p>
                <p className="mt-2.5 border-t border-white/10 pt-2.5 font-mono text-[13px] tabular-nums text-white">{event.value}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* feature highlight legend */}
      <AnimatePresence>
        {focus && lit && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute right-[6%] top-[9%] hidden rounded-full border border-white/10 bg-[#0E1208]/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-300 backdrop-blur lg:block"
          >
            <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: ACCENT[focus.tone] }} />
            {focus.name} · {focus.stat}
          </motion.p>
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
  features,
  places,
  runLabel,
  runTime,
  total,
}: {
  pins: HeroPin[];
  events: HeroEvent[];
  features: HeroFeature[];
  places: HeroPlace[];
  runLabel: string;
  runTime: string;
  total: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const focus = features.find((f) => f.id === focusId) ?? null;

  // Cycle the callouts while the hero is on screen and no feature is being explored.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduce || !visible || focusId || events.length < 2) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % events.length), CYCLE_MS);
    return () => window.clearInterval(t);
  }, [reduce, visible, focusId, events.length]);

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
      className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#080B04] text-white"
      aria-label="Terminal: Aruba real estate market intelligence"
    >
      {/* light: aurora, pointer spotlight, fine grid, grain */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_78%_38%,rgb(92_140_40/0.34),transparent_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_8%_100%,rgb(40_70_90/0.28),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_420px_at_30%_0%,rgb(172_250_104/0.07),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(520px_circle_at_var(--hx,70%)_var(--hy,40%),rgb(172_250_104/0.09),transparent_60%)]" />
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_65%_40%,black,transparent_72%)]" />
        <div className="hero-grain absolute inset-0 opacity-[0.06] mix-blend-overlay" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1">
        {/* map: background on phones/tablets, right side on desktop */}
        <motion.div
          aria-hidden
          style={reduce ? undefined : { x: px, y: py }}
          className="pointer-events-none absolute -right-[38%] top-16 -z-[5] w-[min(125vw,720px)] opacity-35 sm:-right-[12%] sm:opacity-50 lg:right-0 lg:top-1/2 lg:w-[min(52%,calc(100svh-190px))] lg:-translate-y-[49%] lg:opacity-100"
        >
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}>
            <IslandMap pins={pins} places={places} event={events[active]} focus={focus} still={reduce} runTime={runTime} />
          </motion.div>
        </motion.div>

        {/* copy */}
        <div className="relative flex w-full flex-col justify-center px-5 pb-8 pt-24 sm:px-8 sm:pb-10 lg:px-12">
          <div className="max-w-[640px]">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.05] py-1.5 pl-2.5 pr-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-200 backdrop-blur"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-lime" />
              </span>
              <span className="sm:hidden">Live · {runTime}</span>
              <span className="hidden sm:inline">Live · {runLabel}</span>
            </motion.p>

            <h1 className="mt-5 font-display text-[clamp(42px,5.2vw,80px)] font-bold leading-[0.96] tracking-[-0.035em] sm:mt-7">
              {LINES.map((line, i) => (
                <span key={line} className="block overflow-hidden pb-[0.06em]">
                  <motion.span
                    className={`block whitespace-nowrap ${i === 1 ? "bg-gradient-to-r from-white via-[#D9FCB2] to-lime bg-clip-text text-transparent" : ""}`}
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
              className="mt-5 max-w-[50ch] text-[15.5px] leading-relaxed text-zinc-300/90 sm:mt-7 sm:text-[18px]"
            >
              Every home, parcel and commercial listing in Aruba, read overnight by AI. New listings, price cuts and contracts, each one priced against its comps and scored for how likely it is to still be for sale.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
              className="mt-7 flex flex-wrap items-center gap-2.5 sm:mt-9 sm:gap-3"
            >
              <Link
                href="/signup"
                className="group relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-full bg-lime pl-5 pr-3.5 font-display text-[15px] font-semibold text-zinc-950 shadow-[0_0_44px_-6px_rgb(172_250_104/0.55)] transition-transform active:scale-[0.98] sm:h-12 sm:pl-6 sm:pr-5"
              >
                <span className="absolute inset-0 -translate-x-full bg-white transition-transform duration-500 ease-out group-hover:translate-x-0" aria-hidden />
                <span className="relative">Get access</span>
                <span className="relative grid size-6 place-items-center rounded-full bg-zinc-950 text-lime transition-transform duration-300 group-hover:translate-x-0.5">
                  <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" strokeLinecap="square" />
                  </svg>
                </span>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-5 font-display text-[15px] font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/[0.06] sm:h-12 sm:px-6"
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
              className="mt-5 flex max-w-[460px] items-center gap-3 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 backdrop-blur transition-colors focus-within:border-lime/60 hover:border-white/25 sm:mt-6"
            >
              <span className="font-mono text-[13px] text-lime" aria-hidden>
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
      </div>

      {/* features rail: each one is live, hover to see what it found on the map */}
      <motion.ul
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
        aria-label="Features"
        className="no-scrollbar relative flex w-full snap-x snap-mandatory gap-px overflow-x-auto border-t border-white/10 bg-white/10 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6"
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
                className={`group relative block h-full w-full overflow-hidden px-5 py-4 text-left transition-colors sm:px-6 sm:py-5 ${on ? "bg-[#141B0A]" : "bg-[#080B04]/95 hover:bg-[#0F1408]"}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px origin-left transition-transform duration-500 ease-out"
                  style={{ background: ACCENT[f.tone], transform: on ? "scaleX(1)" : "scaleX(0)" }}
                />
                <span className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-right" style={{ color: ACCENT[f.tone] }}>
                    {f.stat}
                  </span>
                </span>
                <span className="mt-2.5 block font-display text-[16px] font-semibold text-white">{f.name}</span>
                <span className="mt-1 block text-[12.5px] leading-snug text-zinc-400 transition-colors group-hover:text-zinc-300">{f.text}</span>
              </button>
            </li>
          );
        })}
      </motion.ul>
    </section>
  );
}
