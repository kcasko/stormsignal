// Small geometry helpers for alert areas. Rings are arrays of [lon, lat].

export type Ring = number[][];

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Outer rings of a GeoJSON Polygon or MultiPolygon, validated, rounded to 3 decimals and capped in size. */
export function outerRings(geometry: unknown, maxPoints = 600): Ring[] | null {
  if (!geometry || typeof geometry !== "object") return null;
  const g = geometry as { type?: unknown; coordinates?: unknown };
  const polys: unknown[] =
    g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" && Array.isArray(g.coordinates) ? g.coordinates : [];
  const rings: Ring[] = [];
  for (const poly of polys.slice(0, 40)) {
    if (!Array.isArray(poly) || !Array.isArray(poly[0])) continue;
    const ring = (poly[0] as unknown[])
      .filter((p): p is number[] => Array.isArray(p) && finite(p[0]) && finite(p[1]))
      .map(([lon, lat]) => [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]);
    if (ring.length >= 4) rings.push(ring);
  }
  if (!rings.length) return null;
  const total = rings.reduce((n, r) => n + r.length, 0);
  if (total <= maxPoints) return rings;
  const tolerance = 0.002 * Math.ceil(total / maxPoints);
  return rings.map((r) => simplify(r, tolerance)).filter((r) => r.length >= 4);
}

/** Douglas–Peucker simplification (degrees). Keeps first and last points. */
export function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1,
      at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDistance(ring[i], ring[a], ring[b]);
      if (d > worst) [worst, at] = [d, i];
    }
    if (worst > tolerance) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

function segmentDistance(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ray-casting point-in-polygon over any of the rings. */
export function insideRings(lon: number, lat: number, rings: Ring[]) {
  return rings.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i],
        [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}

export interface Box {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}
export function bbox(rings: Ring[], extra: number[][] = []): Box | null {
  const pts = [...rings.flat(), ...extra];
  if (!pts.length) return null;
  return {
    minLon: Math.min(...pts.map((p) => p[0])),
    minLat: Math.min(...pts.map((p) => p[1])),
    maxLon: Math.max(...pts.map((p) => p[0])),
    maxLat: Math.max(...pts.map((p) => p[1])),
  };
}

/** "forecast/MIZ072" from an NWS zone URL; null for anything else. */
export function zoneRef(url: unknown) {
  if (typeof url !== "string") return null;
  const m = /^https:\/\/api\.weather\.gov\/zones\/(forecast|county|fire)\/([A-Z]{2}[ZC]\d{3})$/.exec(url);
  return m ? `${m[1]}/${m[2]}` : null;
}
export const ZONE_REF = /^(forecast|county|fire)\/[A-Z]{2}[ZC]\d{3}$/;

/** VTEC event key and action from an NWS alert's parameters.VTEC. */
export function parseVtec(v: unknown): { key: string; action: string } | null {
  const first = Array.isArray(v) ? v[0] : null;
  if (typeof first !== "string") return null;
  const m = /^\/[OTEX]\.([A-Z]{3})\.([A-Z]{4})\.([A-Z]{2})\.([A-Z])\.(\d{4})\./.exec(first);
  return m ? { action: m[1], key: `${m[2]}.${m[3]}.${m[4]}.${m[5]}` } : null;
}
