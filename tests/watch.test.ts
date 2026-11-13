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
  it("includes the city, levels, official warning caveat and link", () => {
    const event = watchChange("kalamazoo", snap("moderate"), snap("high"), "kalamazoo")!;
    const body = watchMessage(event);
    expect(body).toContain("Kalamazoo");
    expect(body).toContain("moderate -> high");
    expect(body).toContain("#overview?loc=kalamazoo");
    expect(body).toContain("not an emergency warning");
  });
});
