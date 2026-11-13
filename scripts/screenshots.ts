// Captures article/README images into docs/screenshots/. Requires `npm run dev` (live data comes from real NWS).
//   npx tsx scripts/screenshots.ts            (local)
//   $env:BASE_URL="https://<cloudfront>"; npx tsx scripts/screenshots.ts   (deployed)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const out = resolve("docs/screenshots");
mkdirSync(out, { recursive: true });

const shots: { name: string; hash: string; source: string; location?: string; mobile?: boolean; full?: boolean; element?: string }[] = [
  { name: "01-overview-live", hash: "overview", source: "live", location: "kalamazoo" },
  { name: "02-overview-sim-thunderstorm", hash: "overview", source: "thunderstorm" },
  { name: "03-whatif-sim-thunderstorm-driving", hash: "whatif", source: "thunderstorm", full: true },
  { name: "04-prep-sim-winter", hash: "prep", source: "winter", full: true },
  { name: "05-tornado-warning-override", hash: "prep", source: "tornado" },
  { name: "06-mobile-overview-live", hash: "overview", source: "live", location: "chicago", mobile: true },
  { name: "07-mobile-whatif-sim", hash: "whatif", source: "thunderstorm", mobile: true },
  { name: "08-drift-sim-thunderstorm", hash: "overview", source: "thunderstorm", element: ".drift" },
  { name: "09-whatif-what-would-change", hash: "whatif", source: "thunderstorm", element: ".options" },
];

const browser = await chromium.launch();
try {
  const diagram = await browser.newPage({ viewport: { width: 1200, height: 660 }, deviceScaleFactor: 2 });
  await diagram.goto(pathToFileURL(resolve("docs/architecture.svg")).href);
  await diagram.screenshot({ path: resolve(out, "00-architecture.png") });
  console.log("00-architecture.png");

  for (const s of shots) {
    const ctx = await browser.newContext(
      s.mobile
        ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" }
        : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" },
    );
    const page = await ctx.newPage();
    if (s.location) await page.addInitScript((id) => localStorage.setItem("stormsignal-location", id), s.location);
    await page.goto(`${base}/#${s.hash}`);
    if (s.source !== "live") await page.locator(".src select").selectOption(s.source);
    else await page.getByText(/^Retrieved /).waitFor({ timeout: 25000 });
    await page.waitForTimeout(400);
    if (s.element) await page.locator(s.element).screenshot({ path: resolve(out, s.name + ".png") });
    else await page.screenshot({ path: resolve(out, s.name + ".png"), fullPage: !!s.full });
    console.log(s.name + ".png");
    await ctx.close();
  }
} finally {
  await browser.close();
}
