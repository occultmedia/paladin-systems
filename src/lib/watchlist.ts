"use client";

/*
 * Watchlist: the listings a user has pinned to keep track of.
 * Stored per browser in localStorage until accounts (Supabase) are live; the
 * shape is the row we will store server-side later: listing id, when it was
 * pinned, and the asking price at that moment (to show the move since).
 */

import { useCallback, useSyncExternalStore } from "react";

export interface WatchEntry {
  id: string;
  pinned_at: string; // ISO timestamp
  price_at_pin: number;
  note?: string;
}

const KEY = "signal.watchlist.v1";
const EMPTY: WatchEntry[] = [];
const listeners = new Set<() => void>();
let cache: WatchEntry[] | null = null;

function read(): WatchEntry[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed) ? (parsed as WatchEntry[]).filter((e) => e && typeof e.id === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: WatchEntry[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode or storage full: keep it in memory for this visit */
  }
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

export function useWatchlist() {
  const entries = useSyncExternalStore(subscribe, read, () => EMPTY);

  const isPinned = useCallback((id: string) => entries.some((e) => e.id === id), [entries]);

  const pin = useCallback((id: string, price: number) => {
    const cur = read();
    if (cur.some((e) => e.id === id)) return;
    write([{ id, pinned_at: new Date().toISOString(), price_at_pin: price }, ...cur]);
  }, []);

  const unpin = useCallback((id: string) => write(read().filter((e) => e.id !== id)), []);

  const toggle = useCallback(
    (id: string, price: number) => (read().some((e) => e.id === id) ? unpin(id) : pin(id, price)),
    [pin, unpin],
  );

  const setNote = useCallback(
    (id: string, note: string) => write(read().map((e) => (e.id === id ? { ...e, note: note || undefined } : e))),
    [],
  );

  const clear = useCallback(() => write([]), []);

  return { entries, isPinned, pin, unpin, toggle, setNote, clear };
}
