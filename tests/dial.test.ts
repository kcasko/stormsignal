import { describe, expect, it } from "vitest";
import { dialModel } from "../shared/dial";
import { assess } from "../shared/riskEngine";
import { compareOptions } from "../shared/impactEngine";
import { H, T0, weather, withHours } from "./fixtures/weather";

describe("twelve-hour dial", () => {
  it("shows exactly twelve elapsed hours, crossing midnight without wrapping a later day", () => {
    const w = weather();
    const model = dialModel(w, assess(w, T0), compareOptions(w, "driving", 1, T0));
    expect(model.hours).toHaveLength(12);
    expect(model.end).toBe(T0 + 12 * H);
    expect(model.markers.map((o) => o.key)).toEqual(["A", "B", "C"]);
    expect(model.hours.at(-1)?.start).toBe(T0 + 11 * H);
  });
  it("does not put a custom start twelve hours later back at Now", () => {
    const w = weather();
    const model = dialModel(w, assess(w, T0), compareOptions(w, "driving", 1, T0, T0 + 12 * H));
    expect(model.markers.map((o) => o.key)).toEqual(["A", "B", "C"]);
    expect(model.outside[0].key).toBe("D");
  });
  it("does not show tomorrow's hazard as a peak in the next twelve hours", () => {
    const w = weather(withHours(15, 18, { gustMph: 60 }));
    const assessment = assess(w, T0);
    expect(assessment.level).toBe("high");
    const model = dialModel(w, assessment, []);
    expect(model.peak).toBeNull();
    expect(model.hours.every((h) => h.level === "low")).toBe(true);
  });
  it("keeps missing weather unknown on the ring", () => {
    const w = weather([], { availability: { forecast: false, alerts: false, grid: false, observation: false } });
    expect(dialModel(w, assess(w, T0), []).hours.every((h) => h.level === "unknown")).toBe(true);
  });
  it("uses the actual factor times for the displayed peak window", () => {
    const w = weather(withHours(3, 5, { gustMph: 60 }));
    expect(dialModel(w, assess(w, T0), []).peak).toEqual({ level: "high", start: T0 + 3 * H, end: T0 + 5 * H });
  });
});
