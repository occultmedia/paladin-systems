"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, TrendingUp } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SequenceMark } from "@/components/logo";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* The mock website assembles piece by piece (design -> build -> grow),
   holds, then rebuilds. Reduced-motion users get the finished state. */
const FIRST_DELAY = 500;
const STEP_MS = 620;
const STEPS = 8;
const HOLD_AFTER = 4600;

function Piece({
  active,
  children,
  className = "",
  pop = false,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  pop?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={false}
      animate={
        active
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: pop ? 0 : 14, scale: pop ? 0.6 : 0.98 }
      }
      transition={
        pop
          ? { type: "spring", stiffness: 320, damping: 18 }
          : { duration: 0.55, ease: EASE }
      }
    >
      {children}
    </motion.div>
  );
}

export function HeroVisual() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= STEPS; i++) {
      timers.push(setTimeout(() => setStep(i), FIRST_DELAY + i * STEP_MS));
    }
    timers.push(
      setTimeout(() => {
        setStep(0);
        setCycle((c) => c + 1);
      }, FIRST_DELAY + STEPS * STEP_MS + HOLD_AFTER),
    );
    return () => timers.forEach(clearTimeout);
  }, [cycle, reduce]);

  const on = (i: number) => reduce || step >= i;
  const phase = reduce || step >= 6 ? 2 : step >= 3 ? 1 : 0;

  return (
    <div className="relative pb-12 pr-2 lg:pr-4">
      <p className="sr-only">
        Animated illustration: Sequence Labs designs and builds a client
        website piece by piece, marks it live, and then grows it, shown by a
        rising visitor chart and a number-one Google ranking badge.
      </p>

      {/* browser frame */}
      <div aria-hidden className="glass-slab overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-edge/80 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-line" />
            <span className="size-2.5 rounded-full bg-line" />
            <span className="size-2.5 rounded-full bg-line" />
          </span>
          <span className="mx-auto rounded-[8px] border border-edge bg-canvas px-3 py-1 font-mono text-[10.5px] tracking-[0.06em] text-muted">
            yourbusiness.aw
          </span>
          <Piece active={on(5)} pop className="w-[64px]">
            <span className="flex items-center gap-1 rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 text-[10px] font-medium text-signal">
              <CheckCircle2 className="size-3" strokeWidth={2} />
              Live
            </span>
          </Piece>
        </div>

        <div className="relative px-5 py-5 sm:px-6">
          {/* faint blueprint grid behind the mock */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_85%)]"
          />

          {/* mini nav */}
          <Piece active={on(1)} className="relative flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <SequenceMark className="size-3.5 text-accent" />
              <span className="h-2 w-14 rounded-full bg-fg/70" />
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-fg/15" />
              <span className="h-1.5 w-8 rounded-full bg-fg/15" />
              <span className="h-5 w-14 rounded-[6px] bg-brand" />
            </span>
          </Piece>

          {/* mini hero: headline + photo */}
          <div className="relative mt-5 grid grid-cols-5 items-center gap-4">
            <div className="col-span-3">
              <Piece active={on(2)}>
                <span className="block h-3 w-full rounded-full bg-fg/80" />
                <span className="mt-2 block h-3 w-4/5 rounded-full bg-fg/80" />
                <span className="mt-2 block h-1 w-3/5 rounded-full bg-brand" />
                <span className="mt-3 block h-1.5 w-full rounded-full bg-fg/15" />
                <span className="mt-1.5 block h-1.5 w-11/12 rounded-full bg-fg/15" />
              </Piece>
              <Piece active={on(3)} className="mt-4 flex items-center gap-2">
                <span className="flex h-7 w-24 items-center justify-center rounded-[7px] bg-brand">
                  <span className="h-1.5 w-14 rounded-full bg-[#101403]/70" />
                </span>
                <span className="h-7 w-16 rounded-[7px] border border-line" />
              </Piece>
            </div>
            <Piece active={on(3)} className="col-span-2">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-edge bg-[linear-gradient(150deg,var(--color-brand),#6cc132_58%,#2f5a12)]">
                <span className="absolute left-2.5 top-2.5 size-4 rounded-full bg-white/80" />
                <span className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgb(11_13_8/0.55),transparent)]" />
              </div>
            </Piece>
          </div>

          {/* three content cards */}
          <div className="relative mt-5 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((c) => (
              <Piece active={on(4)} key={c}>
                <div className="rounded-xl border border-edge bg-canvas/70 p-3">
                  <span className="block size-4 rounded-[5px] bg-brand/70" />
                  <span className="mt-2 block h-1.5 w-4/5 rounded-full bg-fg/60" />
                  <span className="mt-1.5 block h-1 w-full rounded-full bg-fg/15" />
                  <span className="mt-1 block h-1 w-3/4 rounded-full bg-fg/15" />
                </div>
              </Piece>
            ))}
          </div>
        </div>

        {/* status bar: which phase the studio is in */}
        <div
          aria-hidden
          className="flex items-center justify-end gap-5 border-t border-edge/80 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em]"
        >
          {["Design", "Build", "Grow"].map((label, i) => (
            <span
              key={label}
              className={`flex items-center gap-1.5 transition-colors duration-500 ${
                phase === i ? "text-signal" : "text-muted/60"
              }`}
            >
              <span
                className={`size-1.5 rounded-full transition-colors duration-500 ${
                  phase === i ? "bg-signal" : "bg-line"
                }`}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* analytics overlay */}
      <Piece
        active={on(6)}
        className="absolute -bottom-2 left-0 w-[230px] sm:-left-3 lg:-left-6"
      >
        <div aria-hidden className="glass-slab rounded-2xl p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Visitors
            </p>
            <p className="flex items-center gap-1 font-mono text-[13px] text-signal">
              <TrendingUp className="size-3.5" strokeWidth={2} />
              +23%
            </p>
          </div>
          <svg viewBox="0 0 200 56" className="mt-2 w-full">
            <motion.path
              d="M4 48 L32 42 L60 45 L88 32 L116 36 L144 22 L172 24 L196 8"
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: on(6) ? 1 : 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            <motion.circle
              cx="196"
              cy="8"
              r="3.5"
              fill="var(--color-signal)"
              initial={false}
              animate={{ opacity: on(7) ? 1 : 0, scale: on(7) ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            />
          </svg>
          <p className="mt-1.5 text-[11px] leading-snug text-muted">
            Report sent to your inbox
          </p>
        </div>
      </Piece>

      {/* ranking badge */}
      <Piece
        active={on(8)}
        pop
        className="absolute -right-1 bottom-16 sm:right-0 lg:-right-2"
      >
        <motion.div
          aria-hidden
          animate={reduce ? undefined : { y: [0, -7, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="glass-slab flex items-center gap-2.5 rounded-2xl px-4 py-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/google.svg"
            alt=""
            width={16}
            height={16}
            className="size-4"
          />
          <span className="text-[12px] leading-tight">
            <span className="block font-semibold text-fg">#1 on Google</span>
            <span className="block text-[10.5px] text-muted">
              &ldquo;jeep tour aruba&rdquo;
            </span>
          </span>
        </motion.div>
      </Piece>
    </div>
  );
}
