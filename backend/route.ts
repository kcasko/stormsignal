// Amazon Location Routes v2. Fixed catalog-city endpoints keep the public API bounded.
import { locations } from "../shared/locations";
import { pointId } from "./geocode";
import { getWeather } from "./weather";
import { assess } from "../shared/riskEngine";
import { reviewRouteWarnings, type RouteAlertReview } from "./routeAlerts";
import { routeSamples } from "../shared/routeTiming";

export type RouteResult = {
  origin: string; destination: string;
  distanceMi: number; durationMin: number;
  departureAt: string; arrivalAt: string;
  line: number[][];
  warningReview: RouteAlertReview;
  checks: { label: string; level: string; alerts: { event: string; url: string }[]; available: boolean; arrivalAt: string; forecastCovered: boolean; summary: string }[];
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

export async function routePlan(from: string, to: string, departureAt = Date.now(), provider: RouteProvider = amazonRoute): Promise<RouteResult> {
  const cities = routeCities(from, to);
  if (!cities) throw Error("Choose two different supported cities");
  const { a, b } = cities;
  const computed = await provider([a.longitude, a.latitude], [b.longitude, b.latitude]);
  const coords = computed.line.filter(p => p.length === 2 && p.every(Number.isFinite));
  if (coords.length < 2) throw Error("Route geometry unavailable");
  // Deliberately sparse checks: these do not establish whether an entire route is warning-free.
  const samples = routeSamples(coords);
  const checks = await Promise.all(samples.map(async ({point:p, fraction}, i) => {
    const label = i === 0 ? a.name : i === 2 ? b.name : "Approximate route midpoint";
    const eta = departureAt + computed.durationSeconds * 1000 * fraction;
    const arrivalAt = new Date(eta).toISOString();
    try {
      const w = await getWeather(pointId(p[1], p[0]));
      const forecastCovered = w.availability.forecast && w.periods.some(period => Date.parse(period.start) <= eta && Date.parse(period.end) > eta);
      const forecast = forecastCovered ? assess({ ...w, alerts: [], availability: { ...w.availability, alerts: true } }, eta, 1) : null;
      return {
        label, arrivalAt, forecastCovered,
        summary: !forecast ? "No NWS hourly forecast covers this arrival time."
          : forecast.level === "unknown" ? "Insufficient forecast data for the hour after estimated arrival."
          : forecast.factors.length ? `Forecast-only evidence in the hour after arrival: ${forecast.factors.slice(0, 2).map(f => `${f.title}: ${f.evidence}`).join("; ")}.`
          : "No forecast-only threshold exceeded during the hour after arrival. Not an all-clear; check current NWS warnings.",
        available: forecastCovered,
        level: forecast?.level ?? "unknown",
        // These alerts are ACTIVE NOW. They are NOT a prediction of what will be active at arrival.
        alerts: w.availability.alerts ? w.alerts.filter(alert => alert.kind === "warning").slice(0, 4).map(alert => ({
          event: alert.event, url: alert.url,
        })) : [],
      };
    } catch {
      return { label, arrivalAt, forecastCovered: false, summary: "NWS weather unavailable for this stop.", available: false, level: "unknown", alerts: [] };
    }
  }));
  const warningReview = await reviewRouteWarnings(coords);
  return {
    origin: a.name, destination: b.name,
    departureAt: new Date(departureAt).toISOString(),
    arrivalAt: new Date(departureAt + computed.durationSeconds * 1000).toISOString(),
    distanceMi: Math.round((computed.distanceMeters / 1609.344) * 10) / 10,
    durationMin: Math.round(computed.durationSeconds / 60),
    line: coords.length > 300 ? coords.filter((_, i) => i % Math.ceil(coords.length / 300) === 0 || i === coords.length - 1) : coords,
    warningReview,
    checks,
    warning: "Active NWS warning boundaries are checked at request time, not forecast for departure. Forecast-only risk is evaluated for one hour after estimated arrival at just three route points. Traffic and delays may shift arrival times. Incomplete NWS feeds or zone geometry may miss warnings. This is not a road hazard or safety assessment; check NWS and road conditions before travel.",
  };
}
