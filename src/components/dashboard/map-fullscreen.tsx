"use client";

/*
 * Full-screen map view of the Terminal: the map fills the screen, the current
 * (filtered) listings sit in a side panel on desktop and a swipeable strip on
 * phones. Hovering a listing highlights its pin, clicking a pin or a listing
 * selects it and flies the map there; "Open details" returns to the table
 * with that listing open. Esc closes.
 */

import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Minimize2, X } from "lucide-react";
import { BAND_COLOR, confidenceBand } from "@/lib/confidence";
import type { Listing } from "@/lib/aruba-data";
import { AgencyLogo, SIGNAL_COLOR, SIGNAL_LABEL } from "./map-shared";

const ArubaMap = dynamic(() => import("./aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

const EASE = [0.22, 1, 0.36, 1] as const;
const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const kindOf = (l: Listing) =>
  l.category === "Property" ? `${l.property_type} · ${l.bedrooms} bd` : l.category === "Land" ? `Land · ${l.zoning}` : `Commercial · ${l.commercial_use}`;

function Row({ l, on, onPick, onHover }: { l: Listing; on: boolean; onPick: () => void; onHover: (id: string | null) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [on]);
  const band = confidenceBand(l.confidence_score);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onPick}
      onMouseEnter={() => onHover(l.listing_id)}
      onMouseLeave={() => onHover(null)}
      className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${on ? "bg-zinc-950 text-white" : "hover:bg-zinc-100"}`}
    >
      <span className="relative shrink-0">
        {l.photo_url ? (
          <Image src={`${l.photo_url}?auto=format&fit=crop&w=128&h=96&q=60`} alt="" width={64} height={48} unoptimized className="h-12 w-16 rounded-lg object-cover" />
        ) : (
          <span className="block h-12 w-16 rounded-lg bg-zinc-200" />
        )}
        <span className="absolute -bottom-1 -right-1 rounded-[5px] ring-2 ring-white">
          <AgencyLogo agency={l.agency} size={18} rounded={4} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{l.asset_name}</span>
        <span className={`block truncate text-[11.5px] ${on ? "text-zinc-400" : "text-zinc-500"}`}>
          {l.district} · {kindOf(l)}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: on ? undefined : SIGNAL_COLOR[l.signal] }}>
            <span className="size-1.5 rounded-full" style={{ background: SIGNAL_COLOR[l.signal] }} />
            {SIGNAL_LABEL[l.signal]}
          </span>
          <span className="tabular-nums" style={{ color: on ? "#ACFA68" : BAND_COLOR[band] }}>
            {l.confidence_score}% conf.
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right font-display text-[14px] font-bold tabular-nums">{usdShort(l.asking_price_usd)}</span>
    </button>
  );
}

export function MapFullscreen({
  open,
  listings,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onClose,
  onOpenDetails,
}: {
  open: boolean;
  listings: Listing[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onClose: () => void;
  onOpenDetails: (id: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const selected = listings.find((l) => l.listing_id === selectedId) ?? null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Full-screen map"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-[1300] flex flex-col bg-white"
        >
          {/* top bar */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-950 px-4 text-white sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-lime" />
              </span>
              <p className="truncate font-mono text-[11.5px] uppercase tracking-[0.14em] text-zinc-300">
                Map · <span className="text-white">{listings.length}</span> listing{listings.length === 1 ? "" : "s"}
                <span className="hidden sm:inline"> · your filters apply</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:border-lime hover:text-lime"
            >
              <Minimize2 size={14} /> Exit <kbd className="hidden rounded border border-white/20 px-1 font-mono text-[10px] text-zinc-400 sm:inline">Esc</kbd>
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* side panel (desktop) */}
            <aside className="hidden w-[380px] shrink-0 flex-col border-r border-zinc-200 lg:flex">
              <AnimatePresence mode="wait">
                {selected && (
                  <motion.div
                    key={selected.listing_id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="border-b border-zinc-200 p-4"
                  >
                    {selected.photo_url && (
                      <Image
                        src={`${selected.photo_url}?auto=format&fit=crop&w=720&h=400&q=70`}
                        alt={selected.asset_name}
                        width={348}
                        height={190}
                        unoptimized
                        className="aspect-[16/9] h-auto w-full rounded-xl object-cover"
                      />
                    )}
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-[16px] font-bold text-zinc-950">{selected.asset_name}</p>
                        <p className="truncate text-[12px] text-zinc-500">
                          {selected.district} · {kindOf(selected)} · {selected.agency.name}
                        </p>
                      </div>
                      <button type="button" onClick={() => onSelect("")} aria-label="Clear selection" className="grid size-7 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950">
                        <X size={14} />
                      </button>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <dt className="text-zinc-500">Asking</dt>
                        <dd className="mt-0.5 font-display text-[14px] font-bold tabular-nums text-zinc-950">{usdShort(selected.asking_price_usd)}</dd>
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <dt className="text-zinc-500">$ / ft²</dt>
                        <dd className="mt-0.5 font-display text-[14px] font-bold tabular-nums text-zinc-950">${selected.price_per_sqft_usd.toLocaleString("en-US")}</dd>
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <dt className="text-zinc-500">Confidence</dt>
                        <dd className="mt-0.5 font-display text-[14px] font-bold tabular-nums" style={{ color: BAND_COLOR[confidenceBand(selected.confidence_score)] }}>
                          {selected.confidence_score}%
                        </dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={() => onOpenDetails(selected.listing_id)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 py-2.5 text-[13px] font-semibold text-lime transition-colors hover:bg-zinc-800"
                    >
                      Open full details <ArrowUpRight size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div data-lenis-prevent className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
                {listings.map((l) => (
                  <Row key={l.listing_id} l={l} on={l.listing_id === selectedId} onPick={() => onSelect(l.listing_id)} onHover={onHover} />
                ))}
                {!listings.length && <p className="p-6 text-center text-[13px] text-zinc-500">No listings match your filters.</p>}
              </div>
            </aside>

            {/* map */}
            <div className="relative min-w-0 flex-1">
              <ArubaMap mode="listings" listings={listings} selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} fill />

              {/* phones / tablets: selected listing card */}
              <AnimatePresence>
                {selected && (
                  <motion.div
                    key={selected.listing_id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-x-3 bottom-3 z-[3] rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl lg:hidden"
                  >
                    <Row l={selected} on={false} onPick={() => onOpenDetails(selected.listing_id)} onHover={() => {}} />
                    <button
                      type="button"
                      onClick={() => onOpenDetails(selected.listing_id)}
                      className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 py-2.5 text-[13px] font-semibold text-lime"
                    >
                      Open full details <ArrowUpRight size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
