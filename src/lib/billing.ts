"use client";

/*
 * Billing preferences: which plan, how the member prefers to pay, and where
 * invoices go. No card or bank numbers are ever stored here; those are entered
 * on the payment provider's own checkout once billing goes live.
 *
 * Signed in (Supabase): saved on the account (auth user metadata `plan` and
 * `billing`). Otherwise this browser, so the settings page works as a preview.
 */

import { useCallback, useSyncExternalStore } from "react";
import { supabase, useUser } from "./auth";
import type { Billing } from "./site";

export const PAY_METHODS = {
  card: "Credit or debit card",
  bank: "Bank transfer (Aruba bank)",
  invoice: "Monthly invoice to my company",
} as const;
export type PayMethod = keyof typeof PAY_METHODS;

export interface BillingPrefs {
  plan: Billing;
  method: PayMethod;
  billing_email: string;
  invoice_name: string; // person or company on the invoice
  tax_id?: string; // KvK / crib number, optional
  address?: string;
  receipts: boolean; // email a receipt for every payment
}

export const DEFAULT_BILLING: BillingPrefs = { plan: "monthly", method: "card", billing_email: "", invoice_name: "", receipts: true };

const KEY = "signal.billing.v1";
const listeners = new Set<() => void>();
let cache: BillingPrefs | null | undefined;

function readLocal(): BillingPrefs | null {
  if (cache !== undefined) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_BILLING, ...(JSON.parse(raw) as Partial<BillingPrefs>) } : null;
  } catch {
    cache = null;
  }
  return cache;
}

function writeLocal(b: BillingPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* storage full: keep for this visit */
  }
  cache = b;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useBilling() {
  const { user } = useUser();
  const local = useSyncExternalStore(subscribe, readLocal, () => null);
  const sb = supabase();
  const meta = user?.user_metadata as { plan?: Billing; billing?: Partial<BillingPrefs> } | undefined;
  const fromAccount: BillingPrefs | null = user ? { ...DEFAULT_BILLING, billing_email: user.email ?? "", ...(meta?.billing ?? {}), plan: meta?.plan ?? meta?.billing?.plan ?? "monthly" } : null;
  const prefs = fromAccount ?? local ?? DEFAULT_BILLING;

  const save = useCallback(
    async (b: BillingPrefs) => {
      const client = supabase();
      if (user && client) {
        const { error } = await client.auth.updateUser({ data: { plan: b.plan, billing: b } });
        if (error) throw new Error(error.message);
        return;
      }
      writeLocal(b);
    },
    [user],
  );

  return { prefs, save, shared: Boolean(user && sb) };
}
