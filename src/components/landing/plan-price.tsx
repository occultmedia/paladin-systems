"use client";

import { useState } from "react";
import { PLANS, YEARLY_SAVINGS_USD, type Billing } from "@/lib/site";

/** Monthly / yearly switch and the price for the Aruba plan. */
export function PlanPrice() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const plan = PLANS[billing];
  return (
    <div>
      <div role="radiogroup" aria-label="Billing" className="inline-flex rounded-full bg-zinc-100 p-1 text-[13px] font-semibold">
        {(["monthly", "yearly"] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={billing === b}
            onClick={() => setBilling(b)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-colors ${billing === b ? "bg-zinc-950 text-white" : "text-zinc-600 hover:text-zinc-950"}`}
          >
            {b === "monthly" ? "Monthly" : "Yearly"}
            {b === "yearly" && (
              <span className={`rounded-full px-1.5 py-px text-[10.5px] ${billing === b ? "bg-mint text-zinc-950" : "bg-zinc-950 text-mint"}`}>
                Save ${YEARLY_SAVINGS_USD}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-5 font-display text-[48px] font-bold leading-none tracking-tight tabular-nums text-zinc-950 sm:text-[56px]">
        ${plan.price.toLocaleString("en-US")}
        <span className="ml-1 text-[16px] font-semibold text-zinc-500">/{plan.per}</span>
      </p>
      <p className="mt-2 text-[13px] text-zinc-500">
        {billing === "monthly"
          ? "Billed monthly. Cancel anytime."
          : `One payment for 12 months. That is $${Math.round(PLANS.yearly.price / 12)}/month, $${YEARLY_SAVINGS_USD} less than paying monthly.`}
      </p>
    </div>
  );
}
