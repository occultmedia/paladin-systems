"use client";

/**
 * Aruba map entry point. Uses Mapbox when NEXT_PUBLIC_MAPBOX_TOKEN is set,
 * otherwise falls back to the Leaflet + Esri version so the site never shows
 * an empty map (e.g. if the Vercel env var is missing).
 */

import dynamic from "next/dynamic";
import type { ArubaMapProps } from "./map-shared";

const loading = () => <div className="h-full min-h-[200px] w-full animate-pulse bg-zinc-100" />;
const MapboxMap = dynamic(() => import("./aruba-map-mapbox"), { ssr: false, loading });
const LeafletMap = dynamic(() => import("./aruba-map-leaflet"), { ssr: false, loading });

export default function ArubaMap(props: ArubaMapProps) {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? <MapboxMap {...props} /> : <LeafletMap {...props} />;
}
