"use client";

/*
 * Glass window that opens over the map when a listing is picked (from the
 * side list or a pin): photo, key numbers, Full details and Pin. Closes with
 * the X. Shared by the normal view and Dashboard view (full screen). Also the
 * Dashboard view / Normal view switch.
 */

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight, Pin, X } from "lucide-react";
import { BAND_COLOR, confidenceBand } from "@/lib/confidence";
import type { Listing } from "@/lib/aruba-data";
import { useWatchlist } from "@/lib/watchlist";
import { AgencyLogo, HotFlame, SIGNAL_COLOR, SIGNAL_LABEL } from "./map-shared";

export const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
export const kindOf = (l: Listing) =>
  l.category === "Property" ? `${l.property_type} · ${l.bedrooms} bd` : l.category === "Land" ? `Land · ${l.zoning}` : `Commercial · ${l.commercial_use}`;

const EASE = [0.22, 1, 0.36, 1] as const;

export function ListingPopup({
  l,
  onClose,
  onDetails,
  className = "",
}: {
  l: Listing;
  onClose: () => void;
  onDetails: () => void;
  className?: string;
}) {
  const { isPinned, toggle } = useWatchlist();
  const pinned = isPinned(l.listing_id);
  const conf = BAND_COLOR[confidenceBand(l.confidence_score)];
  const stats: Array<[string, string, string | undefined]> = [
    ["Asking", usdShort(l.asking_price_usd), undefined],
    ["$ / ft²", `$${l.price_per_sqft_usd.toLocaleString("en-US")}`, undefined],
    ["Confidence", `${l.confidence_score}%`, conf],
  ];
  return (
    <motion.div
      key={l.listing_id}
      role="dialog"
      aria-label={l.asset_name}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.32, ease: EASE }}
      className={`glass z-[6] overflow-hidden rounded-2xl p-2 ${className}`}
    >
      <div className="relative">
        {l.photo_url ? (
          <Image
            src={`${l.photo_url}?auto=format&fit=crop&w=720&h=360&q=70`}
            alt={l.asset_name}
            width={360}
            height={180}
            unoptimized
            className="aspect-[2/1] h-auto w-full rounded-xl object-cover"
          />
        ) : (
          <div className="aspect-[2/1] w-full rounded-xl bg-zinc-200" />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="glass absolute right-2 top-2 grid size-8 place-items-center rounded-full text-zinc-900 transition-transform hover:scale-105"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
        <span className="glass absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ color: SIGNAL_COLOR[l.signal] }}>
          <span className="size-1.5 rounded-full" style={{ background: SIGNAL_COLOR[l.signal] }} />
          {SIGNAL_LABEL[l.signal]}
          {l.signal === "UNDERVALUED" && <HotFlame size={13} />}
        </span>
      </div>

      <div className="px-2 pb-1 pt-3">
        <div className="flex items-start gap-2.5">
          <AgencyLogo agency={l.agency} size={30} rounded={7} />
          <div className="min-w-0">
            <p className="truncate font-display text-[16px] text-zinc-950">{l.asset_name}</p>
            <p className="truncate text-[12px] text-zinc-600">
              {l.district} · {kindOf(l)} · {l.agency.name}
            </p>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
          {stats.map(([k, v, c]) => (
            <div key={k} className="rounded-lg border border-white/70 bg-white/55 p-2">
              <dt className="text-zinc-500">{k}</dt>
              <dd className="mt-0.5 font-display text-[14px] tabular-nums text-zinc-950" style={c ? { color: c } : undefined}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onDetails}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-zinc-950 py-2.5 text-[13px] font-semibold text-lime transition-colors hover:bg-zinc-800"
          >
            Full details <ArrowUpRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => toggle(l.listing_id, l.asking_price_usd)}
            aria-pressed={pinned}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-semibold transition-colors ${
              pinned ? "border-zinc-950 bg-lime text-zinc-950" : "border-white/80 bg-white/60 text-zinc-800 hover:border-zinc-950"
            }`}
          >
            <Pin size={13} fill={pinned ? "currentColor" : "none"} />
            {pinned ? "Pinned" : "Pin"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export type TerminalView = "dashboard" | "normal";

/** Dashboard view (full screen) ↔ Normal view switch. */
export function ViewToggle({
  value,
  onChange,
  tone = "light",
  className = "",
}: {
  value: TerminalView;
  onChange: (v: TerminalView) => void;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  const options: Array<[TerminalView, string, string]> = [
    ["dashboard", "Dashboard view", "Dashboard"],
    ["normal", "Normal view", "Normal"],
  ];
  return (
    <div role="group" aria-label="View" className={`${dark ? "glass-dark" : "glass"} inline-flex rounded-full p-1 ${className}`}>
      {options.map(([id, label, short]) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => !on && onChange(id)}
            className={`relative whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors sm:px-3.5 ${
              on ? (dark ? "text-zinc-950" : "text-lime") : dark ? "text-white/75 hover:text-white" : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            {on && <span className={`absolute inset-0 rounded-full ${dark ? "bg-lime" : "bg-zinc-950"}`} />}
            <span className="relative hidden sm:inline">{label}</span>
            <span className="relative sm:hidden">{short}</span>
          </button>
        );
      })}
    </div>
  );
}
