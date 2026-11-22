"use client";

/*
 * "Built for" section: one tab per audience (agents, brokers, investors).
 * Three short value lines and a CTA on the left, a real example on the right.
 * The examples are rendered by the page from today's data and passed in.
 */

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

export type Audience = {
  id: string;
  label: string;
  title: string;
  points: string[];
  cta: { label: string; href: string };
  visual: React.ReactNode;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function AudienceTabs({ items }: { items: Audience[] }) {
  const [active, setActive] = useState(items[0].id);
  const a = items.find((x) => x.id === active) ?? items[0];
  return (
    <div>
      <div role="tablist" aria-label="Who Terminal is for" className="glass inline-flex rounded-full p-1">
        {items.map((x) => {
          const on = x.id === active;
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`aud-${x.id}`}
              onClick={() => setActive(x.id)}
              className={`relative rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors sm:px-5 ${on ? "text-lime" : "text-zinc-600 hover:text-zinc-950"}`}
            >
              {on && <motion.span layoutId="aud-pill" className="absolute inset-0 rounded-full bg-zinc-950" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">{x.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={a.id}
          id={`aud-${a.id}`}
          role="tabpanel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16"
        >
          <div>
            <h3 className="max-w-[18ch] font-display text-[28px] leading-[1.08] tracking-[-0.025em] text-[#15171C] sm:text-[38px]">{a.title}</h3>
            <ul className="mt-7 space-y-4">
              {a.points.map((p) => (
                <li key={p} className="flex gap-3 text-[15.5px] leading-snug text-zinc-700">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-zinc-950 text-lime">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href={a.cta.href}
              className="group mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-zinc-950 px-5 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
            >
              {a.cta.label}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="min-w-0">{a.visual}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
