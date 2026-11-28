"use client";

/*
 * Which plan a member is on, how they are billed, and asking to move to Pro.
 *
 * The plan that unlocks Pro is `app_metadata.plan` on the Supabase account.
 * Only the server (service role) can write app_metadata, so a member cannot
 * give themselves Pro from the browser. It is set to "pro" once the Pro
 * payment is received; anything else is Standard.
 *
 * `user_metadata.requested_plan` is what the member asked for (at sign-up or
 * with "Upgrade to Pro" in Settings). It unlocks nothing on its own.
 * `user_metadata.billing_cycle` is how they want to be billed, monthly or
 * yearly (older accounts kept it in `user_metadata.plan`).
 *
 * When the auction and social media tables exist, their RLS policies must
 * check the same field: (auth.jwt() -> 'app_metadata' ->> 'plan') = 'pro'.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase, useUser } from "./auth";
import { billingOf, planOf, type Billing, type Plan } from "./site";

// A login carries the app_metadata it was issued with until it renews itself
// (up to an hour). Ask the server for the account once per page load, so a plan
// set there (Pro paid, or given by hand) shows on the next visit. This reads the
// account only; it never renews the login (that is the auth library's job, and
// renewing it from here as well made the two clash).
let fresh: { id: string; plan: unknown } | null = null;
const freshListeners = new Set<() => void>();

export function usePlan() {
  const { user } = useUser();
  const [, rerender] = useState(0);
  useEffect(() => {
    const sb = supabase();
    if (!user || !sb) return;
    const bump = () => rerender((n) => n + 1);
    freshListeners.add(bump);
    if (fresh?.id !== user.id) {
      fresh = { id: user.id, plan: undefined };
      sb.auth.getUser().then(({ data }) => {
        if (data.user?.id !== user.id) return;
        fresh = { id: user.id, plan: (data.user.app_metadata as { plan?: unknown }).plan };
        freshListeners.forEach((f) => f());
      });
    }
    return () => {
      freshListeners.delete(bump);
    };
  }, [user]);
  const serverPlan = user && fresh?.id === user.id && fresh.plan !== undefined ? fresh.plan : undefined;
  const plan: Plan = planOf(serverPlan ?? (user?.app_metadata as { plan?: unknown } | undefined)?.plan);
  const meta = user?.user_metadata as { requested_plan?: unknown; requested_plan_at?: string; billing_cycle?: unknown; plan?: unknown } | undefined;
  const billing: Billing = billingOf(meta?.billing_cycle ?? meta?.plan);
  const requested = plan !== "pro" && meta?.requested_plan === "pro" ? (meta.requested_plan_at ?? "") : null;

  const update = useCallback(
    async (data: Record<string, unknown>) => {
      const sb = supabase();
      if (!user || !sb) throw new Error("Sign in first.");
      const { error } = await sb.auth.updateUser({ data });
      if (error) throw new Error(error.message);
    },
    [user],
  );
  const requestPro = useCallback(() => update({ requested_plan: "pro", requested_plan_at: new Date().toISOString() }), [update]);
  const setBilling = useCallback((b: Billing) => update({ billing_cycle: b }), [update]);

  return {
    plan,
    billing,
    isPro: plan === "pro",
    signedIn: Boolean(user),
    /** ISO time the upgrade was asked for, "" if unknown, null if not asked */
    requested,
    requestPro,
    setBilling,
  };
}
