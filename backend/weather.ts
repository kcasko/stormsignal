import { locations } from "../shared/locations";
import type { Weather, Period, Alert } from "../shared/types";
type Fetcher = typeof fetch;
const cache = new Map<string, { until: number; value: Weather }>();
const pending = new Map<string, Promise<Weather>>();
const text = (v: unknown, max = 40000) =>
  typeof v === "string" ? v.slice(0, max) : "";
const iso = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;
const record = (v: unknown): Record<string, any> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : {};
export function forecastUrl(raw: unknown) {
  if (typeof raw !== "string") throw Error("Missing forecast endpoint");
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "api.weather.gov" ||
    u.port ||
    u.username ||
    u.password ||
    !/^\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast\/hourly$/.test(u.pathname) ||
    u.search
  )
    throw Error("Unexpected forecast endpoint");
  return u.href;
}
async function json(url: string, fetcher: Fetcher) {
  const response = await fetcher(url, {
    headers: {
      Accept: "application/geo+json",
      "User-Agent":
        process.env.NWS_USER_AGENT ||
        "StormSignal-local-development (https://casko.dev)",
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
      if (size > 2000000) throw Error("Upstream payload too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
export function normalizePeriods(raw: unknown): Period[] {
  if (!Array.isArray(raw) || !raw.length) throw Error("Missing hourly periods");
  return raw
    .slice(0, 168)
    .map((value) => {
      const p = record(value);
      const start = iso(p.startTime),
        end = iso(p.endTime);
      if (
        !start ||
        !end ||
        Date.parse(end) <= Date.parse(start) ||
        !text(p.shortForecast, 500)
      )
        throw Error("Invalid hourly period");
      return {
        start,
        end,
        temperature:
          typeof p.temperature === "number" && Number.isFinite(p.temperature)
            ? p.temperature
            : null,
        temperatureUnit: text(p.temperatureUnit, 4),
        wind: text(p.windSpeed, 60),
        forecast: text(p.shortForecast, 500),
        precipitation:
          typeof p.probabilityOfPrecipitation?.value === "number"
            ? p.probabilityOfPrecipitation.value
            : null,
      };
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
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
      if (!expires || !sent || !text(p.event, 200))
        throw Error("Invalid alert");
      const id = text(p.id || f.id, 1500);
      return {
        id,
        event: text(p.event, 200),
        severity: text(p.severity, 30),
        headline: text(p.headline, 3000),
        description: text(p.description),
        instruction: text(p.instruction),
        sent,
        expires,
        onset: iso(p.onset),
        ends: iso(p.ends),
        area: text(p.areaDesc, 3000),
        url: "https://www.weather.gov/",
      };
    })
    .filter((a) => Date.parse(a.expires) > now);
}
export async function getWeather(
  id: string,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<Weather> {
  const location = locations.find((x) => x.id === id);
  if (!location) throw Error("Unknown location");
  if (fetcher === fetch) {
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
      availability: { forecast: false, alerts: false },
      errors: [],
    };
    await Promise.all([
      (async () => {
        try {
          const point = await json(
            `https://api.weather.gov/points/${location.latitude},${location.longitude}`,
            fetcher,
          );
          const data = await json(
            forecastUrl(record(point.properties).forecastHourly),
            fetcher,
          );
          result.periods = normalizePeriods(record(data.properties).periods);
          result.forecastUpdatedAt = iso(record(data.properties).updateTime);
          result.availability.forecast = true;
        } catch {
          result.errors.push("Hourly forecast unavailable from NWS.");
        }
      })(),
      (async () => {
        try {
          const data = await json(
            `https://api.weather.gov/alerts?active=true&point=${location.latitude},${location.longitude}`,
            fetcher,
          );
          result.alerts = normalizeAlerts(data, now);
          result.availability.alerts = true;
        } catch {
          result.errors.push(
            "Official alerts unavailable from NWS. Warning status is unknown.",
          );
        }
      })(),
    ]);
    if (
      fetcher === fetch &&
      result.availability.forecast &&
      result.availability.alerts
    )
      cache.set(id, { value: result, until: now + 60000 });
    return result;
  };
  const job = load();
  if (fetcher === fetch) pending.set(id, job);
  try {
    return await job;
  } finally {
    if (fetcher === fetch) pending.delete(id);
  }
}
