"use client";

/*
 * Full-screen mode of Baseline: the map fills the screen, with a panel
 * for Listings (your current filters), your Watchlist and the Market feed. Members land
 * here after logging in. Hovering a listing highlights its pin; clicking a
 * listing or pin flies the map in (3D) and shows its card. "Exit" returns to
 * the normal view on the matching tab (Listings, Watchlist or Market feed). Esc
 * exits too. On phones a bottom bar switches between Map and the panels.
 */

import dynamic from "next/dynamic";
import { ListingPhoto } from "@/components/listing-photo";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutList, Map as MapIcon, Megaphone, Pin, Plus, Search, X } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { GrainField } from "@/components/landing/grain-field";
import { PostCard, SharedNotice } from "@/components/feed/feed-view";
import { BAND_COLOR, confidenceBand } from "@/lib/confidence";
import { STATUS_TAB, isClosed, type Listing, type ListingStatus } from "@/lib/aruba-data";
import { shortSize } from "@/lib/units";
import { DEAL_TTL_DAYS, POST_KINDS, useFeed, type PostKind } from "@/lib/feed";
import { useWatchlist } from "@/lib/watchlist";
import { HotFlame, AgencyLogo, SIGNAL_COLOR, SIGNAL_LABEL, STATUS_PILL } from "./map-shared";
import { ListingPopup, ViewToggle, kindOf, usdShort } from "./listing-popup";

const ArubaMap = dynamic(() => import("./aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

const noopSubscribe = () => () => {};

export type FullPanel = "Listings" | "Watchlist" | "Market feed";
const PANELS: Array<{ id: FullPanel; icon: typeof Pin }> = [
  { id: "Listings", icon: LayoutList },
  { id: "Watchlist", icon: Pin },
  { id: "Market feed", icon: Megaphone },
];

const EASE = [0.22, 1, 0.36, 1] as const;

/** Listings per page in the side panel. */
const PANEL_PAGE = 20;

export interface AgencyOption {
  key: string;
  name: string;
  count: number;
}

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
      className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${on ? "bg-zinc-950 text-white" : "hover:bg-white/70"}`}
    >
      <span className="relative shrink-0">
        {l.photo_url ? (
          <ListingPhoto
            src={l.photo_url}
            alt=""
            w={64}
            h={48}
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
        <span className={`block truncate text-[11.5px] tabular-nums ${on ? "text-zinc-300" : "text-zinc-700"}`}>{shortSize(l)}</span>
        <span className="mt-1 flex items-center gap-2 text-[11px]">
          {l.status !== "For sale" && (
            <span className="rounded-full px-1.5 py-px text-[10px] font-semibold" style={{ color: STATUS_PILL[l.status].color, background: STATUS_PILL[l.status].bg }}>
              {l.status}
            </span>
          )}
          {!isClosed(l) && (
            <span
              className="inline-flex items-center gap-1 font-semibold"
              style={{ color: on ? undefined : SIGNAL_COLOR[l.signal] }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: SIGNAL_COLOR[l.signal] }}
              />
              {SIGNAL_LABEL[l.signal]}
              {l.signal === "UNDERVALUED" && <HotFlame size={12} />}
            </span>
          )}
          {extra ?? (l.member ? (
            <span className={`rounded px-1.5 py-px text-[9.5px] font-semibold tracking-wide ${l.member.visibility === "private" ? "bg-zinc-200 text-zinc-700" : "bg-lime text-zinc-950"}`}>
              {l.member.visibility === "private" ? "ONLY ME" : "OFF-MARKET"}
            </span>
          ) : isClosed(l) ? (
            <span className={on ? "text-zinc-400" : "text-zinc-500"}>last asking</span>
          ) : (
            <span
              className="tabular-nums"
              style={{ color: on ? "#ACFA68" : BAND_COLOR[band] }}
            >
              {l.confidence_score}% conf.
            </span>
          ))}
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

/** Market feed in full-screen mode: no map, just the post cards. */
function FeedBoard({ onPick, onNewPost, tabs }: { onPick: (id: string) => void; onNewPost: () => void; tabs?: React.ReactNode }) {
  const { posts, remove, setInterest, responders, loading } = useFeed(null);
  const [kind, setKind] = useState<PostKind | "All">("All");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (kind === "All" || p.kind === kind) &&
        (!t || [p.title, p.body, p.district, p.blind ? null : p.author.name, p.blind ? null : p.author.company, p.listing_id].some((x) => x?.toLowerCase().includes(t))),
    );
  }, [posts, kind, q]);

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          {tabs && <div className="w-[360px] max-w-full">{tabs}</div>}
          <label className="relative min-w-[200px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <span className="sr-only">Search the Market feed</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search posts, areas, members or a listing ID"
              className="w-full rounded-full border border-zinc-300 bg-white py-2 pl-9 pr-4 text-[13px] outline-none placeholder:text-zinc-400 focus:border-zinc-950"
            />
          </label>
          <button
            type="button"
            onClick={onNewPost}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-[13px] font-semibold text-lime transition-colors hover:bg-zinc-800"
          >
            <Plus size={14} strokeWidth={2.2} /> New post
          </button>
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(["All", ...POST_KINDS] as const).map((k) => {
            const on = kind === k;
            const n = k === "All" ? posts.length : posts.filter((p) => p.kind === k).length;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  on ? "bg-zinc-950 text-lime" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950"
                }`}
              >
                {k}
                <span className="tabular-nums text-[11px] text-zinc-400">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div className="mx-auto mb-4 max-w-[1600px]">
          <SharedNotice light />
        </div>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-zinc-200/60" />
            ))}
          </div>
        ) : shown.length ? (
          <div className="mx-auto max-w-[1600px] columns-1 gap-4 md:columns-2 2xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {shown.map((p) => (
              <PostCard key={p.id} post={p} onOpenListing={onPick} onInterest={setInterest} loadResponders={responders} onDelete={(id) => void remove(id).catch((e) => window.alert(e instanceof Error ? e.message : "Could not delete."))} />
            ))}
          </div>
        ) : (
          <Empty title={posts.length ? "No posts match" : `Nothing posted in the last ${DEAL_TTL_DAYS} days`} text={posts.length ? "Try another type or search." : "Be the first to post one."} />
        )}
      </div>
    </div>
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
  renderDetails,
  onAddListing,
  agency,
  agencies,
  onAgency,
  status,
  statusCounts,
  onStatus,
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
  /** The full property details, shown in a glass window over the map. */
  renderDetails: (l: Listing) => React.ReactNode;
  /** Opens the Add listing form (agents adding a property by hand). */
  onAddListing?: () => void;
  /** Agency filter, shared with the normal view ("All" or an AgencyOption key). */
  agency: string;
  agencies: AgencyOption[];
  onAgency: (key: string) => void;
  /** Available / Under contract / Sold, shared with the normal view. */
  status: ListingStatus;
  statusCounts: Record<ListingStatus, number>;
  onStatus: (s: ListingStatus) => void;
}) {
  const [panel, setPanel] = useState<FullPanel>("Listings");
  const [mobileView, setMobileView] = useState<"Map" | FullPanel>("Map");
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Side panel pages: back to the first page when the filters change, and to
  // the page that holds a listing when it is picked on the map.
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState({ listings, selectedId });
  if (seen.listings !== listings || seen.selectedId !== selectedId) {
    const i = selectedId ? listings.findIndex((l) => l.listing_id === selectedId) : -1;
    if (i >= 0) setPage(Math.floor(i / PANEL_PAGE));
    else if (seen.listings !== listings) setPage(0);
    setSeen({ listings, selectedId });
  }
  const pageCount = Math.max(1, Math.ceil(listings.length / PANEL_PAGE));
  const pageIdx = Math.min(page, pageCount - 1);
  const pageRows = listings.slice(pageIdx * PANEL_PAGE, (pageIdx + 1) * PANEL_PAGE);
  const panelRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const turnTo = (p: number) => {
    setPage(p);
    panelRef.current?.scrollTo({ top: 0 });
    mobilePanelRef.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detailsOpen) setDetailsOpen(false);
      else onExit(panel);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onExit, panel, detailsOpen]);

  // Portals only exist in the browser; wait until after hydration (the page can open in full screen).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const selected = allListings.find((l) => l.listing_id === selectedId) ?? null;
  const showDetails = detailsOpen && selected !== null && panel !== "Market feed";
  const closeAll = () => {
    setDetailsOpen(false);
    onSelect("");
  };
  const pick = (id: string) => {
    onSelect(id);
    setMobileView("Map");
  };
  const openFromDeal = (id: string) => {
    setPanel("Listings");
    pick(id);
  };
  if (!mounted) return null;

  const statusTabs = (
    <div role="group" aria-label="Status" className="mb-2 flex gap-1">
      {(Object.keys(STATUS_TAB) as ListingStatus[])
        .filter((st) => st !== "De-listed" || status === st || statusCounts[st] > 0)
        .map((st) => (
          <button
            key={st}
            type="button"
            aria-pressed={status === st}
            onClick={() => onStatus(st)}
            className={`flex-auto whitespace-nowrap rounded-full border px-2 py-1.5 text-[12px] font-semibold transition-colors ${
              status === st ? "border-zinc-950 bg-zinc-950 text-lime" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-950 hover:text-zinc-950"
            }`}
          >
            {STATUS_TAB[st]} <span className={`tabular-nums ${status === st ? "text-lime/70" : "text-zinc-400"}`}>{statusCounts[st]}</span>
          </button>
        ))}
    </div>
  );
  const agencySelect = (
    <label className="block">
      <span className="sr-only">Agency</span>
      <select
        value={agency}
        onChange={(e) => onAgency(e.target.value)}
        className={`w-full rounded-full border px-3.5 py-2 text-[12.5px] font-semibold outline-none transition-colors focus:border-zinc-950 ${
          agency === "All" ? "border-zinc-300 bg-white text-zinc-700" : "border-zinc-950 bg-white text-zinc-950"
        }`}
      >
        <option value="All">All agencies</option>
        {agencies.map((a) => (
          <option key={a.key} value={a.key}>
            {a.name} ({a.count})
          </option>
        ))}
      </select>
    </label>
  );
  const pageBtn =
    "grid size-8 place-items-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-35";
  const pager = pageCount > 1 && (
    <nav aria-label="Listing pages" className="flex items-center justify-between gap-2 px-3 py-2">
      <p className="text-[12px] tabular-nums text-zinc-500">
        <span className="font-semibold text-zinc-950">
          {pageIdx * PANEL_PAGE + 1}–{Math.min(listings.length, (pageIdx + 1) * PANEL_PAGE)}
        </span>{" "}
        of {listings.length}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={pageIdx === 0} onClick={() => turnTo(pageIdx - 1)} className={pageBtn}>
          <ChevronLeft size={15} strokeWidth={2.2} />
        </button>
        <span className="text-[12px] font-semibold tabular-nums text-zinc-950">
          {pageIdx + 1} / {pageCount}
        </span>
        <button type="button" aria-label="Next page" disabled={pageIdx >= pageCount - 1} onClick={() => turnTo(pageIdx + 1)} className={pageBtn}>
          <ChevronRight size={15} strokeWidth={2.2} />
        </button>
      </div>
    </nav>
  );

  const list = (p: FullPanel) =>
    p === "Listings" ? (
      <>
      {onAddListing && (
        <button
          type="button"
          onClick={onAddListing}
          className="mb-1 flex w-full items-center gap-3 rounded-xl border border-dashed border-zinc-300 p-2.5 text-left transition-colors hover:border-zinc-950 hover:bg-white/70"
        >
          <span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-zinc-950 text-lime">
            <Plus size={16} strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-zinc-950">Add a listing</span>
            <span className="block text-[11.5px] text-zinc-500">Off-market or private. We check for duplicates.</span>
          </span>
        </button>
      )}
      {listings.length ? (
        pageRows.map((l) => (
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
          text="Try another tab, or exit and loosen your filters."
        />
      )}
      </>
    ) : p === "Watchlist" ? (
      <WatchPanel
        all={allListings}
        selectedId={selectedId}
        onSelect={pick}
        onHover={onHover}
      />
    ) : (
      <FeedBoard onPick={openFromDeal} onNewPost={() => onExit("Market feed")} />
    );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Baseline, full-screen mode"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-[1300] flex flex-col bg-white"
        >
          {/* top bar */}
          <div className="relative isolate flex h-14 shrink-0 items-center justify-between gap-3 bg-zinc-950 px-4 text-white sm:px-5">
            <GrainField variant="ink" className="-z-10" />
            <div className="flex min-w-0 items-center gap-4">
              <Wordmark tone="white" />
              <p className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 md:flex">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-lime" />
                </span>
                Dashboard view ·{" "}
                <span className="text-white">{listings.length}</span> on the map
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ViewToggle tone="dark" value="dashboard" onChange={() => onExit(panel)} />
              <kbd className="hidden rounded border border-white/20 px-1 font-mono text-[10px] text-zinc-400 md:inline">Esc</kbd>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1">
            {/* side panel (desktop) */}
            <aside className={`glass absolute bottom-3 left-3 top-3 z-[4] hidden w-[380px] flex-col overflow-hidden rounded-2xl ${panel === "Market feed" ? "" : "lg:flex"}`}>
              <div className="border-b border-white/60 p-3">
                <PanelTabs value={panel} onChange={setPanel} />
                {panel === "Listings" && (
                  <div className="mt-2">
                    {statusTabs}
                    {agencySelect}
                  </div>
                )}
              </div>
              <div
                ref={panelRef}
                data-lenis-prevent
                className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2"
              >
                {panel !== "Market feed" && list(panel)}
              </div>
              {panel === "Listings" && pager && <div className="shrink-0 border-t border-zinc-200 bg-white/80">{pager}</div>}
            </aside>

            {/* Market feed (desktop): the board takes the whole screen, no map */}
            {panel === "Market feed" && mobileView === "Map" && (
              <div className="absolute inset-0 z-[5] hidden lg:block">
                <FeedBoard onPick={openFromDeal} onNewPost={() => onExit("Market feed")} tabs={<PanelTabs value={panel} onChange={setPanel} />} />
              </div>
            )}

            {/* map (isolated, so its pins never paint over the Market feed) */}
            <div className={`relative isolate min-w-0 flex-1 ${panel === "Market feed" ? "lg:invisible" : ""}`}>
              <ArubaMap
                mode="listings"
                listings={listings}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={pick}
                onHover={onHover}
                fill
              />

              {/* the picked listing opens as a glass window on the map */}
              <AnimatePresence>
                {selected && !showDetails && mobileView === "Map" && panel !== "Market feed" && (
                  <ListingPopup
                    key={selected.listing_id}
                    l={selected}
                    onClose={closeAll}
                    onDetails={() => setDetailsOpen(true)}
                    className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:right-4 sm:top-14 sm:bottom-auto sm:w-[360px]"
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Full details: a large glass window over the map, beside the list */}
            <AnimatePresence>
              {showDetails && selected && (
                <motion.div
                  key="details"
                  role="dialog"
                  aria-label={`${selected.asset_name}, full details`}
                  initial={{ opacity: 0, y: 16, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.99 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className="glass absolute inset-0 z-[6] flex flex-col overflow-hidden lg:inset-y-3 lg:left-[404px] lg:right-3 lg:rounded-2xl"
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/60 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetailsOpen(false)}
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-semibold text-zinc-600 transition-colors hover:bg-white/70 hover:text-zinc-950"
                    >
                      <ArrowLeft size={14} /> Back to map
                    </button>
                    <p className="min-w-0 truncate font-display text-[15px] text-zinc-950">{selected.asset_name}</p>
                    <button
                      type="button"
                      onClick={closeAll}
                      aria-label="Close"
                      className="glass grid size-8 shrink-0 place-items-center rounded-full text-zinc-900 transition-transform hover:scale-105"
                    >
                      <X size={15} strokeWidth={2.2} />
                    </button>
                  </div>
                  <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
                    {renderDetails(selected)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* phones / tablets: a panel over the map */}
            <AnimatePresence>
              {mobileView !== "Map" && (
                <motion.div
                  key={mobileView}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  ref={mobilePanelRef}
                  data-lenis-prevent
                  className="absolute inset-0 z-[4] space-y-1 overflow-y-auto overscroll-contain bg-white p-2 lg:hidden"
                >
                  {mobileView === "Listings" && (
                    <div className="pb-1">
                      {statusTabs}
                      {agencySelect}
                    </div>
                  )}
                  {list(mobileView)}
                  {mobileView === "Listings" && pager}
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
