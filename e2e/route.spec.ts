import { test, expect } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "Run mocked route test locally only");

test("route planner shows actual route estimate and sampled NWS caveat", async ({ page }) => {
  await page.route("**/api/weather?**", route => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.route("**/api/history?**", route => route.fulfill({ json: { tracked: true, snapshots: [] } }));
  await page.route("**/api/route?**", route => route.fulfill({
    json: {
      origin: "Kalamazoo, MI", destination: "Grand Rapids, MI",
      distanceMi: 50.2, durationMin: 45,
      departureAt: "2026-11-13T19:00:00.000Z", arrivalAt: "2026-11-13T19:45:00.000Z", line: [[-85.58, 42.29], [-85.66, 42.96]],
      warningReview: { status: "partial", checkedAt: "2026-11-13T19:00:00.000Z", warnings: [{ id: "example", event: "Tornado Warning", area: "Example area", url: "https://alerts.weather.gov/", geometry: [[[ -85.62,42.4],[-85.61,42.4],[-85.61,42.5],[-85.62,42.4]]], basis: "polygon" }], gaps: ["Missing NWS boundary"] },
      checks: [
        { label: "Kalamazoo, MI", level: "moderate", available: true, forecastCovered: true, summary: "Wind gusts in the hour after arrival.", arrivalAt: "2026-11-13T19:00:00.000Z", alerts: [] },
        { label: "Approximate route midpoint", level: "unknown", available: false, forecastCovered: false, summary: "NWS data missing.", arrivalAt: "2026-11-13T19:22:30.000Z", alerts: [] },
        { label: "Grand Rapids, MI", level: "elevated", available: true, forecastCovered: true, summary: "Wind gusts at arrival.", arrivalAt: "2026-11-13T19:45:00.000Z", alerts: [{ event: "Wind Advisory", url: "https://alerts.weather.gov/" }] },
      ],
      warning: "Weather sampled at only three route points, not checked continuously.",
    },
  }));
  await page.goto("/#whatif");
  await expect(page.getByRole("heading", { name: "Weather along a trip" })).toBeVisible();
  await page.getByRole("combobox", { name: "Planned departure" }).selectOption("3");
  await page.getByRole("button", { name: "Check route" }).click();
  await expect(page.getByText("50.2 miles")).toBeVisible();
  await expect(page.getByTestId("interactive-route-map")).toBeVisible();
  await expect(page.getByText(/Planned departure:/)).toBeVisible();
  await expect(page.getByText(/Incomplete warning coverage/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Tornado Warning" })).toBeVisible();
  await expect(page.getByText(/Forecast conditions unknown/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Wind Advisory/ })).toHaveAttribute("href", "https://alerts.weather.gov/");
  await expect(page.getByText(/not checked continuously/)).toBeVisible();
});
