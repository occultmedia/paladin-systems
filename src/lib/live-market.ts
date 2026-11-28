"use client";

/*
 * The live Master Market: every active indexed listing from Supabase
 * (`v_master_market`, see lib/master-market.ts). Starts empty and fills as
 * the Index runs. The dashboard publishes the combined market (indexed +
 * agent listings) here so other parts (the Market feed listing picker and the
 * listing cards on posts) can look listings up without loading them again.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase, useUser } from "./auth";
import { MARKET_ID, type Listing } from "./aruba-data";
import { fetchMasterMarket } from "./master-market";
import { fetchListingsByRef } from "./market-api";

/** Indexed listings for the signed-in member. Empty (not mock) when signed out. */
export function useMasterMarket() {
  const { user, ready } = useUser();
  const [state, setState] = useState<{ uid: string; listings: Listing[]; error: string | null } | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!user || !sb) return;
    let live = true;
    fetchMasterMarket(sb, MARKET_ID)
      .then((listings) => live && setState({ uid: user.id, listings, error: null }))
      .catch((e: unknown) => live && setState({ uid: user.id, listings: [], error: e instanceof Error ? e.message : "Feed unavailable" }));
    return () => {
      live = false;
    };
  }, [user]);

  if (!ready) return { listings: undefined, error: null };
  if (!user || !supabase()) return { listings: [] as Listing[], error: null };
  if (!state || state.uid !== user.id) return { listings: undefined, error: null };
  return { listings: state.listings, error: state.error };
}

/* ── the listings this page holds ───────────────────────────────────── */
// The market is no longer loaded whole (lib/market-api.ts). Each part publishes
// what it holds (the dashboard: recent, pinned and members' listings; the
// Listings tab: the rows on screen), so the Market feed's listing cards and the
// flag notice can name a listing without loading it again. A listing nobody
// holds is fetched by its ref.

const sources = new Map<string, Listing[]>();
let current: Listing[] = [];
let byId = new Map<string, Listing>();
const listeners = new Set<() => void>();

function rebuild() {
  byId = new Map();
  for (const list of sources.values()) for (const l of list) if (!byId.has(l.listing_id)) byId.set(l.listing_id, l);
  current = [...byId.values()];
  listeners.forEach((l) => l());
}

export function publishMarket(listings: Listing[], source = "market") {
  if (sources.get(source) === listings) return;
  sources.set(source, listings);
  rebuild();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const EMPTY: Listing[] = [];

export function useMarketListings(): Listing[] {
  return useSyncExternalStore(subscribe, () => current, () => EMPTY);
}

const asked = new Set<string>();
export function useListingById(id: string | null | undefined): Listing | null {
  const all = useMarketListings();
  const hit = id ? (all === current ? byId.get(id) : all.find((l) => l.listing_id === id)) ?? null : null;
  useEffect(() => {
    if (!id || hit || asked.has(id) || id.startsWith("AG-")) return;
    asked.add(id);
    fetchListingsByRef([id]).then(
      (m) => m.size && publishMarket([...(sources.get("lookups") ?? []), ...m.values()], "lookups"),
      () => asked.delete(id),
    );
  }, [id, hit]);
  return hit;
}
