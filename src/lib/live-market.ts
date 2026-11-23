"use client";

/*
 * The live Master Market: every active indexed listing from Supabase
 * (`v_master_market`, see lib/master-market.ts). Starts empty and fills as
 * the Index runs. The dashboard publishes the combined market (indexed +
 * agent listings) here so other parts (the Deals listing picker and the
 * listing cards on posts) can look listings up without loading them again.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase, useUser } from "./auth";
import { MARKET_ID, type Listing } from "./aruba-data";
import { fetchMasterMarket } from "./master-market";

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

/* ── the published market (indexed + agent listings) ──────────────────── */

let current: Listing[] = [];
let byId = new Map<string, Listing>();
const listeners = new Set<() => void>();

export function publishMarket(listings: Listing[]) {
  if (listings === current) return;
  current = listings;
  byId = new Map(listings.map((l) => [l.listing_id, l]));
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const EMPTY: Listing[] = [];

export function useMarketListings(): Listing[] {
  return useSyncExternalStore(subscribe, () => current, () => EMPTY);
}

export function useListingById(id: string | null | undefined): Listing | null {
  const all = useMarketListings();
  return id ? (all === current ? byId.get(id) : all.find((l) => l.listing_id === id)) ?? null : null;
}
