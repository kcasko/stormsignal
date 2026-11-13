import { describe, it, expect } from "vitest";
import { compareOptions, explainDifferences, evaluateOption } from "../shared/impactEngine";
import { T0, H, alert, weather, withHours } from "./fixtures/weather";

const zone = "America/Detroit";
describe("impact engine (What If?)", () => {
  it("compares leave now, in 3 hours and in 6 hours", () => {
    const opts = compareOptions(weather(withHours(3, 5, { gustMph: 47 })), "driving", 1, T0);
    expect(opts.map((o) => o.label)).toEqual(["Leave now", "Leave in 3 hours", "Leave in 6 hours"]);
    expect(opts.map((o) => o.level)).toEqual(["low", "elevated", "low"]);
    expect(opts[1].conditions.maxGust).toBe(47);
  });

  it("explains differences with evidence and never calls a time safe", () => {
    const opts = compareOptions(weather(withHours(0, 2, { gustMph: 47 })), "driving", 1, T0);
    const text = explainDifferences(opts, zone).join(" ");
    expect(text).toMatch(/lower than Elevated for A/);
    expect(text).toMatch(/peak gust falls from 47 mph to 15 mph/);
    expect(text).toMatch(/not a guarantee/);
    expect(text.toLowerCase()).not.toMatch(/\bsafe to\b|\bis safe\b/);
  });

  it("leads the explanation with the metric that set the level", () => {
    // Thunder changes more in absolute terms, but the 60 mph gust is what makes B High.
    const opts = compareOptions(weather(withHours(3, 4, { gustMph: 60, thunderChance: 49 })), "driving", 1, T0);
    expect(opts[1].level).toBe("high");
    expect(explainDifferences(opts, zone)[0]).toMatch(/High, higher than Low for A: peak gust rises from 15 mph to 60 mph/);
  });

  it("uses activity-specific thresholds for the same storm", () => {
    const w = weather(withHours(0, 3, { gustMph: 36, thunderChance: 30 }));
    const drive = evaluateOption(w, "driving", T0, 1, T0);
    const event = evaluateOption(w, "event", T0, 3, T0);
    expect(drive.level).toBe("moderate");
    expect(event.level).toBe("elevated");
    expect(event.factors.map((f) => f.id)).toContain("thunder");
  });

  it("treats any ice during a drive as High", () => {
    expect(evaluateOption(weather(withHours(0, 1, { iceIn: 0.01 })), "driving", T0, 1, T0).level).toBe("high");
  });

  it("returns Unknown, not Low, when the option runs past the forecast", () => {
    const opts = compareOptions(weather(withHours(0, 5, {}, 5)), "driving", 1, T0);
    expect(opts[2].level).toBe("unknown");
    expect(explainDifferences(opts, zone).join(" ")).toMatch(/C \(leave in 6 hours\) cannot be rated/);
  });

  it("lets an active warning override the comparison", () => {
    const w = weather(undefined, { alerts: [alert("Tornado Warning", { severity: "Extreme" })] });
    const opts = compareOptions(w, "event", 3, T0);
    expect(opts[0].urgent?.event).toBe("Tornado Warning");
    expect(opts[0].level).toBe("critical");
    expect(explainDifferences(opts, zone)[0]).toMatch(/Follow its instructions now/);
  });

  it("does not attach an expired urgent warning to later options", () => {
    const end = new Date(T0 + H).toISOString();
    const w = weather(undefined, { alerts: [alert("Tornado Warning", { ends: end, expires: end })] });
    const opts = compareOptions(w, "driving", 1, T0);
    expect(opts[0].urgent).not.toBeNull();
    expect(opts[1].urgent).toBeNull();
  });

  it("reports missing gust data as a limitation", () => {
    const opts = compareOptions(weather(withHours(0, 30, { gustMph: null })), "home", 2, T0);
    expect(opts[0].limitations.join(" ")).toMatch(/Wind gusts: no hours had a value/);
  });
});

describe("impact engine edge cases", () => {
  it("warns when an official alert starts soon after the option ends", () => {
    const w = weather(undefined, {
      alerts: [alert("Winter Storm Warning", { onset: new Date(T0 + 2 * H).toISOString() })],
    });
    const a = evaluateOption(w, "driving", T0, 1, T0);
    expect(a.level).toBe("low");
    expect(a.limitations.join(" ")).toMatch(/Winter Storm Warning begins Fri 4:00 PM, soon after/);
  });
});
