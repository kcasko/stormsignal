import { describe, it, expect, vi, afterEach } from "vitest";
import { validateCities, locations } from "../shared/locations";
import { renderBadge } from "../backend/badge";
import { handler } from "../backend/handler";
import { clearCaches } from "../backend/weather";
import config from "../stormsignal.config.json";

const get = (rawPath: string, q?: Record<string, string>) =>
  handler({ rawPath, requestContext: { http: { method: "GET" } }, queryStringParameters: q });
afterEach(() => vi.unstubAllGlobals());

describe("stormsignal.config.json", () => {
  it("is valid and is what the app lists", () => {
    expect(locations.map((l) => l.id)).toEqual(config.cities.map((c) => c.id));
  });
  it("explains what is wrong with a bad config", () => {
    const ok = { id: "boulder", name: "Boulder, CO", latitude: 40.0, longitude: -105.3, timeZone: "America/Denver" };
    expect(() => validateCities([])).toThrow(/1 to 25 cities/);
    expect(() => validateCities([ok, ok])).toThrow(/duplicate id "boulder"/);
    expect(() => validateCities([{ ...ok, id: "Boulder CO" }])).toThrow(/lowercase/);
    expect(() => validateCities([{ ...ok, latitude: 51.5, longitude: -0.1 }])).toThrow(/U.S. latitude|U.S. longitude/);
    expect(() => validateCities([{ ...ok, timeZone: "Mars/Olympus" }])).toThrow(/unknown timeZone/);
    expect(validateCities([{ ...ok, name: "  Boulder, CO " }])[0].name).toBe("Boulder, CO");
  });
});

describe("embeddable badge", () => {
  it("renders the level, escapes the place and never claims to be official", () => {
    const svg = renderBadge("high", `<script>alert(1)</script> & "Co"`);
    expect(svg).toContain("High · ");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("Not an official NWS rating");
    expect(svg).toContain('fill="#a31f15"');
    expect(renderBadge("unknown", "")).toContain(">Unavailable<");
  });

  it("serves an SVG for bad input and when NWS is down, with short caching for failures", async () => {
    const bad = await get("/api/badge", { loc: "../../etc" });
    expect(bad.statusCode).toBe(200);
    expect(bad.headers["content-type"]).toMatch(/^image\/svg\+xml/);
    expect(bad.body).toContain("Unavailable");
    clearCaches();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const down = await get("/api/badge", { loc: "49007" }); // ZIP resolves locally, then NWS fails
    expect(down.body).toContain("Unavailable");
    expect(down.headers["cache-control"]).toBe("public, max-age=120");
  });
});
