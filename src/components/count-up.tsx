"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* Counts from 0 to `value` when scrolled into view. Screen readers and
   reduced-motion users get the final value directly. */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  className = "",
  duration = 1.4,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setCurrent(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration]);

  const shown = reduce ? value : current;

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>
        {prefix}
        {shown.toLocaleString("en-US")}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {value.toLocaleString("en-US")}
        {suffix}
      </span>
    </span>
  );
}
