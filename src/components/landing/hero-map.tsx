"use client";

import dynamic from "next/dynamic";
import type { Listing } from "@/lib/aruba-data";

const ArubaMap = dynamic(() => import("@/components/dashboard/aruba-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

/** Static map of every listing, used as the landing-page hero visual. */
export function HeroMap({ listings, height }: { listings: Listing[]; height: number }) {
  return <ArubaMap mode="listings" listings={listings} interactive={false} height={height} />;
}
