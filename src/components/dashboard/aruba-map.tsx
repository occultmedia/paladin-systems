"use client";

/**
 * Leaflet map of Aruba. Two modes:
 *  - "listings": one marker per listing, coloured by signal (square = land)
 *  - "districts": one circle per district, sized by listings for sale, shaded by Sequence Score
 * Loaded with next/dynamic { ssr: false } because Leaflet needs `window`.
 */

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Rectangle, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import type { DistrictStats, Listing, Signal } from "@/lib/aruba-data";

const SIGNAL_COLOR: Record<Signal, string> = {
  UNDERVALUED: "#5E8A6B",
  AT_MARKET: "#52525B",
  OVERPRICED: "#A05A5D",
};

const ARUBA_CENTER: LatLngExpression = [12.53, -70.0];
const ARUBA_BOUNDS: LatLngBoundsExpression = [
  [12.40, -70.10],
  [12.64, -69.85],
];

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString("en-US")}`;

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

type Props =
  | {
      mode: "listings";
      listings: Listing[];
      selectedId?: string | null;
      onSelect?: (id: string) => void;
      height?: number;
      /** false = static decorative map (no pan/zoom/legend), e.g. on the landing page */
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
  const points: Array<[number, number]> =
    props.mode === "listings"
      ? props.listings.map((l) => [l.lat, l.lng])
      : props.districts.map((d) => [d.lat, d.lng]);

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
            const color = SIGNAL_COLOR[l.signal];
            const selected = props.selectedId === l.listing_id;
            const tooltip = (
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <div style={{ fontFamily: "inherit", minWidth: 180 }}>
                  <div style={{ fontWeight: 600, color: "#09090B" }}>{l.asset_name}</div>
                  <div style={{ color: "#71717A", fontSize: 11, marginTop: 2 }}>
                    {l.property_type} · {l.district}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    <b>{usd(l.asking_price_usd)}</b>
                    {l.category === "Property"
                      ? ` · ${l.projected_gross_yield_pct.toFixed(1)}% yield`
                      : ` · $${l.price_per_sqft_usd}/sq ft`}
                  </div>
                  <div style={{ color, fontSize: 10, letterSpacing: "0.08em", marginTop: 4, textTransform: "uppercase" }}>
                    {l.signal.replace("_", " ")}
                  </div>
                </div>
              </Tooltip>
            );
            const handlers = { click: () => props.onSelect?.(l.listing_id) };
            if (l.category === "Land") {
              const d = selected ? 0.0011 : 0.0008;
              return (
                <Rectangle
                  key={l.listing_id}
                  bounds={[
                    [l.lat - d * 0.7, l.lng - d],
                    [l.lat + d * 0.7, l.lng + d],
                  ]}
                  pathOptions={{ color: selected ? "#09090B" : color, weight: selected ? 2.5 : 1.5, fillColor: color, fillOpacity: 0.25 }}
                  eventHandlers={handlers}
                >
                  {tooltip}
                </Rectangle>
              );
            }
            return (
              <CircleMarker
                key={l.listing_id}
                center={[l.lat, l.lng]}
                radius={selected ? 10 : 7}
                pathOptions={{ color: selected ? "#09090B" : "#FFFFFF", weight: selected ? 2.5 : 1.5, fillColor: color, fillOpacity: 0.95 }}
                eventHandlers={handlers}
              >
                {tooltip}
              </CircleMarker>
            );
          })}

        {props.mode === "districts" &&
          props.districts.map((d) => {
            const forSale = d.properties_for_sale + d.land_for_sale;
            const shade = d.score >= 70 ? "#5E8A6B" : d.score >= 50 ? "#71717A" : "#A05A5D";
            return (
              <CircleMarker
                key={d.district}
                center={[d.lat, d.lng]}
                radius={7 + forSale * 2.5}
                pathOptions={{ color: shade, weight: 1.5, fillColor: shade, fillOpacity: 0.22 }}
                eventHandlers={{ click: () => props.onSelect?.(d.district) }}
              >
                <Tooltip direction="top" opacity={1} permanent={false}>
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
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap gap-3 border border-zinc-200 bg-white/95 px-3 py-2 tabular-nums text-[10px] uppercase tracking-wider text-zinc-600">
        {props.mode === "listings" ? (
          <>
            {(Object.keys(SIGNAL_COLOR) as Signal[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: SIGNAL_COLOR[s] }} />
                {s.replace("_", " ")}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="size-2 border border-zinc-500" /> Land
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#5E8A6B]" />Score 70+</span>
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
