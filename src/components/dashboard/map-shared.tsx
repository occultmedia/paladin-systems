"use client";

/* Shared pieces for the Aruba map (Mapbox and Leaflet versions). */

import { ListingPhoto } from "@/components/listing-photo";
import { pricePerM2, sizeLines } from "@/lib/units";
import { PLATFORM_LABEL, TENURE_NOT_STATED, isClosed, type Agency, type DistrictStats, type Listing, type RentalPlatform, type Signal, type VacationRental } from "@/lib/aruba-data";

export const SIGNAL_COLOR: Record<Signal, string> = {
  UNDERVALUED: "#3F7A55",
  AT_MARKET: "#52525B",
  OVERPRICED: "#A05A5D",
};
export const SIGNAL_LABEL: Record<Signal, string> = {
  UNDERVALUED: "Below market",
  AT_MARKET: "At Market",
  OVERPRICED: "Overpriced",
};

/** 🔥 next to Below market: the AI rates it a great deal. */
export function HotFlame({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <span role="img" aria-label="Great deal" title="Great deal: priced 10%+ below its comps" className={`hot-flame inline-block leading-none ${className}`} style={{ fontSize: size }}>
      🔥
    </span>
  );
}

/** Asking-price moves: up = green, down = red, no change = orange. */
export const priceColor = (n: number) => (n > 0 ? "#2E9E5B" : n < 0 ? "#D64545" : "#E08A1E");

/**
 * Listing agency logo. Uses the logo indexed from the agency's site; until we
 * have it, a monogram in the agency colour.
 */
export function AgencyLogo({ agency, size = 24, rounded = 6 }: { agency: Agency; size?: number; rounded?: number }) {
  if (agency.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={agency.logo_url}
        alt={`${agency.name} logo`}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain", borderRadius: rounded, background: "#fff", flexShrink: 0 }}
      />
    );
  }
  const initials = agency.name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span
      role="img"
      aria-label={`${agency.name} logo`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: agency.color,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: Math.max(8, Math.round(size * 0.4)),
        letterSpacing: "-0.02em",
        flexShrink: 0,
        fontFamily: "var(--font-archivo), var(--font-inter), system-ui, sans-serif",
      }}
    >
      {initials}
    </span>
  );
}

export const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString("en-US")}`;
export const num = (n: number) => n.toLocaleString("en-US");
export const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}%`;

export const STATUS_PILL: Record<Listing["status"], { color: string; bg: string }> = {
  "For sale": { color: "#1F7A45", bg: "#E6F4EC" },
  "Under contract": { color: "#9A5B00", bg: "#FDF1DC" },
  Sold: { color: "#B42318", bg: "#FDE8E7" },
  "De-listed": { color: "#52525B", bg: "#EEEEF0" },
};

/** Listings that share one spot (units in a building): pick one from a short list. */
export function ClusterList({ items, onPick }: { items: Listing[]; onPick: (id: string) => void }) {
  return (
    <div style={{ width: 250 }}>
      <p className="border-b border-zinc-200 px-3 py-2 text-[11px] font-semibold text-zinc-500">{items.length} listings at this spot</p>
      <ul data-lenis-prevent className="max-h-[230px] overflow-y-auto overscroll-contain p-1">
        {items.map((l) => (
          <li key={l.listing_id}>
            <button
              type="button"
              onClick={() => onPick(l.listing_id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-100"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: SIGNAL_COLOR[l.signal] }} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-900">{l.asset_name}</span>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-zinc-950">
                {l.asking_price_usd >= 1e6 ? `$${(l.asking_price_usd / 1e6).toFixed(2)}M` : `$${Math.round(l.asking_price_usd / 1000)}k`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HoverCard({ l }: { l: Listing }) {
  const color = SIGNAL_COLOR[l.signal];
  const facts =
    l.category === "Property"
      ? `${l.bedrooms} beds · ${l.bathrooms} baths`
      : l.category === "Land"
        ? `${l.zoning} zoning`
        : l.commercial_use;
  const m2Price = pricePerM2(l);
  const closed = isClosed(l);
  const status = STATUS_PILL[l.status];
  const vs = l.category === "Property" ? `${pct(l.price_vs_comps_pct)} vs comps` : `${pct(l.price_vs_district_pct)} vs district`;
  return (
    <div style={{ width: 250 }}>
      {l.photo_url && (
        <ListingPhoto
          src={l.photo_url}
          alt=""
          w={250}
          h={135}
          style={{ display: "block", width: 250, height: 135, objectFit: "cover", background: "#F4F4F5" }}
        />
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#09090B", whiteSpace: "normal", lineHeight: 1.25 }}>{l.asset_name}</span>
          {l.is_new && (
            <span style={{ background: "#0A0A0A", color: "#ACFA68", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>NEW</span>
          )}
        </div>
        <div style={{ color: "#71717A", fontSize: 11, marginTop: 2 }}>
          {l.category === "Commercial" ? "Commercial" : l.property_type} · {l.district} · {l.tenure ?? TENURE_NOT_STATED}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#09090B", fontVariantNumeric: "tabular-nums" }}>{usd(l.asking_price_usd)}</span>
          <span style={{ fontSize: 11, color: "#71717A", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{closed ? "last asking" : m2Price ? vs : ""}</span>
        </div>
        {m2Price > 0 && (
          <div style={{ fontSize: 11.5, color: "#71717A", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            <b style={{ color: "#09090B" }}>${num(m2Price)}/m²</b> · ${num(l.price_per_sqft_usd)}/sq ft
          </div>
        )}
        <div style={{ color: "#3F3F46", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
          {facts}
          {sizeLines(l).map((s) => (
            <div key={s}>{s}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ color: status.color, background: status.bg, fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
            {l.status}
          </span>
          {l.pool && l.pool !== "No pool" && (
            <span style={{ color: "#0369A1", background: "#F0F9FF", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
              {l.pool}
            </span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid #F4F4F5" }}>
          {closed ? (
            <span style={{ color: status.color, fontSize: 11, fontWeight: 600 }}>● {l.status}</span>
          ) : (
            <span style={{ color, fontSize: 11, fontWeight: 600 }}>
              ● {SIGNAL_LABEL[l.signal]} {l.signal === "UNDERVALUED" && <HotFlame size={11} />}
            </span>
          )}
          <span style={{ color: "#A1A1AA", fontSize: 11 }}>
            {l.is_new ? "Found today" : `${l.days_on_market} days listed`}
            {" · "}
            <span style={{ color: priceColor(l.price_change_pct), fontWeight: 600 }}>
              {l.price_change_pct > 0 ? "↑" : l.price_change_pct < 0 ? "↓" : "→"}{" "}
              {l.price_change_pct ? `${Math.abs(l.price_change_pct).toFixed(1)}%` : "no change"}
            </span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 8, borderTop: "1px solid #F4F4F5" }}>
          <AgencyLogo agency={l.agency} size={18} rounded={4} />
          <span style={{ fontSize: 11, color: "#52525B" }}>
            Listed by <b style={{ color: "#09090B" }}>{l.agency.name}</b>
            {l.agent && <> · {l.agent.name}</>}
          </span>
        </div>
        <div style={{ color: "#A1A1AA", fontSize: 10, marginTop: 6 }}>Click the pin for full details</div>
      </div>
    </div>
  );
}

export type ArubaMapProps =
  | {
      mode: "listings";
      listings: Listing[];
      selectedId?: string | null;
      hoveredId?: string | null;
      onSelect?: (id: string) => void;
      onHover?: (id: string | null) => void;
      height?: number;
      /** Fill the parent's height (full-screen map) instead of using `height`. */
      fill?: boolean;
      /** false = static decorative map (no pan/zoom/legend/hover), e.g. on the landing page */
      interactive?: boolean;
    }
  | {
      mode: "rentals";
      rentals: VacationRental[];
      selectedId?: string | null;
      hoveredId?: string | null;
      onSelect?: (id: string) => void;
      onHover?: (id: string | null) => void;
      height?: number;
      interactive?: boolean;
    }
  | {
      mode: "districts";
      districts: DistrictStats[];
      onSelect?: (district: string) => void;
      height?: number;
      interactive?: boolean;
    };

/* ── Vacation rentals ─────────────────────────────────────────────────── */

export const PLATFORM_COLOR: Record<RentalPlatform, string> = {
  Airbnb: "#D9485F",
  Vrbo: "#2C5FA8",
  Direct: "#0A0A0A",
};

/** Short price for a map pin: $480, $1.2k, $5.6k */
export const pinPrice = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `$${n}`);

export function RentalHoverCard({ r }: { r: VacationRental }) {
  return (
    <div style={{ width: 260 }}>
      {r.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${r.photo_url}?auto=format&fit=crop&w=520&h=270&q=60`}
          alt=""
          width={260}
          height={135}
          style={{ display: "block", width: 260, height: 135, objectFit: "cover", background: "#F4F4F5" }}
        />
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{ background: PLATFORM_COLOR[r.platform], color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}
          >
            {PLATFORM_LABEL[r.platform]}
          </span>
          <span style={{ color: "#71717A", fontSize: 11 }}>{r.host_type}</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#09090B", marginTop: 6, lineHeight: 1.25 }}>{r.name}</div>
        <div style={{ color: "#71717A", fontSize: 11, marginTop: 2 }}>
          {r.property_type} · {r.district} · {r.bedrooms} bd · {r.bathrooms} ba · sleeps {r.sleeps}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            <b style={{ fontSize: 17, color: "#09090B" }}>{usd(r.nightly_rate_usd)}</b>
            <span style={{ color: "#71717A", fontSize: 12 }}> / night</span>
          </span>
          <span style={{ fontSize: 12, color: "#09090B" }}>
            {r.rating ? (
              <>
                ★ {r.rating.toFixed(2)} <span style={{ color: "#A1A1AA" }}>({r.reviews})</span>
              </>
            ) : (
              <span style={{ color: "#A1A1AA" }}>New</span>
            )}
          </span>
        </div>
        <div style={{ color: "#52525B", fontSize: 11, marginTop: 2 }}>
          Low season {usd(r.low_season_rate_usd)} · High season {usd(r.high_season_rate_usd)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #F4F4F5", fontSize: 12 }}>
          <span>
            <b style={{ fontVariantNumeric: "tabular-nums" }}>{r.occupancy_pct}%</b> <span style={{ color: "#71717A" }}>booked</span>
          </span>
          <span>
            <b style={{ fontVariantNumeric: "tabular-nums" }}>{usd(r.annual_revenue_usd)}</b> <span style={{ color: "#71717A" }}>/ yr est.</span>
          </span>
        </div>
        <div style={{ color: "#A1A1AA", fontSize: 10, marginTop: 6 }}>Click the pin for full details</div>
      </div>
    </div>
  );
}

