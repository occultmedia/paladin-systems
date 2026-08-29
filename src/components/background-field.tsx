"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/* Deterministic particle field (SSR-stable, transform-only animation). */
const PARTICLES = [
  { left: "8%", top: "22%", size: 4, delay: 0, duration: 9 },
  { left: "16%", top: "64%", size: 3, delay: 1.4, duration: 11 },
  { left: "27%", top: "38%", size: 5, delay: 2.6, duration: 8 },
  { left: "43%", top: "75%", size: 3, delay: 0.8, duration: 10 },
  { left: "58%", top: "18%", size: 4, delay: 3.1, duration: 12 },
  { left: "66%", top: "52%", size: 3, delay: 1.9, duration: 9 },
  { left: "78%", top: "30%", size: 5, delay: 0.4, duration: 11 },
  { left: "88%", top: "68%", size: 3, delay: 2.2, duration: 8 },
  { left: "94%", top: "40%", size: 4, delay: 3.6, duration: 10 },
];

/* Pulse dots ride the 48px grid lines in circuit paths. The layer is fixed,
   so they keep running behind every section as the page scrolls. */
const PULSES = [
  {
    x: [96, 480, 480, 864],
    y: [144, 144, 336, 336],
    duration: 9,
    delay: 0.6,
  },
  {
    x: [1296, 912, 912, 576],
    y: [480, 480, 240, 240],
    duration: 11,
    delay: 4,
  },
  {
    x: [672, 672, 1056, 1056],
    y: [720, 528, 528, 672],
    duration: 10,
    delay: 7.5,
  },
];

export function BackgroundField() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 110]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* full-page circuit grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* layered ambient light */}
      <motion.div
        style={reduce ? undefined : { y: glowY }}
        className="absolute right-[-12%] top-[-14%] h-[560px] w-[760px] rounded-full bg-[radial-gradient(closest-side,var(--halo-strong),transparent)] blur-2xl"
      />
      <div className="absolute bottom-[-18%] left-[-14%] h-[520px] w-[680px] rounded-full bg-[radial-gradient(closest-side,var(--halo-soft),transparent)] blur-2xl" />

      {/* traveling grid pulses with radar ripples */}
      {!reduce &&
        PULSES.map((pulse, i) => (
          <motion.div
            key={i}
            className="absolute -ml-[3px] -mt-[3px] hidden md:block"
            animate={{ x: pulse.x, y: pulse.y, opacity: [0, 1, 1, 0] }}
            transition={{
              duration: pulse.duration,
              delay: pulse.delay,
              repeat: Infinity,
              repeatDelay: 2.5,
              ease: "linear",
              times: [0, 0.35, 0.75, 1],
            }}
          >
            {[0, 1.1].map((ringDelay) => (
              <motion.span
                key={ringDelay}
                className="absolute left-[-15px] top-[-15px] size-9 rounded-full border border-[var(--pulse-ring)]"
                animate={{ scale: [0.16, 1.6], opacity: [0.45, 0] }}
                transition={{
                  duration: 2.2,
                  delay: pulse.delay + ringDelay,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            ))}
            <motion.span
              className="block size-1.5 rounded-full bg-[var(--pulse-color)] shadow-[0_0_14px_3px_var(--pulse-glow)]"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        ))}

      {/* sparse particle field, desktop + motion-safe only */}
      <div className="hidden md:block">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-[var(--particle)] motion-safe:animate-[drift_var(--dur)_ease-in-out_infinite]"
            style={
              {
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}s`,
                "--dur": `${p.duration}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
