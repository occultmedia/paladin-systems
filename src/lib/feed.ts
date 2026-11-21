"use client";

/*
 * The Feed: members post updates and offers (off-market deals, listings for
 * co-broke, buyer requests, rentals, partnerships) that every Sequence
 * Terminal member can see and respond to by contacting the poster directly.
 * No chat, no comments. Every post deletes itself 48 hours after it goes up.
 *
 * Same two backends as profiles:
 *  - Supabase `feed_posts` (joined to `profiles`) once accounts are live.
 *  - This browser until then, plus sample posts so the Feed is not empty.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase, useUser } from "./auth";
import { rowToProfile, type Profile } from "./profile";

export const POST_KINDS = ["Update", "Off-market", "For sale", "Buyer request", "For rent", "Partnership"] as const;
export type PostKind = (typeof POST_KINDS)[number];

/** Post types that are offers (they can carry a price). "Update" is a plain post. */
export const isOffer = (k: PostKind) => k !== "Update";

/** Posts are removed automatically this long after they are published. */
export const FEED_TTL_HOURS = 48;
const TTL_MS = FEED_TTL_HOURS * 36e5;
export const expiresAt = (iso: string) => Date.parse(iso) + TTL_MS;
const isLive = (iso: string, now = Date.now()) => expiresAt(iso) > now;

export const POST_KIND_HINT: Record<PostKind, string> = {
  Update: "Market news, a sale you closed, an open house, anything members should know",
  "Off-market": "A property you can sell quietly, not on public sites",
  "For sale": "A listing you want other agents to bring buyers to",
  "Buyer request": "A client looking for something specific",
  "For rent": "A long-term or vacation rental that is available",
  Partnership: "Co-broke, joint venture or an investor wanted",
};

export type FeedAuthor = Pick<Profile, "name" | "role" | "company" | "title" | "photo" | "logo" | "email" | "phone" | "whatsapp">;

export interface FeedPost {
  id: string;
  created_at: string; // ISO
  kind: PostKind;
  title: string;
  body: string;
  price_usd: number | null; // asking price, or budget for buyer requests
  district: string | null;
  author: FeedAuthor;
  mine?: boolean;
  sample?: boolean; // demo content: contact details are hidden
}

export interface NewPost {
  kind: PostKind;
  title: string;
  body: string;
  price_usd: number | null;
  district: string | null;
}

export const TITLE_MAX = 90;
export const BODY_MAX = 600;

/* ── sample posts (fictional people and companies) ─────────────────────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

const SAMPLES: FeedPost[] = [
  {
    id: "sample-1",
    created_at: ago(2),
    kind: "Off-market",
    title: "4-bed villa in Malmok, owner wants a quiet sale",
    body: "Ocean-view villa on a 1,100 m² lot, private pool, renovated 2023. Not listed anywhere. Owner will consider serious offers with proof of funds. Happy to co-broke 50/50.",
    price_usd: 2_150_000,
    district: "Malmok",
    author: { name: "Daniela Ruiz", role: "Agent", company: "Brightwater Realty", title: "Senior agent" },
    sample: true,
  },
  {
    id: "sample-2",
    created_at: ago(5),
    kind: "Buyer request",
    title: "Client looking for a beachfront condo, Eagle Beach",
    body: "2-bed condo, walking distance to the beach, rental program allowed. Cash buyer from Toronto, can close within 60 days.",
    price_usd: 900_000,
    district: "Eagle Beach",
    author: { name: "Marcus Hale", role: "Agent", company: "Northshore Property Group" },
    sample: true,
  },
  {
    id: "sample-3",
    created_at: ago(11),
    kind: "Partnership",
    title: "Investor wanted: 6-unit rental project in Noord",
    body: "Land secured and permits submitted for six 1-bed vacation units. Looking for a capital partner for 40%. Projections and drawings available on request.",
    price_usd: 650_000,
    district: "Noord",
    author: { name: "Elena Vos", role: "Investor", company: "Coastline Ventures" },
    sample: true,
  },
  {
    id: "sample-4",
    created_at: ago(26),
    kind: "For rent",
    title: "Furnished 3-bed house, long-term, Tierra del Sol",
    body: "Available from January. Golf course view, 12-month minimum. Suits a relocating family or executive.",
    price_usd: 4_200,
    district: "Tierra del Sol",
    author: { name: "Ricardo Lopes", role: "Brokerage", company: "Island Key Homes" },
    sample: true,
  },
  {
    id: "sample-6",
    created_at: ago(8),
    kind: "Update",
    title: "Open house Saturday 10am to 1pm, Palm Beach condo",
    body: "Agents welcome to bring clients. Corner unit, 2 bed, pool view. Coffee and floor plans on site.",
    price_usd: null,
    district: "Palm Beach",
    author: { name: "Daniela Ruiz", role: "Agent", company: "Brightwater Realty", title: "Senior agent" },
    sample: true,
  },
  {
    id: "sample-5",
    created_at: ago(40),
    kind: "For sale",
    title: "Commercial unit on main road, Oranjestad: co-broke welcome",
    body: "Ground floor retail, 180 m², currently leased until 2027. Good yield for an investor client. 3% to the buyer's agent.",
    price_usd: 780_000,
    district: "Oranjestad",
    author: { name: "Sofia Martens", role: "Agent", company: "Harbor Lane Real Estate" },
    sample: true,
  },
];

/* ── local (this browser) ─────────────────────────────────────────────── */

const KEY = "signal.feed.v1";
const EMPTY: FeedPost[] = [];
const listeners = new Set<() => void>();
let cache: FeedPost[] | null = null;

function readLocal(): FeedPost[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const all = Array.isArray(parsed) ? (parsed as FeedPost[]).filter((p) => p && typeof p.id === "string") : [];
    cache = all.filter((p) => isLive(p.created_at));
    // Expired posts are deleted, not just hidden.
    if (cache.length !== all.length) window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    cache = [];
  }
  return cache;
}

function writeLocal(next: FeedPost[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error("Your browser storage is full.");
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

/* ── Supabase ─────────────────────────────────────────────────────────── */

const SELECT =
  "id, created_at, kind, title, body, price_usd, district, author_id, author:profiles(name, role, company, title, email, phone, whatsapp, photo_url, logo_url)";

interface PostRow {
  id: string;
  created_at: string;
  kind: PostKind;
  title: string;
  body: string;
  price_usd: number | null;
  district: string | null;
  author_id: string;
  author: Parameters<typeof rowToProfile>[0] | null;
}

const fromRow = (r: PostRow, uid: string): FeedPost => ({
  id: r.id,
  created_at: r.created_at,
  kind: r.kind,
  title: r.title,
  body: r.body,
  price_usd: r.price_usd === null ? null : Number(r.price_usd),
  district: r.district,
  author: r.author ? rowToProfile(r.author) : { name: "Member", role: "Agent", company: "" },
  mine: r.author_id === uid,
});

/* ── hook ─────────────────────────────────────────────────────────────── */

export function useFeed(author: Profile | null) {
  const { user, ready } = useUser();
  const local = useSyncExternalStore(subscribe, readLocal, () => EMPTY);
  const [remote, setRemote] = useState<{ uid: string; posts: FeedPost[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remoteMode = Boolean(user && supabase());

  const load = useCallback(async () => {
    const sb = supabase();
    if (!user || !sb) return;
    const since = new Date(Date.now() - TTL_MS).toISOString();
    const { data, error: e } = await sb.from("feed_posts").select(SELECT).gt("created_at", since).order("created_at", { ascending: false }).limit(200);
    if (e) return setError(e.message);
    setError(null);
    setRemote({ uid: user.id, posts: ((data ?? []) as unknown as PostRow[]).map((r) => fromRow(r, user.id)) });
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (p: NewPost) => {
      const sb = supabase();
      if (!author) throw new Error("Set up your profile before posting.");
      if (user && sb) {
        const { error: e } = await sb.from("feed_posts").insert({ ...p, author_id: user.id });
        if (e) throw new Error(e.message);
        return load();
      }
      const post: FeedPost = { ...p, id: `local-${Date.now()}`, created_at: new Date().toISOString(), author, mine: true };
      writeLocal([post, ...readLocal()]);
    },
    [author, user, load],
  );

  const remove = useCallback(
    async (id: string) => {
      const sb = supabase();
      if (user && sb) {
        const { error: e } = await sb.from("feed_posts").delete().eq("id", id).eq("author_id", user.id);
        if (e) throw new Error(e.message);
        return load();
      }
      writeLocal(readLocal().filter((p) => p.id !== id));
    },
    [user, load],
  );

  // Re-check expiry every minute so posts drop off the Feed at 48 hours.
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
      : [...local.map((p) => (author ? { ...p, author } : p)), ...SAMPLES];
    return all.filter((p) => isLive(p.created_at, now)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [remoteMode, remote, user, local, author, now]);

  return {
    posts,
    create,
    remove,
    refresh: load,
    error,
    loading: !ready || (remoteMode && remote?.uid !== user?.id && !error),
    shared: remoteMode,
  };
}
