"use client";

/*
 * A Baseline listing attached to a Market feed post: the picker in the New post form
 * and the card shown on the post. The card carries the listing's own data
 * (photo, price, AI Signal, price vs comps) and opens it in Baseline.
 */

import { ListingPhoto } from "@/components/listing-photo";
import { ArrowUpRight, Building2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { isClosed, isScored, type Listing } from "@/lib/aruba-data";
import { shortSize } from "@/lib/units";
import { useListingById, useMarketListings } from "@/lib/live-market";
import { HotFlame, SIGNAL_COLOR, SIGNAL_LABEL, STATUS_PILL } from "@/components/dashboard/map-shared";


const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const kindOf = (l: Listing) =>
  l.category === "Property" ? `${l.property_type} · ${l.bedrooms} bd` : l.category === "Land" ? `Land · ${l.zoning}` : `Commercial · ${l.commercial_use}`;
const vsComps = (l: Listing) => (l.category === "Property" ? l.price_vs_comps_pct : l.price_vs_district_pct);

function Thumb({ l, size = "md" }: { l: Listing; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-10 w-14" : "h-16 w-[88px]";
  return l.photo_url ? (
    <ListingPhoto src={l.photo_url} alt="" w={88} h={64} className={`${cls} shrink-0 rounded-lg object-cover`} />
  ) : (
    <span className={`${cls} grid shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-400`}>
      <Building2 size={16} />
    </span>
  );
}

/** The listing card on a post. */
export function AttachedListing({ id, onOpen, compact = false }: { id: string | null | undefined; onOpen?: (id: string) => void; compact?: boolean }) {
  const l = useListingById(id);
  if (!l) return null;
  const pct = vsComps(l);
  const body = (
    <>
      <Thumb l={l} size={compact ? "sm" : "md"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          Listing on Baseline · {l.listing_id}
        </span>
        <span className="mt-0.5 block truncate text-[13.5px] font-semibold text-zinc-950">{l.asset_name}</span>
        <span className="block truncate text-[11.5px] text-zinc-500">
          {l.district} · {kindOf(l)} · {shortSize(l)}
        </span>
        {!compact && isClosed(l) && (
          <span className="mt-1 inline-block rounded-full px-2 py-px text-[11px] font-semibold" style={{ color: STATUS_PILL[l.status].color, background: STATUS_PILL[l.status].bg }}>
            {l.status}
          </span>
        )}
        {!compact && !isClosed(l) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px]">
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: SIGNAL_COLOR[l.signal] }}>
              <span className="size-1.5 rounded-full" style={{ background: SIGNAL_COLOR[l.signal] }} />
              {SIGNAL_LABEL[l.signal]}
              {l.signal === "UNDERVALUED" && <HotFlame size={12} />}
            </span>
            {isScored(l) && (
              <span className="tabular-nums text-zinc-500">
                {pct > 0 ? "+" : ""}
                {pct.toFixed(0)}% vs similar homes
              </span>
            )}
            <span className="tabular-nums text-zinc-500">{l.confidence_score}% confidence</span>
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-display text-[15px] font-bold tabular-nums text-zinc-950">{usdShort(l.asking_price_usd)}</span>
        {onOpen && (
          <span className="mt-1 inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-zinc-950 group-hover:underline">
            Open <ArrowUpRight size={12} />
          </span>
        )}
      </span>
    </>
  );
  const cls = "group mt-3 flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-left transition-colors";
  return onOpen ? (
    <button type="button" onClick={() => onOpen(l.listing_id)} className={`${cls} hover:border-zinc-950 hover:bg-white`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Search-and-pick field for the New post form. */
export function ListingPicker({ value, onChange }: { value: string | null; onChange: (l: Listing | null) => void }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const picked = useListingById(value);
  const all = useMarketListings();
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all.slice(0, 6);
    return all.filter((l) => `${l.asset_name} ${l.listing_id} ${l.district} ${l.agency.name}`.toLowerCase().includes(t)).slice(0, 6);
  }, [q, all]);

  if (picked)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-zinc-950 bg-white p-2.5">
        <Thumb l={picked} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-zinc-950">{picked.asset_name}</p>
          <p className="truncate text-[11.5px] text-zinc-500">
            {picked.listing_id} · {picked.district} · {usdShort(picked.asking_price_usd)}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label="Remove listing" className="grid size-7 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950">
          <X size={14} />
        </button>
      </div>
    );

  return (
    <div className="relative">
      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <span className="sr-only">Find a listing to attach</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder="Search by name, ID, area or agency"
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-[14px] text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-950"
        />
      </label>
      {focused && (
        <ul data-lenis-prevent className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
          {matches.length ? (
            matches.map((l) => (
              <li key={l.listing_id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(l);
                    setQ("");
                    setFocused(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-zinc-50"
                >
                  <Thumb l={l} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-zinc-950">{l.asset_name}</span>
                    <span className="block truncate text-[11.5px] text-zinc-500">
                      {l.listing_id} · {l.district} · {kindOf(l)}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-[13px] font-bold tabular-nums text-zinc-950">{usdShort(l.asking_price_usd)}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-4 text-center text-[12.5px] text-zinc-500">No listing matches. Off-market? Just describe it below.</li>
          )}
        </ul>
      )}
    </div>
  );
}
