"use client";

/*
 * The Pro tab: property auctions, listings indexed from social media, and
 * short-term rental income from Airbnb (rental-income.tsx).
 * Standard members see it locked, with the way to upgrade. Pro members see
 * the sections; both are empty until those Index runs start.
 */

import { AuctionsView } from "./auctions";
import { ProBadge } from "@/components/pro-badge";
import { BedDouble, Check, Gavel, Loader2, Lock, MessageCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { GrainField } from "@/components/landing/grain-field";
import { usePlan } from "@/lib/plan";
import { PLANS, fmtPlanPrice, type Billing } from "@/lib/site";
import { RentalIncome } from "./rental-income";

/** The Pro pages. Each has its own tab and address: /dashboard?tab=pro&section=<key>. */
const SECTIONS = [
  {
    key: "auctions",
    label: "Auctions",
    icon: Gavel,
    title: "Property auctions",
    text: "Homes, land and commercial property going to auction in Aruba, with the auction date, starting bid and where to register.",
    columns: ["Auction date", "Property", "District", "Starting bid", "Where to register"],
  },
  {
    key: "social",
    label: "Social media",
    icon: MessageCircle,
    title: "Social media listings",
    text: "Properties offered on social media that are not on any agency site, indexed and placed on the map next to agency listings.",
    columns: ["Posted", "Property", "District", "Asking", "Contact"],
  },
  {
    key: "rentals",
    label: "Airbnb income",
    icon: BedDouble,
    title: "Short-term rental income",
    text: "What a home could earn on Airbnb: nightly rates and occupancy by area, and a calculator for yearly income and yield.",
    columns: [],
  },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];
const sectionOf = (v: string | null): SectionKey => SECTIONS.find((x) => x.key === v)?.key ?? "auctions";

/** Grey placeholder rows under real column names: shows the list without showing any data. */
function GhostTable({ columns }: { columns: readonly string[] }) {
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };
  return (
    <div aria-hidden className="overflow-hidden rounded-lg border border-zinc-200">
      <div className="grid gap-3 bg-zinc-50 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500" style={grid}>
        {columns.map((c) => (
          <span key={c} className="truncate">{c}</span>
        ))}
      </div>
      {[0.92, 0.7, 0.84, 0.62, 0.78, 0.88].map((w, r) => (
        <div key={r} className="grid items-center gap-3 border-t border-zinc-100 px-4 py-3.5" style={grid}>
          {columns.map((c, i) => (
            <span key={c} className={`block h-2.5 rounded ${i === 1 ? "bg-zinc-300" : "bg-zinc-200"}`} style={{ width: `${(i === 1 ? w : 0.4 + ((w * (i + 3)) % 0.45)) * 100}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListPage({ section, isPro }: { section: (typeof SECTIONS)[number]; isPro: boolean }) {
  return (
    <section aria-label={section.title} className="rounded-2xl border border-zinc-200 p-4 sm:p-5">
      <div className="relative">
        <div className={isPro ? "opacity-50" : "select-none blur-[2px]"}>
          <GhostTable columns={section.columns} />
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <p className="rounded-full bg-white/90 px-4 py-2 text-center text-[12.5px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200">
            {isPro ? "The first Index run for this is coming soon." : `Unlock with ${PLANS.pro.name}`}
          </p>
        </div>
      </div>
    </section>
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
  const params = useSearchParams();
  const [section, setSectionState] = useState<SectionKey>(() => sectionOf(params.get("section")));
  const setSection = (k: SectionKey) => {
    setSectionState(k);
    window.history.replaceState(null, "", `?tab=pro&section=${k}`);
  };
  const current = SECTIONS.find((x) => x.key === section)!;

  return (
    <div className="pb-8 sm:pb-10">
      <div className="deck bleed relative isolate">
        <GrainField variant="ink" particles={false} className="-z-10" />
        <div className="mx-auto max-w-[1400px] px-4 pt-8 sm:px-6 sm:pt-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{isPro ? "Included in your plan" : "Pro plan"}</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-[28px] font-bold tracking-tight text-white sm:text-[34px]">
            {current.title}
            {isPro ? <ProBadge size="md" /> : <Lock size={20} strokeWidth={2} className="text-zinc-500" aria-label="Locked" />}
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-zinc-400">{current.text}</p>
          <nav aria-label="Pro sections" className="no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const on = section === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSection(key)}
                  className={`relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-[13px] font-medium transition-colors ${
                    on ? "border-lime text-white" : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  {label}
                  {!isPro && <Lock size={11} strokeWidth={2} className="text-zinc-500" />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {!isPro && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-950 bg-white p-5 shadow-[0_0_0_3px_rgb(172_250_104/0.45)] sm:p-6">
          <div>
            <p className="font-display text-[17px] font-bold text-zinc-950">You&rsquo;re on {PLANS.standard.name}</p>
            <p className="mt-1 max-w-xl text-[13px] text-zinc-600">
              Pro adds property auctions, social media listings and Airbnb rental income for {fmtPlanPrice("pro", billing)}, instead of {fmtPlanPrice("standard", billing)}.
            </p>
          </div>
          <UpgradeButton />
        </div>
      )}

      <div className="mt-6">
        {current.key === "rentals" ? (
          <RentalIncome locked={!isPro} />
        ) : current.key === "auctions" && isPro ? (
          <AuctionsView />
        ) : (
          <ListPage section={current} isPro={isPro} />
        )}
      </div>
    </div>
  );
}
