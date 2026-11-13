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
