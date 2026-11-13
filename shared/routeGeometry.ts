// Segment/polygon overlap in [longitude, latitude] degrees. Exact for supplied line segments
// and rings (subject to NWS boundary resolution); not a road-safety determination.
export type Coordinate = number[];
export type Ring = Coordinate[];

function orientation(a: Coordinate, b: Coordinate, c: Coordinate): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function onSegment(a: Coordinate, b: Coordinate, p: Coordinate): boolean {
  const e = 1e-10;
  return p[0] >= Math.min(a[0], b[0]) - e && p[0] <= Math.max(a[0], b[0]) + e
    && p[1] >= Math.min(a[1], b[1]) - e && p[1] <= Math.max(a[1], b[1]) + e
    && Math.abs(orientation(a, b, p)) < e;
}
export function segmentsCross(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate): boolean {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
export function inRing(p: Coordinate, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (onSegment(a, b, p)) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function routeIntersectsRings(route: Coordinate[], rings: Ring[]): boolean {
  if (route.length < 2) return false;
  for (const ring of rings) {
    if (ring.length < 3) continue;
    if (route.some(p => inRing(p, ring))) return true;
    for (let i = 1; i < route.length; i++) {
      for (let j = 0; j < ring.length; j++) {
        if (segmentsCross(route[i - 1], route[i], ring[j], ring[(j + 1) % ring.length])) return true;
      }
    }
  }
  return false;
}
