"use client";

/**
 * Micro-motion helpers (framer-motion). Everything respects
 * prefers-reduced-motion through MotionConfig reducedMotion="user".
 */

import { animate, motion, MotionConfig, useInView, useMotionValue, useTransform, type HTMLMotionProps } from "framer-motion";
import { useEffect, useRef } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  ...rest
}: { children: React.ReactNode; delay?: number; y?: number; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** A grid/list whose children reveal one after another. Wrap each child in <StaggerItem>. */
export function Stagger({ children, className, gap = 0.07 }: { children: React.ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to `value` when it scrolls into view (or on mount, for above-the-fold figures). */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  onMount = false,
  delay = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  onMount?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const inView = onMount || seen;
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${prefix}${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 1.4, ease: EASE, delay });
    return () => c.stop();
  }, [inView, mv, value, delay]);
  return (
    <span ref={ref} className="tabular-nums">
      <motion.span>{text}</motion.span>
      <span className="sr-only">{`${prefix}${value}${suffix}`}</span>
    </span>
  );
}
