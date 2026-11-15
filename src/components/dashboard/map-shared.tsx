"use client";

/* Shared pieces for the Aruba map (Mapbox and Leaflet versions). */

import { PLATFORM_LABEL, type DistrictStats, type Listing, type RentalPlatform, type Signal, type VacationRental } from "@/lib/aruba-data";

export const SIGNAL_COLOR: Record<Signal, string> = {
  UNDERVALUED: "#3F7A55",
  AT_MARKET: "#52525B",
  OVERPRICED: "#A05A5D",
};
export const SIGNAL_LABEL: Record<Signal, string> = {
  UNDERVALUED: "Undervalued",
  AT_MARKET: "At Market",
  OVERPRICED: "Overpriced",
};

export const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString("en-US")}`;
export const num = (n: number) => n.toLocaleString("en-US");
export const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}%`;

export function HoverCard({ l }: { l: Listing }) {
  const color = SIGNAL_COLOR[l.signal];
  const facts =
    l.category === "Property"
      ? `${l.bedrooms} bd · ${l.bathrooms} ba · ${num(l.built_sqft)} sq ft`
      : l.category === "Land"
        ? `${num(l.lot_sqft)} sq ft lot · ${l.zoning} zoning`
        : `${l.commercial_use} · ${num(l.built_sqft)} sq ft`;
  const metric =
    l.category === "Property"
      ? { value: `${l.projected_gross_yield_pct.toFixed(1)}%`, label: "rental yield" }
      : { value: `$${num(l.price_per_sqft_usd)}/sq ft`, label: `${pct(l.price_vs_district_pct)} vs district` };
  return (
    <div style={{ width: 250 }}>
      {l.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${l.photo_url}?auto=format&fit=crop&w=500&h=270&q=60`}
          alt=""
          width={250}
          height={135}
          style={{ display: "block", width: 250, height: 135, objectFit: "cover", background: "#F4F4F5" }}
        />
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#09090B", whiteSpace: "normal", lineHeight: 1.25 }}>{l.asset_name}</span>
          {l.is_new && (
            <span style={{ background: "#0A0A0A", color: "#DDE5DC", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>NEW</span>
          )}
        </div>
        <div style={{ color: "#71717A", fontSize: 11, marginTop: 2 }}>
          {l.category === "Commercial" ? "Commercial" : l.property_type} · {l.district} · {l.tenure}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#09090B", fontVariantNumeric: "tabular-nums" }}>{usd(l.asking_price_usd)}</span>
          <span style={{ fontSize: 12, color: "#09090B", fontVariantNumeric: "tabular-nums" }}>
            <b>{metric.value}</b> <span style={{ color: "#71717A" }}>{metric.label}</span>
          </span>
        </div>
        <div style={{ color: "#3F3F46", fontSize: 11, marginTop: 4 }}>{facts}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid #F4F4F5" }}>
          <span style={{ color, fontSize: 11, fontWeight: 600 }}>● {SIGNAL_LABEL[l.signal]}</span>
          <span style={{ color: "#A1A1AA", fontSize: 11 }}>
            {l.is_new ? "Found today" : `${l.days_on_market} days listed`}
            {l.last_price_change ? ` · price ${pct(l.last_price_change.change_pct ?? 0)} ${l.last_price_change.date.slice(5).replace("-", "/")}` : ""}
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

