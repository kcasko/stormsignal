import { test, expect } from "@playwright/test";

// Runs against `vite preview` (production build) because the service worker is production-only.
test.skip(!!process.env.BASE_URL, "local preview only");
const PREVIEW = "http://127.0.0.1:4173";

test("the plan still opens offline, with an offline notice", async ({ page, context }) => {
  await page.route("**/api/history?**", (r) => r.fulfill({ json: { tracked: true, snapshots: [] } }));
  await page.goto(PREVIEW + "/#prep?src=winter");
  await expect(page.getByRole("heading", { name: "Storm prep" })).toBeVisible();
  // Wait until the service worker controls the page, then reload once so the shell and assets are cached.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || navigator.serviceWorker.ready.then(() => true));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator(".tasks input").first()).toBeVisible();
  await page.locator(".tasks input").first().check();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Storm prep" })).toBeVisible();
  await expect(page.getByText(/You.re offline/)).toBeVisible();
  await expect(page.locator(".tasks input").first()).toBeChecked();
  await context.setOffline(false);
});

test("print layout hides controls and keeps the plan", async ({ page }) => {
  await page.goto(PREVIEW + "/#prep?src=winter");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".masthead")).toBeHidden();
  await expect(page.locator(".prep-actions")).toBeHidden();
  await expect(page.locator(".print-meta")).toBeVisible();
  await expect(page.locator(".print-meta")).toContainText("SIMULATED SCENARIO");
  await expect(page.locator(".phase.before .tasks li").first()).toBeVisible();
});
