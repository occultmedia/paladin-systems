"use client";

/*
 * Full-screen mode of the Terminal: the map fills the screen, with a panel
 * for Listings (your current filters), your Watchlist and Deals. Members land
 * here after logging in. Hovering a listing highlights its pin; clicking a
 * listing or pin flies the map in (3D) and shows its card. "Exit" returns to
 * the normal view on the matching tab (Listings, Watchlist or Deals). Esc
 * exits too. On phones a bottom bar switches between Map and the panels.
 */

import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  LayoutList,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  Minimize2,
  Pin,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/logo";
import { KIND_STYLE, fmtPrice, timeAgo } from "@/components/feed/feed-view";
import { BAND_COLOR, confidenceBand } from "@/lib/confidence";
import type { Listing } from "@/lib/aruba-data";
import { useFeed } from "@/lib/feed";
import { useWatchlist } from "@/lib/watchlist";
import { AgencyLogo, SIGNAL_COLOR, SIGNAL_LABEL } from "./map-shared";

const ArubaMap = dynamic(() => import("./aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

const noopSubscribe = () => () => {};

export type FullPanel = "Listings" | "Watchlist" | "Deals";
const PANELS: Array<{ id: FullPanel; icon: typeof Pin }> = [
  { id: "Listings", icon: LayoutList },
  { id: "Watchlist", icon: Pin },
  { id: "Deals", icon: Megaphone },
];

const EASE = [0.22, 1, 0.36, 1] as const;
const usdShort = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`;
const kindOf = (l: Listing) =>
  l.category === "Property"
    ? `${l.property_type} · ${l.bedrooms} bd`
    : l.category === "Land"
      ? `Land · ${l.zoning}`
      : `Commercial · ${l.commercial_use}`;
const digits = (s: string) => s.replace(/[^\d]/g, "");

/* ── rows ────────────────────────────────────────────────────────────── */

function Row({
  l,
  on,
  onPick,
  onHover,
  extra,
}: {
  l: Listing;
  on: boolean;
  onPick: () => void;
  onHover: (id: string | null) => void;
  extra?: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (on)
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
          <Image
            src={`${l.photo_url}?auto=format&fit=crop&w=128&h=96&q=60`}
            alt=""
            width={64}
            height={48}
            unoptimized
            className="h-12 w-16 rounded-lg object-cover"
          />
        ) : (
          <span className="block h-12 w-16 rounded-lg bg-zinc-200" />
        )}
        <span className="absolute -bottom-1 -right-1 rounded-[5px] ring-2 ring-white">
          <AgencyLogo agency={l.agency} size={18} rounded={4} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">
          {l.asset_name}
        </span>
        <span
          className={`block truncate text-[11.5px] ${on ? "text-zinc-400" : "text-zinc-500"}`}
        >
          {l.district} · {kindOf(l)}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[11px]">
          <span
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: on ? undefined : SIGNAL_COLOR[l.signal] }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: SIGNAL_COLOR[l.signal] }}
            />
            {SIGNAL_LABEL[l.signal]}
          </span>
          {extra ?? (
            <span
              className="tabular-nums"
              style={{ color: on ? "#ACFA68" : BAND_COLOR[band] }}
            >
              {l.confidence_score}% conf.
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-right font-display text-[14px] font-bold tabular-nums">
        {usdShort(l.asking_price_usd)}
      </span>
    </button>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="m-2 rounded-xl border border-dashed border-zinc-300 px-5 py-10 text-center">
      <p className="font-display text-[15px] font-bold text-zinc-950">
        {title}
      </p>
      <p className="mt-1 text-[12.5px] text-zinc-500">{text}</p>
    </div>
  );
}

/* ── panels ──────────────────────────────────────────────────────────── */

function WatchPanel({
  all,
  selectedId,
  onSelect,
  onHover,
}: {
  all: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const { entries } = useWatchlist();
  const rows = useMemo(() => {
    const byId = new Map(all.map((l) => [l.listing_id, l]));
    return entries
      .map((e) => ({ e, l: byId.get(e.id) }))
      .filter((x): x is { e: (typeof entries)[number]; l: Listing } =>
        Boolean(x.l),
      );
  }, [entries, all]);
  if (!rows.length)
    return (
      <Empty
        title="Nothing pinned yet"
        text="Pin a listing from its card on the map or in the table to follow every price change."
      />
    );
  return (
    <>
      {rows.map(({ e, l }) => {
        const since =
          ((l.asking_price_usd - e.price_at_pin) / e.price_at_pin) * 100;
        return (
          <Row
            key={l.listing_id}
            l={l}
            on={l.listing_id === selectedId}
            onPick={() => onSelect(l.listing_id)}
            onHover={onHover}
            extra={
              <span
                className="tabular-nums"
                style={{
                  color:
                    since < 0 ? "#D64545" : since > 0 ? "#1F7A45" : undefined,
                }}
              >
                {since === 0
                  ? "No change since pinned"
                  : `${since > 0 ? "+" : "−"}${Math.abs(since).toFixed(1)}% since pinned`}
              </span>
            }
          />
        );
      })}
    </>
  );
}

function DealsPanel({ onOpenDeals }: { onOpenDeals: () => void }) {
  const { posts, loading } = useFeed(null);
  if (loading)
    return <div className="m-2 h-40 animate-pulse rounded-xl bg-zinc-100" />;
  if (!posts.length)
    return (
      <Empty
        title="No deals in the last 48 hours"
        text="Be the first to post one."
      />
    );
  return (
    <>
      {posts.map((p) => {
        const wa =
          !p.sample && p.author.whatsapp
            ? `https://wa.me/${digits(p.author.whatsapp)}?text=${encodeURIComponent(`Hi ${p.author.name.split(" ")[0]}, I saw your post on Terminal: "${p.title}".`)}`
            : null;
        return (
          <article
            key={p.id}
            className="rounded-xl border border-zinc-200 bg-white p-3"
          >
            <p className="flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_STYLE[p.kind]}`}
              >
                {p.kind}
              </span>
              <span className="text-[10.5px] tabular-nums text-zinc-400">
                {timeAgo(p.created_at)}
              </span>
            </p>
            <p className="mt-2 text-[13px] font-semibold leading-snug text-zinc-950">
              {p.title}
            </p>
            <p className="mt-1 truncate text-[11.5px] text-zinc-500">
              {p.author.name}
              {p.author.company && ` · ${p.author.company}`}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-[12px]">
              <span className="text-zinc-600">
                {p.price_usd !== null && p.kind !== "Update" && (
                  <b className="font-display text-zinc-950">
                    {fmtPrice(p.price_usd, p.kind)}
                  </b>
                )}
                {p.district && <span className="ml-1.5">{p.district}</span>}
              </span>
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-lime"
                >
                  <MessageCircle size={12} /> WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onOpenDeals}
                  className="text-[11.5px] font-semibold text-zinc-950 underline-offset-2 hover:underline"
                >
                  Open
                </button>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}

function PanelTabs({
  value,
  onChange,
  dark = false,
}: {
  value: FullPanel;
  onChange: (p: FullPanel) => void;
  dark?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-3 gap-1 rounded-full p-1 ${dark ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-zinc-100"}`}
      role="tablist"
    >
      {PANELS.map(({ id, icon: Icon }) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(id)}
            className={`relative inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[12.5px] font-semibold transition-colors ${on ? "text-zinc-950" : dark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-950"}`}
          >
            {on && (
              <motion.span
                layoutId={dark ? "fs-tab-dark" : "fs-tab"}
                className="absolute inset-0 rounded-full bg-lime"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon size={13} strokeWidth={1.9} />
              {id}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── the mode ────────────────────────────────────────────────────────── */

export function MapFullscreen({
  open,
  listings,
  allListings,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onExit,
  onOpenDetails,
}: {
  open: boolean;
  listings: Listing[];
  allListings: Listing[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** Leave full screen, landing on the normal view of this tab. */
  onExit: (tab: FullPanel) => void;
  onOpenDetails: (id: string) => void;
}) {
  const [panel, setPanel] = useState<FullPanel>("Listings");
  const [mobileView, setMobileView] = useState<"Map" | FullPanel>("Map");
  const { isPinned, toggle } = useWatchlist();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit(panel);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onExit, panel]);

  // Portals only exist in the browser; wait until after hydration (the page can open in full screen).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const selected = allListings.find((l) => l.listing_id === selectedId) ?? null;
  const pick = (id: string) => {
    onSelect(id);
    setMobileView("Map");
  };
  if (!mounted) return null;

  const list = (p: FullPanel) =>
    p === "Listings" ? (
      listings.length ? (
        listings.map((l) => (
          <Row
            key={l.listing_id}
            l={l}
            on={l.listing_id === selectedId}
            onPick={() => pick(l.listing_id)}
            onHover={onHover}
          />
        ))
      ) : (
        <Empty
          title="No listings match"
          text="Exit and loosen your filters to see more."
        />
      )
    ) : p === "Watchlist" ? (
      <WatchPanel
        all={allListings}
        selectedId={selectedId}
        onSelect={pick}
        onHover={onHover}
      />
    ) : (
      <DealsPanel onOpenDeals={() => onExit("Deals")} />
    );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Terminal, full-screen mode"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-[1300] flex flex-col bg-white"
        >
          {/* top bar */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-zinc-950 px-4 text-white sm:px-5">
            <div className="flex min-w-0 items-center gap-4">
              <Wordmark tone="white" />
              <p className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 md:flex">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-lime" />
                </span>
                Full screen ·{" "}
                <span className="text-white">{listings.length}</span> on the map
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExit(panel)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:border-lime hover:text-lime"
            >
              <Minimize2 size={14} />
              <span className="hidden sm:inline">Exit to normal view</span>
              <span className="sm:hidden">Exit</span>
              <kbd className="hidden rounded border border-white/20 px-1 font-mono text-[10px] text-zinc-400 sm:inline">
                Esc
              </kbd>
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1">
            {/* side panel (desktop) */}
            <aside className="hidden w-[390px] shrink-0 flex-col border-r border-zinc-200 lg:flex">
              <div className="border-b border-zinc-200 p-3">
                <PanelTabs value={panel} onChange={setPanel} />
              </div>
              <AnimatePresence mode="wait">
                {selected && panel !== "Deals" && (
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
                        width={358}
                        height={180}
                        unoptimized
                        className="aspect-[2/1] h-auto w-full rounded-xl object-cover"
                      />
                    )}
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-[16px] font-bold text-zinc-950">
                          {selected.asset_name}
                        </p>
                        <p className="truncate text-[12px] text-zinc-500">
                          {selected.district} · {kindOf(selected)} ·{" "}
                          {selected.agency.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelect("")}
                        aria-label="Clear selection"
                        className="grid size-7 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <dt className="text-zinc-500">Asking</dt>
                        <dd className="mt-0.5 font-display text-[14px] font-bold tabular-nums text-zinc-950">
                          {usdShort(selected.asking_price_usd)}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <dt className="text-zinc-500">$ / ft²</dt>
                        <dd className="mt-0.5 font-display text-[14px] font-bold tabular-nums text-zinc-950">
                          ${selected.price_per_sqft_usd.toLocaleString("en-US")}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <dt className="text-zinc-500">Confidence</dt>
                        <dd
                          className="mt-0.5 font-display text-[14px] font-bold tabular-nums"
                          style={{
                            color:
                              BAND_COLOR[
                                confidenceBand(selected.confidence_score)
                              ],
                          }}
                        >
                          {selected.confidence_score}%
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenDetails(selected.listing_id)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-zinc-950 py-2.5 text-[13px] font-semibold text-lime transition-colors hover:bg-zinc-800"
                      >
                        Full details <ArrowUpRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggle(selected.listing_id, selected.asking_price_usd)
                        }
                        aria-pressed={isPinned(selected.listing_id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-semibold transition-colors ${
                          isPinned(selected.listing_id)
                            ? "border-zinc-950 bg-lime text-zinc-950"
                            : "border-zinc-300 text-zinc-800 hover:border-zinc-950"
                        }`}
                      >
                        <Pin
                          size={13}
                          fill={
                            isPinned(selected.listing_id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                        {isPinned(selected.listing_id) ? "Pinned" : "Pin"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                data-lenis-prevent
                className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2"
              >
                {list(panel)}
              </div>
            </aside>

            {/* map */}
            <div className="relative min-w-0 flex-1">
              <ArubaMap
                mode="listings"
                listings={listings}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={pick}
                onHover={onHover}
                fill
              />

              {/* phones / tablets: selected listing card */}
              <AnimatePresence>
                {selected && mobileView === "Map" && (
                  <motion.div
                    key={selected.listing_id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-x-3 bottom-3 z-[3] rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl lg:hidden"
                  >
                    <Row
                      l={selected}
                      on={false}
                      onPick={() => onOpenDetails(selected.listing_id)}
                      onHover={() => {}}
                    />
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenDetails(selected.listing_id)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-950 py-2.5 text-[13px] font-semibold text-lime"
                      >
                        Full details <ArrowUpRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggle(selected.listing_id, selected.asking_price_usd)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-4 text-[12.5px] font-semibold ${isPinned(selected.listing_id) ? "border-zinc-950 bg-lime text-zinc-950" : "border-zinc-300 text-zinc-800"}`}
                      >
                        <Pin
                          size={13}
                          fill={
                            isPinned(selected.listing_id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                        {isPinned(selected.listing_id) ? "Pinned" : "Pin"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* phones / tablets: a panel over the map */}
            <AnimatePresence>
              {mobileView !== "Map" && (
                <motion.div
                  key={mobileView}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  data-lenis-prevent
                  className="absolute inset-0 z-[4] space-y-1 overflow-y-auto overscroll-contain bg-white p-2 lg:hidden"
                >
                  {list(mobileView)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* phones / tablets: bottom bar */}
          <nav
            className="grid shrink-0 grid-cols-4 gap-1 border-t border-zinc-200 bg-white p-2 lg:hidden"
            aria-label="Full-screen views"
          >
            {(
              [{ id: "Map", icon: MapIcon }, ...PANELS] as Array<{
                id: "Map" | FullPanel;
                icon: typeof Pin;
              }>
            ).map(({ id, icon: Icon }) => {
              const on = mobileView === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMobileView(id);
                    if (id !== "Map") setPanel(id);
                  }}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors ${on ? "bg-zinc-950 text-lime" : "text-zinc-500"}`}
                >
                  <Icon size={16} strokeWidth={1.9} />
                  {id}
                </button>
              );
            })}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
