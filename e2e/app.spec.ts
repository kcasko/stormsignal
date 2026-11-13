import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Deterministic browser smoke tests. /api is mocked so results don't depend on live weather.
test.skip(!!process.env.BASE_URL, "mocked tests run against the local dev server only");

const now = Date.now();
const iso = (h: number) => new Date(Math.floor(now / 3600000) * 3600000 + h * 3600000).toISOString();
const period = (h: number, over: Record<string, unknown> = {}) => ({
  start: iso(h),
  end: iso(h + 1),
  temperature: 50,
  temperatureUnit: "F",
  wind: "10 mph",
  windMph: 10,
  forecast: "Mostly Cloudy",
  precipitation: 10,
  gustMph: 15,
  thunderChance: 0,
  snowIn: 0,
  iceIn: 0,
  apparentF: 48,
  ...over,
});
function liveWeather(id = "kalamazoo", gusty = false) {
  return {
    source: "live",
    location: { id, name: id === "kalamazoo" ? "Kalamazoo, MI" : "Chicago, IL", latitude: 42.29, longitude: -85.59, timeZone: "America/Detroit" },
    fetchedAt: new Date(now).toISOString(),
    forecastUpdatedAt: new Date(now).toISOString(),
    periods: Array.from({ length: 40 }, (_, i) => period(i - 1, gusty && i > 3 && i < 7 ? { gustMph: 50 } : {})),
    alerts: [],
    observation: { station: "KAZO", stationName: "Test station", timestamp: new Date(now).toISOString(), description: "Cloudy", temperatureF: 50, windMph: 9, gustMph: null, visibilityMi: 10 },
    availability: { forecast: true, alerts: true, grid: true, observation: true },
    errors: [],
  };
}
async function mockApi(page: Page, handler?: (id: string) => { status?: number; body: unknown }) {
  await page.route("**/api/weather?**", async (route) => {
    const id = new URL(route.request().url()).searchParams.get("location") || "";
    const r = handler ? handler(id) : { body: liveWeather(id) };
    await route.fulfill({ status: r.status ?? 200, contentType: "application/json", body: JSON.stringify(r.body) });
  });
}
const pickSource = (page: Page, v: string) => page.locator(".src select").selectOption(v);

test("live overview shows level, evidence and official-alert status", async ({ page }) => {
  await mockApi(page, (id) => ({ body: liveWeather(id, true) }));
  await page.goto("/#overview");
  await expect(page.getByRole("img", { name: /Storm Signal level: Elevated/ }).first()).toBeVisible();
  await expect(page.getByText(/Elevated because of wind gusts/)).toBeVisible();
  await expect(page.getByText(/no active alerts for this point/)).toBeVisible();
  await expect(page.getByText("Live NWS data", { exact: true }).last()).toBeVisible();
});

test("API failure is never shown as Low", async ({ page }) => {
  await mockApi(page, () => ({ status: 503, body: { error: "down" } }));
  await page.goto("/#overview");
  await expect(page.getByText("Data unavailable")).toBeVisible();
  await expect(page.getByText(/Alert status unknown/)).toBeVisible();
  await expect(page.getByRole("img", { name: /level: Low/ })).toHaveCount(0);
});

test("simulated scenarios are always bannered and tornado warning overrides", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#whatif");
  await pickSource(page, "tornado");
  await expect(page.getByText(/Simulated scenario\. This is not a real forecast/)).toBeVisible();
  await expect(page.locator(".banner-urgent")).toContainText("SIMULATED TORNADO WARNING");
  await expect(page.getByText(/Comparing plans doesn.t apply right now/)).toBeVisible();
  await expect(page.locator("details.paused")).not.toHaveAttribute("open");
  await page.goto("/#prep");
  await expect(page.getByText(/Stop preparing and act now/)).toBeVisible();
});

test("What If? compares three start times and explains differences", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#whatif");
  await pickSource(page, "thunderstorm");
  await expect(page.locator(".option")).toHaveCount(3);
  await expect(page.locator(".option h2")).toHaveText(["Leave now", "Leave in 3 hours", "Leave in 6 hours"]);
  await expect(page.locator(".diffs")).toContainText("peak gust rises");
  await page.getByText("Hosting an outdoor event").click();
  await expect(page.locator(".option h2").first()).toHaveText("Start now");
});

test("Storm Prep checklist persists across reload and resets", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#prep");
  await pickSource(page, "winter");
  const first = page.locator(".tasks input").first();
  await first.check();
  await expect(page.locator(".progress-line")).toContainText(/^1 of \d+ done/);
  await page.reload();
  await expect(page.locator(".tasks input").first()).toBeChecked();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator(".tasks input").first()).not.toBeChecked();
});

test("in-page anchors don't hijack the page router", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#overview");
  await page.getByRole("link", { name: "How levels work" }).click();
  await expect(page.locator("#method")).toBeInViewport();
  await page.goto("/#prep");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter"); // skip link
  await expect(page.getByRole("heading", { name: "Storm prep" })).toBeVisible();
});

test("no horizontal overflow on any page", async ({ page }) => {
  await mockApi(page);
  for (const p of ["overview", "whatif", "prep"]) {
    await page.goto("/#" + p);
    await pickSource(page, "thunderstorm");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});

for (const p of ["overview", "whatif", "prep"])
  test(`no serious accessibility violations: ${p}`, async ({ page }) => {
    await mockApi(page, (id) => ({ body: liveWeather(id, true) }));
    await page.goto("/#" + p);
    await expect(page.locator("main h1")).toHaveCount(1);
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target}`)).toEqual([]);
  });

test("no serious accessibility violations with a warning banner and simulated data", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#prep");
  await pickSource(page, "tornado");
  await expect(page.locator(".banner-urgent")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target}`)).toEqual([]);
});
