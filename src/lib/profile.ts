"use client";

/*
 * Member profile: who you are on the Feed (name, company, photo, company
 * logo and how people reach you). It is filled in when the account is
 * created (sign-up step 2) and can be edited later from the account menu.
 *
 * Two backends behind one hook:
 *  - Supabase (when accounts are configured and you are signed in): the
 *    `profiles` table, images in the public `profile-media` bucket under
 *    your user id. See supabase/migrations/*_profiles_feed.sql.
 *  - This browser (localStorage) until then, so the Feed works as a demo.
 *    Sign-up also keeps the profile here until the new account's first
 *    sign-in (email confirmation means there is no session at sign-up), then
 *    uploads the photo and logo and removes the local copy.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { supabase, useUser, type Role } from "./auth";
import { dataUrlToBlob } from "./images";

export interface Profile {
  name: string;
  role: Role;
  company: string;
  title?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  photo?: string; // URL or data URL
  logo?: string; // URL or data URL
}

export const EMPTY_PROFILE: Profile = { name: "", role: "Agent", company: "" };

/** Enough to post: a name and at least one way to be contacted. */
export function profileComplete(p: Profile | null): p is Profile {
  return Boolean(p && p.name.trim() && (p.email?.trim() || p.phone?.trim() || p.whatsapp?.trim()));
}

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/* ── local (this browser) ─────────────────────────────────────────────── */

const KEY = "signal.profile.v1";
const listeners = new Set<() => void>();
let cache: Profile | null | undefined;

function readLocal(): Profile | null {
  if (cache !== undefined) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Profile) : null;
    cache = p && typeof p.name === "string" ? p : null;
  } catch {
    cache = null;
  }
  return cache;
}

function writeLocal(p: Profile) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    throw new Error("Your browser storage is full. Try smaller images.");
  }
  cache = p;
  listeners.forEach((l) => l());
}

function clearLocal() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
  cache = null;
  listeners.forEach((l) => l());
}

/** Called by the sign-up form: keeps the new member's profile until their first sign-in. */
export function saveSignupProfile(p: Profile) {
  writeLocal(p);
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

/* ── Supabase ─────────────────────────────────────────────────────────── */

interface ProfileRow {
  id: string;
  name: string;
  role: Role;
  company: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  logo_url: string | null;
}

export function rowToProfile(r: Omit<ProfileRow, "id">): Profile {
  return {
    name: r.name,
    role: r.role,
    company: r.company,
    title: r.title ?? undefined,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    whatsapp: r.whatsapp ?? undefined,
    photo: r.photo_url ?? undefined,
    logo: r.logo_url ?? undefined,
  };
}

async function uploadIfNew(uid: string, kind: "photo" | "logo", value?: string): Promise<string | null> {
  const sb = supabase();
  if (!sb || !value) return null;
  if (!value.startsWith("data:")) return value; // already a stored URL
  const blob = dataUrlToBlob(value);
  const path = `${uid}/${kind}-${Date.now()}.${blob.type === "image/jpeg" ? "jpg" : "png"}`;
  const { error } = await sb.storage.from("profile-media").upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return sb.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}

async function persist(uid: string, p: Profile): Promise<Profile> {
  const sb = supabase();
  if (!sb) throw new Error("Accounts are not configured.");
  const [photo_url, logo_url] = await Promise.all([uploadIfNew(uid, "photo", p.photo), uploadIfNew(uid, "logo", p.logo)]);
  const row: ProfileRow = {
    id: uid,
    name: p.name.trim(),
    role: p.role,
    company: p.company.trim(),
    title: p.title?.trim() || null,
    email: p.email?.trim() || null,
    phone: p.phone?.trim() || null,
    whatsapp: p.whatsapp?.trim() || null,
    photo_url,
    logo_url,
  };
  const { error } = await sb.from("profiles").upsert(row);
  if (error) throw new Error(error.message);
  return rowToProfile(row);
}

/** Fill gaps in the stored profile with what was entered at sign-up. */
function mergeSignup(stored: Profile | null, signup: Profile): Profile {
  if (!stored) return signup;
  const out: Profile = { ...signup };
  (Object.keys(stored) as (keyof Profile)[]).forEach((k) => {
    if (stored[k]) (out as unknown as Record<string, unknown>)[k] = stored[k];
  });
  return out;
}

/* ── hook ─────────────────────────────────────────────────────────────── */

export function useProfile() {
  const { user, ready } = useUser();
  const local = useSyncExternalStore(subscribe, readLocal, () => null);
  const [remote, setRemote] = useState<{ uid: string; profile: Profile | null } | null>(null);
  const remoteMode = Boolean(user && supabase());

  useEffect(() => {
    const sb = supabase();
    if (!user || !sb) return;
    let live = true;
    sb.from("profiles")
      .select("name, role, company, title, email, phone, whatsapp, photo_url, logo_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        let stored = data ? rowToProfile(data as ProfileRow) : null;
        const signup = readLocal();
        const sameAccount = signup && signup.email?.trim().toLowerCase() === user.email?.toLowerCase();
        if (sameAccount && (!stored || (!stored.photo && signup.photo) || (!stored.logo && signup.logo))) {
          try {
            stored = await persist(user.id, mergeSignup(stored, signup));
            clearLocal();
          } catch (err) {
            // Keep the local copy and try again on the next visit.
            console.warn("Baseline: could not save the sign-up photo/logo yet.", err);
          }
        } else if (sameAccount && stored) {
          clearLocal();
        }
        if (live) setRemote({ uid: user.id, profile: stored });
      });
    return () => {
      live = false;
    };
  }, [user]);

  const save = useCallback(
    async (p: Profile) => {
      if (!user || !supabase()) return writeLocal(p);
      setRemote({ uid: user.id, profile: await persist(user.id, p) });
    },
    [user],
  );

  const profile = remoteMode ? (remote && remote.uid === user?.id ? remote.profile : null) : local;
  const loading = !ready || (remoteMode && remote?.uid !== user?.id);
  // Prefill the email from the account the first time.
  const draft: Profile = profile ?? { ...EMPTY_PROFILE, name: (user?.user_metadata?.full_name as string) ?? "", email: user?.email ?? "" };

  return { profile, draft, save, loading, shared: remoteMode };
}
