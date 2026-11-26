"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { useSyncExternalStore } from "react";
import { BILLING_LABEL, BILLING_ORDER, PER, PLANS, PRO_FEATURES, yearlySavings, type Billing, type Plan } from "@/lib/site";

const STANDARD_FEATURES = [
  "Listings from Aruba agencies, updated daily",
  "Value signal, price history and Confidence Score",
  "AI morning briefing and a note on every listing",
  "Watchlist and interested clients",
  "Members-only Market feed",
  "3D map, agent contact and CSV export",
];

/* One Monthly / Yearly choice shared by both plan cards. */
let billing: Billing = "monthly";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const setBilling = (b: Billing) => {
  billing = b;
  listeners.forEach((l) => l());
};
const useBillingChoice = () => useSyncExternalStore(subscribe, () => billing, () => "monthly" as Billing);

/** Monthly / yearly switch above the plan cards. */
export function BillingToggle() {
  const current = useBillingChoice();
  return (
    <div role="radiogroup" aria-label="Billing" className="inline-flex rounded-full bg-white/70 p-1 text-[13px] font-semibold ring-1 ring-zinc-950/10">
      {BILLING_ORDER.map((b) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={current === b}
          onClick={() => setBilling(b)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-colors ${current === b ? "bg-zinc-950 text-white" : "text-zinc-600 hover:text-zinc-950"}`}
        >
          {BILLING_LABEL[b]}
          {b === "yearly" && <span className={`rounded-full px-1.5 py-px text-[10.5px] ${current === b ? "bg-lime text-zinc-950" : "bg-zinc-950 text-lime"}`}>Save up to ${yearlySavings("pro")}</span>}
        </button>
      ))}
    </div>
  );
}

/** One plan on the pricing section: its price for the chosen billing, what is in it, and sign-up. */
export function PlanPrice({ plan }: { plan: Plan }) {
  const b = useBillingChoice();
  const p = PLANS[plan];
  const pro = plan === "pro";
  return (
    <div className="flex h-full flex-col">
      <p className="flex items-center gap-2 font-display text-[18px] font-bold text-zinc-950">
        {p.name}
        {pro && <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-lime">Most data</span>}
      </p>
      <p className="mt-5 font-display text-[44px] font-bold leading-none tracking-tight tabular-nums text-zinc-950 sm:text-[52px]">
        ${p.price[b].toLocaleString("en-US")}
        <span className="ml-1 text-[16px] font-semibold text-zinc-500">/{PER[b]}</span>
      </p>
      <p className="mt-2 text-[13px] text-zinc-500">
        {b === "monthly"
          ? `Billed monthly. Cancel anytime. Or $${p.price.yearly.toLocaleString("en-US")} a year.`
          : `One payment for 12 months, $${yearlySavings(plan)} less than paying monthly.`}
      </p>
      <p className="mt-3 text-[13px] text-zinc-600">{p.blurb}</p>
      <ul className="mt-7 flex-1 space-y-3">
        {pro && <li className="text-[13px] font-semibold text-zinc-950">Everything in Standard, plus:</li>}
        {(pro ? PRO_FEATURES : STANDARD_FEATURES).map((f) => (
          <li key={f} className="flex gap-3 text-[14px] text-zinc-700">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-zinc-950" />
            {f}
          </li>
        ))}
        {!pro && (
          <li className="flex items-center gap-3 text-[14px] text-zinc-400">
            <Lock size={12} strokeWidth={2} className="shrink-0" />
            Auctions and social media listings (Pro)
          </li>
        )}
      </ul>
      <Link
        href={`/signup?plan=${plan}&billing=${b}`}
        className={`shine group mt-8 inline-flex items-center gap-2.5 self-start rounded-full px-6 py-3.5 font-display text-[14px] font-semibold transition-[background-color,transform] duration-300 active:scale-[0.97] ${
          pro ? "bg-zinc-950 text-lime hover:bg-zinc-800" : "border border-zinc-950/15 bg-white/60 text-zinc-950 hover:bg-zinc-950 hover:text-white"
        }`}
      >
        Start with {p.name}
        <ArrowRight size={16} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </div>
  );
}
