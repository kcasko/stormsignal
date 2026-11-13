import { useMemo } from "react";
import type { RouteResult } from "../backend/route";

const WIDTH = 760, HEIGHT = 300, PAD = 28;
export function RouteMap({ result }: { result: RouteResult }) {
  const map = useMemo(() => {
    const line = result.line;
    if (line.length < 2) return null;
    const centerLat = line.reduce((sum, p) => sum + p[1], 0) / line.length;
    const factor = Math.cos(centerLat * Math.PI / 180);
    const xs = line.map(p => p[0] * factor), ys = line.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = (WIDTH - PAD * 2) / Math.max(maxX - minX, .025);
    const sy = (HEIGHT - PAD * 2) / Math.max(maxY - minY, .025);
    const scale = Math.min(sx, sy);
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    const point = (p: number[]) => ({
      x: WIDTH / 2 + (p[0] * factor - centerX) * scale,
      y: HEIGHT / 2 - (p[1] - centerY) * scale,
    });
    const path = (pts: number[][]) => pts.map((p, i) => {
      const { x, y } = point(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return { point, path };
  }, [result.line]);

  if (!map) return <p className="muted">Route geometry unavailable.</p>;
  const start = map.point(result.line[0]), end = map.point(result.line[result.line.length - 1]);
  return <figure className="route-map">
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
      aria-label={`Geographic outline of the calculated driving route from ${result.origin} to ${result.destination}; ${result.warningReview.warnings.length} mapped warning area intersections. No streets or road details shown.`}>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="route-map-back" />
      {result.warningReview.warnings.flatMap((warning, wi) => warning.geometry.map((ring, ri) =>
        <path key={`${wi}-${ri}`} d={map.path(ring) + " Z"} className="route-warning-area" />
      ))}
      <path d={map.path(result.line)} className="route-path" />
      <circle cx={start.x} cy={start.y} r={6} className="route-marker"/>
      <circle cx={end.x} cy={end.y} r={6} className="route-marker"/>
      <text x={Math.min(start.x + 8, WIDTH - 85)} y={Math.max(14, start.y - 10)} className="route-map-label">Start</text>
      <text x={Math.max(6, end.x - 55)} y={Math.max(14, end.y - 10)} className="route-map-label">End</text>
    </svg>
    <figcaption className="fine">Route shape from Amazon Location. Shaded areas indicate NWS warning boundaries that may overlap the route. This diagram is not a navigation map or continuous hazard scan.</figcaption>
  </figure>;
}
