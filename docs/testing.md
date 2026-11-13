# Testing

## Automated (Vitest)

```bash
npm test          # 74 tests, under 1 s, no network
npm run typecheck
npm run build     # type check + Vite build + Lambda bundle (build/handler.mjs)
```

| Suite | Covers |
| --- | --- |
| `tests/riskEngine.test.ts` | Low only when every source succeeded; failed alerts/forecast/grid or short coverage → Unknown; inclusive thresholds at boundaries; snow/ice summed over the window; 24 h window edges; wording fallback only where numeric data is missing; official alerts kept separate and labelled; warning → High, tornado → Critical + urgent; future warnings not urgent now; determinism. |
| `tests/impactEngine.test.ts` | Leave now / +3 h / +6 h; differences cite evidence and never say "safe"; the explanation leads with the metric that set the level; activity-specific thresholds on the same storm; ice while driving → High; option past forecast end → Unknown; warnings override comparisons; expired warnings don't carry over; missing gust data reported; alerts starting just after a window are flagged. |
| `tests/preparationEngine.test.ts` | Every task and guidance item has a reason and an https source; wind and winter task selection; timing derived from the forecast; category filtering; baseline-only when hazards are unknown; urgent warning carried into the plan. |
| `tests/features.test.ts` | ZIP/city search from bundled Census data (exact name first, then size); point-id rounding and U.S.-only validation; only street addresses reach the Census Geocoder; drift says "not enough history" instead of guessing, compares the same hours, and detects worse or steady trends; snapshots are deduplicated by NWS issuance; untracked places return `tracked: false`; "what would change" names the threshold and next level and defers to official alerts; option D at your own time; `/api/rules` thresholds; RFC 5545 calendar export with folded lines and reminders 2 h before the deadline. |
| `tests/weather.test.ts` | NWS URL allow-listing; wind text and ISO-duration parsing; unit conversion; accumulation spreading; unexpected units → unknown (not 0); malformed data rejected; ended alerts filtered; observation parsing; full live assembly; partial failures reported independently; network errors; handler validation (400/404/405); health and locations need no network. |

Fixtures in `tests/fixtures/weather.ts` are synthetic and labelled as such.

## Browser smoke + accessibility tests (Playwright)

```bash
npm run e2e        # starts or reuses Vite on 127.0.0.1:5173; /api is mocked, so no NWS calls
```

`e2e/app.spec.ts` and `e2e/offline.spec.ts` run on desktop Chrome and a Pixel 7 profile, plus dark-mode axe checks (40 passing):
- Live Overview shows the level, the evidence sentence, and alert status. An API 503 shows "Data unavailable", never Low.
- Simulated scenarios are always bannered. A tornado warning shows the override, and the comparison and routine tasks are paused (collapsed, full contrast).
- When to go shows three options with labels and a differences sentence; switching activity changes the options.
- The checklist persists across reload, and Reset works.
- In-page anchors (skip link, "How levels work") don't trigger the page router.
- No horizontal overflow on any page.
- Place search loads a new point's forecast; share links restore place, source, activity, duration and your own time; the drift panel and "what would change" render; calendar export is off for simulated data and downloads `storm-signal-prep.ics` for live deadlines.
- **Offline**: against the production build (`vite preview`), the app reloads offline with the offline notice, and checked tasks survive. **Print**: the print layout hides controls and labels simulated data.
- **axe-core (WCAG 2.0/2.1 A and AA): no serious or critical violations** on all three pages, in light mode, dark mode, and with the warning banner.

`e2e/live.spec.ts` is the post-deploy smoke test for the public URL: `$env:BASE_URL="https://<cloudfront>"; npx playwright test e2e/live.spec.ts --project desktop`.

Fixed because of these tests (Nov 13):
- Elevated and Unknown level colours were 4.49:1 and 4.45:1 on the page background; all light-mode level colours now reach ≥5.1:1.
- Invalid `<p>` inside the observation `<dl>`.
- 50% opacity dimming under warnings failed contrast; replaced with a labelled "paused" disclosure.
- The skip link and "How levels work" were hijacked by hash routing.
- Overview had no `<h1>`; focus now moves to each page's heading on navigation.

## Live NWS check (manual)

```bash
npx tsx scripts/live-check.ts            # all nine cities
npx tsx scripts/live-check.ts chicago    # one city
```

Recorded November 12, 2026 at about 10:10 PM ET: all nine cities returned forecast, alerts, gridpoint and observation data (156 hourly periods each, no active alerts, 0.7–2.1 s per city cold). This run found the wording rule over-rating "Slight Chance Rain And Snow Showers" with a known 0 in of snow; it was fixed and covered by a regression test.

The bundled Lambda (`build/handler.mjs`) was invoked directly. It returned 200 with live Indianapolis data and an assessment, 200 on `/api/health`, and 400 for an unknown location.

## Browser checks (manual, November 12, local dev server)

- Live Kalamazoo: Overview, When to go, and Storm Prep render real NWS data, the observation (KAZO), and retrieval and issue times.
- All five sources (live + four simulated scenarios) × three pages render with **zero console errors** after a clean reload.
- Thunderstorm scenario: High from 60 mph gusts; official watch/advisory labelled separately; When to go rates A Elevated, B High, C Elevated with explained differences.
- Tornado scenario: purple protective-action banner with NWS instruction text on every page; When to go dimmed; Storm Prep puts During first and dims routine tasks.
- Data-failure scenario and an injected HTTP 503: Unknown / "Data unavailable", never Low; alert status "unknown"; Storm Prep still offers baseline steps.
- Checklist: checking a task persists across reload (`localStorage`); Reset clears it.
- Layout: no horizontal overflow at 375 px; bottom navigation on mobile; light and dark schemes both checked.
- Source links: every weather.gov and ready.gov link returned HTTP 200. The FHWA link was updated to its canonical `highways.dot.gov/traffic-info`.
- Fixed during browser testing: a one-render flash of previous live data under the "Simulated" banner when switching sources (the data hook now keys data to location + source).

## Deployed verification (Nov 13, us-east-1)

- `https://d3p9tcn7282g7r.cloudfront.net`: the page returns 200 over HTTPS, HTTP redirects with 301, and HSTS, nosniff, X-Frame-Options and Referrer-Policy headers are present. Direct S3 object access returns 403 (private bucket, OAC only).
- `/api/health` returns 200. `/api/weather?location=kalamazoo` returns live NWS data with all four sources available. `/api/geocode?q=49007` and `/api/rules` return 200. A London point returns 400.
- The EventBridge schedule is ENABLED. Its first run saved snapshots for all 9 cities, and a manual run saved only a city with a new NWS issuance (the rest were skipped). DynamoDB TTL is ENABLED, and `/api/history` returns `tracked: true`.
- `e2e/live.spec.ts` against the public URL: 4/4 passed. Screenshots in `docs/screenshots/` were regenerated from the deployed site.
- First deploy attempt failed: the account's Lambda concurrency limit is 10, so reserved concurrency was rejected. It rolled back cleanly, reserved concurrency became an optional parameter, and the redeploy succeeded.

## Not yet verified

- Manual screen-reader pass (NVDA/VoiceOver). Automated axe checks pass, but that isn't a full audit.
- A real active severe-weather alert (none was active during testing; simulated scenarios cover this path).
