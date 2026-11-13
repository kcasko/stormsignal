import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeAlerts, clearCaches } from "../backend/weather";
import { MemoryStore, takeSnapshots } from "../backend/history";
import { handler } from "../backend/handler";
import { clearZoneCache, parseZoneRefs } from "../backend/zones";
import { insideRings, outerRings, parseVtec, zoneRef } from "../shared/geo";
import { activeStory, endedStories } from "../shared/alertHistory";
import type { Snapshot, SnapshotAlert } from "../shared/drift";
import { T0, H, alert } from "./fixtures/weather";

const get = (rawPath: string, q?: Record<string, string>) =>
  handler({ rawPath, requestContext: { http: { method: "GET" } }, queryStringParameters: q });
const iso = (h: number) => new Date(T0 + h * H).toISOString();

afterEach(() => vi.unstubAllGlobals());

describe("NWS alert details", () => {
  it("parses VTEC, earlier versions, polygon and zones", () => {
    const [a] = normalizeAlerts(
      {
        type: "FeatureCollection",
        features: [
          {
            geometry: { type: "Polygon", coordinates: [[[-85.71234, 42.2], [-85.4, 42.2], [-85.4, 42.4], [-85.7, 42.4], [-85.71234, 42.2]]] },
            properties: {
              id: "urn:a",
              event: "Severe Thunderstorm Warning",
              sent: iso(0),
              expires: iso(1),
              messageType: "Update",
              parameters: { VTEC: ["/O.EXT.KGRR.SV.W.0042.000000T0000Z-261113T2100Z/"] },
              references: [{ sent: iso(-1) }, { sent: "nonsense" }, { sent: iso(-2) }],
              affectedZones: ["https://api.weather.gov/zones/county/MIC077", "https://evil.example/zones/county/MIC001"],
            },
          },
        ],
      },
      T0,
    );
    expect(a.vtec).toEqual({ key: "KGRR.SV.W.0042", action: "EXT" });
    expect(a.previous).toEqual([iso(-2), iso(-1)]);
    expect(a.geometry?.[0][0]).toEqual([-85.712, 42.2]);
    expect(a.zones).toEqual(["county/MIC077"]);
    expect(a.messageType).toBe("Update");
  });

  it("geometry helpers validate input and test containment", () => {
    expect(outerRings({ type: "Point", coordinates: [0, 0] })).toBeNull();
    const big = { type: "Polygon", coordinates: [Array.from({ length: 2000 }, (_, i) => [Math.cos(i / 318) - 85, Math.sin(i / 318) + 42])] };
    const ring = outerRings(big, 300)![0];
    expect(ring.length).toBeLessThan(400);
    expect(insideRings(-85, 42, [ring])).toBe(true);
    expect(insideRings(-80, 42, [ring])).toBe(false);
    expect(zoneRef("https://api.weather.gov/zones/forecast/MIZ072")).toBe("forecast/MIZ072");
    expect(zoneRef("https://api.weather.gov/zones/forecast/MIZ072?x=1")).toBeNull();
    expect(parseVtec(["junk"])).toBeNull();
    expect(parseZoneRefs("forecast/MIZ072,county/MIC077,forecast/MIZ072")).toEqual(["forecast/MIZ072", "county/MIC077"]);
    expect(parseZoneRefs("../../x")).toBeNull();
  });
});

describe("alert lifecycle", () => {
  it("tells issued, extended and the scheduled end apart for an active alert", () => {
    const a = alert("Wind Advisory", { sent: iso(0), previous: [iso(-3)], vtec: { key: "GRR.WI.Y.0007", action: "EXT" } });
    const story = activeStory(a, [], T0);
    expect(story.events.map((e) => e.label)).toEqual(["Issued", "Extended", "Scheduled to end"]);
    expect(story.events[2].future).toBe(true);
  });

  const snap = (h: number, alerts: SnapshotAlert[] | undefined): Snapshot => ({ capturedAt: iso(h), issuedAt: null, level: "low", hours: [], alerts });
  const seen = (key: string, event: string, ends: number, action: string | null = "NEW", sent = -6): SnapshotAlert => ({
    key,
    event,
    kind: "advisory",
    sent: iso(sent),
    ends: iso(ends),
    action,
  });

  it("separates expired, cancelled, upgraded and ended-early alerts", () => {
    const snaps = [
      snap(-6, [seen("A", "Wind Advisory", -3), seen("B", "Frost Advisory", 4), seen("C", "Winter Storm Watch", 10), seen("D", "Flood Watch", 10)]),
      snap(-4, [seen("A", "Wind Advisory", -3), seen("B", "Frost Advisory", 4, "CAN", -4.5), seen("C", "Winter Storm Watch", 10, "UPG", -4.5), seen("D", "Flood Watch", 10)]),
      snap(-2, []),
    ];
    const ended = endedStories([], snaps, T0);
    const by = Object.fromEntries(ended.map((s) => [s.event, s]));
    expect(by["Wind Advisory"].state).toBe("expired");
    expect(by["Frost Advisory"].state).toBe("cancelled");
    expect(by["Winter Storm Watch"].state).toBe("upgraded");
    expect(by["Flood Watch"].state).toBe("ended-early");
    expect(by["Flood Watch"].events.at(-1)?.label).toBe("No longer listed by NWS");
  });

  it("infers nothing when alerts are unavailable or old snapshots lack them", () => {
    expect(endedStories(null, [snap(-2, [seen("A", "Wind Advisory", 3)])], T0)).toEqual([]);
    expect(endedStories([], [snap(-2, undefined)], T0)).toEqual([]);
  });

  it("only calls the first message 'Issued' when it is the original", () => {
    const story = endedStories([], [snap(-4, [seen("A", "Wind Advisory", -1, "CON")])], T0)[0];
    expect(story.events[0].label).toBe("In effect");
  });

  it("saves a snapshot when alerts change even if the forecast didn't", async () => {
    clearCaches();
    const store = new MemoryStore();
    let features: unknown[] = [];
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
          ? { properties: { updateTime: "2026-11-13T18:00:00Z", periods: [{ startTime: iso(0), endTime: iso(1), shortForecast: "Cloudy", windSpeed: "5 mph" }] } }
          : url.includes("/alerts/")
            ? { type: "FeatureCollection", features }
            : {};
      return new Response(JSON.stringify(body), { status: url.includes("/alerts/") || url.includes("/points/") || url.endsWith("hourly") ? 200 : 503 });
    });
    await takeSnapshots(store, fake as typeof fetch, T0);
    expect((await takeSnapshots(store, fake as typeof fetch, T0 + 0.5 * H)).kalamazoo).toMatch(/^skipped/);
    features = [{ properties: { id: "urn:w", event: "Wind Advisory", sent: iso(0.5), expires: iso(6), parameters: { VTEC: ["/O.NEW.KGRR.WI.Y.0001.x/"] } } }];
    expect((await takeSnapshots(store, fake as typeof fetch, T0 + H)).kalamazoo).toBe("saved");
    const saved = await store.list("kalamazoo", 0);
    expect(saved.at(-1)?.alerts?.[0]).toMatchObject({ key: "KGRR.WI.Y.0001", action: "NEW" });
  });
});

describe("/api/area", () => {
  it("rejects bad input", async () => {
    expect((await get("/api/area")).statusCode).toBe(400);
    expect((await get("/api/area", { zones: "county/../../x" })).statusCode).toBe(400);
    expect((await get("/api/area", { bbox: "2,48,3,49" })).statusCode).toBe(400); // not U.S.
  });

  it("labels places from bundled data without any upstream request", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await get("/api/area", { bbox: "-86.2,42.0,-85.0,42.6" });
    const body = JSON.parse(r.body);
    expect(r.statusCode).toBe(200);
    expect(body.places.map((p: { name: string }) => p.name)).toContain("Kalamazoo");
    expect(f).not.toHaveBeenCalled();
  });

  it("fetches only api.weather.gov zone paths and caches them", async () => {
    clearZoneCache();
    const f = vi.fn(async (_url: unknown) =>
      new Response(
        JSON.stringify({ properties: { name: "Kalamazoo", state: "MI" }, geometry: { type: "Polygon", coordinates: [[[-85.8, 42.1], [-85.3, 42.1], [-85.3, 42.4], [-85.8, 42.4], [-85.8, 42.1]]] } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", f);
    const r1 = JSON.parse((await get("/api/area", { zones: "county/MIC077" })).body);
    await get("/api/area", { zones: "county/MIC077" });
    expect(r1.zones[0]).toMatchObject({ id: "county/MIC077", name: "Kalamazoo, MI" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toBe("https://api.weather.gov/zones/county/MIC077");
  });
});
