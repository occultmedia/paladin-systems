"use client";

/*
 * Market feed (the Deal Desk): a blind bid/ask board for members. Sellers post
 * asks (off-market, for sale, for rent, partnerships), buyers post bids
 * (buyer requests) with a budget range. Blind posts hide who posted: other
 * members tap "I'm interested", and only the poster sees who responded and
 * decides whether to reach out. Every post deletes itself after 14 days.
 *
 * Two backends:
 *  - Supabase `deal_desk_feed` / `deal_desk_posts` / `deal_desk_interest`
 *    (see supabase/migrations/20261122000000_delta_pipeline.sql) once
 *    accounts are live.
 *  - This browser until accounts are configured.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase, useUser } from "./auth";
import type { AssetClass, DealDeskFeedRow, DealSide, DealInterestRow } from "./database.types";
import { rowToProfile, type Profile } from "./profile";

export const POST_KINDS = ["Off-market", "For sale", "Buyer request", "For rent", "Partnership"] as const;
export type PostKind = (typeof POST_KINDS)[number];
export const ASSET_CLASSES: AssetClass[] = ["Property", "Land", "Commercial"];
export const ASSET_CLASS_LABEL: Record<AssetClass, string> = { Property: "Home / condo", Land: "Land", Commercial: "Commercial" };

/** Buyer requests are bids; everything else is an ask. Matches the SQL check. */
export const sideOf = (k: PostKind): DealSide => (k === "Buyer request" ? "bid" : "ask");
export const SIDE_LABEL: Record<DealSide, string> = { bid: "Buying", ask: "Selling" };

/** Posts are removed automatically this long after they are published. */
export const DEAL_TTL_DAYS = 14;
const TTL_MS = DEAL_TTL_DAYS * 864e5;
const isLive = (p: { expires_at: string }, now = Date.now()) => Date.parse(p.expires_at) > now;

export const POST_KIND_HINT: Record<PostKind, string> = {
  "Off-market": "A property you can sell quietly, not on public sites",
  "For sale": "A listing you want other agents to bring buyers to",
  "Buyer request": "A client looking for something specific, with a budget",
  "For rent": "A long-term or vacation rental that is available",
  Partnership: "Co-broke, joint venture or an investor wanted",
};

export type FeedAuthor = Pick<Profile, "name" | "role" | "company" | "title" | "photo" | "logo" | "email" | "phone" | "whatsapp">;

export interface FeedPost {
  id: string;
  created_at: string; // ISO
  expires_at: string; // ISO, at most 14 days after created_at
  kind: PostKind;
  side: DealSide;
  asset_class: AssetClass;
  title: string;
  body: string; // notes
  budget_min: number | null; // bid: low end of the budget
  budget_max: number | null; // bid: ceiling / ask: asking price, rent or capital needed
  district: string | null;
  listing_id?: string | null; // public ref of an attached Baseline listing ('AW-0388')
  blind: boolean; // poster hidden: only the role shows
  author: FeedAuthor; // on blind posts only `role` is real
  mine?: boolean;
  sample?: boolean; // demo content: contact details are hidden
  interested?: boolean; // you tapped "I'm interested"
  interest_count?: number | null; // your own posts only
}

export interface NewPost {
  kind: PostKind;
  asset_class: AssetClass;
  title: string;
  body: string;
  budget_min: number | null;
  budget_max: number | null;
  district: string | null;
  listing_id?: string | null;
  blind: boolean;
}

/** A member who responded to one of your posts. */
export interface Responder {
  user_id: string;
  note: string | null;
  created_at: string;
  profile: FeedAuthor;
}

export const TITLE_MAX = 90;
export const BODY_MAX = 600;


/* ── local (this browser) ─────────────────────────────────────────────── */

const KEY = "terminal.deals.v2";
const INTEREST_KEY = "terminal.deals.interest.v1";
const EMPTY: FeedPost[] = [];
const EMPTY_SET: string[] = [];
const listeners = new Set<() => void>();
let cache: FeedPost[] | null = null;
let interestCache: string[] | null = null;

function readLocal(): FeedPost[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const all = Array.isArray(parsed) ? (parsed as FeedPost[]).filter((p) => p && typeof p.id === "string" && typeof p.expires_at === "string") : [];
    cache = all.filter((p) => isLive(p));
    // Expired posts are deleted, not just hidden.
    if (cache.length !== all.length) window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    cache = [];
  }
  return cache;
}

function readInterest(): string[] {
  if (interestCache) return interestCache;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INTEREST_KEY) ?? "[]") as unknown;
    interestCache = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    interestCache = [];
  }
  return interestCache;
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Your browser storage is full.");
  }
}

function writeLocal(next: FeedPost[]) {
  save(KEY, next);
  cache = next;
  listeners.forEach((l) => l());
}

function writeInterest(next: string[]) {
  save(INTEREST_KEY, next);
  interestCache = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cache = null;
    if (e.key === INTEREST_KEY) interestCache = null;
    if (e.key === KEY || e.key === INTEREST_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/* ── Supabase ─────────────────────────────────────────────────────────── */

const num = (n: number | null) => (n === null ? null : Number(n));

const fromRow = (r: DealDeskFeedRow): FeedPost => ({
  id: r.id,
  created_at: r.created_at,
  expires_at: r.expires_at,
  kind: r.kind,
  side: r.side,
  asset_class: r.asset_class,
  title: r.title,
  body: r.notes,
  budget_min: num(r.budget_min),
  budget_max: num(r.budget_max),
  district: r.district,
  listing_id: r.listing_ref,
  blind: r.is_blind,
  author: {
    name: r.author_name ?? "",
    role: r.author_role,
    company: r.author_company ?? "",
    title: r.author_title ?? undefined,
    photo: r.author_photo_url ?? undefined,
    logo: r.author_logo_url ?? undefined,
    email: r.author_email ?? undefined,
    phone: r.author_phone ?? undefined,
    whatsapp: r.author_whatsapp ?? undefined,
  },
  mine: r.is_mine,
  interested: r.i_am_interested,
  interest_count: r.interest_count,
});

const responderFromRow = (r: DealInterestRow): Responder => ({
  user_id: r.user_id,
  note: r.note,
  created_at: r.created_at,
  profile: rowToProfile(r),
});

/* ── hook ─────────────────────────────────────────────────────────────── */

export function useFeed(author: Profile | null) {
  const { user, ready } = useUser();
  const local = useSyncExternalStore(subscribe, readLocal, () => EMPTY);
  const localInterest = useSyncExternalStore(subscribe, readInterest, () => EMPTY_SET);
  const [remote, setRemote] = useState<{ uid: string; posts: FeedPost[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remoteMode = Boolean(user && supabase());

  const load = useCallback(async () => {
    const sb = supabase();
    if (!user || !sb) return;
    const { data, error: e } = await sb.from("deal_desk_feed").select("*").order("created_at", { ascending: false }).limit(200);
    if (e) return setError(e.message);
    setError(null);
    setRemote({ uid: user.id, posts: (data ?? []).map(fromRow) });
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (p: NewPost) => {
      const sb = supabase();
      if (!author) throw new Error("Set up your profile before posting.");
      if (user && sb) {
        // The attached listing is stored by its database id.
        let listingUuid: string | null = null;
        if (p.listing_id) {
          const { data } = await sb.from("v_master_market").select("property_id").eq("listing_id", p.listing_id).maybeSingle();
          listingUuid = data?.property_id ?? null;
        }
        const { error: e } = await sb.from("deal_desk_posts").insert({
          side: sideOf(p.kind),
          kind: p.kind,
          asset_class: p.asset_class,
          title: p.title,
          notes: p.body,
          budget_min: p.budget_min,
          budget_max: p.budget_max,
          district: p.district,
          listing_id: listingUuid,
          is_blind: p.blind,
        });
        if (e) throw new Error(e.message);
        return load();
      }
      const now = new Date();
      const post: FeedPost = {
        ...p,
        side: sideOf(p.kind),
        id: `local-${now.getTime()}`,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + TTL_MS).toISOString(),
        author,
        mine: true,
        interest_count: 0,
      };
      writeLocal([post, ...readLocal()]);
    },
    [author, user, load],
  );

  const remove = useCallback(
    async (id: string) => {
      const sb = supabase();
      if (user && sb) {
        const { error: e } = await sb.from("deal_desk_posts").delete().eq("id", id);
        if (e) throw new Error(e.message);
        return load();
      }
      writeLocal(readLocal().filter((p) => p.id !== id));
    },
    [user, load],
  );

  /** "I'm interested" on someone else's post (toggle). */
  const setInterest = useCallback(
    async (id: string, on: boolean, note?: string) => {
      const sb = supabase();
      if (user && sb) {
        const { error: e } = on
          ? await sb.from("deal_desk_interest").insert({ post_id: id, note: note?.trim() || null })
          : await sb.from("deal_desk_interest").delete().eq("post_id", id).eq("user_id", user.id);
        if (e) throw new Error(e.message);
        return load();
      }
      const cur = readInterest();
      writeInterest(on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id));
    },
    [user, load],
  );

  /** Who responded to one of your posts (live accounts only). */
  const responders = useCallback(
    async (id: string): Promise<Responder[]> => {
      const sb = supabase();
      if (!user || !sb) return [];
      const { data, error: e } = await sb.from("v_deal_desk_interest").select("*").eq("post_id", id).order("created_at", { ascending: false });
      if (e) throw new Error(e.message);
      return (data ?? []).map(responderFromRow);
    },
    [user],
  );

  // Re-check expiry every minute so posts drop off at 14 days.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // Local posts show the poster's current profile (photo, logo) like a live account would.
  const posts = useMemo(() => {
    const all = remoteMode
      ? remote && remote.uid === user?.id
        ? remote.posts
        : []
      : [...local.map((p) => (author ? { ...p, author } : p)) ].map((p) => ({ ...p, interested: localInterest.includes(p.id) }));
    return all.filter((p) => isLive(p, now)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [remoteMode, remote, user, local, localInterest, author, now]);

  return {
    posts,
    create,
    remove,
    setInterest,
    responders,
    refresh: load,
    error,
    loading: !ready || (remoteMode && remote?.uid !== user?.id && !error),
    shared: remoteMode,
  };
}
