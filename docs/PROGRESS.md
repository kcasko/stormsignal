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
