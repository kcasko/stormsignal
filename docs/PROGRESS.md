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

- Nationwide city/ZIP search, exact-address selection, alert maps, and polygon/zone fallback.
- Scheduled ingestion and actual historical alert events in DynamoDB.
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
