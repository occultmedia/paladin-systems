"use client";

/*
 * The market, asked for in pieces instead of loaded whole
 * (supabase/migrations/20261128000000_grouping_map_rpcs.sql):
 *
 *   useMapPins        one light pin per group for the whole island (get_map_pins)
 *   useListingPages   the list, 24 groups at a time, keyset (cursor) paging (get_listing_page)
 *   useMarketFacets   status tab counts, summary tiles, agencies and districts (get_market_facets)
 *   useGroupDetail    everything about one pin, fetched when it is opened (get_group_detail)
 *   useListingsByRef  a handful of listings by their ref (Watchlist, links, Market feed)
 *   useRecentActivity listings new, re-priced or changed status in the last N days (updates board)
 *
 * A group is a project (several units of one building or development), one
 * home (possibly listed by several agencies) or a member's own listing.
 * Members' listings arrive without their details (the dashboard already holds
 * them, see useAgentListings) and are filled in from `members`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, useUser } from "./auth";
import type { Listing, ListingStatus, Signal } from "./aruba-data";
import type { GroupDetailRow, GroupType, ListingGroupRow, ListingPageRow, MapPinRow, MarketFacetsRow, OfferRow } from "./database.types";
import { rowToListing } from "./master-market";

/* ── filters ────────────────────────────────────────────────────────── */

/** What the Listings filters say, in the shape every RPC takes (missing = no filter). */
export interface MarketFilters {
  status?: ListingStatus;
  category?: "Property" | "Land" | "Commercial";
  subtypes?: string[];
  district?: string;
  /** agency id ("remax-aruba", "member-<uuid>") */
  agency?: string;
  signal?: Exclude<Signal, "NO_SIGNAL">;
  tenure?: "Eigendom" | "Erfpacht" | "None";
  pool?: string;
  new_today?: boolean;
  off_market?: boolean;
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  size_min_m2?: number;
  new_7d?: boolean;
  drops?: boolean;
  reliable?: boolean;
  q?: string;
  /** [west, south, east, north] */
  bbox?: [number, number, number, number];
}

/** Drop empty values so equal filters always serialise the same way. */
export function cleanFilters(f: MarketFilters): MarketFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === false || v === "" || v === 0) continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out as MarketFilters;
}

/* ── groups ─────────────────────────────────────────────────────────── */

export type SortKey =
  | "activity" | "name" | "district" | "beds" | "baths" | "built" | "lot"
  | "asking" | "psf" | "vsDistrict" | "listed" | "status" | "confidence";

export interface MarketGroup {
  key: string;
  type: GroupType;
  /** Project name, or the listing's own name. */
  title: string;
  lat: number;
  lng: number;
  minPrice: number;
  maxPrice: number;
  /** Listings in the group that match the filters. */
  units: number;
  agencyIds: string[];
  /** The group's cheapest matching listing (null while a member's listing is still loading). */
  l: Listing | null;
}

export type MapPin = MapPinRow;

const toGroup = (r: ListingGroupRow, members: Map<string, Listing>): MarketGroup => ({
  key: r.group_key,
  type: r.group_type,
  title: r.title,
  lat: r.lat,
  lng: r.lng,
  minPrice: Number(r.min_price),
  maxPrice: Number(r.max_price),
  units: r.unit_count,
  agencyIds: r.agency_ids ?? [],
  l: r.rep ? rowToListing(r.rep) : members.get(r.rep_ref) ?? null,
});

/** "From $1.4M · 5 units" style price line for a group. */
export const isMulti = (g: Pick<MarketGroup, "type" | "units">) => g.type === "project" && g.units > 1;

/* ── shared fetch plumbing ──────────────────────────────────────────── */

/** Run `load` whenever `key` changes; the answer for an older key is dropped. */
function useLatest<T>(key: string | null, load: () => Promise<T>) {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    if (key === null) return;
    let live = true;
    loadRef.current().then(
      (data) => live && setState({ key, data, error: null }),
      (e: unknown) => live && setState({ key, data: null, error: e instanceof Error ? e.message : "Could not load" }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  const current = state && state.key === key ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: key !== null && !current, stale: state?.data ?? null };
}

function rpcError(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

/* ── map pins ───────────────────────────────────────────────────────── */

/** Every group matching the filters (the map box is ignored: pins cover the island). */
export function useMapPins(filters: MarketFilters) {
  const { user } = useUser();
  const f = useMemo(() => cleanFilters({ ...filters, bbox: undefined }), [filters]);
  const key = user ? JSON.stringify(f) : null;
  const { data, error, loading, stale } = useLatest(key, async () => {
    const sb = supabase();
    if (!sb) return [] as MapPin[];
    const { data, error } = await sb.rpc("get_map_pins", { f: f as Record<string, unknown> });
    rpcError(error);
    return (data ?? []) as MapPin[];
  });
  // keep showing the previous pins while new ones load (no flashing map)
  return { pins: data ?? stale ?? [], loading, error };
}

/* ── the list: keyset paging ────────────────────────────────────────── */

export const PAGE_SIZE = 24;

/**
 * One list of groups, 24 at a time. `loadMore` fetches the next page after the
 * last row it holds (a cursor, never an offset), so rows never repeat or skip
 * when listings change between pages.
 */
export function useListingPages(filters: MarketFilters, sort: { key: SortKey; dir: "asc" | "desc" }, members: Map<string, Listing>) {
  const { user } = useUser();
  const f = useMemo(() => cleanFilters(filters), [filters]);
  const key = user ? JSON.stringify([f, sort.key, sort.dir]) : null;
  const [state, setState] = useState<{
    key: string;
    rows: ListingGroupRow[];
    total: number;
    cursor: ListingPageRowCursor | null;
    loadingMore: boolean;
    error: string | null;
  } | null>(null);
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const fetchPage = useCallback(
    async (cursor: ListingPageRowCursor | null) => {
      const sb = supabase();
      if (!sb) return { total: 0, items: [] as ListingGroupRow[], next_cursor: null };
      const { data, error } = await sb.rpc("get_listing_page", {
        f: f as Record<string, unknown>,
        p_sort: sort.key,
        p_dir: sort.dir,
        p_cursor: cursor as Record<string, unknown> | null,
        p_limit: PAGE_SIZE,
      });
      rpcError(error);
      return data!;
    },
    [f, sort.key, sort.dir],
  );

  useEffect(() => {
    if (key === null) return;
    let live = true;
    fetchPage(null).then(
      (p) => live && setState({ key, rows: p.items, total: p.total, cursor: p.next_cursor, loadingMore: false, error: null }),
      (e: unknown) => live && setState({ key, rows: [], total: 0, cursor: null, loadingMore: false, error: e instanceof Error ? e.message : "Could not load" }),
    );
    return () => {
      live = false;
    };
  }, [key, fetchPage]);

  const current = state && state.key === key ? state : null;
  const loadMore = useCallback(() => {
    if (!current?.cursor || current.loadingMore) return;
    const k = current.key;
    setState((s) => (s && s.key === k ? { ...s, loadingMore: true } : s));
    fetchPage(current.cursor).then(
      (p) =>
        keyRef.current === k &&
        setState((s) => {
          if (!s || s.key !== k) return s;
          const seen = new Set(s.rows.map((r) => r.group_key));
          return { ...s, rows: [...s.rows, ...p.items.filter((r) => !seen.has(r.group_key))], cursor: p.next_cursor, loadingMore: false };
        }),
      (e: unknown) =>
        setState((s) => (s && s.key === k ? { ...s, loadingMore: false, error: e instanceof Error ? e.message : "Could not load" } : s)),
    );
  }, [current, fetchPage]);

  const groups = useMemo(() => (current ? current.rows.map((r) => toGroup(r, members)) : []), [current, members]);
  return {
    groups,
    total: current?.total ?? 0,
    hasMore: Boolean(current?.cursor),
    loading: key !== null && !current,
    loadingMore: Boolean(current?.loadingMore),
    error: current?.error ?? null,
    loadMore,
  };
}
type ListingPageRowCursor = { n: number; t: string; k: string };

/* ── facets ─────────────────────────────────────────────────────────── */

export type MarketFacets = MarketFacetsRow;

export function useMarketFacets(filters: MarketFilters) {
  const { user } = useUser();
  const f = useMemo(() => cleanFilters(filters), [filters]);
  const key = user ? JSON.stringify(f) : null;
  const { data, error, stale } = useLatest(key, async () => {
    const sb = supabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc("get_market_facets", { f: f as Record<string, unknown> });
    rpcError(error);
    return data as MarketFacets;
  });
  return { facets: data ?? stale, error };
}

/* ── one group, on click ────────────────────────────────────────────── */

export interface GroupUnit {
  ref: string;
  l: Listing | null;
  offers: OfferRow[];
}
export interface GroupDetail {
  key: string;
  type: GroupType | null;
  project: GroupDetailRow["project"];
  units: GroupUnit[];
}

const detailCache = new Map<string, GroupDetail>();

export function useGroupDetail(key: string | null, members: Map<string, Listing>) {
  const { user } = useUser();
  const { data, error, loading } = useLatest(user && key ? key : null, async () => {
    const hit = detailCache.get(key!);
    if (hit) return hit;
    const sb = supabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc("get_group_detail", { p_group_key: key! });
    rpcError(error);
    const d = data as GroupDetailRow;
    const out: GroupDetail = {
      key: d.group_key,
      type: d.group_type,
      project: d.project,
      units: d.units.map((u) => ({ ref: u.ref, l: u.listing ? rowToListing(u.listing) : null, offers: u.offers ?? [] })),
    };
    detailCache.set(key!, out);
    return out;
  });
  const detail = useMemo(
    () => (data ? { ...data, units: data.units.map((u) => ({ ...u, l: u.l ?? members.get(u.ref) ?? null })) } : null),
    [data, members],
  );
  return { detail, error, loading };
}

/** Forget cached details (after a listing is flagged or edited). */
export const clearGroupDetails = () => detailCache.clear();

/* ── a few listings by ref ──────────────────────────────────────────── */

const byRefCache = new Map<string, Listing | null>();

export async function fetchListingsByRef(refs: string[]): Promise<Map<string, Listing>> {
  const want = [...new Set(refs)].filter((r) => r && !byRefCache.has(r));
  const sb = supabase();
  if (want.length && sb) {
    for (let i = 0; i < want.length; i += 100) {
      const chunk = want.slice(i, i + 100);
      const { data, error } = await sb.from("v_master_market").select("*").in("listing_id", chunk);
      if (error) throw new Error(error.message);
      const got = new Map((data ?? []).map((r) => [r.listing_id, rowToListing(r)]));
      for (const r of chunk) byRefCache.set(r, got.get(r) ?? null);
    }
  }
  return new Map(refs.map((r) => [r, byRefCache.get(r)]).filter((x): x is [string, Listing] => Boolean(x[1])));
}

/** Listings by ref, for the Watchlist and links. Refs no longer on the market are left out. */
export function useListingsByRef(refs: string[]) {
  const { user } = useUser();
  const key = user ? [...new Set(refs)].sort().join(",") : null;
  const { data, error, loading, stale } = useLatest(key, () => fetchListingsByRef(refs));
  return { byRef: data ?? stale ?? new Map<string, Listing>(), loading, error };
}

/** The group a listing belongs to (for links that name a listing). */
export async function groupKeyOf(ref: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from("v_market_items").select("group_key").eq("ref", ref).maybeSingle();
  return (data as { group_key: string } | null)?.group_key ?? null;
}

/** Up to `limit` listings whose name, ref, district or agency contains `q` (Market feed picker, rental calculator). */
export async function searchListings(q: string, opts: { limit?: number; category?: "Property" | "Land" | "Commercial"; status?: ListingStatus } = {}) {
  const sb = supabase();
  const text = q.trim();
  if (!sb) return [] as Listing[];
  let query = sb.from("v_master_market").select("*").order("first_seen", { ascending: false }).limit(opts.limit ?? 20);
  if (text) {
    const like = `%${text.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`asset_name.ilike.${like},listing_id.ilike.${like},district.ilike.${like},source.ilike.${like}`);
  }
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToListing);
}

/* ── recent activity (updates board) ────────────────────────────────── */

/**
 * Listings new, re-priced or with a new status in the last `days` days, plus
 * how many listings the market holds and when it was last indexed. Enough for
 * the daily summaries without loading the whole market.
 */
export function useRecentActivity(days = 7) {
  const { user } = useUser();
  const key = user ? `recent:${days}` : null;
  const { data, error } = useLatest(key, async () => {
    const sb = supabase();
    if (!sb) return { listings: [] as Listing[], total: 0, updatedAt: null as string | null };
    const since = new Date(Date.now() - (days + 1) * 86_400_000).toISOString();
    const sinceDay = since.slice(0, 10);
    const [recent, count, latest] = await Promise.all([
      sb.from("v_master_market").select("*").or(`first_seen.gte.${sinceDay},last_price_change_at.gte.${since},status_changed_at.gte.${since}`).limit(2000),
      sb.from("v_master_market").select("listing_id", { count: "exact", head: true }),
      sb.from("v_master_market").select("last_found_at").order("last_found_at", { ascending: false }).limit(1),
    ]);
    if (recent.error) throw new Error(recent.error.message);
    return {
      listings: (recent.data ?? []).map(rowToListing),
      total: count.count ?? 0,
      updatedAt: latest.data?.[0]?.last_found_at ?? null,
    };
  });
  return { recent: data, error };
}

/** Every group matching the filters, 100 per request (CSV export). Stops after `max`. */
export async function fetchAllGroups(filters: MarketFilters, sort: { key: SortKey; dir: "asc" | "desc" }, members: Map<string, Listing>, max = 5000) {
  const sb = supabase();
  if (!sb) return [] as MarketGroup[];
  const f = cleanFilters(filters) as Record<string, unknown>;
  const out: MarketGroup[] = [];
  let cursor: Record<string, unknown> | null = null;
  do {
    const res = await sb.rpc("get_listing_page", { f, p_sort: sort.key, p_dir: sort.dir, p_cursor: cursor, p_limit: 100 });
    rpcError(res.error);
    const pg: ListingPageRow = res.data!;
    out.push(...pg.items.map((r) => toGroup(r, members)));
    cursor = pg.next_cursor;
  } while (cursor && out.length < max);
  return out;
}

/* ── one district (Add listing's duplicate watch) ───────────────────── */

const districtCache = new Map<string, Listing[]>();

/** Every indexed listing in one district and category, for the live duplicate check while an agent types. */
export function useDistrictListings(district: string, category: "Property" | "Land" | "Commercial") {
  const { user } = useUser();
  const key = user && district ? `${district}|${category}` : null;
  const { data } = useLatest(key, async () => {
    const hit = districtCache.get(key!);
    if (hit) return hit;
    const sb = supabase();
    if (!sb) return [] as Listing[];
    const { data, error } = await sb.from("v_master_market").select("*").eq("district", district).eq("category", category).limit(2000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map(rowToListing);
    districtCache.set(key!, rows);
    return rows;
  });
  return data ?? [];
}
