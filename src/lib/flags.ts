"use client";

/*
 * The Kill Switch: members flag a listing as delisted (sold, withdrawn, a
 * ghost). The Index cannot know a deal closed in cash yesterday; agents can.
 *
 * Live (LIVE_DATA and signed in): calls the Supabase RPC `flag_delisted`,
 * which in one transaction logs the member's user id in `property_flags`,
 * sets `property_master.status` to 'archived' and forces `confidence_score`
 * to 0, so the listing leaves the Master Market view for everyone. See
 * supabase/migrations/*_confidence_kill_switch.sql.
 *
 * Until then flags are kept on this device so the flow can be tried.
 */

import { useCallback, useSyncExternalStore } from "react";
import { LIVE_DATA } from "./aruba-data";
import { supabase, useUser } from "./auth";

export const FLAG_REASONS = {
  sold: "Sold or deal closed",
  off_market: "Taken off the market",
  ghost: "Doesn't exist (ghost listing)",
  duplicate: "Duplicate of another listing",
} as const;
export type FlagReason = keyof typeof FLAG_REASONS;

/** How long the member who flagged a listing can undo it. Matches the SQL. */
export const UNDO_MINUTES = 15;

export interface Flag {
  reason: FlagReason;
  note?: string;
  at: string; // ISO
}

const KEY = "signal.flags.v1";
const EMPTY: Record<string, Flag> = {};
const listeners = new Set<() => void>();
let cache: Record<string, Flag> | null = null;

function read(): Record<string, Flag> {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, Flag>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Record<string, Flag>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: keep it in memory for this visit */
  }
  cache = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function canUndo(f: Flag | undefined) {
  return Boolean(f && Date.now() - Date.parse(f.at) < UNDO_MINUTES * 60_000);
}

export function useFlags() {
  const { user } = useUser();
  const flags = useSyncExternalStore(subscribe, read, () => EMPTY);
  const live = LIVE_DATA && Boolean(user && supabase());

  const flag = useCallback(
    async (listingId: string, reason: FlagReason, note?: string) => {
      const sb = supabase();
      if (live && sb) {
        const { error } = await sb.rpc("flag_delisted", { p_listing_id: listingId, p_reason: reason, p_note: note?.trim() || null });
        if (error) throw new Error(error.message);
      }
      // Hide it right away; on live data the next load no longer returns it.
      write({ ...read(), [listingId]: { reason, note: note?.trim() || undefined, at: new Date().toISOString() } });
    },
    [live],
  );

  const undo = useCallback(
    async (listingId: string) => {
      const sb = supabase();
      if (live && sb) {
        const { error } = await sb.rpc("undo_flag", { p_listing_id: listingId });
        if (error) throw new Error(error.message);
      }
      const next = { ...read() };
      delete next[listingId];
      write(next);
    },
    [live],
  );

  return { flags, flag, undo, live };
}
