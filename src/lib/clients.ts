"use client";

/*
 * Interested clients per listing: a small CRM for agents. Each listing can
 * hold any number of people who asked about it (name, phone, comment).
 * Stored per browser in localStorage until accounts (Supabase) are live;
 * the shape matches the table we will add server-side later.
 */

import { useCallback, useSyncExternalStore } from "react";

export interface InterestedClient {
  id: string;
  listing_id: string;
  name: string;
  phone: string;
  comment: string;
  added_at: string; // ISO timestamp
  updated_at?: string;
}

export type ClientInput = Pick<InterestedClient, "name" | "phone" | "comment">;

const KEY = "signal.clients.v1";
const EMPTY: InterestedClient[] = [];
const listeners = new Set<() => void>();
let cache: InterestedClient[] | null = null;

function read(): InterestedClient[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed)
      ? (parsed as InterestedClient[]).filter((c) => c && typeof c.id === "string" && typeof c.listing_id === "string")
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: InterestedClient[]) {
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

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const clean = (c: ClientInput): ClientInput => ({ name: c.name.trim(), phone: c.phone.trim(), comment: c.comment.trim() });

/** Every interested client, across all listings. */
export function useInterestedClients() {
  const all = useSyncExternalStore(subscribe, read, () => EMPTY);

  const forListing = useCallback(
    (listingId: string) =>
      all.filter((c) => c.listing_id === listingId).sort((a, b) => Date.parse(b.added_at) - Date.parse(a.added_at)),
    [all],
  );

  const countFor = useCallback((listingId: string) => all.reduce((n, c) => n + (c.listing_id === listingId ? 1 : 0), 0), [all]);

  const add = useCallback((listingId: string, input: ClientInput) => {
    const c = clean(input);
    if (!c.name) return;
    write([{ id: newId(), listing_id: listingId, ...c, added_at: new Date().toISOString() }, ...read()]);
  }, []);

  const update = useCallback((id: string, input: ClientInput) => {
    const c = clean(input);
    if (!c.name) return;
    write(read().map((x) => (x.id === id ? { ...x, ...c, updated_at: new Date().toISOString() } : x)));
  }, []);

  const remove = useCallback((id: string) => write(read().filter((x) => x.id !== id)), []);

  /** Put a removed client back (undo). */
  const restore = useCallback((client: InterestedClient) => {
    if (read().some((x) => x.id === client.id)) return;
    write([client, ...read()]);
  }, []);

  return { all, forListing, countFor, add, update, remove, restore };
}
