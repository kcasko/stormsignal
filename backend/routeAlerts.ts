import { json, normalizeAlerts } from "./weather";
import { getZones } from "./zones";
import { routeIntersectsRings } from "../shared/routeGeometry";
import type { Alert } from "../shared/types";

const STATES = ["MI", "IN", "IL", "OH", "WI"] as const; // States used by catalog-city itineraries.
const MAX_WARNINGS = 120;
const MAX_ZONE_REFS = 25;

export type RouteWarning = {
  id: string; event: string; area: string; url: string;
  geometry: number[][][]; basis: "polygon" | "zone";
};
export type RouteAlertReview = {
  status: "checked" | "partial";
  warnings: RouteWarning[];
  gaps: string[];
  checkedAt: string;
};

type AlertReader = (state: string) => Promise<Alert[]>;
type ZoneReader = typeof getZones;

/** Does not claim that a warning-free result means a safe road or complete coverage. */
export async function reviewRouteWarnings(
  line: number[][],
  read: AlertReader = async state => normalizeAlerts(
    await json(`https://api.weather.gov/alerts/active?area=${state}`, fetch, 3000000), Date.now(),
  ),
  zones: ZoneReader = getZones,
): Promise<RouteAlertReview> {
  const gaps: string[] = [];
  const responses = await Promise.all(STATES.map(async state => {
    try { return await read(state); }
    catch { gaps.push(`NWS active warning feed unavailable for ${state}`); return []; }
  }));
  const alerts = Array.from(new Map(responses.flat()
    .filter(a => a.kind === "warning")
    .map(a => [a.id, a])).values());
  if (alerts.length > MAX_WARNINGS) gaps.push("Warning listing truncated for this route review");
  const candidates = alerts.slice(0, MAX_WARNINGS);
  const found: RouteWarning[] = [];
  const missing = new Set<string>();
  for (const alert of candidates) {
    if (alert.geometry?.length) {
      if (routeIntersectsRings(line, alert.geometry))
        found.push({ id: alert.id, event: alert.event, area: alert.area, url: alert.url, basis: "polygon", geometry: alert.geometry });
    } else {
      for (const ref of alert.zones) missing.add(ref);
      if (!alert.zones.length) gaps.push(`No mapped boundary for ${alert.event}`);
    }
  }
  const refs = [...missing];
  if (refs.length > MAX_ZONE_REFS) gaps.push(`Only ${MAX_ZONE_REFS} of ${refs.length} NWS zone boundaries could be requested`);
  let zoneResults: Awaited<ReturnType<ZoneReader>> = [];
  try { zoneResults = refs.length ? await zones(refs.slice(0, MAX_ZONE_REFS)) : []; }
  catch { gaps.push("NWS zone boundary lookup failed"); }
  const byRef = new Map(zoneResults.map(z => [z.id, z]));
  for (const ref of refs) if (!byRef.has(ref)) gaps.push(`Boundary unavailable: ${ref}`);
  for (const alert of candidates) {
    if (alert.geometry?.length || !alert.zones.length) continue;
    const matched = alert.zones.map(ref => byRef.get(ref)).filter((z): z is NonNullable<typeof z> => !!z)
      .filter(z => routeIntersectsRings(line, z.rings));
    if (matched.length) {
      found.push({ id: alert.id, event: alert.event, area: alert.area, url: alert.url,
        basis: "zone", geometry: matched.flatMap(z => z.rings) });
    }
  }
  return {
    status: gaps.length ? "partial" : "checked",
    warnings: found.slice(0, 25),
    gaps: [...new Set(gaps)].slice(0, 8),
    checkedAt: new Date().toISOString(),
  };
}
