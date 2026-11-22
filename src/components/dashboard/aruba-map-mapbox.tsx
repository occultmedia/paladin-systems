"use client";

/**
 * Mapbox GL map of Aruba (vector tiles). Same props and behaviour as the
 * Leaflet fallback: pins coloured by signal and shaped by category, a photo
 * card on hover, click to select, and district circles sized by supply.
 * Token: NEXT_PUBLIC_MAPBOX_TOKEN (.env.local locally, Vercel env vars in prod).
 */

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, NavigationControl, Popup, type MapRef } from "react-map-gl/mapbox";
import type { Listing, Signal } from "@/lib/aruba-data";
import { HoverCard, PLATFORM_COLOR, RentalHoverCard, SIGNAL_COLOR, SIGNAL_LABEL, pinPrice, type ArubaMapProps } from "./map-shared";
import { PLATFORM_LABEL, type RentalPlatform } from "@/lib/aruba-data";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
/** Mapbox Standard: 3D buildings, landmarks, trees and dynamic lighting. */
const STYLE = "mapbox://styles/mapbox/standard";
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-70.2, 12.36],
  [-69.78, 12.68],
];
const ARUBA_VIEW = { longitude: -69.98, latitude: 12.52, zoom: 10.4 };
/** The whole island (used for the decorative homepage map). */
const ARUBA_ISLAND: [[number, number], [number, number]] = [
  [-70.075, 12.405],
  [-69.86, 12.635],
];

/** Standard-style settings: keep 3D on, use bright daytime lighting. */
function configure(map: ReturnType<MapRef["getMap"]>) {
  try {
    map.setConfigProperty("basemap", "lightPreset", "day");
    map.setConfigProperty("basemap", "show3dObjects", true);
    map.setConfigProperty("basemap", "showPointOfInterestLabels", true);
  } catch {
    /* older style without config properties */
  }
}

function boundsOf(points: Array<[number, number]>): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  let [minLat, minLng, maxLat, maxLng] = [90, 180, -90, -180];
  for (const [lat, lng] of points) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

const shapeOf = (l: Listing) => (l.category === "Land" ? "square" : l.category === "Commercial" ? "diamond" : "circle");

/** Phones get a map that never fills more than ~70% of the screen. */
const interactiveHeight = (h: number) => `min(${h}px, 70svh)`;

export default function ArubaMapMapbox(props: ArubaMapProps) {
  const height = props.height ?? 520;
  const interactive = props.interactive ?? true;
  const fill = props.mode === "listings" && Boolean(props.fill);
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [localHover, setLocalHover] = useState<string | null>(null);
  const [is3d, setIs3d] = useState(false);

  const source = props.mode === "listings" ? props.listings : props.mode === "rentals" ? props.rentals : props.districts;
  const points: Array<[number, number]> = useMemo(
    () => source.map((x) => [x.lat, x.lng] as [number, number]),
    [source],
  );
  const pointsKey = points.map((p) => p.join(",")).join("|");

  // Fit to whatever is visible whenever the set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    // The homepage map is decorative: always show the whole island, flat and north-up.
    if (!interactive) {
      map.fitBounds(ARUBA_ISLAND, { padding: 24, pitch: 0, bearing: 0, duration: 0 });
      return;
    }
    const b = boundsOf(points);
    if (!b) return;
    const tilt = { pitch: 0, bearing: 0 };
    if (points.length === 1) map.flyTo({ center: [points[0][1], points[0][0]], zoom: 14, duration: 600, ...tilt });
    else map.fitBounds(b, { padding: 50, maxZoom: 14, duration: 600, ...tilt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, loaded]);

  // Clicking a pin or a row flies in close and tilts so the buildings show in 3D.
  const selectedId = props.mode !== "districts" ? props.selectedId : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !selectedId || props.mode === "districts") return;
    const l =
      props.mode === "listings"
        ? props.listings.find((x) => x.listing_id === selectedId)
        : props.rentals.find((x) => x.rental_id === selectedId);
    if (!l) return;
    map.flyTo({ center: [l.lng, l.lat], zoom: 16.6, pitch: 62, bearing: -24, duration: 1800, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loaded]);

  const toggle3d = () => {
    const map = mapRef.current;
    if (!map) return;
    if (is3d) map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    else map.easeTo({ pitch: 60, bearing: -20, zoom: Math.max(map.getZoom(), 15.5), duration: 1000 });
  };
  const resetView = () => {
    const map = mapRef.current;
    const b = boundsOf(points);
    if (!map || !b) return;
    map.fitBounds(b, { padding: 50, maxZoom: 14, pitch: 0, bearing: 0, duration: 900 });
  };

  const hoveredId = props.mode !== "districts" ? (props.hoveredId ?? localHover) : localHover;
  const setHover = (id: string | null) => {
    setLocalHover(id);
    if (props.mode !== "districts") props.onHover?.(id);
  };
  const hoveredListing = props.mode === "listings" ? props.listings.find((l) => l.listing_id === hoveredId) : undefined;
  const hoveredRental = props.mode === "rentals" ? props.rentals.find((r) => r.rental_id === hoveredId) : undefined;
  const hoveredDistrict = props.mode === "districts" ? props.districts.find((d) => d.district === localHover) : undefined;

  if (!TOKEN) return null;

  return (
    <div className={`relative overflow-hidden ${interactive && !fill ? "rounded-2xl border border-zinc-200" : ""}`} style={{ height: fill ? "100%" : interactiveHeight(height) }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        mapStyle={STYLE}
        initialViewState={ARUBA_VIEW}
        maxBounds={MAX_BOUNDS}
        minZoom={9.5}
        maxZoom={17}
        interactive={interactive}
        scrollZoom={false}
        dragRotate={interactive}
        pitchWithRotate={interactive}
        touchPitch={interactive}
        maxPitch={75}
        attributionControl
        style={{ width: "100%", height: "100%" }}
        onLoad={(e) => {
          configure(e.target);
          setLoaded(true);
        }}
        onPitchEnd={(e) => setIs3d(e.target.getPitch() > 10)}
      >
        {interactive && <NavigationControl position={fill ? "bottom-right" : "top-left"} visualizePitch />}

        {props.mode === "listings" &&
          props.listings.map((l) => {
            const active = props.selectedId === l.listing_id || hoveredId === l.listing_id;
            return (
              <Marker
                key={l.listing_id}
                longitude={l.lng}
                latitude={l.lat}
                anchor="center"
                style={{ zIndex: active ? 10 : 1 }}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  props.onSelect?.(l.listing_id);
                }}
              >
                <span
                  className="sd-pin-wrap relative block size-[22px]"
                  onMouseEnter={() => interactive && setHover(l.listing_id)}
                  onMouseLeave={() => interactive && setHover(null)}
                >
                  <span
                    className={`sd-pin sd-pin-${shapeOf(l)}${active ? " sd-pin-active" : ""}`}
                    style={{ background: SIGNAL_COLOR[l.signal] }}
                  />
                </span>
              </Marker>
            );
          })}

        {interactive && hoveredListing && (
          <Popup
            longitude={hoveredListing.lng}
            latitude={hoveredListing.lat}
            anchor="bottom"
            offset={16}
            closeButton={false}
            closeOnClick={false}
            maxWidth="none"
            className="sd-popup"
          >
            <HoverCard l={hoveredListing} />
          </Popup>
        )}

        {props.mode === "rentals" &&
          props.rentals.map((r) => {
            const active = props.selectedId === r.rental_id || hoveredId === r.rental_id;
            return (
              <Marker
                key={r.rental_id}
                longitude={r.lng}
                latitude={r.lat}
                anchor="center"
                style={{ zIndex: active ? 10 : 1 }}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  props.onSelect?.(r.rental_id);
                }}
              >
                <span
                  className={`sd-price-pin${active ? " sd-price-pin-active" : ""}`}
                  style={{ background: PLATFORM_COLOR[r.platform] }}
                  onMouseEnter={() => interactive && setHover(r.rental_id)}
                  onMouseLeave={() => interactive && setHover(null)}
                >
                  {pinPrice(r.nightly_rate_usd)}
                </span>
              </Marker>
            );
          })}

        {interactive && hoveredRental && (
          <Popup
            longitude={hoveredRental.lng}
            latitude={hoveredRental.lat}
            anchor="bottom"
            offset={16}
            closeButton={false}
            closeOnClick={false}
            maxWidth="none"
            className="sd-popup"
          >
            <RentalHoverCard r={hoveredRental} />
          </Popup>
        )}

        {props.mode === "districts" &&
          props.districts.map((d) => {
            const forSale = d.properties_for_sale + d.land_for_sale + d.commercial_for_sale;
            const shade = d.score >= 70 ? "#3F7A55" : d.score >= 50 ? "#71717A" : "#A05A5D";
            const size = 18 + forSale * 6;
            return (
              <Marker key={d.district} longitude={d.lng} latitude={d.lat} anchor="center">
                <button
                  type="button"
                  aria-label={`${d.district}, score ${d.score}`}
                  onClick={() => props.onSelect?.(d.district)}
                  onMouseEnter={() => setLocalHover(d.district)}
                  onMouseLeave={() => setLocalHover(null)}
                  className="block rounded-full transition-transform hover:scale-110"
                  style={{ width: size, height: size, background: `${shade}38`, border: `1.5px solid ${shade}` }}
                />
              </Marker>
            );
          })}

        {hoveredDistrict && (
          <Popup
            longitude={hoveredDistrict.lng}
            latitude={hoveredDistrict.lat}
            anchor="bottom"
            offset={20}
            closeButton={false}
            closeOnClick={false}
            className="sd-popup"
          >
            <div style={{ minWidth: 180, padding: "10px 12px" }}>
              <div style={{ fontWeight: 600, color: "#09090B" }}>{hoveredDistrict.district}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Score <b>{hoveredDistrict.score}</b> ·{" "}
                {hoveredDistrict.properties_for_sale + hoveredDistrict.land_for_sale + hoveredDistrict.commercial_for_sale} for sale
              </div>
              <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>
                RevPAR ${hoveredDistrict.revpar_usd.toLocaleString("en-US")} · {hoveredDistrict.occupancy_pct}% occ.
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {interactive && (
        <div className="absolute left-[52px] top-[10px] z-[2] flex gap-1.5">
          <button
            type="button"
            onClick={toggle3d}
            aria-pressed={is3d}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold shadow-sm ring-1 transition-colors ${
              is3d ? "bg-zinc-950 text-lime ring-zinc-950" : "bg-white text-zinc-900 ring-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {is3d ? "2D view" : "3D view"}
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-300 transition-colors hover:bg-zinc-50"
          >
            Show all
          </button>
        </div>
      )}

      {interactive && (
        <div className="pointer-events-none absolute inset-x-2 bottom-7 z-[2] flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-zinc-200 bg-white/95 px-2.5 py-1.5 text-[10px] text-zinc-600 sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-w-[calc(100%-5rem)] sm:justify-end sm:gap-3 sm:px-3 sm:py-2 sm:text-[11px]">
          {props.mode === "rentals" ? (
            <>
              {(Object.keys(PLATFORM_COLOR) as RentalPlatform[]).map((p) => (
                <span key={p} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: PLATFORM_COLOR[p] }} />
                  {PLATFORM_LABEL[p]}
                </span>
              ))}
              <span className="text-zinc-300">|</span>
              <span>Pins show the price per night</span>
            </>
          ) : props.mode === "listings" ? (
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
