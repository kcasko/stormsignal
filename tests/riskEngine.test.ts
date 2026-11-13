import { describe, it, expect } from "vitest";
import { assess } from "../shared/riskEngine";
import { urgentAlert } from "../shared/rules";
import { T0, H, alert, hour, weather, withHours } from "./fixtures/weather";

const avail = (forecast: boolean, alerts: boolean, grid: boolean) => ({
  availability: { forecast, alerts, grid, observation: true },
});

describe("risk engine (overview)", () => {
  it("is Low only when every source succeeded and no threshold is met", () => {
    const a = assess(weather(), T0);
    expect(a.level).toBe("low");
    expect(a.factors).toEqual([]);
    expect(a.summary).toMatch(/not an all-clear/);
  });

  it("never treats a failed alerts request as Low", () => {
    const a = assess(weather(undefined, avail(true, false, true)), T0);
    expect(a.level).toBe("unknown");
    expect(a.limitations.join(" ")).toMatch(/Warning status is unknown/);
  });

  it("never treats a failed forecast or missing grid data as Low", () => {
    expect(assess(weather([], avail(false, true, false)), T0).level).toBe("unknown");
    expect(assess(weather(undefined, avail(true, true, false)), T0).level).toBe("unknown");
  });

  it("treats a forecast that ends early as incomplete", () => {
    const a = assess(weather(Array.from({ length: 10 }, (_, i) => hour(i))), T0);
    expect(a.level).toBe("unknown");
    expect(a.limitations.join(" ")).toMatch(/does not cover/);
  });

  it("explains wind gust classifications with threshold and time window", () => {
    const a = assess(weather(withHours(3, 7, { gustMph: 48 })), T0);
    expect(a.level).toBe("elevated");
    const f = a.factors[0];
    expect(f.id).toBe("gust");
    expect(f.evidence).toContain("48 mph");
    expect(f.evidence).toContain("≥46 mph");
    expect(f.evidence).toMatch(/5:00 PM – 9:00 PM/);
    expect(a.summary).toMatch(/^Elevated because of wind gusts/);
  });

  it("uses inclusive thresholds at exact boundaries", () => {
    expect(assess(weather(withHours(0, 1, { gustMph: 58 })), T0).level).toBe("high");
    expect(assess(weather(withHours(0, 1, { gustMph: 57 })), T0).level).toBe("elevated");
    expect(assess(weather(withHours(0, 1, { gustMph: 29 })), T0).level).toBe("low");
  });

  it("sums snow and ice across the window rather than taking a single hour", () => {
    const a = assess(weather(withHours(2, 8, { snowIn: 0.75 })), T0);
    expect(a.factors.find((f) => f.id === "snow")?.level).toBe("elevated"); // 4.5 in
    const ice = assess(weather(withHours(2, 3, { iceIn: 0.02 })), T0);
    expect(ice.level).toBe("elevated");
    expect(ice.hazards).toContain("ice");
  });

  it("ignores conditions outside the 24-hour window", () => {
    expect(assess(weather(withHours(26, 28, { gustMph: 70 })), T0).level).toBe("low");
  });

  it("falls back to forecast wording when the numeric layer is quiet", () => {
    const a = assess(
      weather(withHours(4, 6, { forecast: "Chance Showers And Thunderstorms", thunderChance: null })),
      T0,
    );
    expect(a.factors.some((f) => f.id === "w-thunder")).toBe(true);
    expect(a.level).not.toBe("low");
  });

  it("lets a known numeric value outrank vague wording", () => {
    // Real case seen Nov 12: "Slight Chance Rain And Snow Showers" with 0 in forecast snow.
    const a = assess(weather(withHours(4, 6, { forecast: "Slight Chance Rain And Snow Showers", snowIn: 0 })), T0);
    expect(a.level).toBe("low");
    const b = assess(weather(withHours(4, 6, { forecast: "Slight Chance Rain And Snow Showers", snowIn: null })), T0);
    expect(b.factors.map((f) => f.id)).toContain("w-snow");
  });

  it("does not double count wording when the thunder rule already fired", () => {
    const a = assess(weather(withHours(4, 6, { forecast: "Thunderstorms Likely", thunderChance: 60 })), T0);
    expect(a.factors.filter((f) => f.hazard === "thunderstorm").map((f) => f.id)).toEqual(["thunder"]);
  });

  it("keeps official alerts identifiable and separate from forecast rules", () => {
    const a = assess(weather(undefined, { alerts: [alert("Wind Advisory", { severity: "Moderate" })] }), T0);
    const f = a.factors[0];
    expect(f.basis).toBe("official");
    expect(f.title).toBe("Wind Advisory");
    expect(f.evidence).toContain("Moderate");
    expect(a.level).toBe("moderate");
  });

  it("rates warnings High and tornado warnings Critical, and flags urgent action", () => {
    expect(assess(weather(undefined, { alerts: [alert("Winter Storm Warning")] }), T0).level).toBe("high");
    const t = assess(
      weather(undefined, { alerts: [alert("Tornado Warning", { severity: "Extreme", urgency: "Immediate" })] }),
      T0,
    );
    expect(t.level).toBe("critical");
    expect(t.urgent?.event).toBe("Tornado Warning");
    expect(t.hazards).toContain("tornado");
  });

  it("does not flag a future warning as an immediate action now", () => {
    const later = alert("Tornado Warning", { onset: new Date(T0 + 2 * H).toISOString() });
    expect(urgentAlert(weather(undefined, { alerts: [later] }), T0)).toBeNull();
  });

  it("uses alerts even when the forecast failed, and says data is missing", () => {
    const a = assess(
      weather([], { alerts: [alert("Severe Thunderstorm Watch")], ...avail(false, true, false) }),
      T0,
    );
    expect(a.level).toBe("elevated");
    expect(a.summary).toMatch(/could be worse/);
  });

  it("is deterministic", () => {
    const w = weather(withHours(3, 9, { gustMph: 50, thunderChance: 45 }));
    expect(assess(w, T0)).toEqual(assess(w, T0));
  });
});
