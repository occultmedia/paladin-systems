"use client";

/*
 * Accounts (Supabase Auth). Configure with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   (the publishable / anon key, never the service key)
 * Until both are set the forms explain that sign-up opens soon instead of
 * pretending to work. The dashboard stays open as a demo; gate it once
 * billing is live.
 */

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { Billing } from "./site";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const authConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!authConfigured) return null;
  return (client ??= createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } }));
}

export type Role = "Agent" | "Investor" | "Brokerage";
export const ROLES: Role[] = ["Agent", "Investor", "Brokerage"];

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  plan: Billing;
  /** Feed profile details entered at sign-up (photo and logo upload after the first sign-in). */
  company?: string;
  title?: string;
  whatsapp?: string;
}

export type AuthResult = { ok: true; message?: string } | { ok: false; error: string };

const NOT_READY: AuthResult = { ok: false, error: "not-configured" };

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const sb = supabase();
  if (!sb) return NOT_READY;
  const { data, error } = await sb.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.name.trim(),
        role: input.role,
        plan: input.plan,
        company: input.company?.trim() ?? "",
        title: input.title?.trim() ?? "",
        whatsapp: input.whatsapp?.trim() ?? "",
      },
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: data.session ? undefined : "confirm-email" };
}

export async function logIn(email: string, password: string): Promise<AuthResult> {
  const sb = supabase();
  if (!sb) return NOT_READY;
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function sendReset(email: string): Promise<AuthResult> {
  const sb = supabase();
  if (!sb) return NOT_READY;
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function logOut() {
  await supabase()?.auth.signOut();
}

/** The signed-in user (null when signed out or auth is not configured). */
export function useUser() {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: !authConfigured });
  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    let live = true;
    sb.auth.getSession().then(({ data }) => live && setState({ user: data.session?.user ?? null, ready: true }));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setState({ user: session?.user ?? null, ready: true }));
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}

export const displayName = (u: User) => (u.user_metadata?.full_name as string | undefined) || u.email?.split("@")[0] || "Account";
