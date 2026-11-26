"use client";

/*
 * Which plan a member is on, and asking to move to Pro.
 *
 * The plan that unlocks Pro is `app_metadata.plan` on the Supabase account.
 * Only the server (service role) can write app_metadata, so a member cannot
 * give themselves Pro from the browser. It is set to "pro" once the Pro
 * payment is received; anything else is Standard.
 *
 * `user_metadata.requested_plan` is what the member asked for (at sign-up or
 * with "Upgrade to Pro" in Settings). It unlocks nothing on its own.
 *
 * When the auction and social media tables exist, their RLS policies must
 * check the same field: (auth.jwt() -> 'app_metadata' ->> 'plan') = 'pro'.
 */

import { useCallback } from "react";
import { supabase, useUser } from "./auth";
import { planOf, type Plan } from "./site";

export function usePlan() {
  const { user } = useUser();
  const plan: Plan = planOf((user?.app_metadata as { plan?: unknown } | undefined)?.plan);
  const meta = user?.user_metadata as { requested_plan?: unknown; requested_plan_at?: string } | undefined;
  const requested = plan !== "pro" && meta?.requested_plan === "pro" ? (meta.requested_plan_at ?? "") : null;

  const requestPro = useCallback(async () => {
    const sb = supabase();
    if (!user || !sb) throw new Error("Sign in to upgrade.");
    const { error } = await sb.auth.updateUser({ data: { requested_plan: "pro", requested_plan_at: new Date().toISOString() } });
    if (error) throw new Error(error.message);
  }, [user]);

  return {
    plan,
    isPro: plan === "pro",
    signedIn: Boolean(user),
    /** ISO time the upgrade was asked for, "" if unknown, null if not asked */
    requested,
    requestPro,
  };
}
