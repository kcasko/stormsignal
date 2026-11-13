import { test, expect } from "@playwright/test";

// Post-deploy smoke test against the public site with real NWS data:
//   $env:BASE_URL = "https://<cloudfront-domain>"; npx playwright test e2e/live.spec.ts --project desktop
test.skip(!process.env.BASE_URL, "set BASE_URL to the deployed site");

test("health endpoint is served through CloudFront", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.status()).toBe(200);
  expect((await r.json()).status).toBe("ok");
});

test("live weather loads with all sources reported", async ({ request }) => {
  const r = await request.get("/api/weather?location=kalamazoo");
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.source).toBe("live");
  expect(Object.keys(body.availability).sort()).toEqual(["alerts", "forecast", "grid", "observation"]);
  expect(body.assessment.level).toMatch(/^(low|moderate|elevated|high|critical|unknown)$/);
});

test("invalid input is rejected", async ({ request }) => {
  expect((await request.get("/api/weather?location=../../x")).status()).toBe(400);
});

test("site renders live data over HTTPS", async ({ page }) => {
  await page.goto("/");
  expect(page.url()).toMatch(/^https:/);
  await expect(page.getByRole("img", { name: /Storm Signal level/ }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Retrieved /)).toBeVisible();
});
