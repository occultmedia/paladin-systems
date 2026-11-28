"use client";

/*
 * Add / edit a listing by hand. Agents choose Off-market (every member sees
 * it) or Only me. While they type, the duplicate watch compares it with every
 * listing on Baseline; a likely duplicate has to be confirmed as a
 * different property before it can be saved (the database checks again).
 */

import { fmtSqft, toM2, toSqft } from "@/lib/units";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, Loader2, Lock, MapPin, Trash2, Users } from "lucide-react";
import { Dialog } from "@/components/feed/profile-dialog";
import {
  COMMERCIAL_USES,
  DISTRICT_CENTERS,
  POOLS,
  RESIDENTIAL_TYPES,
  TENURES,
  TENURE_HINT,
  ZONINGS,
  type CommercialUse,
  type Listing,
  type Pool,
  type PropertyType,
  type Tenure,
  type Zoning,
} from "@/lib/aruba-data";
import { DuplicateListingError, VISIBILITY_HINT, VISIBILITY_LABEL, type AgentListingInput } from "@/lib/agent-listings";
import type { AgentListingViewRow, AgentListingStatus, AgentListingVisibility } from "@/lib/database.types";
import { DUP_LIKELY, findDuplicates, parsePin, type MatchFields } from "@/lib/duplicates";
import { resizeCover } from "@/lib/images";

type Category = "Property" | "Land" | "Commercial";
const CATEGORY_LABEL: Record<Category, string> = { Property: "Home / condo", Land: "Land", Commercial: "Commercial" };
const STATUSES: AgentListingStatus[] = ["For sale", "Under contract", "Sold", "Withdrawn"];
const DISTRICTS = Object.keys(DISTRICT_CENTERS).sort();

const fieldCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-950";
const labelCls = "mb-1.5 block text-[12px] font-semibold text-zinc-800";
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const digits = (s: string) => s.replace(/[^\d]/g, "");
const toNum = (s: string) => (digits(s) ? Number(digits(s)) : null);
const withCommas = (s: string) => (digits(s) ? Number(digits(s)).toLocaleString("en-US") : "");

interface Draft {
  visibility: AgentListingVisibility;
  category: Category;
  type: PropertyType;
  use: CommercialUse;
  zoning: Zoning;
  name: string;
  district: string;
  address: string;
  pin: string;
  price: string;
  beds: string;
  baths: string;
  built: string;
  lot: string;
  pool: Pool;
  tenure: Tenure;
  lease: string;
  status: AgentListingStatus;
  notes: string;
  photo: string | null;
}

function draftFrom(row?: AgentListingViewRow): Draft {
  if (!row)
    return {
      visibility: "members",
      category: "Property",
      type: "Villa",
      use: "Retail",
      zoning: "Residential",
      name: "",
      district: "",
      address: "",
      pin: "",
      price: "",
      beds: "",
      baths: "",
      built: "",
      lot: "",
      pool: "Private pool",
      tenure: "Eigendom",
      lease: "",
      status: "For sale",
      notes: "",
      photo: null,
    };
  return {
    visibility: row.visibility,
    category: row.asset_class,
    type: (RESIDENTIAL_TYPES as string[]).includes(row.property_type) ? (row.property_type as PropertyType) : "Villa",
    use: row.commercial_use ?? "Retail",
    zoning: row.zoning ?? "Residential",
    name: row.asset_name,
    district: row.district,
    address: row.address ?? "",
    pin: row.lat != null && row.lng != null ? `${row.lat.toFixed(6)}, ${row.lng.toFixed(6)}` : "",
    price: withCommas(String(Math.round(Number(row.asking_price_usd)))),
    beds: row.bedrooms != null ? String(row.bedrooms) : "",
    baths: row.bathrooms != null ? String(row.bathrooms) : "",
    built: row.built_sqft ? withCommas(String(toM2(row.built_sqft))) : "",
    lot: row.lot_sqft ? withCommas(String(toM2(row.lot_sqft))) : "",
    pool: row.pool ?? "No pool",
    tenure: row.tenure,
    lease: row.lease_years_left != null ? String(row.lease_years_left) : "",
    status: row.listing_status,
    notes: row.notes ?? "",
    photo: row.photo_url,
  };
}

/** Sizes are typed in m² and stored in sq ft; an unchanged size keeps its stored value. */
function sqftOf(text: string, stored?: number | null) {
  const m2 = toNum(text);
  if (!m2) return null;
  return stored && toM2(stored) === m2 ? stored : toSqft(m2);
}
const sqftHint = (text: string) => {
  const m2 = toNum(text);
  return m2 ? `= ${fmtSqft(toSqft(m2))}` : "";
};

export function AddListingDialog({
  open,
  onClose,
  editing,
  listings,
  onSave,
  onDelete,
  onOpenListing,
}: {
  open: boolean;
  onClose: () => void;
  /** Edit this listing instead of adding one. */
  editing?: AgentListingViewRow;
  /** Everything on Baseline (market + member listings), for the duplicate watch. */
  listings: Listing[];
  onSave: (input: AgentListingInput, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onOpenListing?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={editing ? `Edit ${editing.ref}` : "Add a listing"} wide top>
      {open && <ListingForm key={editing?.id ?? "new"} editing={editing} listings={listings} onSave={onSave} onDelete={onDelete} onClose={onClose} onOpenListing={onOpenListing} />}
    </Dialog>
  );
}

function ListingForm({
  editing,
  listings,
  onSave,
  onDelete,
  onClose,
  onOpenListing,
}: {
  editing?: AgentListingViewRow;
  listings: Listing[];
  onSave: (input: AgentListingInput, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
  onOpenListing?: (id: string) => void;
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(editing));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const [ack, setAck] = useState(editing?.dup_acknowledged ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverMatch, setServerMatch] = useState<DuplicateListingError["match"] | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isHome = d.category === "Property";
  const isLand = d.category === "Land";
  const pin = parsePin(d.pin);
  const pinBad = Boolean(d.pin.trim()) && !pin;

  // Duplicate watch, live as the agent types.
  const deferred = useDeferredValue(d);
  const matches = useMemo(() => {
    const x = deferred;
    if (!x.district || !toNum(x.price)) return [];
    const p = parsePin(x.pin);
    const candidate: MatchFields = {
      category: x.category,
      lat: p?.lat ?? null,
      lng: p?.lng ?? null,
      district: x.district,
      bedrooms: x.category === "Property" ? toNum(x.beds) : null,
      built_sqft: x.category === "Land" ? null : sqftOf(x.built),
      lot_sqft: sqftOf(x.lot),
      asking_price_usd: toNum(x.price) ?? 0,
      name: x.address.trim() || x.name,
    };
    return findDuplicates(candidate, listings, editing?.ref);
  }, [deferred, listings, editing?.ref]);
  const likely = matches.filter((m) => m.score >= DUP_LIKELY);
  const needsAck = (likely.length > 0 || serverMatch !== null) && !ack;

  const pickPhoto = async (f?: File) => {
    if (!f) return;
    setPhotoBusy(true);
    try {
      set("photo", await resizeCover(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const price = toNum(d.price);
    const built = sqftOf(d.built, editing?.built_sqft);
    const lot = sqftOf(d.lot, editing?.lot_sqft);
    if (d.name.trim().length < 3) return setError("Give the listing a name (at least 3 characters).");
    if (!d.district) return setError("Choose the district.");
    if (!price || price < 1000) return setError("Add the asking price in US dollars.");
    if (!isLand && !built) return setError("Add the built area in m².");
    if (isLand && !lot) return setError("Add the lot size in m².");
    if (isHome && !digits(d.beds)) return setError("Add the number of bedrooms.");
    if (isHome && !(Number(d.baths) >= 0 && d.baths.trim())) return setError("Add the number of bathrooms.");
    if (pinBad) return setError("We couldn't read a location in Aruba from the map pin. Paste a Google Maps link or coordinates like 12.5512, -70.0478, or leave it empty.");
    if (needsAck) return setError("This looks like a listing already on Baseline. Confirm it is a different property to save it.");

    const input: AgentListingInput = {
      visibility: d.visibility,
      asset_class: d.category,
      property_type: d.category === "Property" ? d.type : d.category === "Land" ? "Land" : "Commercial",
      commercial_use: d.category === "Commercial" ? d.use : null,
      zoning: isLand ? d.zoning : null,
      asset_name: d.name.trim(),
      bedrooms: isHome ? toNum(d.beds) : null,
      bathrooms: isHome && d.baths.trim() ? Number(d.baths) : null,
      built_sqft: isLand ? null : built,
      lot_sqft: lot,
      pool: isLand ? null : d.pool,
      tenure: d.tenure,
      lease_years_left: d.tenure === "Erfpacht" && digits(d.lease) ? Number(digits(d.lease)) : null,
      district: d.district,
      address: d.address.trim() || null,
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      asking_price_usd: price,
      listing_status: d.status,
      notes: d.notes.trim() || null,
      photo: d.photo,
      dup_acknowledged: ack,
    };
    setBusy(true);
    try {
      await onSave(input, editing?.id);
      onClose();
    } catch (err) {
      if (err instanceof DuplicateListingError) {
        setServerMatch(err.match);
        setAck(false);
        setError(err.message);
      } else setError(err instanceof Error ? err.message : "Could not save the listing.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing || !onDelete) return;
    if (!window.confirm(`Delete ${editing.asset_name}? This removes it from Baseline for everyone.`)) return;
    setBusy(true);
    try {
      await onDelete(editing.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the listing.");
      setBusy(false);
    }
  };

  const seg = (on: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-[12.5px] font-semibold transition-colors ${on ? "bg-zinc-950 text-lime" : "text-zinc-600 hover:text-zinc-950"}`;

  return (
    <form onSubmit={submit} className="space-y-5 px-5 py-5">
      {/* who sees it */}
      <div>
        <span className={labelCls}>Who sees it</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["members", "private"] as const).map((v) => {
            const on = d.visibility === v;
            const Icon = v === "members" ? Users : Lock;
            return (
              <button
                key={v}
                type="button"
                onClick={() => set("visibility", v)}
                aria-pressed={on}
                className={`rounded-xl border p-3 text-left transition-colors ${on ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 hover:border-zinc-400"}`}
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <Icon size={14} className={on ? "text-lime" : "text-zinc-500"} /> {VISIBILITY_LABEL[v]}
                </span>
                <span className={`mt-1 block text-[11.5px] leading-snug ${on ? "text-zinc-300" : "text-zinc-500"}`}>{VISIBILITY_HINT[v]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* what it is */}
      <div>
        <span className={labelCls}>What it is</span>
        <div className="flex gap-1 rounded-lg border border-zinc-200 p-1">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <button key={c} type="button" onClick={() => set("category", c)} className={seg(d.category === c)}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={labelCls}>Listing name</span>
          <input className={fieldCls} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Villa Brisa, 4-bed with ocean view" maxLength={120} />
        </label>
        {isHome && (
          <label>
            <span className={labelCls}>Home type</span>
            <select className={fieldCls} value={d.type} onChange={(e) => set("type", e.target.value as PropertyType)}>
              {RESIDENTIAL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        {d.category === "Commercial" && (
          <label>
            <span className={labelCls}>Use</span>
            <select className={fieldCls} value={d.use} onChange={(e) => set("use", e.target.value as CommercialUse)}>
              {COMMERCIAL_USES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        {isLand && (
          <label>
            <span className={labelCls}>Zoning</span>
            <select className={fieldCls} value={d.zoning} onChange={(e) => set("zoning", e.target.value as Zoning)}>
              {ZONINGS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className={labelCls}>Asking price (USD)</span>
          <input className={fieldCls} inputMode="numeric" value={d.price} onChange={(e) => set("price", withCommas(e.target.value))} placeholder="1,250,000" />
        </label>
      </div>

      {/* where */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>District</span>
          <select className={fieldCls} value={d.district} onChange={(e) => set("district", e.target.value)}>
            <option value="">Choose…</option>
            {DISTRICTS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Address <span className="font-normal text-zinc-400">(optional)</span></span>
          <input className={fieldCls} value={d.address} onChange={(e) => set("address", e.target.value)} placeholder="Street and number" maxLength={160} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelCls}>
            Map pin <span className="font-normal text-zinc-400">(optional, best for spotting duplicates)</span>
          </span>
          <div className="relative">
            <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input className={`${fieldCls} pl-8`} value={d.pin} onChange={(e) => set("pin", e.target.value)} placeholder="Paste a Google Maps link or 12.5512, -70.0478" />
          </div>
          <span className={`mt-1 block text-[11.5px] ${pinBad ? "text-red-600" : pin ? "text-emerald-700" : "text-zinc-500"}`}>
            {pinBad
              ? "No Aruba location found. Short links (maps.app.goo.gl) don't include it: open the link and copy the full address bar."
              : pin
                ? `Pinned at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
                : "Without a pin it shows near the district centre on the map."}
          </span>
        </label>
      </div>

      {/* size */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {isHome && (
          <>
            <label>
              <span className={labelCls}>Bedrooms</span>
              <input className={fieldCls} inputMode="numeric" value={d.beds} onChange={(e) => set("beds", digits(e.target.value).slice(0, 2))} placeholder="4" />
            </label>
            <label>
              <span className={labelCls}>Bathrooms</span>
              <input className={fieldCls} inputMode="decimal" value={d.baths} onChange={(e) => set("baths", e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} placeholder="3.5" />
            </label>
          </>
        )}
        {!isLand && (
          <label>
            <span className={labelCls}>Built (m²)</span>
            <input className={fieldCls} inputMode="numeric" value={d.built} onChange={(e) => set("built", withCommas(e.target.value))} placeholder="300" />
            <span className="mt-1 block h-4 text-[11px] tabular-nums text-zinc-500">{sqftHint(d.built)}</span>
          </label>
        )}
        <label>
          <span className={labelCls}>Lot (m²){!isLand && <span className="font-normal text-zinc-400"> opt.</span>}</span>
          <input className={fieldCls} inputMode="numeric" value={d.lot} onChange={(e) => set("lot", withCommas(e.target.value))} placeholder="850" />
          <span className="mt-1 block h-4 text-[11px] tabular-nums text-zinc-500">{sqftHint(d.lot)}</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {!isLand && (
          <label>
            <span className={labelCls}>Pool</span>
            <select className={fieldCls} value={d.pool} onChange={(e) => set("pool", e.target.value as Pool)}>
              {POOLS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        <label title={TENURE_HINT[d.tenure]}>
          <span className={labelCls}>Land title</span>
          <select className={fieldCls} value={d.tenure} onChange={(e) => set("tenure", e.target.value as Tenure)}>
            {TENURES.map((t) => (
              <option key={t} value={t}>
                {t === "Eigendom" ? "Eigendom (freehold)" : "Erfpacht (leasehold)"}
              </option>
            ))}
          </select>
        </label>
        {d.tenure === "Erfpacht" ? (
          <label>
            <span className={labelCls}>Lease years left</span>
            <input className={fieldCls} inputMode="numeric" value={d.lease} onChange={(e) => set("lease", digits(e.target.value).slice(0, 2))} placeholder="52" />
          </label>
        ) : (
          <label>
            <span className={labelCls}>Status</span>
            <select className={fieldCls} value={d.status} onChange={(e) => set("status", e.target.value as AgentListingStatus)}>
              {STATUSES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        {d.tenure === "Erfpacht" && (
          <label>
            <span className={labelCls}>Status</span>
            <select className={fieldCls} value={d.status} onChange={(e) => set("status", e.target.value as AgentListingStatus)}>
              {STATUSES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* photo + notes */}
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative grid h-[84px] w-[126px] shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition-colors hover:border-zinc-950 hover:text-zinc-950"
          aria-label={d.photo ? "Change photo" : "Upload photo"}
        >
          {photoBusy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : d.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.photo} alt="" className="size-full object-cover" />
          ) : (
            <Camera size={20} strokeWidth={1.6} />
          )}
        </button>
        <div className="min-w-0 text-[12px]">
          <p className="text-[13px] font-semibold text-zinc-950">Main photo</p>
          <p className="text-zinc-500">Landscape works best. Resized in your browser before upload.</p>
          <div className="mt-1.5 flex gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="font-semibold text-zinc-950 underline-offset-4 hover:underline">
              {d.photo ? "Replace" : "Upload"}
            </button>
            {d.photo && (
              <button type="button" onClick={() => set("photo", null)} className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-950">
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => (pickPhoto(e.target.files?.[0]), (e.target.value = ""))} />
      </div>

      <label className="block">
        <span className={labelCls}>Notes for members <span className="font-normal text-zinc-400">(optional)</span></span>
        <textarea
          className={`${fieldCls} min-h-[84px] resize-y`}
          value={d.notes}
          onChange={(e) => set("notes", e.target.value.slice(0, 1000))}
          placeholder="Viewing by appointment, seller motivated, co-broke 50/50…"
        />
      </label>

      {/* duplicate watch */}
      {(matches.length > 0 || serverMatch) && (
        <div className={`rounded-xl border p-3.5 ${likely.length || serverMatch ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-zinc-950">
            <AlertTriangle size={14} className="text-amber-600" />
            {likely.length || serverMatch ? "This may already be on Baseline" : "Similar listings on Baseline"}
          </p>
          <ul className="mt-2 space-y-1.5">
            {serverMatch && !matches.some((m) => m.listing.listing_id === serverMatch.ref) && (
              <li className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="min-w-0 truncate">
                  <b className="text-zinc-950">{serverMatch.name}</b> <span className="text-zinc-500">· {serverMatch.ref}</span>
                </span>
                <MatchTag score={serverMatch.score} />
              </li>
            )}
            {matches.map((m) => (
              <li key={m.listing.listing_id} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="min-w-0 truncate">
                  <b className="text-zinc-950">{m.listing.asset_name}</b>
                  <span className="text-zinc-500">
                    {" "}
                    · {m.listing.district} · {usd.format(m.listing.asking_price_usd)} · {m.listing.member ? "member listing" : m.listing.source}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <MatchTag score={m.score} />
                  {onOpenListing && (
                    <button type="button" onClick={() => (onOpenListing(m.listing.listing_id), onClose())} className="font-semibold text-zinc-950 underline-offset-4 hover:underline">
                      View
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {(likely.length > 0 || serverMatch) && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12.5px] text-zinc-800">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-zinc-950" />
              <span>It&rsquo;s a different property (for example another unit in the same building). Save it anyway.</span>
            </label>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
        {editing && onDelete ? (
          <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">
            <Trash2 size={13} /> Delete listing
          </button>
        ) : (
          <span className="text-[11.5px] text-zinc-500">Shown as {VISIBILITY_LABEL[d.visibility]} with your profile as the listing agent.</span>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[13px] font-semibold text-zinc-600 hover:text-zinc-950">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || photoBusy || needsAck}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-[13px] font-semibold text-lime transition-opacity disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {editing ? "Save changes" : "Add listing"}
          </button>
        </div>
      </div>
    </form>
  );
}

function MatchTag({ score }: { score: number }) {
  const likely = score >= DUP_LIKELY;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums ${likely ? "bg-amber-200 text-amber-900" : "bg-zinc-200 text-zinc-700"}`}>
      {likely ? "Likely same" : "Similar"} · {score}%
    </span>
  );
}
