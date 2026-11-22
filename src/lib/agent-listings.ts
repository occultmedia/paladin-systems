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
import {
  DISTRICT_CENTERS,
  MARKET_ID,
  type Agency,
  type Listing,
  type ListingAgent,
  type ListingBase,
  type ListingStatus,
  type Signal,
} from "./aruba-data";

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

/* ── to a dashboard listing ───────────────────────────────────────────── */

const DAY = 864e5;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const UNIT_TYPES = ["Condo", "Apartment", "Townhouse"];

/** Same idea as the scraped listings: compare $/sq ft with similar listings, same district when there are 3+. */
function compsFor(row: AgentListingViewRow, market: Listing[]) {
  const live = market.filter((l) => l.category === row.asset_class && !l.member && l.status !== "Sold" && l.status !== "De-listed");
  const kind =
    row.asset_class === "Property"
      ? live.filter((l) => UNIT_TYPES.includes(l.property_type) === UNIT_TYPES.includes(row.property_type))
      : live;
  const local = kind.filter((l) => l.district === row.district);
  const pool = local.length >= 3 ? local : kind;
  return { psf: Math.round(median(pool.map((l) => l.price_per_sqft_usd))), count: pool.length };
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
/** No pin: place it near the district centre (shown as approximate). */
function approxSpot(district: string, id: string) {
  const [lat, lng] = DISTRICT_CENTERS[district] ?? [12.52, -70.0];
  const h = hash(id);
  const a = ((h % 1000) / 1000) * Math.PI * 2;
  const r = 0.002 + (((h >> 10) % 100) / 100) * 0.003;
  return { lat: lat + Math.sin(a) * r, lng: lng + Math.cos(a) * r * 0.6 };
}

const STATUS_MAP: Record<AgentListingViewRow["listing_status"], ListingStatus> = {
  "For sale": "For sale",
  "Under contract": "Under contract",
  Sold: "Sold",
  Withdrawn: "De-listed",
};

export function agentRowToListing(row: AgentListingViewRow, market: Listing[], myId: string | null): Listing {
  const price = Number(row.asking_price_usd);
  const listed = row.created_at.slice(0, 10);
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(row.created_at)) / DAY));
  const company = row.owner_company.trim();
  const agency: Agency = {
    id: `member-${row.owner_id}`,
    name: company || row.owner_name,
    website: null,
    logo_url: row.owner_logo_url,
    color: "#0A0A0A",
  };
  const agent: ListingAgent = {
    id: row.owner_id,
    name: row.owner_name,
    title: row.owner_title ?? (row.owner_role === "Agent" ? "Agent" : row.owner_role),
    phone: row.owner_phone || row.owner_whatsapp || null,
    whatsapp: Boolean(row.owner_whatsapp),
    email: row.owner_email,
    photo_url: row.owner_photo_url,
    agency_id: agency.id,
  };
  const pinned = row.lat != null && row.lng != null;
  const spot = pinned ? { lat: row.lat!, lng: row.lng! } : approxSpot(row.district, row.id);
  const comps = compsFor(row, market);
  const size = row.asset_class === "Land" ? row.lot_sqft ?? 0 : row.built_sqft ?? 0;
  const psf = size ? Math.round(price / size) : 0;
  const vs = comps.psf && psf ? Math.round(((psf - comps.psf) / comps.psf) * 1000) / 10 : 0;
  const signal: Signal = comps.count < 2 || !psf ? "AT_MARKET" : vs <= -10 ? "UNDERVALUED" : vs >= 10 ? "OVERPRICED" : "AT_MARKET";

  const base: ListingBase = {
    listing_id: row.ref,
    market_id: row.market_id,
    asset_name: row.asset_name,
    district: row.district,
    ...spot,
    tenure: row.tenure,
    lease_years_left: row.lease_years_left,
    pool: row.asset_class === "Land" ? null : row.pool,
    is_new: days < 1,
    price_history: [{ date: listed, event: "Listed", price_usd: price, change_pct: null }],
    last_price_change: null,
    status: STATUS_MAP[row.listing_status],
    status_changed: row.listing_status === "For sale" ? null : row.updated_at.slice(0, 10),
    asking_price_usd: price,
    price_per_sqft_usd: psf,
    price_change_pct: 0,
    days_on_market: days,
    first_seen: listed,
    last_scraped: row.updated_at,
    last_found_at: row.updated_at,
    confidence_score: 100, // the listing agent vouches for it
    source: agency.name,
    source_url: null,
    agency,
    agent,
    signal,
    photo_url: row.photo_url,
    member: {
      id: row.id,
      visibility: row.visibility,
      mine: row.owner_id === myId,
      owner_id: row.owner_id,
      pinned,
      address: row.address,
      notes: row.notes,
      raw_status: row.listing_status,
      went_public: row.market_listing_id && row.went_public_at ? { listing_id: row.market_listing_id, at: row.went_public_at } : null,
      match:
        row.match_kind && row.match_ref && row.match_score != null
          ? { kind: row.match_kind, ref: row.match_ref, name: row.match_name ?? row.match_ref, score: row.match_score }
          : null,
      dup_acknowledged: row.dup_acknowledged,
    },
  };

  if (row.asset_class === "Land")
    return {
      ...base,
      category: "Land",
      property_type: "Land",
      lot_sqft: row.lot_sqft ?? 0,
      zoning: row.zoning ?? "Residential",
      district_land_psf_usd: comps.psf,
      price_vs_district_pct: vs,
    };
  if (row.asset_class === "Commercial")
    return {
      ...base,
      category: "Commercial",
      property_type: "Commercial",
      commercial_use: row.commercial_use ?? "Mixed-use",
      built_sqft: row.built_sqft ?? 0,
      lot_sqft: row.lot_sqft,
      district_commercial_psf_usd: comps.psf,
      price_vs_district_pct: vs,
    };
  return {
    ...base,
    category: "Property",
    property_type: row.property_type as Exclude<AgentListingViewRow["property_type"], "Land" | "Commercial">,
    bedrooms: row.bedrooms ?? 0,
    bathrooms: Number(row.bathrooms ?? 0),
    built_sqft: row.built_sqft ?? 0,
    lot_sqft: row.lot_sqft,
    comps_psf_usd: comps.psf,
    comps_count: comps.count,
    price_vs_comps_pct: vs,
  };
}

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
