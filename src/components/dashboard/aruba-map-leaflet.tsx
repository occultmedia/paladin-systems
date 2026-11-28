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
import { useEffect, useMemo, useState } from "react";
import L, { type LatLngBoundsExpression, type LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { Listing, Signal } from "@/lib/aruba-data";
import { canSplit, clusterPoints, clusterSize, type Cluster } from "@/lib/cluster";
import { ClusterList, HotFlame, HoverCard, PLATFORM_COLOR, PinHoverCard, RentalHoverCard, SIGNAL_COLOR, SIGNAL_LABEL, pinPrice, type ArubaMapProps } from "./map-shared";
import type { MapPin } from "@/lib/market-api";

const ARUBA_CENTER: LatLngExpression = [12.53, -70.0];
const ARUBA_BOUNDS: LatLngBoundsExpression = [
  [12.4, -70.1],
  [12.64, -69.85],
];

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
function FitTo({ points, whole }: { points: Array<[number, number]>; whole?: boolean }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (whole) {
      map.fitBounds([
        [12.405, -70.075],
        [12.635, -69.86],
      ], { padding: [24, 24] });
      return;
    }
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

function clusterIcon(n: number) {
  const size = clusterSize(n);
  return L.divIcon({
    className: "sd-pin-wrap",
    html: `<span class="sd-cluster" style="width:${size}px;height:${size}px">${n}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Listing pins; overlapping ones are grouped into numbered bubbles on interactive maps. */
function ListingPins({
  listings,
  interactive,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  listings: Listing[];
  interactive: boolean;
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [openCluster, setOpenCluster] = useState<Cluster<Listing> | null>(null);
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  // Leaflet zoom z = Mapbox zoom z - 1 (256 px tiles instead of 512)
  const clusters = useMemo(
    () => (interactive ? clusterPoints(listings, zoom - 1) : listings.map((l): Cluster<Listing> => ({ id: l.listing_id, lat: l.lat, lng: l.lng, items: [l] }))),
    [listings, zoom, interactive],
  );

  const pin = (l: Listing) => {
    const active = selectedId === l.listing_id || hoveredId === l.listing_id;
    return (
      <Marker
        key={l.listing_id}
        position={[l.lat, l.lng]}
        icon={pinIcon(l, active)}
        zIndexOffset={active ? 1000 : 0}
        eventHandlers={{
          click: () => onSelect?.(l.listing_id),
          mouseover: () => onHover?.(l.listing_id),
          mouseout: () => onHover?.(null),
        }}
      >
        {interactive && (
          <Tooltip direction="top" offset={[0, -12]} opacity={1} className="sd-tooltip">
            <HoverCard l={l} />
          </Tooltip>
        )}
      </Marker>
    );
  };

  return (
    <>
      {clusters.map((c) =>
        c.items.length === 1 ? (
          pin(c.items[0])
        ) : (
          <Marker
            key={`cluster-${c.id}`}
            position={[c.lat, c.lng]}
            icon={clusterIcon(c.items.length)}
            zIndexOffset={500}
            eventHandlers={{
              click: () => {
                if (map.getZoom() < map.getMaxZoom() && canSplit(c.items, zoom - 1)) {
                  setOpenCluster(null);
                  map.fitBounds(c.items.map((l) => [l.lat, l.lng] as [number, number]), { padding: [60, 60] });
                } else setOpenCluster(c);
              },
            }}
          />
        ),
      )}
      {clusters
        .filter((c) => c.items.length > 1)
        .flatMap((c) => c.items.filter((l) => l.listing_id === selectedId || l.listing_id === hoveredId))
        .map(pin)}
      {openCluster && listings.includes(openCluster.items[0]) && (
        <Popup position={[openCluster.lat, openCluster.lng]} offset={[0, -14]} closeButton={false} className="sd-popup" eventHandlers={{ remove: () => setOpenCluster(null) }}>
          <ClusterList
            items={openCluster.items}
            onPick={(id) => {
              setOpenCluster(null);
              onSelect?.(id);
            }}
          />
        </Popup>
      )}
    </>
  );
}

/**
 * Grouped pins (fallback when no Mapbox token is set): one marker per group,
 * no bubbles. Projects show their unit count. Reports the visible area like
 * the Mapbox map does.
 */
function GroupPins({
  pins,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onViewport,
}: {
  pins: MapPin[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (key: string) => void;
  onHover?: (key: string | null) => void;
  onViewport?: (v: { bbox: [number, number, number, number]; zoom: number; user: boolean }) => void;
}) {
  const map = useMap();
  useEffect(() => {
    let t: number | undefined;
    let user = false;
    const touched = () => (user = true);
    const report = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const b = map.getBounds();
        onViewport?.({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() + 1, user });
        user = false;
      }, 300);
    };
    report();
    map.on("moveend", report);
    map.on("dragstart", touched);
    map.getContainer().addEventListener("wheel", touched, { passive: true });
    return () => {
      window.clearTimeout(t);
      map.off("moveend", report);
      map.off("dragstart", touched);
      map.getContainer().removeEventListener("wheel", touched);
    };
  }, [map, onViewport]);
  return (
    <>
      {pins.map((p) => {
        const active = selectedId === p.group_key || hoveredId === p.group_key;
        const project = p.group_type === "project";
        const shape = p.category === "Land" ? "square" : p.category === "Commercial" ? "diamond" : "circle";
        const ring = p.agency_count > 1 ? " sd-pin-multi" : "";
        const html = project
          ? `<span class="sd-pin-project${active ? " sd-pin-active" : ""}${ring}" style="background:#0A0A0A;color:#ACFA68">${p.unit_count}</span>`
          : `<span class="sd-pin sd-pin-${shape}${active ? " sd-pin-active" : ""}${ring}" style="background:${SIGNAL_COLOR[p.signal]}"></span>`;
        return (
          <Marker
            key={p.group_key}
            position={[p.lat, p.lng]}
            icon={L.divIcon({ className: "sd-pin-wrap", html, iconSize: [24, 22], iconAnchor: [12, 11] })}
            zIndexOffset={active ? 1000 : project ? 200 : 0}
            eventHandlers={{
              click: () => onSelect?.(p.group_key),
              mouseover: () => onHover?.(p.group_key),
              mouseout: () => onHover?.(null),
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} opacity={1} className="sd-tooltip">
              <PinHoverCard p={p} />
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

/** Phones get a map that never fills more than ~70% of the screen. */
const interactiveHeight = (h: number) => `min(${h}px, 70svh)`;

export default function ArubaMapLeaflet(props: ArubaMapProps) {
  const height = props.height ?? 520;
  const interactive = props.interactive ?? true;
  const fill = (props.mode === "listings" || props.mode === "pins") && Boolean(props.fill);
  const source =
    props.mode === "listings" ? props.listings : props.mode === "pins" ? props.pins : props.mode === "rentals" ? props.rentals : props.districts;
  const points: Array<[number, number]> = useMemo(() => source.map((x) => [x.lat, x.lng] as [number, number]), [source]);

  return (
    <div className={`relative isolate overflow-hidden ${interactive && !fill ? "rounded-2xl border border-zinc-200 [&_.leaflet-container]:rounded-2xl" : ""}`} style={{ height: fill ? "100%" : interactiveHeight(height) }}>
      <MapContainer
        center={ARUBA_CENTER}
        zoom={11}
        minZoom={10}
        maxZoom={17}
        maxBounds={ARUBA_BOUNDS}
        maxBoundsViscosity={0.8}
        scrollWheelZoom={interactive}
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
          maxNativeZoom={16}
          maxZoom={17}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={16}
          maxZoom={17}
        />
        <FitTo points={points} whole={!interactive} />

        {props.mode === "listings" && (
          <ListingPins
            listings={props.listings}
            interactive={interactive}
            selectedId={props.selectedId}
            hoveredId={props.hoveredId}
            onSelect={props.onSelect}
            onHover={props.onHover}
          />
        )}

        {props.mode === "pins" && (
          <GroupPins
            pins={props.pins}
            selectedId={props.selectedId}
            hoveredId={props.hoveredId}
            onSelect={props.onSelect}
            onHover={props.onHover}
            onViewport={props.onViewport}
          />
        )}

        {props.mode === "rentals" &&
          props.rentals.map((r) => {
            const active = props.selectedId === r.rental_id || props.hoveredId === r.rental_id;
            return (
              <Marker
                key={r.rental_id}
                position={[r.lat, r.lng]}
                zIndexOffset={active ? 1000 : 0}
                icon={L.divIcon({
                  className: "sd-pin-wrap",
                  html: `<span class="sd-price-pin${active ? " sd-price-pin-active" : ""}" style="background:${PLATFORM_COLOR[r.platform]};transform:translate(-50%,-50%)${active ? " scale(1.18)" : ""}">${pinPrice(r.nightly_rate_usd)}</span>`,
                  iconSize: [0, 0],
                })}
                eventHandlers={{
                  click: () => props.onSelect?.(r.rental_id),
                  mouseover: () => props.onHover?.(r.rental_id),
                  mouseout: () => props.onHover?.(null),
                }}
              >
                {interactive && (
                  <Tooltip direction="top" offset={[0, -12]} opacity={1} className="sd-tooltip">
                    <RentalHoverCard r={r} />
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
          {props.mode === "rentals" ? (
            <span>Pins show the price per night (red Airbnb · blue Vrbo · black direct)</span>
          ) : props.mode === "listings" || props.mode === "pins" ? (
            <>
              {(Object.keys(SIGNAL_COLOR) as Signal[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: SIGNAL_COLOR[s] }} />
                  {SIGNAL_LABEL[s]}
                  {s === "UNDERVALUED" && <HotFlame size={11} />}
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
