import { describe, expect, it } from "vitest";
import { routeCities, sampleLine } from "../backend/route";
import { handler } from "../backend/handler";

describe("Amazon Location route MVP", () => {
  it("only accepts distinct known catalog cities", () => {
    expect(routeCities("kalamazoo", "grand-rapids")?.a.name).toContain("Kalamazoo");
    expect(routeCities("kalamazoo", "kalamazoo")).toBeNull();
    expect(routeCities("not-a-city", "chicago")).toBeNull();
  });
  it("samples the beginning, approximate middle and end of supplied geometry", () => {
    const points = [[-85.5, 42], [-85.4, 42.1], [-85.3, 42.2], [-85.2, 42.3], [-85.1, 42.4]];
    expect(sampleLine(points)).toEqual([points[0], points[2], points[4]]);
    expect(sampleLine([points[0]])).toEqual([]);
  });
  it("rejects unsupported routes before invoking AWS or NWS", async () => {
    const bad = await handler({ rawPath: "/api/route", requestContext: { http: { method: "GET" } }, queryStringParameters: { from: "bogus", to: "chicago" } });
    expect(bad.statusCode).toBe(400);
    const same = await handler({ rawPath: "/api/route", requestContext: { http: { method: "GET" } }, queryStringParameters: { from: "chicago", to: "chicago" } });
    expect(same.statusCode).toBe(400);
  });
});
