// Amazon Location Routes v2. Fixed catalog-city endpoints keep the public API bounded.
import { locations } from "../shared/locations";
import { pointId } from "./geocode";
import { getWeather } from "./weather";
import { assess } from "../shared/riskEngine";

export type RouteResult = {
  origin: string; destination: string;
  distanceMi: number; durationMin: number;
  line: number[][];
  checks: { label: string; level: string; alerts: { event: string; url: string }[]; available: boolean }[];
  warning: string;
};

export function routeCities(from: string, to: string) {
  const a = locations.find(l => l.id === from), b = locations.find(l => l.id === to);
  if (!a || !b || from === to) return null;
  return { a, b };
}

export function sampleLine(line: number[][]): number[][] {
  if (line.length < 2) return [];
  const at = (fraction: number) => line[Math.min(line.length - 1, Math.floor((line.length - 1) * fraction))];
  return [line[0], at(0.5), line[line.length - 1]];
}

type RouteProvider = (origin: number[], destination: number[]) => Promise<{
  distanceMeters: number; durationSeconds: number; line: number[][];
}>;

export async function amazonRoute(origin: number[], destination: number[]) {
  const { GeoRoutesClient, CalculateRoutesCommand } = await import("@aws-sdk/client-geo-routes");
  const response = await new GeoRoutesClient({}).send(new CalculateRoutesCommand({
    Origin: origin, Destination: destination, TravelMode: "Car", LegGeometryFormat: "Simple",
  }));
  const route = response.Routes?.[0];
  const line = route?.Legs?.flatMap(leg => leg.Geometry?.LineString ?? []) ?? [];
  if (!route || !route.Summary || line.length < 2) throw Error("Routing geometry unavailable");
  return {
    distanceMeters: route.Summary.Distance ?? 0,
    durationSeconds: route.Summary.Duration ?? 0,
    line,
  };
}

export async function routePlan(from: string, to: string, provider: RouteProvider = amazonRoute): Promise<RouteResult> {
  const cities = routeCities(from, to);
  if (!cities) throw Error("Choose two different supported cities");
  const { a, b } = cities;
  const computed = await provider([a.longitude, a.latitude], [b.longitude, b.latitude]);
  const coords = computed.line.filter(p => p.length === 2 && p.every(Number.isFinite));
  if (coords.length < 2) throw Error("Route geometry unavailable");
  // Deliberately sparse checks: these do not establish whether an entire route is warning-free.
  const checks = await Promise.all(sampleLine(coords).map(async (p, i) => {
    const label = i === 0 ? a.name : i === 2 ? b.name : "Approximate route midpoint";
    try {
      const w = await getWeather(pointId(p[1], p[0]));
      return {
        label, available: w.availability.forecast || w.availability.alerts,
        level: w.availability.forecast || w.availability.alerts ? assess(w, Date.now()).level : "unknown",
        alerts: w.availability.alerts ? w.alerts.filter(alert => alert.kind === "warning").slice(0, 4).map(alert => ({
          event: alert.event, url: alert.url,
        })) : [],
      };
    } catch {
      return { label, available: false, level: "unknown", alerts: [] };
    }
  }));
  return {
    origin: a.name, destination: b.name,
    distanceMi: Math.round((computed.distanceMeters / 1609.344) * 10) / 10,
    durationMin: Math.round(computed.durationSeconds / 60),
    line: coords.length > 300 ? coords.filter((_, i) => i % Math.ceil(coords.length / 300) === 0 || i === coords.length - 1) : coords,
    checks,
    warning: "Weather sampled at only three route points, not checked continuously. Missing data is unknown. This is not a road hazard or safety assessment. Check official NWS alerts and road conditions before travel.",
  };
}
