"use client";

/*
 * FAQ: how Baseline gets its data and what the numbers mean. Glass accordion,
 * one answer open at a time. The same Q&A feeds the FAQPage JSON-LD on the
 * landing page, so keep answers as plain text.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";

export type FaqItem = { q: string; a: string };

const EASE = [0.22, 1, 0.36, 1] as const;

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => {
        const on = open === i;
        return (
          <li
            key={it.q}
            className={`overflow-hidden rounded-2xl border transition-[background-color,border-color,box-shadow] duration-300 ${
              on
                ? "border-white/80 bg-white/70 shadow-[0_18px_40px_-24px_rgb(10_10_10/0.35)] backdrop-blur-xl"
                : "border-zinc-950/[0.07] bg-white/40 hover:bg-white/70"
            }`}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpen(on ? null : i)}
                aria-expanded={on}
                aria-controls={`faq-${i}`}
                className="flex w-full items-center justify-between gap-6 px-5 py-4 text-left sm:px-6 sm:py-5"
              >
                <span className="font-display text-[15.5px] font-semibold text-zinc-950 sm:text-[17px]">{it.q}</span>
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-300 ${
                    on ? "rotate-45 bg-zinc-950 text-lime" : "bg-white/80 text-zinc-700 ring-1 ring-zinc-950/10"
                  }`}
                >
                  <Plus size={15} strokeWidth={2.2} />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div
                  id={`faq-${i}`}
                  role="region"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                >
                  <p className="max-w-[72ch] px-5 pb-5 text-[14.5px] leading-relaxed text-zinc-600 sm:px-6 sm:pb-6">{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
