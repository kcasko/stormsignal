import { locations } from "../shared/locations";
import { alertKind } from "../shared/rules";
import { parsePointId } from "./geocode";
import type { Weather, Period, Alert, Observation, Location } from "../shared/types";
type Fetcher = typeof fetch;
type Grid = Map<string, { start: number; end: number; value: number }[]>;

const cache = new Map<string, { until: number; value: Weather }>();
const pending = new Map<string, Promise<Weather>>();
const points = new Map<string, { until: number; value: PointInfo }>();
const SUCCESS_TTL = 120000;
const POINT_TTL = 12 * 3600000;

const text = (v: unknown, max = 40000) => (typeof v === "string" ? v.slice(0, max) : "");
const iso = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const record = (v: unknown): Record<string, any> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
const round = (v: number | null, d = 0) =>
  v === null ? null : Math.round(v * 10 ** d) / 10 ** d;

/** Only fixed NWS hosts and path shapes are ever requested. */
function nwsUrl(raw: unknown, pattern: RegExp, what: string) {
  if (typeof raw !== "string") throw Error("Missing " + what);
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "api.weather.gov" ||
    u.port ||
    u.username ||
    u.password ||
    !pattern.test(u.pathname) ||
    u.search
  )
    throw Error("Unexpected " + what);
  return u.href;
}
export const forecastUrl = (raw: unknown) =>
  nwsUrl(raw, /^\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast\/hourly$/, "forecast endpoint");
export const gridUrl = (raw: unknown) =>
  nwsUrl(raw, /^\/gridpoints\/[A-Z]{3}\/\d+,\d+$/, "grid endpoint");
export const stationsUrl = (raw: unknown) =>
  nwsUrl(raw, /^\/gridpoints\/[A-Z]{3}\/\d+,\d+\/stations$/, "stations endpoint");

async function json(url: string, fetcher: Fetcher, maxBytes = 2000000) {
  const response = await fetcher(url, {
    headers: {
      Accept: "application/geo+json",
      "User-Agent":
        process.env.NWS_USER_AGENT || "StormSignal/0.2 (weather decision-support prototype)",
    },
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok) throw Error("Upstream response " + response.status);
  if (!response.body) throw Error("Empty upstream body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw Error("Upstream payload too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

/** Upper bound of NWS wind text such as "10 to 20 mph" or "15 mph". */
export function windMph(s: string): number | null {
  const m = s.match(/(\d+)(?:\s*to\s*(\d+))?\s*mph/i);
  return m ? Number(m[2] ?? m[1]) : null;
}

export function normalizePeriods(raw: unknown): Period[] {
  if (!Array.isArray(raw) || !raw.length) throw Error("Missing hourly periods");
  return raw
    .slice(0, 168)
    .map((value) => {
      const p = record(value);
      const start = iso(p.startTime),
        end = iso(p.endTime);
      if (!start || !end || Date.parse(end) <= Date.parse(start) || !text(p.shortForecast, 500))
        throw Error("Invalid hourly period");
      const wind = text(p.windSpeed, 60);
      return {
        start,
        end,
        temperature: num(p.temperature),
        temperatureUnit: text(p.temperatureUnit, 4),
        wind,
        windMph: windMph(wind),
        forecast: text(p.shortForecast, 500),
        precipitation: num(p.probabilityOfPrecipitation?.value),
        gustMph: null,
        thunderChance: null,
        snowIn: null,
        iceIn: null,
        apparentF: null,
      };
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** ISO 8601 durations used by NWS validTime, e.g. PT3H, P1DT6H. */
export function durationMs(d: string): number | null {
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m || d === "P" || d === "PT") return null;
  return ((+(m[1] || 0) * 24 + +(m[2] || 0)) * 60 + +(m[3] || 0)) * 60000;
}

const CONVERT: Record<string, Record<string, (v: number) => number>> = {
  windGust: { "wmoUnit:km_h-1": (v) => v * 0.621371 },
  probabilityOfThunder: { "wmoUnit:percent": (v) => v, "": (v) => v },
  snowfallAmount: { "wmoUnit:mm": (v) => v / 25.4 },
  iceAccumulation: { "wmoUnit:mm": (v) => v / 25.4 },
  apparentTemperature: { "wmoUnit:degC": (v) => (v * 9) / 5 + 32 },
};

/** Parses the gridpoint layers Storm Signal uses. Unknown units make a layer absent, never zero. */
export function normalizeGrid(raw: unknown): Grid {
  const props = record(record(raw).properties);
  const grid: Grid = new Map();
  for (const [layer, units] of Object.entries(CONVERT)) {
    const l = record(props[layer]);
    const convert = units[text(l.uom, 40)];
    if (!convert || !Array.isArray(l.values)) continue;
    const series = [];
    for (const item of l.values.slice(0, 400)) {
      const v = num(record(item).value);
      const [startText, dur] = text(record(item).validTime, 60).split("/");
      const start = Date.parse(startText);
      const len = durationMs(dur || "");
      if (v === null || !Number.isFinite(start) || !len) continue;
      series.push({ start, end: start + len, value: convert(v) });
    }
    if (series.length) grid.set(layer, series);
  }
  if (!grid.size) throw Error("No usable grid layers");
  return grid;
}

/** Attaches grid values to hourly periods. Accumulations are spread evenly over their interval. */
export function mergeGrid(periods: Period[], grid: Grid): Period[] {
  const at = (layer: string, s: number, e: number, accumulate: boolean) => {
    const series = grid.get(layer);
    if (!series) return null;
    let total = 0,
      found = false;
    for (const x of series) {
      const overlap = Math.min(e, x.end) - Math.max(s, x.start);
      if (overlap <= 0) continue;
      found = true;
      if (!accumulate) return x.value;
      total += (x.value * overlap) / (x.end - x.start);
    }
    return found ? total : null;
  };
  return periods.map((p) => {
    const s = Date.parse(p.start),
      e = Date.parse(p.end);
    return {
      ...p,
      gustMph: round(at("windGust", s, e, false)),
      thunderChance: round(at("probabilityOfThunder", s, e, false)),
      snowIn: round(at("snowfallAmount", s, e, true), 2),
      iceIn: round(at("iceAccumulation", s, e, true), 2),
      apparentF: round(at("apparentTemperature", s, e, false)),
    };
  });
}

export function normalizeAlerts(raw: unknown, now: number): Alert[] {
  const body = record(raw);
  if (body.type !== "FeatureCollection" || !Array.isArray(body.features))
    throw Error("Invalid alerts collection");
  return body.features
    .slice(0, 200)
    .map((feature: unknown) => {
      const f = record(feature),
        p = record(f.properties);
      const expires = iso(p.expires),
        sent = iso(p.sent);
      if (!expires || !sent || !text(p.event, 200)) throw Error("Invalid alert");
      const id = text(p.id || f.id, 1500);
      const event = text(p.event, 200);
      return {
        id,
        event,
        kind: alertKind(event),
        severity: text(p.severity, 30),
        urgency: text(p.urgency, 30),
        headline: text(p.headline, 3000),
        description: text(p.description),
        instruction: text(p.instruction),
        sent,
        expires,
        onset: iso(p.onset),
        ends: iso(p.ends),
        area: text(p.areaDesc, 3000),
        url: "https://alerts.weather.gov/",
      };
    })
    .filter((a) => Date.parse(a.ends || a.expires) > now);
}

export function normalizeObservation(raw: unknown, station: string, name: string): Observation {
  const p = record(record(raw).properties);
  const timestamp = iso(p.timestamp);
  if (!timestamp) throw Error("Invalid observation");
  const q = (v: unknown, uom: string, f: (n: number) => number) => {
    const r = record(v);
    const n = num(r.value);
    return n === null || r.unitCode !== uom ? null : f(n);
  };
  return {
    station,
    stationName: name,
    timestamp,
    description: text(p.textDescription, 200),
    temperatureF: round(q(p.temperature, "wmoUnit:degC", (c) => (c * 9) / 5 + 32)),
    windMph: round(q(p.windSpeed, "wmoUnit:km_h-1", (k) => k * 0.621371)),
    gustMph: round(q(p.windGust, "wmoUnit:km_h-1", (k) => k * 0.621371)),
    visibilityMi: round(q(p.visibility, "wmoUnit:m", (m) => m / 1609.34), 1),
  };
}

interface PointInfo {
  hourly: string;
  grid: string;
  stations: string;
  timeZone: string | null;
  place: string | null;
}

const validZone = (z: unknown) => {
  if (typeof z !== "string" || !/^[A-Za-z_]+(\/[A-Za-z_+-]+){1,2}$/.test(z)) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return null;
  }
};

async function point(location: Location, fetcher: Fetcher, now: number, useCache: boolean) {
  const hit = useCache ? points.get(location.id) : undefined;
  if (hit && hit.until > now) return hit.value;
  const p = record(
    (await json(`https://api.weather.gov/points/${location.latitude},${location.longitude}`, fetcher))
      .properties,
  );
  const rel = record(record(p.relativeLocation).properties);
  const city = text(rel.city, 80),
    state = text(rel.state, 4);
  const value: PointInfo = {
    hourly: forecastUrl(p.forecastHourly),
    grid: gridUrl(p.forecastGridData),
    stations: stationsUrl(p.observationStations),
    timeZone: validZone(p.timeZone),
    place: city && /^[A-Z]{2}$/.test(state) ? `${city}, ${state}` : null,
  };
  if (useCache) points.set(location.id, { value, until: now + POINT_TTL });
  return value;
}

export async function getWeather(
  id: string,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<Weather> {
  const catalog = locations.find((x) => x.id === id);
  const pt = catalog ? null : parsePointId(id);
  if (!catalog && !pt) throw Error("Unknown location");
  // Any U.S. point: name and time zone come from NWS point metadata once it loads.
  const location: Location = catalog ?? {
    id,
    name: `${pt!.latitude.toFixed(3)}, ${pt!.longitude.toFixed(3)}`,
    latitude: pt!.latitude,
    longitude: pt!.longitude,
    timeZone: "UTC",
  };
  const useCache = fetcher === fetch;
  if (useCache) {
    const hit = cache.get(id);
    if (hit && hit.until > now) return hit.value;
    const inFlight = pending.get(id);
    if (inFlight) return inFlight;
  }
  const load = async () => {
    const result: Weather = {
      source: "live",
      location,
      fetchedAt: new Date(now).toISOString(),
      forecastUpdatedAt: null,
      periods: [],
      alerts: [],
      observation: null,
      availability: { forecast: false, alerts: false, grid: false, observation: false },
      errors: [],
    };
    const alertsJob = (async () => {
      try {
        const data = await json(
          `https://api.weather.gov/alerts/active?point=${location.latitude},${location.longitude}`,
          fetcher,
        );
        result.alerts = normalizeAlerts(data, now);
        result.availability.alerts = true;
      } catch {
        result.errors.push("Official alerts unavailable from NWS. Warning status is unknown.");
      }
    })();
    let info: PointInfo | null = null;
    try {
      info = await point(location, fetcher, now, useCache);
    } catch {
      result.errors.push(
        catalog
          ? "NWS location lookup failed; forecast and observations unavailable."
          : "NWS has no forecast for this point, or the lookup failed. Only U.S. locations are covered.",
      );
    }
    if (info && !catalog)
      result.location = {
        ...location,
        name: info.place ? `Near ${info.place}` : location.name,
        timeZone: info.timeZone ?? "UTC",
      };
    if (info) {
      const i = info;
      const held: { grid: Grid | null } = { grid: null };
      await Promise.all([
        (async () => {
          try {
            const data = record(await json(i.hourly, fetcher));
            result.periods = normalizePeriods(record(data.properties).periods);
            result.forecastUpdatedAt = iso(record(data.properties).updateTime);
            result.availability.forecast = true;
          } catch {
            result.errors.push("Hourly forecast unavailable from NWS.");
          }
        })(),
        (async () => {
          try {
            held.grid = normalizeGrid(await json(i.grid, fetcher, 4000000));
          } catch {
            result.errors.push(
              "NWS gridpoint data unavailable; gusts, thunder chance, snow and ice amounts are unknown.",
            );
          }
        })(),
        (async () => {
          try {
            const list = await json(i.stations + "?limit=1", fetcher);
            const s = record(record(list.features?.[0]).properties);
            const station = text(s.stationIdentifier, 8);
            if (!/^[A-Z0-9]{3,5}$/.test(station)) throw Error("Bad station");
            result.observation = normalizeObservation(
              await json(`https://api.weather.gov/stations/${station}/observations/latest`, fetcher),
              station,
              text(s.name, 200),
            );
            result.availability.observation = true;
          } catch {
            result.errors.push("Current observation unavailable from NWS.");
          }
        })(),
      ]);
      if (held.grid && result.availability.forecast) {
        result.periods = mergeGrid(result.periods, held.grid);
        result.availability.grid = true;
      }
    }
    await alertsJob;
    if (useCache && result.availability.forecast && result.availability.alerts)
      cache.set(id, { value: result, until: now + SUCCESS_TTL });
    return result;
  };
  const job = load();
  if (useCache) pending.set(id, job);
  try {
    return await job;
  } finally {
    if (useCache) pending.delete(id);
  }
}

export function clearCaches() {
  cache.clear();
  points.clear();
}
