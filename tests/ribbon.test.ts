import { describe, it, expect } from "vitest";
import { assess } from "../shared/riskEngine";
import { hourlySignal, peakRun } from "../shared/ribbon";
import { T0, H, alert, weather, withHours } from "./fixtures/weather";

describe("hour-by-hour signal ribbon", () => {
  it("colours only the hours a factor applies to and finds the peak", () => {
    const w = weather(withHours(3, 5, { gustMph: 60 }));
    const a = assess(w, T0);
    const r = hourlySignal(w, a);
    expect(r).toHaveLength(24);
    expect(r.map((h) => h.level).slice(0, 6)).toEqual(["low", "low", "low", "high", "high", "low"]);
    expect(peakRun(r)).toEqual({ level: "high", start: T0 + 3 * H, end: T0 + 5 * H });
  });

  it("applies an alert's floor across its whole duration", () => {
    const w = weather(undefined, { alerts: [alert("Wind Advisory", { ends: new Date(T0 + 4 * H).toISOString() })] });
    const r = hourlySignal(w, assess(w, T0));
    expect(r.slice(0, 5).map((h) => h.level)).toEqual(["moderate", "moderate", "moderate", "moderate", "low"]);
  });

  it("never shows Low for hours without forecast data", () => {
    const w = weather(withHours(0, 0, {}, 10));
    const r = hourlySignal(w, assess(w, T0));
    expect(r[2].level).toBe("low");
    expect(r[12].level).toBe("unknown");
    expect(peakRun(r)).toBeNull();
  });
});
