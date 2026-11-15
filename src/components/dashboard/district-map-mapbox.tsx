"use client";

/**
 * District maps (Mapbox):
 *  - "value":  each district's area shaded by the chosen value metric (choropleth)
 *  - "zoning": the official ROPV zoning areas of Aruba, with district outlines on top
 *
 * Boundaries: /data/districts.geojson (approximate market areas, drawn from the
 * district centres and clipped to the coast). Zoning: /data/ropv.geojson, the
 * ROPV deelgebieden (5 Feb 2021) as published by the Government of Aruba's
 * planning consultant on ArcGIS Online.
 */

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, NavigationControl, Popup, Source, type MapMouseEvent, type MapRef } from "react-map-gl/mapbox";
import type { FeatureCollection } from "geojson";
import type { DistrictStats } from "@/lib/aruba-data";
import { DISTRICT_METRICS, NO_DATA, RAMP, ROPV_ZONES, rampColor, type DistrictMetric } from "./district-map-shared";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "mapbox://styles/mapbox/standard";
const ISLAND: [[number, number], [number, number]] = [
  [-70.075, 12.405],
  [-69.86, 12.635],
];
/** Where the districts are (west / north coast down to Savaneta). */
const DISTRICT_AREA: [[number, number], [number, number]] = [
  [-70.08, 12.435],
  [-69.925, 12.63],
];
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-70.25, 12.33],
  [-69.7, 12.7],
];

/* ── Component ─────────────────────────────────────────────────────────── */

export type { DistrictMetric };

export interface DistrictMapProps {
  layer: "value" | "zoning";
  districts: DistrictStats[];
  metric?: DistrictMetric;
  onSelect?: (district: string) => void;
  height?: number;
  /** zoning only: zones to hide (by Dutch name) */
  hiddenZones?: string[];
}

interface ZoneHover {
  lng: number;
  lat: number;
  zone: string;
  area: string | null;
  note: string | null;
  district: string | null;
}

export default function DistrictMapMapbox({ layer, districts, metric = "median_asking_usd", onSelect, height = 480, hiddenZones = [] }: DistrictMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [areas, setAreas] = useState<FeatureCollection | null>(null);
  const [ropv, setRopv] = useState<FeatureCollection | null>(null);
  const [hoverDistrict, setHoverDistrict] = useState<string | null>(null);
  const [zoneHover, setZoneHover] = useState<ZoneHover | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/data/districts.geojson")
      .then((r) => r.json())
      .then((d) => live && setAreas(d))
      .catch(() => {});
    if (layer === "zoning")
      fetch("/data/ropv.geojson")
        .then((r) => r.json())
        .then((d) => live && setRopv(d))
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [layer]);

  const byName = useMemo(() => Object.fromEntries(districts.map((d) => [d.district, d])), [districts]);

  // Colour each district by the chosen metric (min–max across districts with data).
  const { shaded, min, max } = useMemo(() => {
    const vals = districts.map((d) => d[metric]).filter((v): v is number => v !== null);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    if (!areas) return { shaded: null, min: lo, max: hi };
    const fc: FeatureCollection = {
      ...areas,
      features: areas.features.map((f) => {
        const d = byName[f.properties?.district as string];
        const v = d ? d[metric] : null;
        const color = v === null || v === undefined ? NO_DATA : rampColor(hi === lo ? 1 : (v - lo) / (hi - lo));
        return { ...f, properties: { ...f.properties, color } };
      }),
    };
    return { shaded: fc, min: lo, max: hi };
  }, [areas, byName, districts, metric]);

  const zones = useMemo(() => {
    if (!ropv) return null;
    const hidden = new Set(hiddenZones);
    return {
      ...ropv,
      features: ropv.features
        .filter((f) => !hidden.has(f.properties?.zone))
        .map((f) => ({ ...f, properties: { ...f.properties, color: ROPV_ZONES[f.properties?.zone]?.color ?? "#999" } })),
    } as FeatureCollection;
  }, [ropv, hiddenZones]);

  const fmt = DISTRICT_METRICS[metric].fmt;

  const labels = useMemo<FeatureCollection>(() => {
    const ranked = [...districts].sort((a, b) => (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity));
    return {
      type: "FeatureCollection",
      features: ranked.map((d, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [d.lng, d.lat] },
        properties: { district: d.district, rank: i, label: d[metric] === null ? "—" : fmt(d[metric] as number) },
      })),
    };
  }, [districts, metric, fmt]);

  const onMove = (e: MapMouseEvent) => {
    const fs = e.features ?? [];
    const area = fs.find((f) => ["district-fill", "district-hit", "district-label"].includes(f.layer?.id ?? ""));
    const zone = fs.find((f) => f.layer?.id === "ropv-fill");
    setHoverDistrict((area?.properties?.district as string) ?? null);
    if (layer === "zoning") {
      setZoneHover(
        zone
          ? {
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
              zone: zone.properties?.zone as string,
              area: (zone.properties?.area as string) || null,
              note: (zone.properties?.note as string) || null,
              district: (area?.properties?.district as string) ?? null,
            }
          : null,
      );
    }
    e.target.getCanvas().style.cursor = area && onSelect && layer === "value" ? "pointer" : "";
  };

  if (!TOKEN) return null;
  const hovered = hoverDistrict ? byName[hoverDistrict] : undefined;

  return (
    <div className="relative overflow-hidden border border-zinc-200" style={{ height }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        mapStyle={STYLE}
        initialViewState={{ bounds: layer === "value" ? DISTRICT_AREA : ISLAND, fitBoundsOptions: { padding: 20 } }}
        maxBounds={MAX_BOUNDS}
        minZoom={9.5}
        maxZoom={16}
        scrollZoom={false}
        dragRotate={false}
        pitchWithRotate={false}
        attributionControl
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={layer === "value" ? ["district-fill", "district-label"] : ["ropv-fill", "district-hit"]}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHoverDistrict(null);
          setZoneHover(null);
        }}
        onClick={(e) => {
          const area = e.features?.find((f) => f.layer?.id === "district-fill" || f.layer?.id === "district-label");
          if (layer === "value" && area && onSelect) onSelect(area.properties?.district as string);
        }}
        onLoad={(e) => {
          try {
            e.target.setConfigProperty("basemap", "lightPreset", "day");
            e.target.setConfigProperty("basemap", "showPointOfInterestLabels", false);
          } catch {
            /* style without config */
          }
        }}
      >
        <NavigationControl position="top-left" showCompass={false} />

        {layer === "zoning" && zones && (
          <Source id="ropv" type="geojson" data={zones}>
            <Layer id="ropv-fill" type="fill" slot="middle" paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.55 }} />
            <Layer id="ropv-line" type="line" slot="middle" paint={{ "line-color": ["get", "color"], "line-width": 0.8, "line-opacity": 0.9 }} />
          </Source>
        )}

        {shaded && (
          <Source id="districts" type="geojson" data={shaded}>
            {layer === "value" ? (
              <Layer
                id="district-fill"
                type="fill"
                slot="middle"
                paint={{ "fill-color": ["get", "color"], "fill-opacity": ["case", ["==", ["get", "district"], hoverDistrict ?? ""], 0.92, 0.72] }}
              />
            ) : (
              <Layer id="district-hit" type="fill" slot="middle" paint={{ "fill-color": "#000", "fill-opacity": 0 }} />
            )}
            <Layer
              id="district-line"
              type="line"
              slot="middle"
              paint={{
                "line-color": layer === "value" ? "#FFFFFF" : "#0A0A0A",
                "line-width": ["case", ["==", ["get", "district"], hoverDistrict ?? ""], 2.5, layer === "value" ? 1.2 : 1],
                "line-dasharray": layer === "zoning" ? [2, 1.5] : [1, 0],
              }}
            />
          </Source>
        )}

        {/* Value labels: a symbol layer, so labels that would overlap hide until you zoom in */}
        {layer === "value" && (
          <Source id="district-labels" type="geojson" data={labels}>
            <Layer
              id="district-label"
              type="symbol"
              slot="top"
              layout={{
                "text-field": ["get", "label"],
                "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
                "text-size": 12,
                "symbol-sort-key": ["get", "rank"],
                "text-padding": 2,
              }}
              paint={{ "text-color": "#09090B", "text-halo-color": "#FFFFFF", "text-halo-width": 1.6 }}
            />
          </Source>
        )}

        {layer === "value" && hovered && (
          <Popup longitude={hovered.lng} latitude={hovered.lat} anchor="bottom" offset={16} closeButton={false} closeOnClick={false} className="sd-popup">
            <div style={{ minWidth: 200, padding: "10px 12px", fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: "#09090B", fontSize: 13 }}>{hovered.district}</div>
              <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 12px", color: "#52525B" }}>
                {(Object.keys(DISTRICT_METRICS) as DistrictMetric[]).map((k) => (
                  <FragmentRow key={k} label={DISTRICT_METRICS[k].short} value={hovered[k] === null ? "—" : DISTRICT_METRICS[k].fmt(hovered[k] as number)} strong={k === metric} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#71717A", marginTop: 6 }}>Click to see its listings</div>
            </div>
          </Popup>
        )}

        {layer === "zoning" && zoneHover && (
          <Popup longitude={zoneHover.lng} latitude={zoneHover.lat} anchor="bottom" offset={10} closeButton={false} closeOnClick={false} className="sd-popup">
            <div style={{ minWidth: 210, maxWidth: 260, padding: "10px 12px", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: ROPV_ZONES[zoneHover.zone]?.color }} />
                <span style={{ fontWeight: 600, color: "#09090B" }}>{ROPV_ZONES[zoneHover.zone]?.en ?? zoneHover.zone}</span>
              </div>
              <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>ROPV: {zoneHover.zone}</div>
              <div style={{ marginTop: 6, color: "#3F3F46" }}>{ROPV_ZONES[zoneHover.zone]?.hint}</div>
              {(zoneHover.area || zoneHover.note) && (
                <div style={{ marginTop: 4, color: "#52525B" }}>
                  {[zoneHover.area, zoneHover.note].filter(Boolean).join(" · ")}
                </div>
              )}
              {zoneHover.district && <div style={{ fontSize: 11, color: "#71717A", marginTop: 6 }}>In {zoneHover.district}</div>}
            </div>
          </Popup>
        )}
      </Map>

      {layer === "value" && (
        <div className="pointer-events-none absolute bottom-8 left-3 z-[2] rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-[11px] text-zinc-600">
          <div className="font-medium text-zinc-900">{DISTRICT_METRICS[metric].label}</div>
          <div className="mt-1.5 flex h-2 w-44 overflow-hidden rounded-sm">
            {RAMP.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="mt-1 flex w-44 justify-between tabular-nums">
            <span>{Number.isFinite(min) ? fmt(min) : "—"}</span>
            <span>{Number.isFinite(max) ? fmt(max) : "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ label, value, strong }: { label: string; value: string; strong: boolean }) {
  return (
    <>
      <span style={{ fontWeight: strong ? 600 : 400, color: strong ? "#09090B" : undefined }}>{label}</span>
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: strong ? 600 : 400, color: strong ? "#09090B" : undefined }}>{value}</span>
    </>
  );
}
