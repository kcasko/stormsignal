import { describe, it, expect } from "vitest";
import { demoWeather, demoAnchor } from "../src/demo";
import { locations } from "../shared/locations";
import {
  comparePlan,
  intervalEndLabel,
  forecastWindows,
  HOUR,
  overlaps,
  timeLabel,
  isStale,
} from "../shared/planning";
const data = () => demoWeather(locations[0], "thunderstorm");
describe("time comparisons", () => {
  it("uses half-open intervals at exact weather boundaries", () => {
    const w = { start: 10, end: 20, label: "test" };
    expect(overlaps(0, 10, w)).toBe(false);
    expect(overlaps(20, 30, w)).toBe(false);
    expect(overlaps(9, 11, w)).toBe(true);
  });
  it("merges consecutive weather hours and preserves source wording", () => {
    const w = forecastWindows(data(), demoAnchor);
    expect(w).toHaveLength(1);
    expect(w[0].start).toBe(demoAnchor + 3 * HOUR);
    expect(w[0].end).toBe(demoAnchor + 7 * HOUR);
    expect(w[0].label).toContain("thunderstorms");
  });
  it("detects activity extending into a window", () => {
    expect(
      comparePlan(data(), demoAnchor + 2.5 * HOUR, 45, demoAnchor).title,
    ).toBe("Overlaps forecast weather");
  });
  it("does not treat missing forecast coverage as clear weather", () => {
    const d = data();
    d.periods = d.periods.slice(0, 1);
    expect(comparePlan(d, demoAnchor + 2 * HOUR, 45, demoAnchor).title).toBe(
      "Incomplete forecast coverage",
    );
  });
  it("handles gaps inside coverage", () => {
    const d = data();
    d.periods = d.periods.filter((_, i) => i !== 1);
    expect(comparePlan(d, demoAnchor, 180, demoAnchor).title).toBe(
      "Incomplete forecast coverage",
    );
  });
  it("puts urgent warnings before the comparison", () => {
    const d = demoWeather(locations[0], "tornado");
    expect(comparePlan(d, demoAnchor, 45, demoAnchor).title).toBe(
      "Official warning takes priority",
    );
  });
  it("does not equate a failed alert request with no alerts", () => {
    const d = data();
    d.availability.alerts = false;
    d.alerts = [];
    expect(comparePlan(d, demoAnchor, 45, demoAnchor).detail).toContain(
      "warning status is unknown",
    );
  });
  it("does not compare when the forecast failed", () => {
    const d = data();
    d.availability.forecast = false;
    expect(comparePlan(d, demoAnchor, 45, demoAnchor).title).toBe(
      "Forecast unavailable",
    );
  });
  it("formats midnight in the location timezone", () => {
    expect(
      timeLabel(Date.parse("2026-11-14T05:00:00Z"), "America/Detroit"),
    ).toBe("12:00 AM");
  });
  it("uses absolute timestamps across the DST repeated hour", () => {
    const zone = "America/Detroit";
    const a = Date.parse("2026-11-01T05:30:00Z"),
      b = Date.parse("2026-11-01T06:30:00Z");
    expect(b - a).toBe(HOUR);
    expect(timeLabel(a, zone)).toBe(timeLabel(b, zone));
  });
  it("marks old retrievals stale", () => {
    expect(isStale(data(), demoAnchor + 11 * 60000)).toBe(true);
    expect(isStale(data(), demoAnchor)).toBe(false);
  });
  it("keeps simulated source explicit", () => {
    expect(data().source).toBe("simulated");
  });
});

it("includes the new calendar date when an activity crosses midnight", () => {
  const start = Date.parse("2026-11-13T04:45:00Z");
  expect(intervalEndLabel(start, start + 45 * 60000, "America/Detroit")).toBe(
    "Nov 13 12:30 AM",
  );
  expect(intervalEndLabel(start, start + 10 * 60000, "America/Detroit")).toBe(
    "11:55 PM",
  );
});
