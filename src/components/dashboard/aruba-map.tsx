"use client";

/**
 * Leaflet map of Aruba. Two modes:
 *  - "listings": one pin per listing, coloured by signal; shape by category
 *    (circle = residential, square = land, diamond = commercial). Hover shows a
 *    property card; click selects it.
 *  - "districts": one circle per district, sized by listings for sale, shaded by Sequence Score.
 * Loaded with next/dynamic { ssr: false } because Leaflet needs `window`.
 */

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L, { type LatLngBoundsExpression, type LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { DistrictStats, Listing, Signal } from "@/lib/aruba-data";

const SIGNAL_COLOR: Record<Signal, string> = {
  UNDERVALUED: "#3F7A55",
  AT_MARKET: "#52525B",
  OVERPRICED: "#A05A5D",
};
const SIGNAL_LABEL: Record<Signal, string> = {
  UNDERVALUED: "Undervalued",
  AT_MARKET: "At Market",
  OVERPRICED: "Overpriced",
};

const ARUBA_CENTER: LatLngExpression = [12.53, -70.0];
const ARUBA_BOUNDS: LatLngBoundsExpression = [
  [12.4, -70.1],
  [12.64, -69.85],
];

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString("en-US")}`;
const num = (n: number) => n.toLocaleString("en-US");
const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}%`;

function pinIcon(l: Listing, active: boolean) {
  const shape = l.category === "Land" ? "square" : l.category === "Commercial" ? "diamond" : "circle";
  return L.divIcon({
    className: "sd-pin-wrap",
    html: `<span class="sd-pin sd-pin-${shape}${active ? " sd-pin-active" : ""}" style="background:${SIGNAL_COLOR[l.signal]}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Fit to the visible points whenever the set changes. */
function FitTo({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function HoverCard({ l }: { l: Listing }) {
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

type Props =
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

export default function ArubaMap(props: Props) {
  const height = props.height ?? 520;
  const interactive = props.interactive ?? true;
  const points: Array<[number, number]> = useMemo(
    () => (props.mode === "listings" ? props.listings.map((l) => [l.lat, l.lng]) : props.districts.map((d) => [d.lat, d.lng])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.mode === "listings" ? props.listings : props.districts],
  );

  return (
    <div className={`relative ${interactive ? "border border-zinc-200" : ""}`} style={{ height }}>
      <MapContainer
        center={ARUBA_CENTER}
        zoom={11}
        minZoom={10}
        maxBounds={ARUBA_BOUNDS}
        maxBoundsViscosity={0.8}
        scrollWheelZoom={false}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        boxZoom={interactive}
        className="h-full w-full"
        style={{ background: "#F4F4F5" }}
      >
        {/* Esri light-gray canvas (no key needed for low-volume use; move to a keyed provider before scaling). */}
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <FitTo points={points} />

        {props.mode === "listings" &&
          props.listings.map((l) => {
            const active = props.selectedId === l.listing_id || props.hoveredId === l.listing_id;
            return (
              <Marker
                key={l.listing_id}
                position={[l.lat, l.lng]}
                icon={pinIcon(l, active)}
                zIndexOffset={active ? 1000 : 0}
                eventHandlers={{
                  click: () => props.onSelect?.(l.listing_id),
                  mouseover: () => props.onHover?.(l.listing_id),
                  mouseout: () => props.onHover?.(null),
                }}
              >
                {interactive && (
                  <Tooltip direction="top" offset={[0, -12]} opacity={1} className="sd-tooltip">
                    <HoverCard l={l} />
                  </Tooltip>
                )}
              </Marker>
            );
          })}

        {props.mode === "districts" &&
          props.districts.map((d) => {
            const forSale = d.properties_for_sale + d.land_for_sale + d.commercial_for_sale;
            const shade = d.score >= 70 ? "#3F7A55" : d.score >= 50 ? "#71717A" : "#A05A5D";
            return (
              <CircleMarker
                key={d.district}
                center={[d.lat, d.lng]}
                radius={7 + forSale * 2.2}
                pathOptions={{ color: shade, weight: 1.5, fillColor: shade, fillOpacity: 0.22 }}
                eventHandlers={{ click: () => props.onSelect?.(d.district) }}
              >
                <Tooltip direction="top" opacity={1}>
                  <div style={{ minWidth: 170 }}>
                    <div style={{ fontWeight: 600, color: "#09090B" }}>{d.district}</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Score <b>{d.score}</b> · {forSale} for sale
                    </div>
                    <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>
                      RevPAR ${d.revpar_usd.toLocaleString("en-US")} · {d.occupancy_pct}% occ.
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
      </MapContainer>

      {interactive && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap gap-3 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-[11px] text-zinc-600">
          {props.mode === "listings" ? (
            <>
              {(Object.keys(SIGNAL_COLOR) as Signal[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: SIGNAL_COLOR[s] }} />
                  {SIGNAL_LABEL[s]}
                </span>
              ))}
              <span className="text-zinc-300">|</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-zinc-400" />Residential</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 bg-zinc-400" />Land</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rotate-45 bg-zinc-400" />Commercial</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#3F7A55]" />Score 70+</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#71717A]" />50–69</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#A05A5D]" />Under 50</span>
              <span>Size = listings for sale</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
