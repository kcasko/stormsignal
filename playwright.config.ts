import { defineConfig, devices } from "@playwright/test";

// Local: starts (or reuses) Vite on 127.0.0.1:5173. The tests mock /api, so no NWS calls are made.
// Deployed: set BASE_URL=https://<cloudfront-domain> to smoke-test the public site with real data (see e2e/live.spec.ts).
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5173";
export default defineConfig({
  testDir: "e2e",
  timeout: 30000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark" }, grep: /accessibility/ },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : [
        { command: "npx vite --host 127.0.0.1", url: baseURL, reuseExistingServer: true, timeout: 60000 },
        // Production build for the offline test (service workers only run in production builds).
        { command: "npx vite build && npx vite preview", url: "http://127.0.0.1:4173", reuseExistingServer: true, timeout: 120000 },
      ],
});
