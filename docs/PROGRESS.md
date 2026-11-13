# Local checkpoint — November 12, 2026

Branch: `feat/stormsignal-mvp`. This is the first working local slice, not a completed/deployed competition entry.

## Verified

- `npm test`: 20 deterministic tests passed.
- `npm run build`: TypeScript checking, Vite production build, and Lambda bundling passed.
- `npm audit --omit=dev`: no known production dependency vulnerabilities reported at this checkpoint.
- Real local API request for Kalamazoo successfully retrieved both the NWS hourly forecast and active-alert collection: 156 hourly periods, zero active alerts returned, forecast update time `2026-11-12T21:03:26-05:00`. A successful empty response is not an all-clear.
- Browser checks: explicit demo switching, 4 PM / 6 PM comparison, simulated tornado protective banner, checklist surviving reload, and no horizontal overflow at 360, 390, 768, 1024, and 1440 pixels.

- Browser-injected HTTP 503: showed unavailable forecast and unknown alert status, with no simulated banner or fallback data.

## Not yet complete

- SAM validation/build and AWS execution; private S3/CloudFront frontend hosting; billing controls; deployed end-to-end tests.
- Full accessibility audit and real device/human safety-copy review.
- Submission write-up, architecture artifact, public demo video, and competition submission.

No cloud credentials were used, and no AWS resources, GitHub push, publication, or submission was performed.

## Planning-flow refinement — November 12

Moved the activity selector, the single pair of time-comparison buttons, and the results into one section beside the dial. Added a short current-weather summary and moved the fuller forecast evidence into an expandable disclosure. Mobile navigation is fixed at the bottom; the smaller dial and compact header shorten arrival. Clarified the no-overlap label to name thunderstorm/wintry conditions rather than ambiguous “flagged weather”.

Visible browser walkthrough verified desktop at 1440 × 900 and phone at 390 × 844. Following Compare plans on the phone placed the activity selector at y=108–152, time controls at y=165–209, and results at y=227–453, all above the fixed navigation at y=787. Previously, time controls ended 488 pixels above that view. Changing activity and timing worked in place. Prepare navigation landed the checklist at y=14, with navigation remaining visible. Temporary viewport override was reset. Production build and 21 tests passed.

## Rebuild to the competition handoff — November 12, late evening

Keith chose to rebuild the frontend to the new handoff (Overview / What If? / Storm Prep with Low–Critical levels). The dial prototype was retired; `shared/planning.ts`, `src/Dial.tsx`, `src/Checklist.tsx` and `tests/planning.test.ts` were removed (they remain in git history). The location catalog keeps the six SW Michigan cities and adds Detroit, Chicago and Indianapolis. The API stays on API Gateway HTTP API (throttling) rather than a Function URL.

### Built
- NWS client now also reads gridpoint layers (gusts, thunder, snow, ice, feels-like) and the nearest station observation; point metadata cached for 12 h; each source reported independently.
- Deterministic engines in `shared/`: `riskEngine` (overview level + explanation), `impactEngine` (activity rules, now/+3/+6 h comparison, explained differences), `preparationEngine` (sourced tasks, timing, Before/During/After).
- New React UI, design tokens and wireframes (`docs/design.md`), four labelled simulated scenarios.
- SAM template now provisions private S3 + CloudFront (OAC, `/api/*` to the HTTP API), a Lambda error alarm, and an optional budget. `scripts/deploy.ps1` is written.

### Verified
- `npm test`: 45 passed. `tsc --noEmit` and `npm run build` passed.
- `sam validate --lint --region us-east-2`: valid.
- Live NWS: all nine cities, all four sources OK. The bundled Lambda handler returned live data.
- Browser: 5 sources × 3 pages, zero console errors; mobile 375 px with no overflow; light and dark; checklist persistence; injected 503.

### Not done
- **Not deployed.** The AWS CLI SSO token had expired (read-only check). Deployment needs Keith's sign-in and go-ahead. `deploy.ps1` hasn't been run.
- Screen-reader audit; screenshots; architecture diagram image; video recording; publishing the article; submission.
- No commits made for this rebuild yet.

## Rules compliance, accessibility and assets — November 13

- AWS sign-in verified (SSO, us-east-1). Deploy region changed to us-east-1, and `deploy.ps1` checks STS identity first. Still **not deployed** (Keith: "Not yet").
- Official terms reviewed: `docs/rules-compliance.md` maps every requirement. Added `NOTICE.md`, shipped the OFL font licenses in `public/licenses/`, and added a not-affiliated line to the footer. The demo script now avoids third-party brands and unlicensed music. The article has a pass/fail checklist and a "Reuse the pattern" section.
- Accessibility: fixed hash-routing hijack of in-page anchors, added an Overview `<h1>` and focus management, raised level colours to WCAG AA, fixed `<dl>` markup, and replaced warning-state dimming with a labelled paused disclosure.
- Added Playwright browser tests with axe: 26 passing (desktop, mobile, dark-mode axe), plus `e2e/live.spec.ts` for the deployed URL.
- Architecture diagram (`docs/architecture.svg` and PNG) and 7 screenshots in `docs/screenshots/` (live and labelled simulated).

Remaining (Keith): deploy approval, choose a repo license and visibility, record and upload the video, publish the article, submit before Nov 16, 1 PM PT.

## Contest features — November 13

Built all seven additions Keith approved:
1. **Forecast drift**: EventBridge Scheduler (every 30 min) → snapshot Lambda → DynamoDB (TTL 72 h), saving each new NWS issuance for the listed cities; `/api/history`; Overview panel comparing the same hours (trend, changes, level strip). Simulated scenarios include labelled fictional history.
2. **Any U.S. place**: ZIP and "City, ST" from bundled Census Gazetteer data, street addresses via the Census Geocoder, "use my location" rounded to about 1 km; `pt:lat,lon` ids validated and U.S.-only; the place name and time zone come from NWS.
3. **Offline / print / calendar**: service worker (production only), offline notice, print layout, `.ics` reminders 2 h before forecast deadlines.
4. **Your own start time** as What If? option D.
5. **Share this view** links (hash state).
6. **What would change the level** on Overview and each option.
7. **`/api/rules`** JSON catalog.

Verified: 61 unit tests, 38 Playwright tests (incl. offline reload and print), `sam validate --lint` (us-east-1), live routes against NWS and Census (ZIP 49007, "Boulder, CO", 1600 Pennsylvania Ave; a London point rejected), and the local snapshot job writing history for all nine cities. Still **not deployed**.

## Published and deployed — November 13

- Public repo: https://github.com/kcasko/stormsignal (MIT, default branch `main`). The history was scanned for secrets and personal data before the push.
- Deployed `storm-signal` to us-east-1, account verified with STS. **Live: https://d3p9tcn7282g7r.cloudfront.net**
- First attempt failed because the account's Lambda concurrency limit is 10 (no reserved concurrency allowed). It rolled back cleanly; reserved concurrency is now an optional parameter (off), and the redeploy succeeded.
- Verified: site, security headers, HTTP→HTTPS, private S3 (403), all API routes, schedule enabled and saving snapshots, DynamoDB TTL, `e2e/live.spec.ts` 4/4.
- Not set: the optional budget alert (needs an email; pass `-BudgetEmail` to `deploy.ps1`).

Remaining (Keith): record and upload the video, publish the Builder Center article, submit before Nov 16, 1:00 PM PT.

## Nov 13: alert maps and alert history

- Every alert card has an SVG area map: the NWS storm-based polygon when there is one, otherwise the outlines of the NWS zones it lists (`/api/area`, allow-listed `api.weather.gov/zones/*`, cached 24 h), the user's point ("inside"/"outside") and nearby towns from bundled Census data. Simulated alerts use fictional areas, labelled as such.
- Every alert card has a timeline from NWS `references` and VTEC actions: issued, updated, extended, upgraded, scheduled end.
- Snapshots now also record active alerts and are saved whenever they change. The Overview lists alerts that ended in the last 24 hours as expired, cancelled (VTEC CAN), upgraded (UPG) or "no longer listed by NWS" (never assumed cancelled).
- 74 unit tests and 40 local browser tests pass.

## Overview refinement review — November 13

Local review on branch codex/overview-refinement, based on Claude's final e41a0ff checkpoint.
- Current city, observed temperature, wind, visibility and observation time now lead the Overview.
- Reduced the level word and summary size; grouped official alert status and forecast history beside the assessment instead of spanning multiple empty rows.
- Removed the repeated calm-weather evidence section when there are no factors or limitations. Hazard evidence and missing-data explanations remain visible.
- Made saved-forecast bars larger and labelled the first and latest saved times; moved implementation details out of the forecast-history explanation.
- The method explanation is expandable. Official instructions, warning banners, maps, alert lifecycle history and source timestamps remain intact.
- Verification: 74 unit tests passed before UI edits; production build passed. Final browser results recorded below. Mobile thunderstorm checked at 390 px with no horizontal overflow.
- Local preview only; no commit, push or deployment performed for this refinement.
- Final verification: production build and all 36 app browser tests passed (desktop, mobile and dark accessibility checks). A transient Vite cache of an empty module during formatting was cleared; the fresh run passed. Git diff whitespace check is clean.

## Slate and blue palette / introduction — November 13

The local refinement replaces the cream palette with cool slate (#edf2f7), white panels, navy text and blue actions. Dark mode uses navy (#0c1726 / #142337). Risk colors remain semantic; the assessment panel itself uses the neutral panel color.

Overview opens with a compact explanation of what the application does, plus an expandable three-step guide linking to What If? and Storm Prep. The explanation stays visible; the longer guide is closed by default. Urgent warning banners remain above the introduction.

Verification: production build passed; 16 targeted browser checks passed for light/dark contrast, mobile overflow and anchor navigation. Expanded guide visually reviewed at 390 px. Changes remain local on codex/overview-refinement.

## Dial-led local alternative — November 13

Restored the earlier twelve-hour dial concept using the current deterministic assessment and activity engines instead of the retired planning code.
- Overview now pairs the forecast dial with activity, duration and custom-time controls. A/B/C (and optional D) use the same comparison results on the ring and in the selected-option explanation.
- The selected activity duration is drawn on a separate dashed outer track. An explicit date/time-zone range and expandable hourly text alternative accompany the ring. Beyond-window starts are listed separately and never wrap onto Now.
- Kept the cool blue palette, product explanation, full-day assessment, official alert maps/lifecycle history, saved forecast trends, detailed What If? page and prep tools.
- Small screens place activity controls ahead of the dial. Urgent official instructions remain above the whole application; comparisons stay paused under warnings.
- Verified: 79 unit tests, 38 app browser checks (desktop/mobile/dark contrast), and production build. The new tests cover horizon boundaries, midnight, missing data, actual peak times, and selection synchronization. Final key-button check added to the same browser test.
- Review locally at http://127.0.0.1:5173/ on codex/overview-refinement. Still uncommitted, unpushed and undeployed.

## Quiet default view — November 13

Simplified the dial-led alternative after user feedback that it displayed too much at once.
- Replaced the embedded activity button group with one selector. Duration/custom timing and comparison explanations use native disclosures.
- Kept one selected exposure result next to the dial; removed the duplicated large 24-hour scale and the second standalone evidence section.
- The 24-hour assessment remains labelled and available with its evidence/limitations. Forecast history and the hourly forecast table are collapsed by default. Official alerts and urgent instructions remain visible.
- Shortened the introduction and dial captions while preserving dates, time zones, the hourly text alternative and out-of-window notes.
- Production build passes. Browser tests now open optional sections explicitly and check that supporting history/table sections begin collapsed.
- Final verification for the quiet view: all 38 app browser checks passed, including desktop/mobile/dark accessibility, collapse defaults, alert maps and synchronized dial selection. Still local and uncommitted.

## Final layout — November 13

Claude reworked the dial-led alternative after feedback ("too much empty space", "maybe lose the dial"): the Overview became an answer page (navy hero with the level, reason and next-24-hour key numbers; ribbon, calls to action, forecast changes and hourly table beside official alerts), and the dial moved to What If?, laid out beside its controls with the option cards full width below. 79 unit tests and 42 browser tests pass. Committed, merged to main and deployed.
