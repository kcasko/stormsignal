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
  await page.route("**/api/history?**", (route) => route.fulfill({ json: { tracked: true, snapshots: [] } }));
  await page.route("**/api/area?**", (route) =>
    route.fulfill({ json: { zones: [], places: [{ name: "Grand Rapids", lat: 42.96, lon: -85.66 }, { name: "Lansing", lat: 42.71, lon: -84.56 }] } }),
  );
  await page.route("**/api/geocode?**", (route) =>
    route.fulfill({
      json: { results: [{ id: "pt:40.024,-105.251", label: "Boulder, CO", latitude: 40.024, longitude: -105.251, source: "place" }] },
    }),
  );
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

test("search any U.S. place and load its forecast", async ({ page }) => {
  await mockApi(page, (id) => ({ body: { ...liveWeather(id), location: { id, name: "Near Boulder, CO", latitude: 40.024, longitude: -105.251, timeZone: "America/Denver" } } }));
  await page.goto("/#overview");
  await page.getByRole("button", { name: "Find a place" }).click();
  await page.getByLabel("ZIP, city or street address").fill("Boulder, CO");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: /Boulder, CO/ }).click();
  await expect(page.getByRole("heading", { name: "Weather overview for Near Boulder, CO" })).toBeAttached();
  await expect(page.getByText(/saved for the listed cities only/)).toBeVisible();
});

test("share link restores place, source, activity and your own time", async ({ page }) => {
  await mockApi(page);
  const at = Math.round((Date.parse("2026-11-13T19:00:00Z") + 4.5 * 3600000) / 60000);
  await page.goto(`/#whatif?loc=kalamazoo&src=thunderstorm&act=event&dur=2&at=${at}`);
  await expect(page.locator(".src select")).toHaveValue("thunderstorm");
  await expect(page.locator(".option h2")).toHaveText(["Start now", "Start in 3 hours", "Start in 6 hours", "Start at 6:30 PM"]);
  await expect(page.locator("select").filter({ hasText: "2 hours" })).toHaveValue("2");
});

test("drift panel and what-would-change explain the scenario", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#overview?src=thunderstorm");
  await page.locator(".risk-details > summary").click();
  await expect(page.locator(".trend")).toContainText("Trending worse");
  await expect(page.locator(".drift-changes")).toContainText("33 mph → 60 mph");
  await expect(page.locator(".verdict .cf")).toContainText("Wind gusts stayed below 58 mph");
});

test("alerts show a labelled area map, their timeline, and alerts that ended", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#overview?src=thunderstorm");
  const map = page.getByRole("img", { name: /Map of the simulated Severe Thunderstorm Watch area\. Kalamazoo, MI is inside it/ });
  await expect(map).toBeVisible();
  await expect(page.locator(".alert-map").first()).toContainText("Grand Rapids");
  await expect(page.locator(".alert").first().locator(".timeline li")).toHaveText([/Issued/, /Updated/, /Scheduled to end/]);
  await expect(page.locator(".ended")).toContainText("Special Weather Statement");
  await expect(page.locator(".ended")).toContainText("Expired");
  await page.locator(".src select").selectOption("winter");
  await expect(page.locator(".ended")).toContainText("Winter Storm Watch");
  await expect(page.locator(".ended .state")).toHaveText("Upgraded");
});

test("calendar export is off for simulated data and available for live deadlines", async ({ page }) => {
  await mockApi(page, (id) => ({ body: liveWeather(id, true) }));
  await page.goto("/#prep?src=thunderstorm");
  await expect(page.getByRole("button", { name: "Add deadlines to my calendar" })).toBeDisabled();
  await page.goto("/?x=1#prep?src=live");
  const button = page.getByRole("button", { name: "Add deadlines to my calendar" });
  await expect(button).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe("storm-signal-prep.ics");
});

test("quiet days offer the labelled storm demo; When to go answers first", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#overview");
  await expect(page.locator(".purpose-line")).toContainText("turns National Weather Service forecasts into decisions");
  await page.getByRole("button", { name: /See it during a storm/ }).click();
  await expect(page.locator(".src select")).toHaveValue("thunderstorm");
  await expect(page.locator(".banner-sim")).toBeVisible();
  await page.getByRole("link", { name: "When to go" }).first().click();
  await expect(page.locator(".options-summary")).toContainText("Highest: B, leave in 3 hours (High)");
});

test("overview is an answer page; the dial lives on When to go", async ({ page }) => {
  await mockApi(page);
  await page.goto("/#overview?src=thunderstorm");
  await expect(page.getByRole("img", { name: /Storm Signal level by hour: .*High 5PM to 7PM/ })).toBeVisible();
  await expect(page.locator(".next-day")).toContainText("60 mph");
  await expect(page.locator(".forecast-dial")).toHaveCount(0);
  await page.getByRole("link", { name: "Compare when to go →" }).click();
  await expect(page.getByRole("img", { name: /Twelve-hour forecast timeline/ })).toBeVisible();
  await expect(page.locator(".option")).toHaveCount(3);
  await page.getByRole("button", { name: "Show option C on dial" }).click();
  await expect(page.locator(".dial-marker.selected text")).toHaveText("C");
});
