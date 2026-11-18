"use client";

/*
 * AI Signal visuals: the market "being read" (a scan through real listings),
 * typed briefing text, and a cursor spotlight for dark panels. All content is
 * passed in from the scrape data; nothing here invents numbers. Motion is
 * skipped for people who prefer reduced motion.
 */

import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface ScanRow {
  id: string;
  name: string;
  meta: string; // "Villa · Malmok"
  price: string; // "$2.45M"
  tag: string; // "12% under comps"
  tone: "up" | "down" | "flat" | "new";
}

const TONE: Record<ScanRow["tone"], string> = {
  up: "text-[#1F7A45] bg-[#E3F3E8]",
  down: "text-[#B23A3A] bg-[#FBE9E9]",
  flat: "text-zinc-600 bg-zinc-100",
  new: "text-mint bg-zinc-950",
};

/** Text that types itself in once it is on screen. */
export function TypeText({ text, speed = 18, className = "", delay = 0, caret = true }: { text: string; speed?: number; className?: string; delay?: number; caret?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStarted(true), { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started || reduce) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setN(i);
      if (i < text.length) t = setTimeout(tick, speed + (text[i - 1] === "." || text[i - 1] === "," ? speed * 6 : 0));
    };
    t = setTimeout(tick, delay);
    return () => clearTimeout(t);
  }, [started, reduce, text, speed, delay]);

  const shown = reduce ? text.length : n;
  const done = shown >= text.length;
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, shown)}
        {caret && !done && <span className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-current" />}
        <span className="invisible">{text.slice(shown)}</span>
      </span>
    </span>
  );
}

/** "AI Signal" label with a breathing glow. */
export function AIBadge({ dark = false, label = "AI Signal" }: { dark?: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-white" : "text-zinc-950"}`}>
      <span className={`relative grid size-6 place-items-center rounded-lg ${dark ? "bg-mint text-zinc-950" : "bg-zinc-950 text-mint"}`}>
        <span className={`absolute inset-0 animate-[ai-breathe_2.8s_ease-in-out_infinite] rounded-lg motion-reduce:animate-none ${dark ? "bg-mint" : "bg-zinc-950"}`} />
        <Sparkles size={12} strokeWidth={2.2} className="relative" />
      </span>
      {label}
    </span>
  );
}

/**
 * The market being read: listings stream past, each gets checked against its
 * comps and tagged, a progress counter climbs to the full market, then the
 * briefing headline types out. Loops.
 */
export function AIMarketScan({
  rows,
  total,
  headline,
  dark = false,
  className = "",
}: {
  rows: ScanRow[];
  total: number;
  headline: string;
  dark?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const VISIBLE = 4;
  const [step, setStep] = useState(reduce ? rows.length : 0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduce || !rows.length) return;
    const t = setTimeout(
      () => {
        if (step < rows.length) setStep((s) => s + 1);
        else {
          setStep(0);
          setCycle((c) => c + 1);
        }
      },
      step < rows.length ? 900 : 5200,
    );
    return () => clearTimeout(t);
  }, [step, rows.length, reduce]);

  const finished = step >= rows.length;
  const read = finished ? total : Math.round((step / rows.length) * total);
  const window_ = rows.slice(Math.max(0, Math.min(step, rows.length) - VISIBLE + 1), Math.min(step, rows.length - 1) + 1);
  const shell = dark ? "border-white/10 bg-zinc-900/80 text-white" : "border-zinc-200 bg-white text-zinc-950";
  const muted = dark ? "text-zinc-400" : "text-zinc-500";

  return (
    <div className={`relative overflow-hidden rounded-2xl border shadow-2xl shadow-zinc-950/10 backdrop-blur ${shell} ${className}`}>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${dark ? "border-white/10" : "border-zinc-100"}`}>
        <AIBadge dark={dark} />
        <span className={`text-[11px] tabular-nums ${muted}`}>
          {finished ? "Market read" : "Reading the market"} · <b className={dark ? "text-white" : "text-zinc-950"}>{read}</b>/{total}
        </span>
      </div>
      {/* progress */}
      <div className={`h-[2px] ${dark ? "bg-white/5" : "bg-zinc-100"}`}>
        <motion.div
          className={dark ? "h-full bg-mint" : "h-full bg-zinc-950"}
          animate={{ width: `${(read / Math.max(total, 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </div>

      <div className="relative h-[212px] px-2 py-2">
        {/* scan beam */}
        {!reduce && !finished && (
          <motion.div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 h-14 ${dark ? "bg-gradient-to-b from-transparent via-mint/15 to-transparent" : "bg-gradient-to-b from-transparent via-mint/70 to-transparent"}`}
            initial={{ top: -56 }}
            animate={{ top: 212 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          />
        )}
        <ul className="relative space-y-1" aria-label="Listings being analysed">
          <AnimatePresence initial={false} mode="popLayout">
            {(finished ? rows.slice(-VISIBLE) : window_).map((r, i, arr) => {
              const reading = !finished && i === arr.length - 1;
              return (
                <motion.li
                  key={`${cycle}-${r.id}`}
                  layout
                  initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -18, filter: "blur(4px)" }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${reading ? (dark ? "bg-white/5" : "bg-mint-soft") : ""}`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full ${reading ? (dark ? "bg-white/10" : "bg-white") : dark ? "bg-mint text-zinc-950" : "bg-zinc-950 text-mint"}`}
                  >
                    {reading ? (
                      <span className={`size-3 animate-spin rounded-full border-[1.5px] border-t-transparent ${dark ? "border-mint" : "border-zinc-950"}`} />
                    ) : (
                      <Check size={12} strokeWidth={3} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{r.name}</span>
                    <span className={`block truncate text-[11px] ${muted}`}>
                      {r.meta} · {r.price}
                    </span>
                  </span>
                  {reading ? (
                    <span className={`shrink-0 text-[10.5px] ${muted}`}>comparing…</span>
                  ) : (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${dark && r.tone === "new" ? "bg-mint text-zinc-950" : TONE[r.tone]}`}
                    >
                      {r.tag}
                    </motion.span>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      <div className={`min-h-[64px] border-t px-4 py-3 ${dark ? "border-white/10" : "border-zinc-100"}`}>
        <AnimatePresence mode="wait">
          {finished ? (
            <motion.p key={`h-${cycle}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[13px] font-semibold leading-snug">
              <TypeText text={headline} speed={16} />
            </motion.p>
          ) : (
            <motion.p key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`text-[12px] leading-snug ${muted}`}>
              Checking price per sq ft, price history, days on market and status against comparable listings…
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Dark panel with a soft light that follows the cursor. */
export function Spotlight({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const sx = useSpring(x, { stiffness: 120, damping: 20 });
  const sy = useSpring(y, { stiffness: 120, damping: 20 });
  const bg = useMotionTemplate`radial-gradient(520px circle at ${sx}px ${sy}px, rgb(221 229 220 / 0.10), transparent 70%)`;
  return (
    <div
      className={`relative ${className}`}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      {children}
    </div>
  );
}
