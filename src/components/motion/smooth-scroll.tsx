"use client";

/**
 * Site-wide smooth scrolling (Lenis). Off for people who ask for reduced
 * motion. Inner scroll areas (dropdown feeds, map canvases) opt out with
 * data-lenis-prevent; horizontal table scrolling is left to the browser.
 */

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      lerp: 0.11,
      wheelMultiplier: 1,
      smoothWheel: true,
      anchors: { offset: -72 },
      autoRaf: true,
      prevent: (node) => node.closest?.(".mapboxgl-map, .leaflet-container, [data-lenis-prevent]") !== null,
    });
    return () => lenis.destroy();
  }, []);
  return null;
}
