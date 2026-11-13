import { describe, it, expect, vi } from "vitest";
import {
  durationMs,
  forecastUrl,
  getWeather,
  gridUrl,
  mergeGrid,
  normalizeAlerts,
  normalizeGrid,
  normalizeObservation,
  normalizePeriods,
  windMph,
} from "../backend/weather";
import { handler } from "../backend/handler";

const now = Date.parse("2026-11-13T19:00:00Z");
const period = {
  startTime: "2026-11-13T19:00:00Z",
  endTime: "2026-11-13T20:00:00Z",
  temperature: null,
  temperatureUnit: "F",
  windSpeed: "10 to 20 mph",
  shortForecast: "Mostly cloudy",
  probabilityOfPrecipitation: { value: null },
};
const gridBody = {
  properties: {
    windGust: { uom: "wmoUnit:km_h-1", values: [{ validTime: "2026-11-13T18:00:00+00:00/PT3H", value: 80.467 }] },
    probabilityOfThunder: { values: [{ validTime: "2026-11-13T19:00:00+00:00/PT1H", value: 30 }] },
    snowfallAmount: { uom: "wmoUnit:mm", values: [{ validTime: "2026-11-13T18:00:00+00:00/PT6H", value: 152.4 }] },
    iceAccumulation: { uom: "wmoUnit:mm", values: [{ validTime: "2026-11-13T19:00:00+00:00/PT1H", value: 0 }] },
    apparentTemperature: { uom: "wmoUnit:degC", values: [{ validTime: "2026-11-13T19:00:00+00:00/PT1H", value: 0 }] },
  },
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Fake NWS: each path can be overridden with a status code to simulate failure. */
function nws(fail: Partial<Record<"points" | "hourly" | "grid" | "stations" | "obs" | "alerts", number>> = {}) {
  return vi.fn(async (input: unknown) => {
    const url = String(input);
    const route = url.includes("/points/")
      ? "points"
      : url.endsWith("/forecast/hourly")
        ? "hourly"
        : url.includes("/stations?")
          ? "stations"
          : url.includes("/observations/latest")
            ? "obs"
            : url.includes("/alerts/")
              ? "alerts"
              : "grid";
    if (fail[route]) return reply({}, fail[route]);
    switch (route) {
      case "points":
        return reply({
          properties: {
            forecastHourly: "https://api.weather.gov/gridpoints/GRR/46,16/forecast/hourly",
            forecastGridData: "https://api.weather.gov/gridpoints/GRR/46,16",
            observationStations: "https://api.weather.gov/gridpoints/GRR/46,16/stations",
          },
        });
      case "hourly":
        return reply({ properties: { periods: [period], updateTime: period.startTime } });
      case "grid":
        return reply(gridBody);
      case "stations":
        return reply({ features: [{ properties: { stationIdentifier: "KAZO", name: "Kalamazoo Airport" } }] });
      case "obs":
        return reply({
          properties: {
            timestamp: "2026-11-13T18:53:00+00:00",
            textDescription: "Cloudy",
            temperature: { unitCode: "wmoUnit:degC", value: 5 },
            windSpeed: { unitCode: "wmoUnit:km_h-1", value: 16.09 },
            windGust: { unitCode: "wmoUnit:km_h-1", value: null },
            visibility: { unitCode: "wmoUnit:m", value: 16090 },
          },
        });
      default:
        return reply({ type: "FeatureCollection", features: [] });
    }
  });
}

describe("NWS boundary", () => {
  it("rejects foreign hosts, credentials and unexpected paths", () => {
    for (const url of [
      "https://evil.example/forecast",
      "http://api.weather.gov/gridpoints/GRR/1,2/forecast/hourly",
      "https://user@api.weather.gov/gridpoints/GRR/1,2/forecast/hourly",
      "https://api.weather.gov/other",
    ])
      expect(() => forecastUrl(url)).toThrow();
    expect(forecastUrl("https://api.weather.gov/gridpoints/GRR/1,2/forecast/hourly")).toContain("/GRR/1,2");
    expect(() => gridUrl("https://api.weather.gov/gridpoints/GRR/1,2?x=1")).toThrow();
  });

  it("parses wind text and ISO durations", () => {
    expect(windMph("10 to 20 mph")).toBe(20);
    expect(windMph("15 mph")).toBe(15);
    expect(windMph("")).toBeNull();
    expect(durationMs("PT3H")).toBe(3 * 3600000);
    expect(durationMs("P1DT6H")).toBe(30 * 3600000);
    expect(durationMs("bad")).toBeNull();
  });

  it("keeps missing numeric values unknown", () => {
    const [p] = normalizePeriods([period]);
    expect(p.temperature).toBeNull();
    expect(p.precipitation).toBeNull();
    expect(p.gustMph).toBeNull();
  });

  it("converts grid units and spreads accumulations over their interval", () => {
    const [p] = mergeGrid(normalizePeriods([period]), normalizeGrid(gridBody));
    expect(p.gustMph).toBe(50);
    expect(p.thunderChance).toBe(30);
    expect(p.snowIn).toBe(1); // 6 in over 6 h → 1 in this hour
    expect(p.apparentF).toBe(32);
  });

  it("drops grid layers with unexpected units instead of reading them as zero", () => {
    const g = normalizeGrid({
      properties: { ...gridBody.properties, windGust: { uom: "wmoUnit:m_s-1", values: [] } },
    });
    expect(g.has("windGust")).toBe(false);
    const [p] = mergeGrid(normalizePeriods([period]), g);
    expect(p.gustMph).toBeNull();
  });

  it("rejects malformed periods and alert collections", () => {
    expect(() => normalizePeriods([{ ...period, endTime: "bad" }])).toThrow();
    expect(() => normalizeAlerts({ features: [] }, now)).toThrow();
  });

  it("filters ended alerts and classifies alert kinds", () => {
    const base = { sent: "2026-11-13T17:00:00Z" };
    const list = normalizeAlerts(
      {
        type: "FeatureCollection",
        features: [
          { properties: { ...base, id: "1", event: "Wind Advisory", expires: "2026-11-13T18:00:00Z" } },
          { properties: { ...base, id: "2", event: "Tornado Watch", expires: "2026-11-13T23:00:00Z" } },
        ],
      },
      now,
    );
    expect(list.map((a) => [a.event, a.kind])).toEqual([["Tornado Watch", "watch"]]);
  });

  it("converts observation units and keeps null gusts unknown", () => {
    const o = normalizeObservation(
      { properties: { timestamp: "2026-11-13T18:53:00Z", temperature: { unitCode: "wmoUnit:degC", value: 10 }, windGust: { unitCode: "wmoUnit:km_h-1", value: null } } },
      "KAZO",
      "Kalamazoo",
    );
    expect(o.temperatureF).toBe(50);
    expect(o.gustMph).toBeNull();
  });

  it("assembles a full live response", async () => {
    const d = await getWeather("kalamazoo", nws() as typeof fetch, now);
    expect(d.availability).toEqual({ forecast: true, alerts: true, grid: true, observation: true });
    expect(d.periods[0].gustMph).toBe(50);
    expect(d.observation?.station).toBe("KAZO");
    expect(d.errors).toEqual([]);
  });

  it("reports partial failure independently and never injects demo data", async () => {
    const d = await getWeather("kalamazoo", nws({ alerts: 503, grid: 500 }) as typeof fetch, now);
    expect(d.source).toBe("live");
    expect(d.availability).toEqual({ forecast: true, alerts: false, grid: false, observation: true });
    expect(d.errors).toHaveLength(2);
    expect(d.alerts).toEqual([]);
    expect(d.periods[0].gustMph).toBeNull();
  });

  it("contains network errors and preserves unknown state", async () => {
    const d = await getWeather("kalamazoo", vi.fn().mockRejectedValue(Error("timeout")) as typeof fetch, now);
    expect(d.availability).toEqual({ forecast: false, alerts: false, grid: false, observation: false });
    expect(d.errors).toHaveLength(2);
    expect(d.periods).toEqual([]);
  });
});

describe("API handler", () => {
  const get = (rawPath: string, q?: Record<string, string>, method = "GET") =>
    handler({ rawPath, requestContext: { http: { method } }, queryStringParameters: q });

  it("rejects unsupported locations and non-GET requests before NWS access", async () => {
    expect((await get("/api/weather", { location: "unknown" })).statusCode).toBe(400);
    expect((await get("/api/weather", { location: "../../etc" })).statusCode).toBe(400);
    expect((await get("/api/weather", undefined, "POST")).statusCode).toBe(405);
    expect((await get("/api/nope")).statusCode).toBe(404);
  });

  it("health and locations do not require weather connectivity or AWS credentials", async () => {
    expect((await get("/api/health")).statusCode).toBe(200);
    const r = await get("/api/locations");
    expect(JSON.parse(r.body).locations.map((l: { id: string }) => l.id)).toEqual(
      expect.arrayContaining(["kalamazoo", "grand-rapids", "detroit", "chicago", "indianapolis"]),
    );
  });
});
