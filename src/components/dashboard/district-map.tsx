"use client";

/** District value / zoning map. Needs Mapbox; without a token the page falls back to the circle map. */

import dynamic from "next/dynamic";
import type { DistrictMapProps } from "./district-map-mapbox";

const loading = () => <div className="h-full min-h-[200px] w-full animate-pulse bg-zinc-100" />;
const DistrictMapMapbox = dynamic(() => import("./district-map-mapbox"), { ssr: false, loading });

export const HAS_DISTRICT_MAP = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

export default function DistrictMap(props: DistrictMapProps) {
  return <DistrictMapMapbox {...props} />;
}
