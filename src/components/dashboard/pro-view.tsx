"use client";

/*
 * The Pro tab: property auctions and listings indexed from social media.
 * Standard members see it locked, with the way to upgrade. Pro members see
 * the sections; both are empty until those Index runs start.
 */

import { Check, Gavel, Loader2, Lock, MessageCircle } from "lucide-react";
import { useState } from "react";
import { GrainField } from "@/components/landing/grain-field";
import { usePlan } from "@/lib/plan";
import { PLANS, fmtPlanPrice, type Billing } from "@/lib/site";

const SECTIONS = [
  {
    icon: Gavel,
    title: "Property auctions",
    text: "Homes, land and commercial property going to auction in Aruba, with the auction date, starting bid and where to register.",
  },
  {
    icon: MessageCircle,
    title: "Social media listings",
    text: "Properties offered on social media that are not on any agency site, indexed and placed on the map next to agency listings.",
  },
] as const;

/** Grey placeholder rows: shows that there is a list here without showing any data. */
function GhostRows() {
  return (
    <div aria-hidden className="space-y-2.5">
      {[0.92, 0.78, 0.86, 0.7].map((w, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-2.5">
          <span className="size-10 shrink-0 rounded-md bg-zinc-100" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-2.5 rounded bg-zinc-200" style={{ width: `${w * 70}%` }} />
            <span className="block h-2 rounded bg-zinc-100" style={{ width: `${w * 45}%` }} />
          </span>
          <span className="h-3 w-14 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

export function UpgradeButton({ className = "", billing }: { className?: string; /** defaults to how the member is billed now */ billing?: Billing }) {
  const { requested, requestPro, setBilling, signedIn, billing: current } = usePlan();
  const cycle = billing ?? current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (requested !== null)
    return (
      <p className={`inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-[12.5px] font-medium text-zinc-700 ${className}`}>
        <Check size={14} strokeWidth={2.5} /> Upgrade requested. We&rsquo;ll email your Pro invoice.
      </p>
    );
  return (
    <span className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <button
        type="button"
        disabled={busy || !signedIn}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            if (cycle !== current) await setBilling(cycle);
            await requestPro();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not send the request.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 font-display text-[13px] font-semibold text-lime transition-colors hover:bg-zinc-800 disabled:opacity-60"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        Upgrade to Pro · {fmtPlanPrice("pro", cycle)}
      </button>
      {!signedIn && <span className="text-[11.5px] text-zinc-500">Sign in to upgrade.</span>}
      {error && <span className="text-[11.5px] text-[#B23A3A]">{error}</span>}
    </span>
  );
}

export function ProView() {
  const { isPro, billing } = usePlan();
  return (
    <div className="pb-8 sm:pb-10">
      <div className="deck bleed relative isolate">
        <GrainField variant="ink" particles={false} className="-z-10" />
        <div className="mx-auto max-w-[1400px] px-4 pb-8 pt-8 sm:px-6 sm:pt-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{isPro ? "Included in your plan" : "Pro plan"}</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-[28px] font-bold tracking-tight text-white sm:text-[34px]">
            Pro data
            {!isPro && <Lock size={20} strokeWidth={2} className="text-zinc-500" aria-label="Locked" />}
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-zinc-400">
            Property auctions and listings from social media: deals that never reach an agency site.
          </p>
        </div>
      </div>

      {!isPro && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-950 bg-white p-5 shadow-[0_0_0_3px_rgb(172_250_104/0.45)] sm:p-6">
          <div>
            <p className="font-display text-[17px] font-bold text-zinc-950">You&rsquo;re on {PLANS.standard.name}</p>
            <p className="mt-1 max-w-xl text-[13px] text-zinc-600">
              Pro adds property auctions and social media listings for {fmtPlanPrice("pro", billing)}, instead of {fmtPlanPrice("standard", billing)}.
            </p>
          </div>
          <UpgradeButton />
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {SECTIONS.map(({ icon: Icon, title, text }) => (
          <section key={title} className="rounded-2xl border border-zinc-200 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-950 text-lime">
                <Icon size={17} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-zinc-950">
                  {title}
                  {!isPro && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime">
                      <Lock size={9} strokeWidth={2.5} /> Pro
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{text}</p>
              </div>
            </div>
            <div className="relative mt-5">
              <div className={isPro ? "opacity-40" : "select-none blur-[2px]"}>
                <GhostRows />
              </div>
              <div className="absolute inset-0 grid place-items-center">
                <p className="rounded-full bg-white/90 px-4 py-2 text-center text-[12.5px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200">
                  {isPro ? "The first Index run for this is coming soon." : `Unlock with ${PLANS.pro.name}`}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
