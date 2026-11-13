import { describe, expect, it } from "vitest";
import { parseDeparture, routeSamples } from "../shared/routeTiming";
import { handler } from "../backend/handler";

describe("route departure and arrival estimates", () => {
  it("measures route progress by distance instead of unequal geometry point count", () => {
    const line = [[-85,42],[-85,42.01],[-85,42.02],[-85,43]];
    const samples = routeSamples(line);
    expect(samples).toHaveLength(3);
    expect(samples[0].point).toEqual(line[0]);
    expect(samples[2].point).toEqual(line[3]);
    expect(samples[1].point[1]).toBeCloseTo(42.5, 1);
    expect(samples[1].fraction).toBe(0.5);
  });
  it("rejects invalid, expired, or too-distant departures", () => {
    const now=Date.parse("2026-11-13T18:00:00.000Z");
    expect(parseDeparture("2026-11-13T21:00:00.000Z",now)).toBe(now+3*3600000);
    expect(parseDeparture("2026-11-12T21:00:00.000Z",now)).toBeNull();
    expect(parseDeparture("2026-11-16T21:00:00.000Z",now)).toBeNull();
    expect(parseDeparture("tomorrow",now)).toBeNull();
  });
  it("API rejects malformed departure without paid route requests", async () => {
    const res = await handler({
      rawPath:"/api/route", requestContext:{http:{method:"GET"}},
      queryStringParameters:{from:"kalamazoo",to:"grand-rapids",depart:"bad"},
    });
    expect(res.statusCode).toBe(400);
  });
});
