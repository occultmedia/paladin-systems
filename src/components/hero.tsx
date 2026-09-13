"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  BedDouble,
  Building2,
  Car,
  Home,
  Map,
  Plus,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { CountUp } from "@/components/count-up";
import { HeroVisual } from "@/components/hero-visual";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* Placeholder track-record figures: confirm real numbers before launch. */
const METRICS = [
  { value: 120, suffix: "+", label: "site changes shipped" },
  { value: 24, suffix: "/7", label: "uptime monitoring" },
  { value: 48, suffix: " hr", label: "typical change turnaround" },
];

const INDUSTRIES = [
  { icon: Building2, label: "Real Estate" },
  { icon: Home, label: "Vacation Rentals" },
  { icon: Car, label: "Car Rentals" },
  { icon: BedDouble, label: "Boutique Hotels" },
  { icon: Map, label: "Tour Operators" },
  { icon: Waves, label: "Watersports" },
  { icon: UtensilsCrossed, label: "Restaurants" },
];

export function Hero() {
  const reduce = useReducedMotion();

  /* Slide-only entrance: text stays visible in server HTML (no opacity: 0
     before hydration), which keeps LCP at first paint on slow connections. */
  const rise = (delay: number) => ({
    initial: reduce ? false : { y: 26 },
    animate: { y: 0 },
    transition: { duration: 0.8, delay, ease: EASE },
  });

  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] top-[15%] h-[480px] w-[640px] rounded-full bg-[radial-gradient(closest-side,var(--halo-soft),transparent)] blur-2xl"
      />

      <div className="relative mx-auto grid min-h-[100svh] w-full max-w-[1400px] grid-cols-1 items-center gap-y-10 px-5 pb-8 pt-32 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-8 lg:px-8 lg:pb-8 lg:pt-20">
        <div className="lg:col-span-7">
          <motion.p
            {...rise(0)}
            className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-muted"
          >
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-signal shadow-[0_0_10px_2px_var(--btn-glow)] motion-safe:animate-pulse"
            />
            A boutique web agency for Aruba companies
          </motion.p>

          <motion.h1
            {...rise(0.08)}
            className="mt-7 font-display text-[clamp(38px,5.5vw,75px)] font-bold uppercase leading-[1.02] tracking-[-0.02em] text-fg"
          >
            Never worry about
            <br className="hidden md:block" />{" "}
            <span className="underline decoration-brand decoration-[0.06em] underline-offset-[0.14em]">
              your website again.
            </span>
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="mt-7 max-w-[56ch] text-base leading-relaxed text-muted lg:text-[18px]"
          >
            We build your website, then stay on it month after month:
            maintenance, changes, SEO, and reports, all for one flat monthly
            price. You run your business; we run your website.
          </motion.p>

          <motion.div
            {...rise(0.24)}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <a
              href="#how-it-works"
              className="btn-metal rounded-[10px] px-7 py-4 font-mono text-[13.5px] font-medium uppercase tracking-[0.08em] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            >
              See How It Works
            </a>
          </motion.div>

          <motion.div
            {...rise(0.32)}
            className="mt-12 flex flex-wrap gap-x-12 gap-y-6"
          >
            {METRICS.map((metric) => (
              <div key={metric.label}>
                <p className="font-mono text-[24px] text-signal">
                  <CountUp value={metric.value} suffix={metric.suffix} />
                </p>
                <p className="mt-1 text-[12.5px] text-muted">{metric.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div {...rise(0.3)} className="lg:col-span-5">
          <HeroVisual />
        </motion.div>

        <motion.div {...rise(0.4)} className="lg:col-span-12">
          <div className="relative pt-7">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-edge to-transparent"
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted">
              Industries we work with
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {INDUSTRIES.map((industry) => (
                <div
                  key={industry.label}
                  className="group flex items-center gap-3.5 rounded-2xl border border-edge bg-surface/60 py-3.5 pl-4 pr-5 transition-colors duration-300 hover:border-line hover:bg-white/[0.03]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line/80 bg-canvas/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <industry.icon
                      className="size-4 text-accent transition-transform duration-300 group-hover:scale-110"
                      strokeWidth={1.5}
                    />
                  </span>
                  <span className="text-[14.5px] font-medium text-fg">
                    {industry.label}
                  </span>
                </div>
              ))}
              <a
                href="#audit"
                className="group flex items-center gap-3.5 rounded-2xl border border-signal/40 bg-brand/10 py-3.5 pl-4 pr-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-signal/70 hover:bg-brand/20"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-signal/40 bg-canvas/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <Plus className="size-4 text-signal" strokeWidth={1.5} />
                </span>
                <span className="text-[14.5px] font-medium text-signal">
                  Your Business
                </span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
