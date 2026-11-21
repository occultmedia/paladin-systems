"use client";

/*
 * Landing: the Terminal's full-screen map, in 3D. A framed copy of the real
 * full-screen view: the live map tours a few listings, flying in and tilting
 * so the buildings stand up (Mapbox Standard), while the side list and the
 * listing card follow along. The map only loads when the section is near the
 * viewport and the tour only runs while it is on screen.
 */

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Listing } from "@/lib/aruba-data";

const ArubaMap = dynamic(() => import("@/components/dashboard/aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

const EASE = [0.22, 1, 0.36, 1] as const;
const STEP_MS = 6500;
const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const kindOf = (l: Listing) => (l.category === "Property" ? `${l.property_type} · ${l.bedrooms} bd` : l.category === "Land" ? "Land" : "Commercial");
const vsComps = (l: Listing) => (l.category === "Property" ? l.price_vs_comps_pct : l.price_vs_district_pct);

export function MapShowcase({ listings, tour }: { listings: Listing[]; tour: Listing[] }) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = tour[i];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true);
        setVisible(e.intersectionRatio > 0.35);
      },
      { rootMargin: "400px 0px", threshold: [0, 0.35, 0.6] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || !visible || paused || tour.length < 2) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % tour.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [i, reduce, visible, paused, tour.length]);

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_30px_80px_-30px_rgb(10_10_10/0.35)]">
      {/* window bar: same as the real full-screen map */}
      <div className="flex h-12 items-center justify-between gap-3 bg-zinc-950 px-4 text-white">
        <p className="flex min-w-0 items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-300">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-lime" />
          </span>
          <span className="truncate">
            Map · <span className="text-white">{listings.length}</span> listings
          </span>
          <span className="rounded bg-lime px-1.5 py-px font-semibold text-zinc-950">3D</span>
        </p>
        <span className="hidden rounded-full border border-white/20 px-3 py-1 text-[11.5px] font-semibold text-zinc-300 sm:inline">Full screen · Esc to exit</span>
      </div>

      <div className="grid h-[520px] grid-cols-[minmax(0,1fr)] sm:h-[600px] lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* tour list */}
        <ul className="hidden flex-col gap-1 overflow-hidden border-r border-zinc-200 p-2 lg:flex" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {tour.map((l, n) => {
            const on = n === i;
            return (
              <li key={l.listing_id}>
                <button
                  type="button"
                  onClick={() => setI(n)}
                  className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl p-2.5 text-left transition-colors ${on ? "bg-zinc-950 text-white" : "hover:bg-zinc-50"}`}
                >
                  {l.photo_url ? (
                    <Image src={`${l.photo_url}?auto=format&fit=crop&w=128&h=96&q=60`} alt="" width={56} height={42} unoptimized className="h-[42px] w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="h-[42px] w-14 shrink-0 rounded-lg bg-zinc-200" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold">{l.asset_name}</span>
                    <span className={`block truncate text-[11px] ${on ? "text-zinc-400" : "text-zinc-500"}`}>
                      {l.district} · {kindOf(l)}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-[13px] font-bold tabular-nums">{usdShort(l.asking_price_usd)}</span>
                  {on && !reduce && visible && !paused && (
                    <motion.span
                      key={`${l.listing_id}-${i}`}
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-lime"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                    />
                  )}
                </button>
              </li>
            );
          })}
          <li className="mt-auto px-2.5 pb-1.5 pt-3 text-[11px] leading-snug text-zinc-400">Click any listing or pin: the map flies in and tilts so the buildings stand up.</li>
        </ul>

        {/* map */}
        <div className="relative min-w-0">
          {near ? (
            <ArubaMap mode="listings" listings={listings} selectedId={active?.listing_id ?? null} interactive={false} fill />
          ) : (
            <div className="h-full w-full bg-zinc-100" />
          )}

          {/* selected listing card */}
          <AnimatePresence mode="wait">
            {active && (
              <motion.div
                key={active.listing_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="pointer-events-none absolute bottom-4 left-4 right-4 max-w-[340px] rounded-xl border border-zinc-200 bg-white/95 p-3.5 shadow-xl backdrop-blur sm:right-auto"
              >
                <p className="flex items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">
                  <span>{active.district}</span>
                  <span className="rounded bg-zinc-950 px-1.5 py-px text-lime">{vsComps(active).toFixed(0)}% vs comps</span>
                </p>
                <p className="mt-1.5 text-[14.5px] font-semibold text-zinc-950">{active.asset_name}</p>
                <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-[12px] text-zinc-500">
                  <span>
                    <b className="font-display text-[15px] text-zinc-950">{usdShort(active.asking_price_usd)}</b> · ${active.price_per_sqft_usd.toLocaleString("en-US")}/ft²
                  </span>
                  <span className="tabular-nums">{active.confidence_score}% confidence</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function MapShowcaseCta() {
  return (
    <Link
      href="/dashboard?tab=listings&map=full"
      className="group inline-flex h-12 items-center gap-2 rounded-full bg-zinc-950 pl-6 pr-4 font-display text-[15px] font-semibold text-lime transition-colors hover:bg-zinc-800"
    >
      Open the full-screen map
      <span className="grid size-6 place-items-center rounded-full bg-lime text-zinc-950 transition-transform group-hover:translate-x-0.5">
        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" strokeLinecap="square" />
        </svg>
      </span>
    </Link>
  );
}
