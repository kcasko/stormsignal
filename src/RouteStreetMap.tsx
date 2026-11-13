import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteResult } from "../backend/route";
import { RouteMap } from "./RouteMap";

// OpenStreetMap standard raster tiles, requested only when a user opens a route.
// The map is interactive but not a navigation service; Leaflet handles zoom and pan.
export function RouteStreetMap({ result }: { result: RouteResult }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || result.line.length < 2) return;
    const map = L.map(container.current, { scrollWheelZoom: false });
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const points = result.line.map(([lon, lat]) => [lat, lon] as L.LatLngTuple);
    const route = L.polyline(points, { color: "#155d8e", weight: 5, opacity: 0.92 }).addTo(map);
    for (const [index, coord] of [[0, points[0]], [points.length - 1, points[points.length - 1]]] as [number,L.LatLngTuple][]) {
      L.circleMarker(coord, { radius: 7, weight: 3, color: "#155d8e", fillColor: "#fff", fillOpacity: 1 })
        .bindTooltip(index === 0 ? result.origin : result.destination).addTo(map);
    }
    for (const item of result.warningReview?.warnings ?? []) {
      for (const ring of item.geometry) {
        if (ring.length < 3) continue;
        L.polygon(ring.map(([lon,lat])=>[lat,lon] as L.LatLngTuple), {
          color: "#b04c25", fillColor: "#da7735", fillOpacity: 0.25, weight: 2,
        }).bindPopup(item.event + " (official NWS warning area)").addTo(map);
      }
    }
    map.fitBounds(route.getBounds().pad(0.16));
    // Ensure correct sizing once shown in its parent layout.
    map.invalidateSize();
    return () => { tiles.off(); map.remove(); };
  }, [result]);
  return <section className="route-street-map" aria-label="Interactive map of driving route">
    <div ref={container} className="route-leaflet" data-testid="interactive-route-map" aria-label="Interactive street map: zoom and pan to explore your route"/>
    <p className="fine">Map: OpenStreetMap contributors. Route: Amazon Location. Zoom and pan to explore. Orange overlays mark available official NWS warning boundaries, not every possible hazard.</p>
    <details><summary>View offline route diagram</summary><RouteMap result={result}/></details>
  </section>;
}
