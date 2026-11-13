// NWS zone outlines for alert maps. Only fixed api.weather.gov zone paths are requested.
import { outerRings, ZONE_REF, type Ring } from "../shared/geo";
import { json } from "./weather";

export interface Zone {
  id: string;
  name: string;
  rings: Ring[];
}

const cache = new Map<string, { until: number; value: Zone | null }>();
const TTL = 24 * 3600000;
export const MAX_ZONES = 30;

export function clearZoneCache() {
  cache.clear();
}

async function zone(ref: string, fetcher: typeof fetch, now: number): Promise<Zone | null> {
  const hit = cache.get(ref);
  if (hit && hit.until > now) return hit.value;
  let value: Zone | null = null;
  try {
    const body = (await json(`https://api.weather.gov/zones/${ref}`, fetcher, 3000000)) as {
      properties?: { name?: unknown; state?: unknown };
      geometry?: unknown;
    };
    const rings = outerRings(body.geometry, 300);
    const name = typeof body.properties?.name === "string" ? body.properties.name.slice(0, 80) : ref;
    const state = typeof body.properties?.state === "string" ? body.properties.state.slice(0, 2) : "";
    if (rings) value = { id: ref, name: state ? `${name}, ${state}` : name, rings };
  } catch {
    value = null;
  }
  // Failures are cached briefly so one bad zone doesn't trigger repeated upstream calls.
  cache.set(ref, { until: now + (value ? TTL : 300000), value });
  return value;
}

/** Valid, de-duplicated zone refs from a comma-separated query, or null if any is malformed. */
export function parseZoneRefs(raw: string): string[] | null {
  const refs = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
  if (!refs.length || refs.length > MAX_ZONES || !refs.every((r) => ZONE_REF.test(r))) return null;
  return refs;
}

export async function getZones(refs: string[], fetcher: typeof fetch = fetch, now = Date.now()) {
  const zones = await Promise.all(refs.map((r) => zone(r, fetcher, now)));
  return zones.filter((z): z is Zone => z !== null);
}
