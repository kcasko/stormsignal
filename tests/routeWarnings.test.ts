import { describe, expect, it } from "vitest";
import { routeIntersectsRings, segmentsCross } from "../shared/routeGeometry";
import { reviewRouteWarnings } from "../backend/routeAlerts";
import { alert } from "./fixtures/weather";

const box = [[2,-1],[4,-1],[4,1],[2,1],[2,-1]];
const line = [[0,0],[6,0]];
describe("route geometry and official warning areas", () => {
  it("finds polygon intersections between endpoints", () => {
    expect(routeIntersectsRings(line, [box])).toBe(true);
    expect(routeIntersectsRings([[0,3],[6,3]], [box])).toBe(false);
    expect(routeIntersectsRings([[3,0],[3,2]], [box])).toBe(true);
    expect(segmentsCross([0,0],[6,0],[2,-1],[2,1])).toBe(true);
  });
  it("reports intersecting NWS polygons from the state feed", async () => {
    const a = alert("Tornado Warning", { id: "test-one", geometry: [box], zones: [], area: "Example area" });
    const result = await reviewRouteWarnings(line, async state => state === "MI" ? [a] : [], async () => []);
    expect(result.status).toBe("checked");
    expect(result.warnings).toMatchObject([{ id: "test-one", basis: "polygon" }]);
  });
  it("includes intersecting NWS zone outlines and marks missing outlines partial", async () => {
    const a = alert("Winter Storm Warning", { id: "test-zones", geometry: null, zones: ["forecast/MIZ072","forecast/MIZ073"] });
    const result = await reviewRouteWarnings(line, async state => state === "MI" ? [a] : [],
      async () => [{ id: "forecast/MIZ072", name: "Example county", rings: [box] }]);
    expect(result.warnings).toMatchObject([{ id: "test-zones", basis: "zone" }]);
    expect(result.status).toBe("partial");
    expect(result.gaps.join(" ")).toContain("MIZ073");
  });
  it("preserves incomplete-coverage status when one NWS feed fails", async () => {
    const result = await reviewRouteWarnings(line, async state => {
      if (state === "IN") throw Error("NWS offline");
      return [];
    }, async () => []);
    expect(result.status).toBe("partial");
    expect(result.gaps.join(" ")).toContain("IN");
    expect(result.warnings).toEqual([]);
  });
});
