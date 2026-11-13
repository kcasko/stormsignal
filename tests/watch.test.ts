import { describe, expect, it } from "vitest";
import { watchChange, watchMessage } from "../backend/watch";
import type { Snapshot } from "../shared/drift";

const snap = (level: Snapshot["level"], capturedAt = "2026-11-13T18:00:00.000Z"): Snapshot => ({
  level, capturedAt, issuedAt: capturedAt, hours: [], alerts: [],
});

describe("Storm Signal Watch", () => {
  it("reports an increase for only the configured city", () => {
    const event = watchChange("kalamazoo", snap("moderate"), snap("high"), "kalamazoo");
    expect(event).toMatchObject({ before: "moderate", after: "high", location: "kalamazoo" });
    expect(watchChange("chicago", snap("moderate"), snap("high"), "kalamazoo")).toBeNull();
  });
  it("does not notify about flat or improving forecast levels", () => {
    expect(watchChange("kalamazoo", snap("high"), snap("high"), "kalamazoo")).toBeNull();
    expect(watchChange("kalamazoo", snap("high"), snap("moderate"), "kalamazoo")).toBeNull();
  });
  it("does not treat missing data or the first snapshot as a risk increase", () => {
    expect(watchChange("kalamazoo", snap("unknown"), snap("high"), "kalamazoo")).toBeNull();
    expect(watchChange("kalamazoo", snap("moderate"), snap("unknown"), "kalamazoo")).toBeNull();
    expect(watchChange("kalamazoo", undefined, snap("high"), "kalamazoo")).toBeNull();
  });
  it("explains a meaningful wind increase with local peak time", () => {
    const a = snap("moderate");
    const b = snap("high");
    a.hours = [
      { t: "2026-11-13T19:00:00.000Z", g: 35, w: 20, th: null, p: null, s: null, i: null, tp: null },
      { t: "2026-11-13T20:00:00.000Z", g: 32, w: 20, th: null, p: null, s: null, i: null, tp: null },
    ];
    b.hours = [
      { ...a.hours[0], g: 60, w: 42 },
      { ...a.hours[1], g: 55, w: 39 },
    ];
    const event = watchChange("kalamazoo", a, b, "kalamazoo")!;
    const body = watchMessage(event);
    expect(body).toContain("Peak wind gusts: 35 mph -> 60 mph");
    expect(body).toContain("Fri, 2:00 PM EST");
    expect(body).toContain("WHAT TO DO");
    expect(body).not.toContain("safe to drive");
  });
  it("does not invent evidence without shared forecast hours", () => {
    const a = snap("moderate");
    const b = snap("high");
    b.hours = [{ t: "2026-11-13T19:00:00.000Z", g: 60, w: null, th: null, p: null, s: null, i: null, tp: null }];
    expect(watchMessage(watchChange("kalamazoo", a, b, "kalamazoo")!)).toContain("matching forecast hours were unavailable");
  });
  it("does not compare stale past forecast hours", () => {
    const a = snap("moderate", "2026-11-13T22:00:00.000Z");
    const b = snap("high", "2026-11-13T22:00:00.000Z");
    a.hours = [{ t: "2026-11-13T18:00:00.000Z", g: 20, w: null, th: null, p: null, s: null, i: null, tp: null }];
    b.hours = [{ ...a.hours[0], g: 60 }];
    expect(watchMessage(watchChange("kalamazoo", a, b, "kalamazoo")!)).not.toContain("20 mph -> 60 mph");
  });
  it("includes the city, levels, official warning caveat and link", () => {
    const event = watchChange("kalamazoo", snap("moderate"), snap("high"), "kalamazoo")!;
    const body = watchMessage(event);
    expect(body).toContain("Kalamazoo");
    expect(body).toContain("moderate -> high");
    expect(body).toContain("#overview?loc=kalamazoo");
    expect(body).toContain("not an emergency warning");
  });
});
