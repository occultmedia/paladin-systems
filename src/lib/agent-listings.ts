"use client";

/*
 * Listings agents add by hand. Each one is either Off-market (every member
 * sees it on the dashboard, marked Off-market) or Only me. The duplicate
 * watch (lib/duplicates.ts) warns in the form; the database refuses likely
 * duplicates the agent did not confirm, and links an agent listing to the
 * scraped listing when it later turns up on a public site.
 *
 * Two backends:
 *  - Supabase `v_agent_listings` / `agent_listings` once accounts are live
 *    (supabase/migrations/20261123000000_agent_listings.sql).
 *  - This browser until then, so the feature works in the demo.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase, useUser } from "./auth";
import { dataUrlToBlob } from "./images";
import type { AgentListingFields, AgentListingViewRow } from "./database.types";
import type { Profile } from "./profile";
import { MARKET_ID } from "./aruba-data";
export { agentRowToListing } from "./agent-listing-map";

export type AgentListingInput = Omit<AgentListingFields, "photo_url"> & {
  /** Data URL of a new photo, or the stored URL. */
  photo: string | null;
};

/** The database refused the listing as a likely duplicate. */
export class DuplicateListingError extends Error {
  constructor(public match: { kind: "market" | "member"; ref: string; name: string; score: number }) {
    super(`This looks like ${match.name} (${match.ref}), already on the Terminal.`);
    this.name = "DuplicateListingError";
  }
}

export const VISIBILITY_LABEL = { members: "Off-market", private: "Only me" } as const;
export const VISIBILITY_HINT = {
  members: "Every Terminal member sees it on the dashboard, marked Off-market. It is never shown publicly.",
  private: "Only you see it. Handy for pocket listings you are still preparing.",
} as const;

/* ── this browser (demo) ──────────────────────────────────────────────── */

const KEY = "terminal.agent-listings.v1";
const LOCAL_OWNER = "local-member";
const listeners = new Set<() => void>();
let cache: AgentListingViewRow[] | undefined;
const EMPTY: AgentListingViewRow[] = [];

function readLocal(): AgentListingViewRow[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as AgentListingViewRow[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}
function writeLocal(rows: AgentListingViewRow[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    throw new Error("Your browser storage is full. Try a smaller photo.");
  }
  cache = rows;
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = undefined;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function localRef(id: string) {
  return `AG-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/* ── hook ─────────────────────────────────────────────────────────────── */

const VIEW_COLS = "*";

async function uploadPhoto(uid: string, value: string | null): Promise<string | null> {
  const sb = supabase();
  if (!sb || !value) return null;
  if (!value.startsWith("data:")) return value;
  const blob = dataUrlToBlob(value);
  const path = `${uid}/listing-${Date.now()}.${blob.type === "image/jpeg" ? "jpg" : "png"}`;
  const { error } = await sb.storage.from("profile-media").upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return sb.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}

function asDuplicate(err: { message?: string; details?: string | null }) {
  if (err.message !== "DUPLICATE_LISTING") return null;
  try {
    const d = JSON.parse(err.details ?? "{}");
    return new DuplicateListingError({ kind: d.kind, ref: d.ref, name: d.name, score: d.score });
  } catch {
    return new DuplicateListingError({ kind: "member", ref: "", name: "a listing", score: 70 });
  }
}

export function useAgentListings(me: Profile | null) {
  const { user } = useUser();
  const remoteMode = Boolean(user && supabase());
  const local = useSyncExternalStore(subscribe, readLocal, () => EMPTY);
  const [remote, setRemote] = useState<{ uid: string; rows: AgentListingViewRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const sb = supabase();
    if (!user || !sb) return;
    let live = true;
    sb.from("v_agent_listings")
      .select(VIEW_COLS)
      .eq("market_id", MARKET_ID)
      .order("created_at", { ascending: false })
      .then(({ data, error: e }) => {
        if (!live) return;
        if (e) setError(e.message);
        else {
          setError(null);
          setRemote({ uid: user.id, rows: (data ?? []) as AgentListingViewRow[] });
        }
      });
    return () => {
      live = false;
    };
  }, [user, tick]);

  const rows = remoteMode ? (remote && remote.uid === user?.id ? remote.rows : EMPTY) : local;
  const myId = remoteMode ? user!.id : LOCAL_OWNER;
  const loading = remoteMode && remote?.uid !== user?.id && !error;

  const save = useCallback(
    async (input: AgentListingInput, id?: string) => {
      const { photo, ...fields } = input;
      const sb = supabase();
      if (user && sb) {
        const photo_url = await uploadPhoto(user.id, photo);
        const q = id
          ? sb.from("agent_listings").update({ ...fields, photo_url }).eq("id", id).select("id").single()
          : sb.from("agent_listings").insert({ ...fields, photo_url }).select("id").single();
        const { error: e } = await q;
        if (e) throw asDuplicate(e) ?? new Error(e.message);
        reload();
        return;
      }
      // this browser
      const now = new Date().toISOString();
      const all = readLocal();
      const prev = id ? all.find((r) => r.id === id) : undefined;
      const newId = id ?? crypto.randomUUID();
      const row: AgentListingViewRow = {
        ...fields,
        photo_url: photo,
        id: newId,
        ref: prev?.ref ?? localRef(newId),
        owner_id: LOCAL_OWNER,
        market_id: MARKET_ID,
        match_kind: null,
        match_ref: null,
        match_name: null,
        match_score: null,
        market_listing_id: null,
        went_public_at: null,
        created_at: prev?.created_at ?? now,
        updated_at: now,
        owner_name: me?.name || "You",
        owner_role: me?.role ?? "Agent",
        owner_company: me?.company ?? "",
        owner_title: me?.title ?? null,
        owner_email: me?.email ?? null,
        owner_phone: me?.phone ?? null,
        owner_whatsapp: me?.whatsapp ?? null,
        owner_photo_url: me?.photo ?? null,
        owner_logo_url: me?.logo ?? null,
      };
      writeLocal(prev ? all.map((r) => (r.id === id ? row : r)) : [row, ...all]);
    },
    [user, me, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      const sb = supabase();
      if (user && sb) {
        const { error: e } = await sb.from("agent_listings").delete().eq("id", id);
        if (e) throw new Error(e.message);
        reload();
        return;
      }
      writeLocal(readLocal().filter((r) => r.id !== id));
    },
    [user, reload],
  );

  const setStatus = useCallback(
    async (id: string, listing_status: AgentListingFields["listing_status"]) => {
      const sb = supabase();
      if (user && sb) {
        const { error: e } = await sb.from("agent_listings").update({ listing_status }).eq("id", id);
        if (e) throw new Error(e.message);
        reload();
        return;
      }
      writeLocal(readLocal().map((r) => (r.id === id ? { ...r, listing_status, updated_at: new Date().toISOString() } : r)));
    },
    [user, reload],
  );

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  return { rows, byId, myId, loading, error, save, remove, setStatus, shared: remoteMode };
}
