import { describe, it, expect } from "vitest";
import { buildPlan, TASKS, DURING, AFTER, type Category } from "../shared/preparationEngine";
import { assess } from "../shared/riskEngine";
import { T0, alert, weather, withHours } from "./fixtures/weather";

const zone = "America/Detroit";
const all: Category[] = ["home", "vehicle", "household", "electronics"];
describe("preparation engine", () => {
  it("every task and guidance item has a reason and an https source", () => {
    for (const t of [...TASKS, ...DURING, ...AFTER]) {
      expect(t.source.url).toMatch(/^https:\/\//);
      expect(("reason" in t ? t.reason : t.detail).length).toBeGreaterThan(10);
    }
  });

  it("generates wind tasks for a wind event, timed before it begins", () => {
    const plan = buildPlan(assess(weather(withHours(4, 8, { gustMph: 50 })), T0), all, zone);
    const secure = plan.before.find((t) => t.id === "h-secure");
    expect(secure?.timing).toMatch(/^Before about Fri 6:00 PM/);
    expect(plan.before.some((t) => t.id === "v-kit")).toBe(false);
    expect(plan.during.some((g) => g.id === "d-wind")).toBe(true);
    expect(plan.after.some((g) => g.id === "a-lines")).toBe(true);
  });

  it("generates winter tasks for snow", () => {
    const plan = buildPlan(assess(weather(withHours(2, 10, { snowIn: 0.6, forecast: "Snow" })), T0), all, zone);
    expect(plan.before.map((t) => t.id)).toEqual(expect.arrayContaining(["h-heat", "v-kit", "e-charge"]));
    expect(plan.before.some((t) => t.id === "h-cool")).toBe(false);
  });

  it("filters by the categories the user chose", () => {
    const plan = buildPlan(assess(weather(withHours(4, 8, { gustMph: 50 })), T0), ["vehicle"], zone);
    expect(plan.before.length).toBeGreaterThan(0);
    expect(plan.before.every((t) => t.category === "vehicle")).toBe(true);
  });

  it("falls back to baseline tasks when hazards are unknown", () => {
    const plan = buildPlan(
      assess(weather(undefined, { availability: { forecast: true, alerts: false, grid: true, observation: true } }), T0),
      all,
      zone,
    );
    expect(plan.baselineOnly).toBe(true);
    expect(plan.before.map((t) => t.id).sort()).toEqual(["e-alerts", "hh-plan"]);
  });

  it("carries the urgent warning so it can override routine tasks", () => {
    const plan = buildPlan(assess(weather(undefined, { alerts: [alert("Tornado Warning")] }), T0), all, zone);
    expect(plan.urgent?.event).toBe("Tornado Warning");
    expect(plan.during.map((g) => g.id)).toContain("d-tornado");
  });
});
