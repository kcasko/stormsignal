import { describe, it, expect, vi } from "vitest";
import {
  forecastUrl,
  getWeather,
  normalizeAlerts,
  normalizePeriods,
} from "../backend/weather";
import { handler } from "../backend/handler";
const now = Date.parse("2026-11-13T19:00:00Z");
const period = {
  startTime: "2026-11-13T19:00:00Z",
  endTime: "2026-11-13T20:00:00Z",
  temperature: null,
  temperatureUnit: "F",
  windSpeed: "10 mph",
  shortForecast: "Mostly cloudy",
  probabilityOfPrecipitation: { value: null },
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
describe("NWS boundary", () => {
  it("rejects foreign forecast hosts, credentials and paths", () => {
    for (const url of [
      "https://evil.example/forecast",
      "http://api.weather.gov/gridpoints/GRR/1,2/forecast/hourly",
      "https://user@api.weather.gov/gridpoints/GRR/1,2/forecast/hourly",
      "https://api.weather.gov/other",
    ])
      expect(() => forecastUrl(url)).toThrow();
    expect(
      forecastUrl("https://api.weather.gov/gridpoints/GRR/1,2/forecast/hourly"),
    ).toContain("/GRR/1,2");
  });
  it("keeps missing numeric values unknown", () => {
    const [p] = normalizePeriods([period]);
    expect(p.temperature).toBeNull();
    expect(p.precipitation).toBeNull();
  });
  it("rejects malformed time periods and alert collections", () => {
    expect(() => normalizePeriods([{ ...period, endTime: "bad" }])).toThrow();
    expect(() => normalizeAlerts({ features: [] }, now)).toThrow();
  });
  it("filters expired alerts without inventing cancellations", () => {
    const a = {
      id: "1",
      event: "Wind Advisory",
      expires: "2026-11-13T18:00:00Z",
      sent: "2026-11-13T17:00:00Z",
    };
    expect(
      normalizeAlerts(
        { type: "FeatureCollection", features: [{ properties: a }] },
        now,
      ),
    ).toEqual([]);
  });
  it("reports partial failure independently and never injects demo data", async () => {
    const mock = vi.fn(async (url: unknown) =>
      String(url).includes("/points/")
        ? reply({
            properties: {
              forecastHourly:
                "https://api.weather.gov/gridpoints/GRR/1,2/forecast/hourly",
            },
          })
        : String(url).includes("/gridpoints/")
          ? reply({
              properties: { periods: [period], updateTime: period.startTime },
            })
          : reply({}, 503),
    );
    const d = await getWeather("kalamazoo", mock as typeof fetch, now);
    expect(d.source).toBe("live");
    expect(d.availability).toEqual({ forecast: true, alerts: false });
    expect(d.errors).toHaveLength(1);
    expect(d.alerts).toEqual([]);
  });
  it("contains network errors and preserves unknown state", async () => {
    const d = await getWeather(
      "kalamazoo",
      vi.fn().mockRejectedValue(Error("timeout")) as typeof fetch,
      now,
    );
    expect(d.availability).toEqual({ forecast: false, alerts: false });
    expect(d.errors).toHaveLength(2);
    expect(d.periods).toEqual([]);
  });
  it("rejects unsupported locations and non-GET requests before NWS access", async () => {
    expect(
      (
        await handler({
          rawPath: "/api/weather",
          requestContext: { http: { method: "GET" } },
          queryStringParameters: { location: "unknown" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await handler({
          rawPath: "/api/weather",
          requestContext: { http: { method: "POST" } },
        })
      ).statusCode,
    ).toBe(405);
  });
  it("health does not require weather connectivity or AWS credentials", async () => {
    expect(
      (
        await handler({
          rawPath: "/api/health",
          requestContext: { http: { method: "GET" } },
        })
      ).statusCode,
    ).toBe(200);
  });
});
