"use client";

/* Client side of AI Signal: fetch the brief / a listing note once per visit. */

import { useEffect, useState } from "react";
import type { ListingNote, MarketBrief, WithSource } from "./signal-ai";

const memo = new Map<string, Promise<unknown>>();

function load<T>(key: string, body: object): Promise<T> {
  let p = memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetch("/api/signal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => {
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

export const useMarketBrief = (enabled = true) =>
  useSignal<WithSource<MarketBrief>>(enabled ? "brief" : null, enabled ? { kind: "brief" } : null);

export const useListingNote = (id: string | null) =>
  useSignal<WithSource<ListingNote>>(id ? `listing:${id}` : null, id ? { kind: "listing", id } : null);
