"use client";

/*
 * Pieces for grouped listings (lib/market-api.ts):
 *   GroupTags       "5 units" / "3 agencies" chips on a row or card
 *   AgencyOffers    one home listed by several agencies: each agency's own price and link
 *   ProjectUnits    every unit of a building project, each opening its full details
 *   GroupDetails    what a row or a pin opens to (loads the group on demand)
 *   ProjectPopup    the glass window over the map for a project pin
 */

import { motion } from "framer-motion";
import { ArrowUpRight, Building2, ChevronDown, ExternalLink, Layers, X } from "lucide-react";
import { useState } from "react";
import { ListingPhoto } from "@/components/listing-photo";
import { isClosed, type Listing } from "@/lib/aruba-data";
import type { OfferRow } from "@/lib/database.types";
import { useGroupDetail, type GroupDetail, type MarketGroup } from "@/lib/market-api";
import { shortSize } from "@/lib/units";
import { ListingPopup } from "./listing-popup";
import { AgencyLogo, SIGNAL_COLOR, STATUS_PILL, priceShort } from "./map-shared";

const EASE = [0.22, 1, 0.36, 1] as const;
const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Aruba" });

/* ── chips ──────────────────────────────────────────────────────────── */

export function GroupTags({ g, dark = false }: { g: Pick<MarketGroup, "type" | "units" | "agencyIds">; dark?: boolean }) {
  const chip = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${dark ? "bg-white/10 text-lime" : "bg-zinc-950 text-lime"}`;
  return (
    <>
      {g.type === "project" && (
        <span className={chip} title="Units of one building or development, from every agency">
          <Building2 size={11} strokeWidth={2} /> {g.units} unit{g.units === 1 ? "" : "s"}
        </span>
      )}
      {g.agencyIds.length > 1 && (
        <span className={chip} title="Listed by more than one agency">
          <Layers size={11} strokeWidth={2} /> {g.agencyIds.length} agencies
        </span>
      )}
    </>
  );
}

/** "From $1.40M" for a project with several prices, else the one price. */
export const groupPrice = (g: Pick<MarketGroup, "type" | "units" | "minPrice" | "maxPrice">) =>
  g.type === "project" && g.units > 1 && g.maxPrice > g.minPrice ? `From ${priceShort(g.minPrice)}` : priceShort(g.minPrice);

/* ── several agencies, one home ─────────────────────────────────────── */

export function AgencyOffers({ offers, title = "Listed by" }: { offers: OfferRow[]; title?: string }) {
  const priced = offers.filter((o) => o.price_usd);
  if (!offers.length) return null;
  const low = priced.length ? Math.min(...priced.map((o) => Number(o.price_usd))) : 0;
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
      <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        <Layers size={13} /> {title} {offers.length > 1 ? `${offers.length} agencies` : "one agency"}
      </h4>
      {offers.length > 1 && (
        <p className="mt-1 text-[12px] text-zinc-600">
          The same home on several agency sites. Prices can differ; each agency&apos;s own page is the source.
        </p>
      )}
      <ul className="mt-3 divide-y divide-zinc-100">
        {offers.map((o) => {
          const p = o.price_usd ? Number(o.price_usd) : null;
          const lowest = p !== null && p === low && priced.length > 1;
          const above = p !== null && low ? ((p - low) / low) * 100 : 0;
          return (
            <li key={o.agency_id} className="flex items-center gap-3 py-2.5">
              <AgencyLogo agency={{ id: o.agency_id, name: o.agency, website: o.website, logo_url: o.logo_url, color: "#0A0A0A" }} size={28} rounded={6} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-zinc-950">{o.agency}</p>
                <p className="text-[11px] text-zinc-500">{o.last_seen ? `Seen on their site ${fmtDay(o.last_seen)}` : "On their site"}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-semibold tabular-nums text-zinc-950">{p !== null ? fmt(p) : "—"}</p>
                <p className="text-[11px] tabular-nums">
                  {lowest ? (
                    <span className="font-semibold text-[#2E9E5B]">Lowest</span>
                  ) : above > 0.05 ? (
                    <span className="text-zinc-500">+{above.toFixed(1)}%</span>
                  ) : priced.length > 1 ? (
                    <span className="text-zinc-500">Same price</span>
                  ) : null}
                </p>
              </div>
              {o.source_url && (
                <a
                  href={o.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-800 transition-colors hover:border-zinc-950"
                  aria-label={`Open on ${o.agency}'s site`}
                >
                  View <ExternalLink size={11} />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── a project's units ──────────────────────────────────────────────── */

export function ProjectUnits({ detail, renderDetails }: { detail: GroupDetail; renderDetails: (l: Listing) => React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const units = detail.units.filter((u): u is typeof u & { l: Listing } => Boolean(u.l));
  const forSale = units.filter((u) => !isClosed(u.l) && u.l.status === "For sale");
  const prices = forSale.map((u) => u.l.asking_price_usd);
  const agencies = new Map<string, OfferRow>();
  for (const u of units) for (const o of u.offers) agencies.set(o.agency_id, o);
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Project</p>
        <p className="mt-1 font-display text-[18px] font-bold text-zinc-950">{detail.project?.name ?? units[0]?.l.asset_name}</p>
        <p className="mt-1 text-[12.5px] text-zinc-600">
          {units.length} unit{units.length === 1 ? "" : "s"} on Baseline
          {forSale.length ? ` · ${forSale.length} for sale` : ""}
          {prices.length ? ` · ${prices.length > 1 ? `${priceShort(Math.min(...prices))} – ${priceShort(Math.max(...prices))}` : priceShort(prices[0])}` : ""}
          {detail.project?.district ? ` · ${detail.project.district}` : ""}
        </p>
        {agencies.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-zinc-500">Agencies:</span>
            {[...agencies.values()].map((o) => (
              <span key={o.agency_id} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 py-0.5 pl-0.5 pr-2 text-[11.5px] text-zinc-800">
                <AgencyLogo agency={{ id: o.agency_id, name: o.agency, website: o.website, logo_url: o.logo_url, color: "#0A0A0A" }} size={18} rounded={9} />
                {o.agency}
              </span>
            ))}
          </div>
        )}
      </div>
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {units.map(({ ref, l, offers }) => {
          const on = open === ref;
          return (
            <li key={ref}>
              <button
                type="button"
                onClick={() => setOpen(on ? null : ref)}
                aria-expanded={on}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-mint-soft ${on ? "bg-mint-soft" : ""}`}
              >
                {l.photo_url ? (
                  <ListingPhoto src={l.photo_url} alt="" w={56} h={40} className="h-10 w-14 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="h-10 w-14 shrink-0 rounded-md bg-zinc-100" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-950">{l.asset_name}</span>
                  <span className="block truncate text-[11.5px] text-zinc-500">
                    {l.category === "Property" ? `${l.bedrooms} bd · ${l.bathrooms} ba · ` : ""}
                    {shortSize(l)} · {offers.length > 1 ? `${offers.length} agencies` : l.agency.name}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-semibold tabular-nums text-zinc-950">{priceShort(l.asking_price_usd)}</span>
                  <span
                    className="mt-0.5 inline-block rounded-full px-1.5 text-[10px] font-semibold"
                    style={l.status === "For sale" ? { color: SIGNAL_COLOR[l.signal] } : { color: STATUS_PILL[l.status].color, background: STATUS_PILL[l.status].bg }}
                  >
                    {l.status === "For sale" ? "For sale" : l.status}
                  </span>
                </span>
                <ChevronDown size={14} className={`shrink-0 text-zinc-400 transition-transform ${on ? "rotate-180" : ""}`} />
              </button>
              {on && (
                <div className="space-y-3 border-t border-zinc-200 bg-mint-soft px-3 pb-4 pt-2">
                  {offers.length > 1 && <AgencyOffers offers={offers} />}
                  {renderDetails(l)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── what a row or a pin opens to ───────────────────────────────────── */

/**
 * The full view of one group. A project lists its units; a home shows its
 * details and, when several agencies list it, their prices side by side.
 * `fallback` is the listing already on screen, shown while the group loads.
 */
export function GroupDetails({
  groupKey,
  fallback,
  members,
  renderDetails,
}: {
  groupKey: string;
  fallback: Listing | null;
  members: Map<string, Listing>;
  renderDetails: (l: Listing) => React.ReactNode;
}) {
  const { detail, loading, error } = useGroupDetail(groupKey, members);
  if (error) return <p className="py-4 text-[12.5px] text-[#D64545]">Could not load this listing: {error}</p>;
  if (!detail) {
    return fallback && !groupKey.startsWith("p:") ? (
      <>{renderDetails(fallback)}</>
    ) : (
      <div className="space-y-2 py-3" aria-busy={loading}>
        <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
      </div>
    );
  }
  if (detail.type === "project") return <ProjectUnits detail={detail} renderDetails={renderDetails} />;
  const unit = detail.units[0];
  const l = unit?.l ?? fallback;
  if (!l) return <p className="py-4 text-[12.5px] text-zinc-500">This listing is no longer on the market.</p>;
  return (
    <div className="space-y-3">
      {unit && unit.offers.length > 1 && <AgencyOffers offers={unit.offers} />}
      {renderDetails(l)}
    </div>
  );
}

/** "Also listed by RE/MAX ($1,999,999)": the line under a co-listed home's popup. */
export function OffersNote({ groupKey, members }: { groupKey: string; members: Map<string, Listing> }) {
  const { detail } = useGroupDetail(groupKey, members);
  const offers = detail?.units[0]?.offers ?? [];
  if (offers.length < 2) return null;
  const priced = offers.filter((o) => o.price_usd).map((o) => Number(o.price_usd));
  const spread = priced.length > 1 ? Math.max(...priced) - Math.min(...priced) : 0;
  return (
    <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-zinc-950 px-2.5 py-1.5 text-[11.5px] text-white">
      <Layers size={12} className="shrink-0 text-lime" />
      Listed by {offers.length} agencies
      {spread > 0 ? ` · prices differ by ${fmt(spread)}` : " · same price"}
    </p>
  );
}

/* ── a project pin's window over the map ────────────────────────────── */

export function ProjectPopup({
  groupKey,
  members,
  onClose,
  onDetails,
  className = "",
}: {
  groupKey: string;
  members: Map<string, Listing>;
  onClose: () => void;
  onDetails: () => void;
  className?: string;
}) {
  const { detail } = useGroupDetail(groupKey, members);
  const units = (detail?.units ?? []).map((u) => u.l).filter((l): l is Listing => Boolean(l));
  const forSale = units.filter((l) => l.status === "For sale");
  const prices = forSale.map((l) => l.asking_price_usd);
  const photo = units.find((l) => l.photo_url)?.photo_url ?? null;
  const agencies = new Set((detail?.units ?? []).flatMap((u) => u.offers.map((o) => o.agency_id)));
  return (
    <motion.div
      role="dialog"
      aria-label={detail?.project?.name ?? "Project"}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.32, ease: EASE }}
      className={`glass z-[6] overflow-hidden rounded-2xl bg-white! p-2 ${className}`}
    >
      <div className="relative">
        {photo ? (
          <ListingPhoto src={photo} alt="" w={360} h={160} className="aspect-[9/4] h-auto w-full rounded-xl object-cover" />
        ) : (
          <div className="aspect-[9/4] w-full rounded-xl bg-zinc-200" />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="glass absolute right-2 top-2 grid size-8 place-items-center rounded-full text-zinc-900 transition-transform hover:scale-105"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-2.5 py-1 text-[11.5px] font-semibold text-lime">
          <Building2 size={12} /> Project
        </span>
      </div>
      <div className="px-2 pb-1 pt-3">
        <p className="font-display text-[16px] text-zinc-950">{detail?.project?.name ?? "Loading…"}</p>
        <p className="text-[12px] text-zinc-600">
          {detail ? `${units.length} unit${units.length === 1 ? "" : "s"} · ${agencies.size} agenc${agencies.size === 1 ? "y" : "ies"}${detail.project?.district ? ` · ${detail.project.district}` : ""}` : " "}
        </p>
        {prices.length > 0 && (
          <p className="mt-2 font-display text-[18px] font-bold tabular-nums text-zinc-950">
            {prices.length > 1 ? `From ${priceShort(Math.min(...prices))}` : priceShort(prices[0])}
            <span className="ml-1.5 text-[12px] font-normal text-zinc-500">{forSale.length} for sale</span>
          </p>
        )}
        <ul data-lenis-prevent className="mt-2 max-h-[160px] space-y-0.5 overflow-y-auto overscroll-contain">
          {units.slice(0, 12).map((l) => (
            <li key={l.listing_id} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[12px]">
              <span className="min-w-0 truncate text-zinc-800">{l.asset_name}</span>
              <span className="shrink-0 tabular-nums font-semibold text-zinc-950">{priceShort(l.asking_price_usd)}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onDetails}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 py-2.5 text-[13px] font-semibold text-lime transition-colors hover:bg-zinc-800"
        >
          Every unit and agency <ArrowUpRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}

/* ── the window over the map for any pin ────────────────────────────── */

/** A project pin opens ProjectPopup; a home opens the listing card, noting other agencies. */
export function GroupPopup(props: {
  groupKey: string;
  fallback: Listing | null;
  members: Map<string, Listing>;
  onClose: () => void;
  onDetails: () => void;
  className?: string;
}) {
  return props.groupKey.startsWith("p:") ? <ProjectPopup {...props} /> : <HomePopup {...props} />;
}

function HomePopup({
  groupKey,
  fallback,
  members,
  onClose,
  onDetails,
  className,
}: {
  groupKey: string;
  fallback: Listing | null;
  members: Map<string, Listing>;
  onClose: () => void;
  onDetails: () => void;
  className?: string;
}) {
  const { detail } = useGroupDetail(groupKey, members);
  const l = detail?.units[0]?.l ?? fallback;
  if (!l) return null;
  return <ListingPopup l={l} onClose={onClose} onDetails={onDetails} className={className} note={<OffersNote groupKey={groupKey} members={members} />} />;
}
