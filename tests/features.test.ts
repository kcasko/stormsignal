import { describe, it, expect, vi } from "vitest";
import { geocode, parsePointId, pointId, searchLocal } from "../backend/geocode";
import { MemoryStore, takeSnapshots } from "../backend/history";
import { handler } from "../backend/handler";
import { clearCaches } from "../backend/weather";
import { computeDrift, toSnapshot } from "../shared/drift";
import { whatWouldChange } from "../shared/counterfactual";
import { compareOptions } from "../shared/impactEngine";
import { assess } from "../shared/riskEngine";
import { buildPlan } from "../shared/preparationEngine";
import { rulesCatalog } from "../shared/rulesCatalog";
import { prepCalendar } from "../src/ics";
import { T0, H, alert, weather, withHours } from "./fixtures/weather";

const get = (rawPath: string, q?: Record<string, string>) =>
  handler({ rawPath, requestContext: { http: { method: "GET" } }, queryStringParameters: q });

describe("any U.S. place", () => {
  it("finds ZIPs and city names from bundled Census data", () => {
    expect(searchLocal("49007")[0]).toMatchObject({ label: "ZIP 49007", source: "zip" });
    expect(searchLocal("Boulder, CO")[0].label).toBe("Boulder, CO");
    expect(searchLocal("boulder co")[0].label).toBe("Boulder, CO");
    // Exact name first, then larger places.
    expect(searchLocal("Louisville")[0].label).toBe("Louisville, KY");
    expect(searchLocal("00000")).toEqual([]);
    expect(searchLocal("x")).toEqual([]);
  });

  it("validates and rounds point ids, rejecting non-U.S. points", () => {
    expect(pointId(42.29171, -85.58721)).toBe("pt:42.292,-85.587");
    expect(parsePointId("pt:42.292,-85.587")).toEqual({ latitude: 42.292, longitude: -85.587 });
    expect(parsePointId("pt:51.500,-0.120")).toBeNull(); // London
    expect(parsePointId("pt:42.29177,-85.5")).toBeNull(); // too precise
    expect(parsePointId("kalamazoo")).toBeNull();
  });

  it("sends only street addresses to the Census geocoder", async () => {
    const f = vi.fn(async (_url: unknown) =>
      new Response(
        JSON.stringify({
          result: { addressMatches: [{ matchedAddress: "1 MAIN ST, KALAMAZOO, MI", coordinates: { x: -85.5872, y: 42.2917 } }] },
        }),
      ),
    );
    const r = await geocode("1 Main St Kalamazoo MI", f as typeof fetch);
    expect(String(f.mock.calls[0][0])).toMatch(/^https:\/\/geocoding\.geo\.census\.gov\/geocoder\/locations\/onelineaddress\?/);
    expect(r[0]).toMatchObject({ id: "pt:42.292,-85.587", source: "address" });
    await geocode("Boulder, CO", f as typeof fetch);
    await geocode("49007", f as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("handler accepts catalog ids and U.S. points, and validates search input", async () => {
    expect((await get("/api/weather", { location: "pt:51.500,-0.120" })).statusCode).toBe(400);
    expect((await get("/api/geocode", { q: "a" })).statusCode).toBe(400);
    const r = await get("/api/geocode", { q: "49007" });
    expect(JSON.parse(r.body).results[0].source).toBe("zip");
  });
});

describe("forecast history and drift", () => {
  it("reports not enough history instead of inventing a trend", () => {
    const d = computeDrift(weather(), [], "low", T0);
    expect(d.trend).toBe("unknown");
    expect(d.summary).toMatch(/Not enough forecast history/);
  });

  it("compares the same valid hours and detects a worsening trend", () => {
    const now = weather(withHours(3, 6, { gustMph: 50 }));
    const before = weather(withHours(3, 6, { gustMph: 30 }));
    const snap = { ...toSnapshot(before, "moderate", T0 - 6 * H), capturedAt: new Date(T0 - 6 * H).toISOString() };
    // The snapshot was taken 6 h earlier but covers the same forecast hours.
    snap.hours = toSnapshot(before, "moderate", T0).hours;
    const d = computeDrift(now, [snap], "elevated", T0);
    expect(d.trend).toBe("worse");
    expect(d.changes[0]).toMatchObject({ key: "g", before: 30, after: 50, delta: 20 });
    expect(d.summary).toMatch(/trended worse over the last 6 hours/);
  });

  it("calls an unchanged forecast steady", () => {
    const w = weather();
    const snap = { ...toSnapshot(w, "low", T0), capturedAt: new Date(T0 - 4 * H).toISOString() };
    expect(computeDrift(w, [snap], "low", T0).trend).toBe("stable");
  });

  it("saves one snapshot per city per NWS issuance", async () => {
    clearCaches();
    const store = new MemoryStore();
    let issued = "2026-11-13T18:00:00Z";
    const fake = vi.fn(async (input: unknown) => {
      const url = String(input);
      const body = url.includes("/points/")
        ? {
            properties: {
              forecastHourly: "https://api.weather.gov/gridpoints/GRR/1,2/forecast/hourly",
              forecastGridData: "https://api.weather.gov/gridpoints/GRR/1,2",
              observationStations: "https://api.weather.gov/gridpoints/GRR/1,2/stations",
            },
          }
        : url.endsWith("/forecast/hourly")
          ? {
              properties: {
                updateTime: issued,
                periods: [{ startTime: new Date(T0).toISOString(), endTime: new Date(T0 + H).toISOString(), shortForecast: "Cloudy", windSpeed: "5 mph" }],
              },
            }
          : url.includes("/alerts/")
            ? { type: "FeatureCollection", features: [] }
            : {};
      return new Response(JSON.stringify(body), { status: url.includes("/alerts/") || url.includes("/points/") || url.endsWith("hourly") ? 200 : 503 });
    });
    const first = await takeSnapshots(store, fake as typeof fetch, T0);
    expect(Object.values(first).every((v) => v === "saved")).toBe(true);
    const second = await takeSnapshots(store, fake as typeof fetch, T0 + 30 * 60000);
    expect(Object.values(second).every((v) => v.startsWith("skipped: no new"))).toBe(true);
    issued = "2026-11-13T19:30:00Z";
    const third = await takeSnapshots(store, fake as typeof fetch, T0 + 60 * 60000);
    expect(third.kalamazoo).toBe("saved");
    expect((await store.list("kalamazoo", 0)).length).toBe(2);
  });

  it("history endpoint declines untracked places without error", async () => {
    const r = await get("/api/history", { location: "pt:40.024,-105.251" });
    expect(JSON.parse(r.body)).toMatchObject({ tracked: false, snapshots: [] });
  });
});

describe("what would change the level", () => {
  it("names the threshold and the next level down", () => {
    const a = assess(weather(withHours(3, 7, { gustMph: 48 })), T0);
    const cf = whatWouldChange(a.level, a.factors)!;
    expect(cf.headline).toBe("Would be Moderate if this changed:");
    expect(cf.conditions[0]).toBe("Wind gusts stayed below 46 mph (forecast: 48 mph)");
  });

  it("requires every top factor to change and respects other factors", () => {
    const a = assess(weather(withHours(3, 7, { gustMph: 60, thunderChance: 45 })), T0);
    const cf = whatWouldChange(a.level, a.factors)!;
    expect(a.level).toBe("high");
    expect(cf.headline).toBe("Would be Elevated if this changed:");
  });

  it("explains that official alerts can't be argued with", () => {
    const a = assess(weather(undefined, { alerts: [alert("Winter Storm Warning")] }), T0);
    expect(whatWouldChange(a.level, a.factors)!.headline).toMatch(/while the official Winter Storm Warning is in effect/);
  });

  it("says nothing for Low or Unknown", () => {
    expect(whatWouldChange("low", [])).toBeNull();
    expect(whatWouldChange("unknown", [])).toBeNull();
  });
});

describe("your own start time, rules export, calendar", () => {
  it("adds option D at the chosen time", () => {
    const opts = compareOptions(weather(withHours(4, 5, { gustMph: 50 })), "driving", 1, T0, T0 + 4 * H + 15 * 60000);
    expect(opts).toHaveLength(4);
    expect(opts[3]).toMatchObject({ key: "D", label: "Leave at 6:15 PM", level: "elevated" });
    expect(compareOptions(weather(), "driving", 1, T0, T0 - 2 * H)).toHaveLength(3);
  });

  it("publishes every rule with its thresholds", async () => {
    const c = rulesCatalog();
    expect(c.overview.rules.find((r) => r.id === "gust")?.thresholds).toContainEqual({ level: "elevated", atOrAbove: 46 });
    expect(Object.keys(c.activities)).toEqual(["driving", "event", "home"]);
    expect((await get("/api/rules")).statusCode).toBe(200);
  });

  it("exports prep deadlines as a valid calendar with reminders before the hazard", () => {
    const plan = buildPlan(assess(weather(withHours(6, 9, { gustMph: 50 })), T0), ["home"], "America/Detroit");
    const ics = prepCalendar(plan.before, "Kalamazoo, MI", T0)!;
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    // RFC 5545 folds long lines; unfold (CRLF + space) before matching.
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:Storm prep: Secure or bring in outdoor furniture\\, bins and decorations");
    // Gusts start at T0+6h; reminder is 2 h earlier.
    expect(ics).toContain("DTSTART:" + new Date(T0 + 4 * H).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""));
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(prepCalendar(buildPlan(assess(weather(), T0), ["home"], "America/Detroit").before, "x", T0)).toBeNull();
  });
});
