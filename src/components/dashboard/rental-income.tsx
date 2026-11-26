"use client";

/*
 * Pro: short-term rental income (Airbnb). Area figures (typical nightly
 * rate and occupancy per district) will come from a licensed third-party
 * data provider (e.g. AirDNA). Airbnb itself is never crawled: its terms
 * forbid automated collection (decided with the owner, 26 November 2026).
 * Until the provider is connected the calculator runs on the member's own
 * numbers. No map: this is about income, not where the rentals are.
 */

import { BedDouble, Calculator, Lock } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { isClosed, type Listing, type ListingSignal } from "@/lib/aruba-data";

const usd = (n: number) => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString("en-US")}` : "—");
const pct = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}%` : "—");

interface Inputs {
  price: number; // purchase price, USD
  rate: number; // average nightly rate, USD
  occupancy: number; // % of nights booked
  fees: number; // platform + management, % of booking income
  costs: number; // running costs per month, USD (HOA, utilities, insurance, upkeep)
}

// Example numbers so the result is not empty; the member types their own.
const EXAMPLE: Inputs = { price: 450000, rate: 250, occupancy: 65, fees: 20, costs: 800 };

export function rentalIncome({ price, rate, occupancy, fees, costs }: Inputs) {
  const nights = 365 * (occupancy / 100);
  const gross = nights * rate;
  const net = gross * (1 - fees / 100) - costs * 12;
  // occupancy where the net income is zero
  const breakEven = rate > 0 && fees < 100 ? ((costs * 12) / (365 * rate * (1 - fees / 100))) * 100 : NaN;
  return {
    nights,
    gross,
    net,
    grossYield: price > 0 ? (gross / price) * 100 : NaN,
    netYield: price > 0 ? (net / price) * 100 : NaN,
    breakEven,
    payback: net > 0 && price > 0 ? price / net : NaN,
  };
}

function NumberField({ label, value, onChange, prefix, suffix, step = 1 }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; step?: number }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-zinc-700">
        {label}
      </label>
      <div className="flex items-center rounded-lg border border-zinc-300 bg-white px-3 transition-[border-color,box-shadow] focus-within:border-zinc-950 focus-within:shadow-[0_0_0_3px_rgb(172_250_104/0.45)]">
        {prefix && <span className="text-[13px] text-zinc-400">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="w-full bg-transparent px-1.5 py-2 text-[14px] tabular-nums text-zinc-950 outline-none"
        />
        {suffix && <span className="text-[13px] text-zinc-400">{suffix}</span>}
      </div>
    </div>
  );
}

function Result({ label, value, strong = false, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${strong ? "bg-zinc-950 text-white" : "bg-zinc-50"}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide ${strong ? "text-zinc-400" : "text-zinc-500"}`}>{label}</p>
      <p className={`mt-0.5 font-display text-[20px] font-bold tabular-nums ${strong ? "text-lime" : "text-zinc-950"}`}>{value}</p>
      {hint && <p className={`text-[11px] ${strong ? "text-zinc-400" : "text-zinc-500"}`}>{hint}</p>}
    </div>
  );
}

export function RentalIncome({ listings, locked }: { listings: Listing[]; locked: boolean }) {
  const [v, setV] = useState<Inputs>(EXAMPLE);
  const [from, setFrom] = useState("");
  const set = (k: keyof Inputs) => (n: number) => setV((x) => ({ ...x, [k]: n }));
  const r = rentalIncome(v);
  const homes = useMemo(
    () =>
      listings
        .filter((l): l is ListingSignal => l.category === "Property" && !isClosed(l))
        .sort((a, b) => a.asset_name.localeCompare(b.asset_name)),
    [listings],
  );
  const picked = homes.find((l) => l.listing_id === from);

  return (
    <section className="rounded-2xl border border-zinc-200 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-950 text-lime">
          <BedDouble size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-zinc-950">
            Short-term rental income (Airbnb)
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime">
                <Lock size={9} strokeWidth={2.5} /> Pro
              </span>
            )}
          </h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-zinc-600">
            For investors: what a home could earn as a holiday rental. Airbnb rentals in each area, with their nightly prices, size and bedrooms, give the typical rate and
            occupancy; the calculator turns that into yearly income and yield on the asking price.
          </p>
        </div>
      </div>

      <div className="relative">
      {locked && (
        <div className="absolute inset-0 z-10 grid place-items-center">
          <p className="rounded-full bg-white/90 px-4 py-2 text-center text-[12.5px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200">Unlock with Pro</p>
        </div>
      )}
      <div className={`mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] ${locked ? "pointer-events-none select-none blur-[3px]" : ""}`} aria-hidden={locked} inert={locked}>
        {/* area figures from Airbnb */}
        <div>
          <p className="text-[12.5px] font-semibold text-zinc-950">Nightly rates by area</p>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] bg-zinc-50 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
              <span>Area</span>
              <span className="text-right">Rentals</span>
              <span className="text-right">Nightly</span>
              <span className="text-right">Booked</span>
            </div>
            {["Noord", "Palm Beach", "Oranjestad", "Savaneta", "San Nicolas"].map((d) => (
              <div key={d} className="grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center border-t border-zinc-100 px-3 py-2.5 text-[13px]">
                <span className="text-zinc-700">{d}</span>
                <span className="ml-auto h-2.5 w-8 rounded bg-zinc-200" />
                <span className="ml-auto h-2.5 w-12 rounded bg-zinc-200" />
                <span className="ml-auto h-2.5 w-10 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
            The Airbnb figures are coming soon. Until then, enter the nightly rate and occupancy you expect.
          </p>
        </div>

        {/* calculator */}
        <div>
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-zinc-950">
            <Calculator size={14} strokeWidth={2} /> Rental income calculator
          </p>
          <div className="mt-2">
            <label htmlFor="rent-from" className="mb-1 block text-[12px] font-medium text-zinc-700">
              Start from a listing (optional)
            </label>
            <select
              id="rent-from"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                const l = homes.find((h) => h.listing_id === e.target.value);
                if (l) setV((x) => ({ ...x, price: l.asking_price_usd }));
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[13.5px] text-zinc-950 outline-none focus:border-zinc-950"
            >
              <option value="">Type your own price</option>
              {homes.map((l) => (
                <option key={l.listing_id} value={l.listing_id}>
                  {l.asset_name} · {l.district} · {usd(l.asking_price_usd)}
                </option>
              ))}
            </select>
            {picked && <p className="mt-1 text-[11.5px] text-zinc-500">{picked.bedrooms} bedrooms, listed by {picked.source}.</p>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberField label="Purchase price" prefix="$" value={v.price} onChange={(n) => (setFrom(""), set("price")(n))} step={1000} />
            <NumberField label="Nightly rate" prefix="$" value={v.rate} onChange={set("rate")} step={5} />
            <NumberField label="Occupancy" suffix="% of nights" value={v.occupancy} onChange={set("occupancy")} />
            <NumberField label="Platform & management" suffix="% of income" value={v.fees} onChange={set("fees")} />
            <div className="col-span-2">
              <NumberField label="Running costs per month (HOA, utilities, insurance, upkeep)" prefix="$" value={v.costs} onChange={set("costs")} step={50} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Result label="Income per year" value={usd(r.gross)} hint={`${Math.round(r.nights)} nights booked`} />
            <Result label="After costs" value={usd(r.net)} strong hint={`${usd(r.net / 12)} a month`} />
            <Result label="Net yield" value={pct(r.netYield)} hint={`Gross ${pct(r.grossYield)}`} />
            <Result label="Break-even occupancy" value={pct(r.breakEven)} />
            <Result label="Pays back in" value={Number.isFinite(r.payback) ? `${r.payback.toFixed(1)} yrs` : "—"} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            The starting numbers are an example; change them to your own. Before tax and mortgage. Check the local rules and permits for holiday rentals before you count on this income. Not investment advice.
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}
