# StormSignal — Build Plan

> Know the threat. Understand the impact. Take action.

Status: **planning only**. Implementation starts when the challenge window opens.

## Challenge facts (from the official About text, pasted 2026-11-11)

| Item | Value |
|---|---|
| Challenge | AWS Weekend Challenge: No Pipeline, No Problem (virtual) |
| Window opens | Fri 2026-11-13 12:00 AM PT (3:00 AM ET) |
| Window closes | Mon 2026-11-16 1:00 PM PT (4:00 PM ET) |
| Expected stack | Serverless: Lambda, API Gateway, DynamoDB, S3, Step Functions |
| Awards | 10 × ($100 AWS credits + AWS Builder Backpack) |

The About text describes building "this weekend", and it doesn't explicitly allow pre-event code.
So before Nov 13 the work is limited to this plan; there is no code, scaffolding or AWS resources.
**Still to confirm on the official page:** eligibility (country/age), submission format (Builder Center article? word count? required tags?), whether a repo or a live URL is required, and the judging criteria.

## Before the window opens (owner: Keith)

- [ ] Install the AWS SAM CLI (`winget install Amazon.SAM-CLI`)
- [ ] `aws sso login` (the token is currently expired) and confirm which account/region to use (plan: `us-east-2`)
- [ ] Approve the deploy budget (target < $5/month; an AWS Budget alarm at $5)
- [ ] Decide on the public GitHub repo name (`stormsignal`) and the license (MIT)
- [ ] Read the full official rules and submission requirements

## Architecture

```
            EventBridge Scheduler (rate 5 min)
                         │
                         ▼
     Step Functions (Express) "IngestAlerts"
       ├─ FetchActive   Lambda → api.weather.gov/alerts/active (national, ETag-aware)
       ├─ Validate      Lambda → schema-check, dedupe by id, normalize
       ├─ Diff          Lambda → compare to DynamoDB current state
       ├─ Map(changes)  Lambda → write CREATED / UPDATED / EXPIRED / CANCELLED events
       └─ Catch → record IngestRun{status:FAILED}, never throw away last good state
                         │
                         ▼
                DynamoDB (single table, on-demand, TTL)
                         ▲
                         │
  CloudFront ──/api/*──► API Gateway (HTTP API, throttled) ──► Lambda (read API)
      │
      └─ /* ──► S3 (private, OAC) — React + Vite SPA
```

- **Region:** `us-east-2`. CloudFront is used for HTTPS and the SPA plus an `/api` origin, so the app needs no CORS.
- **Why Express Step Functions:** about 8,640 runs a month. Standard workflows would cost about 50k state transitions, past the free tier, while Express costs pennies.
- **Ingest scope:** the national active-alert feed (one request every 5 minutes), so the timeline works for any US location, with Southwest Michigan as the default view.

## Data sources (official and verifiable only)

| Need | Source | Notes |
|---|---|---|
| Alerts | `https://api.weather.gov/alerts/active` (`?point=lat,lon`, `?area=MI`) | Requires a `User-Agent` header (app name + contact URL). Limits are undisclosed; retry after about 5 s. |
| Alert polygons | `feature.geometry` | It's often `null` for zone-based alerts. Fall back to `affectedZones` → `GET /zones/{type}/{id}` geometry, cached in DynamoDB for 7 days. |
| City / ZIP search | US Census Gazetteer files (Places + ZCTA, public domain) | Bundled as a compact static JSON on S3, searched client-side. No third-party geocoder, API key or rate limit. |
| Safety guidance | The alert's own `instruction` field, plus static ready.gov/NWS safety text per event type | Static text is quoted with a link to its source. |

**Verify on Nov 13:** the `point` parameter, how geometry and `affectedZones` behave on live data, and the size of the national feed.

## DynamoDB single table `StormSignal`

| Entity | PK | SK | Notes |
|---|---|---|---|
| Current alert | `ALERT#{id}` | `CURRENT` | Normalized alert plus a content hash; `GSI1PK=STATE#{st}` |
| Alert event | `ALERT#{id}` | `EVT#{iso-ts}#{type}` | CREATED/UPDATED/EXPIRED/CANCELLED, with a diff summary |
| Zone geometry | `ZONE#{id}` | `GEOM` | TTL 7 days |
| Ingest run | `RUN#{yyyy-mm-dd}` | `{iso-ts}` | Status, counts and duration (shown as a "data freshness" badge) |

- Everything except current alerts gets a TTL of 30 days.
- `GSI1` (`STATE#xx`, `SK=sent`) answers "events in Michigan, newest first".
- **Dedupe:** the NWS `id` is the key. A content hash suppresses no-op updates. An NWS `references[]` chain links an update to its predecessor.
- **Expiry:** an alert that is no longer in the active feed, or whose `expires`/`ends` time has passed, emits `EXPIRED` once.

## API (HTTP API, all GET, all read-only)

| Route | Returns |
|---|---|
| `/api/alerts?lat=&lon=` | Live NWS active alerts for the point, with geometry resolved (proxied and cached for 60 s) |
| `/api/alerts?state=MI` | Active alerts for a state |
| `/api/alerts/{id}` | One alert, plus plain-English sections |
| `/api/alerts/{id}/timeline` | Recorded events for that alert |
| `/api/timeline?state=MI&since=` | Recent recorded events in a state |
| `/api/status` | Last ingest run and its freshness |
| `/api/demo/{scenario}` | Static simulated scenarios (bundled JSON) |

Every response includes `source: "live" | "simulated"`, and `fetchedAt`. If NWS is down, the API serves the last recorded state with `stale: true`. The UI shows this rather than failing.

## Frontend (React + TypeScript + Vite + Leaflet)

- **Layout:** a map-first design on desktop (a full-height map plus a side panel). On mobile, a bottom sheet with tabs: Alerts · Details · Timeline.
- **Visual direction:** inspired by a "storm-room console" — dark slate with signal colors keyed to NWS severity (Extreme → magenta-red, Severe → orange, Moderate → amber, Minor → teal). It uses a condensed display face (e.g. Barlow Condensed) and monospace timestamps. This is not a generic card dashboard.
- **Plain-English panel:** what is happening, where, when (a countdown to the end time), what it means (the hazard bullets parsed from `description` `HAZARD...`/`IMPACT...`), what to do (the `instruction` text plus a safety card), and a link to the official alert.
- **Timeline:** a vertical rail of CREATED/UPDATED/EXPIRED events, with field-level diffs ("Expires 9:45 → 10:30 PM").
- **Demo mode:** a toggle that shows a persistent striped "SIMULATED — NOT A REAL ALERT" banner, plus watermarked polygons. Scenarios are a Kalamazoo tornado warning, a Lake Michigan lake-effect snow warning, and a Benton Harbor flash flood. Demo data never touches the live table.
- **Accessibility:** keyboard-navigable lists, a text alternative to the map (the list is the primary view), WCAG AA contrast, `prefers-reduced-motion` support, and an ARIA live region for new alerts.

## Repo layout

```
stormsignal/
  frontend/          Vite React TS app (+ Vitest, Testing Library)
  backend/src/       Lambda handlers (TypeScript, esbuild via SAM)
  backend/statemachine/ingest.asl.json
  backend/tests/     Vitest unit tests with recorded NWS fixtures
  template.yaml      AWS SAM
  docs/              PLAN, ARCHITECTURE (diagram), DEPLOY, SUBMISSION draft
  e2e/               Playwright smoke test against local + deployed URL
```

## Cost and security safeguards

- DynamoDB on demand with TTL, and a Lambda memory of 256 MB with timeouts of 10–30 s.
- API reserved concurrency of 10, and HTTP API throttling at 20 rps with a 40 burst.
- CloudWatch log retention of 14 days, and an AWS Budget of $5 with an email alert.
- Each Lambda gets its own least-privilege role: ingest has `PutItem/Query` on the table, and the read API has `GetItem/Query` only.
- The S3 bucket is private with Block Public Access, behind CloudFront OAC. HTTPS is enforced and CloudFront adds security headers.
- No secrets are needed: NWS has no key.

## Testing

- **Unit (backend):** normalize, dedupe, diff, expiry, `null`-geometry fallback, and the NWS error path. Uses recorded real NWS JSON fixtures.
- **Unit (frontend):** severity mapping, plain-English parsing, demo labelling (a "simulated" banner always appears with demo data), and search.
- **Integration:** `sam local invoke` on the ingest steps against the fixtures.
- **E2E:** Playwright searches "Kalamazoo", sees the map and a list (or a "no active alerts" state), opens a demo scenario, and sees the banner and the timeline. It runs locally and against the live URL.

## Weekend schedule (ET)

| When | Milestone | Done when |
|---|---|---|
| Fri AM | Scaffold the repo, SAM template, and Vite app; capture NWS fixtures | `sam build` and `npm test` pass |
| Fri PM | The ingest workflow plus DynamoDB; deploy to AWS (after approval) | A scheduled run writes events and `/api/status` shows freshness |
| Sat AM | Read API, search, map with live polygons | Searching a location shows real alerts on the map |
| Sat PM | Details panel, timeline, demo mode | All three demo scenarios are labelled and work offline from NWS |
| Sun AM | Visual polish, accessibility pass, mobile layout | The Lighthouse a11y score is ≥ 95 and it works at 375 px |
| Sun PM | E2E against live, architecture diagram, screenshots, demo GIF | Playwright is green on the public URL |
| Mon AM | README, DEPLOY.md, Builder Center article draft for review | Keith approves, then submits before 1:00 PM PT |

**Cut line if the schedule slips:** keep live alerts, the map, details, demo mode and the timeline. Drop the field-level diffs, zone-geometry caching (fetch the geometry live instead), and the Lighthouse target.
