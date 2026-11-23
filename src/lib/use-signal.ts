"use client";

/*
 * Client side of AI Signal: fetch the brief / a listing note once per visit.
 * Sends the member's access token; the server reads the live market with it.
 */

import { useEffect, useState } from "react";
import { supabase } from "./auth";
import type { ListingNote, MarketBrief, WithSource } from "./signal-ai";

const memo = new Map<string, Promise<unknown>>();

async function authHeader(): Promise<Record<string, string>> {
  const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function load<T>(key: string, body: object): Promise<T> {
  let p = memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = authHeader().then((auth) =>
      fetch("/api/signal", { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify(body) }),
    ).then((r) => {
      if (!r.ok) throw new Error(`AI Signal ${r.status}`);
      return r.json() as Promise<T>;
    });
    memo.set(key, p);
    p.catch(() => memo.delete(key)); // allow a retry on the next open
  }
  return p;
}

type State<T> = { data: T | null; error: boolean };

function useSignal<T>(key: string | null, body: object | null): State<T> & { loading: boolean } {
  const [state, setState] = useState<{ key: string | null } & State<T>>({ key: null, data: null, error: false });
  useEffect(() => {
    if (!key || !body) return;
    let live = true;
    load<T>(key, body).then(
      (data) => live && setState({ key, data, error: false }),
      () => live && setState({ key, data: null, error: true }),
    );
    return () => {
      live = false;
    };
    // body is derived from key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key ? state : { data: null, error: false };
  return { ...current, loading: !!key && !current.data && !current.error };
}

/** `version` changes when the market does (null = no listings yet, nothing to brief). */
export const useMarketBrief = (version: string | null) =>
  useSignal<WithSource<MarketBrief>>(version ? `brief:${version}` : null, version ? { kind: "brief" } : null);

/** `version` changes when the listing does (price, status, last Index run). */
export const useListingNote = (id: string | null, version = "") =>
  useSignal<WithSource<ListingNote>>(id ? `listing:${id}:${version}` : null, id ? { kind: "listing", id } : null);
