/**
 * Turns GeoJSON polygons into SVG path strings (server side), for the small
 * static maps in the landing-page Terminal preview. Equirectangular
 * projection, good enough at Aruba's size.
 */

import type { FeatureCollection, Geometry, Position } from "geojson";
import districtAreas from "./district-areas.json";
import ropvLite from "./ropv-lite.json";

const LAT0 = Math.cos((12.52 * Math.PI) / 180);
/** Bounding box of Aruba (lng/lat) used by every preview map. */
const BOX = { minLng: -70.07, maxLng: -69.865, minLat: 12.41, maxLat: 12.63 };
export const SVG_W = 400;
const K = SVG_W / ((BOX.maxLng - BOX.minLng) * LAT0);
export const SVG_H = Math.round((BOX.maxLat - BOX.minLat) * K);

export function project([lng, lat]: Position | [number, number]): [number, number] {
  return [Math.round((lng - BOX.minLng) * LAT0 * K * 10) / 10, Math.round((BOX.maxLat - lat) * K * 10) / 10];
}

function ringPath(ring: Position[]) {
  return ring.map((p, i) => `${i ? "L" : "M"}${project(p).join(",")}`).join("") + "Z";
}

export function geometryPath(g: Geometry): string {
  if (g.type === "Polygon") return g.coordinates.map(ringPath).join("");
  if (g.type === "MultiPolygon") return g.coordinates.map((poly) => poly.map(ringPath).join("")).join("");
  return "";
}

export interface SvgShape {
  key: string;
  d: string;
}

export const DISTRICT_SHAPES: SvgShape[] = (districtAreas as FeatureCollection).features.map((f) => ({
  key: String(f.properties?.district),
  d: geometryPath(f.geometry),
}));

export const ZONING_SHAPES: SvgShape[] = (ropvLite as FeatureCollection).features.map((f) => ({
  key: String(f.properties?.zone),
  d: geometryPath(f.geometry),
}));
