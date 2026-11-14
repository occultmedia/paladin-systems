"use client";

/* Shared pieces for the Aruba map (Mapbox and Leaflet versions). */

import type { DistrictStats, Listing, Signal } from "@/lib/aruba-data";

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
        </div>
        <div style={{ color: "#71717A", fontSize: 11, marginTop: 2 }}>
          {l.category === "Commercial" ? "Commercial" : l.property_type} · {l.district} · {l.listing_id}
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
            {l.days_on_market} days listed{l.price_change_pct < 0 ? ` · price ${pct(l.price_change_pct)}` : ""}
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
      mode: "districts";
      districts: DistrictStats[];
      onSelect?: (district: string) => void;
      height?: number;
      interactive?: boolean;
    };

