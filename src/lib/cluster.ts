/*
 * Map clustering: listings that would overlap on screen at a zoom level are
 * drawn as one numbered bubble. Plain arithmetic on the listings already in
 * memory, shared by the Mapbox and the Leaflet map.
 */

export interface ClusterPoint {
  listing_id: string;
  lat: number;
  lng: number;
}

export interface Cluster<T extends ClusterPoint> {
  /** Stable while the same listings stay grouped. */
  id: string;
  lat: number;
  lng: number;
  items: T[];
}

/** Bubbles closer than this many screen pixels are merged. */
export const CLUSTER_RADIUS = 46;
/** Listings still overlapping at this zoom share a building: show them as a list instead of zooming further. */
export const CLUSTER_MAX_ZOOM = 16.5;

/** Web Mercator position in pixels at a Mapbox zoom level (512 px world at zoom 0). */
function project(lat: number, lng: number, zoom: number) {
  const size = 512 * Math.pow(2, zoom);
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** Group points within `radius` pixels of each other at `zoom` (Mapbox zoom; Leaflet zoom - 1). */
export function clusterPoints<T extends ClusterPoint>(points: T[], zoom: number, radius = CLUSTER_RADIUS): Cluster<T>[] {
  const cells = new Map<string, number[]>();
  const pos = points.map((p) => project(p.lat, p.lng, zoom));
  const cell = (v: number) => Math.floor(v / radius);
  pos.forEach((p, i) => {
    const key = `${cell(p.x)}:${cell(p.y)}`;
    const list = cells.get(key);
    if (list) list.push(i);
    else cells.set(key, [i]);
  });

  const taken = new Array<boolean>(points.length).fill(false);
  const out: Cluster<T>[] = [];
  for (let i = 0; i < points.length; i++) {
    if (taken[i]) continue;
    const { x, y } = pos[i];
    const members: number[] = [];
    for (let cx = cell(x) - 1; cx <= cell(x) + 1; cx++)
      for (let cy = cell(y) - 1; cy <= cell(y) + 1; cy++)
        for (const j of cells.get(`${cx}:${cy}`) ?? [])
          if (!taken[j] && Math.hypot(pos[j].x - x, pos[j].y - y) <= radius) members.push(j);
    members.forEach((j) => (taken[j] = true));
    const items = members.map((j) => points[j]);
    out.push({
      id: items.map((m) => m.listing_id).sort()[0] + `:${items.length}`,
      lat: items.reduce((s, m) => s + m.lat, 0) / items.length,
      lng: items.reduce((s, m) => s + m.lng, 0) / items.length,
      items,
    });
  }
  return out;
}

/** Will zooming in pull this group apart? False = same building or plot. */
export const canSplit = <T extends ClusterPoint>(items: T[], zoom: number) =>
  zoom < CLUSTER_MAX_ZOOM && clusterPoints(items, CLUSTER_MAX_ZOOM).length > 1;

/** Bubble size in pixels: grows gently with the number of listings. */
export const clusterSize = (n: number) => (n < 10 ? 34 : n < 30 ? 40 : n < 75 ? 46 : 54);
