# Storm Signal

A local working weather planner built from the approved storm-window prototype. It combines official NWS hourly forecasts and alerts, start-time comparisons, and a browser-saved household preparation checklist.

## Run locally on Windows

Requires Node.js 22.12 or later and npm. From PowerShell:

```powershell
Set-Location D:\Repos\stormsignal
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. The local API listens only on 127.0.0.1:8787. Vite forwards `/api` requests to it. Stop both with Ctrl+C in the terminal that launched the app. No AWS account, credentials, or paid service is needed for local development.

```powershell
npm test
npm run build
```

`npm run build` type-checks the project, builds the frontend into `dist/`, and bundles the Lambda adapter into `build/handler.mjs`. Tests cover time boundaries, partial failures, warnings overriding comparisons, unknown numeric fields, safe upstream URLs, and API validation.

## Working now

- Live NWS hourly forecasts and active point alerts for six named Southwest Michigan city centers. This is not nationwide search or address-level coverage.
- A date-aware twelve-hour dial with explicit AM/PM labels and two selectable start-time pairs.
- Weather windows derived from actual hourly forecast wording mentioning thunderstorms, snow, freezing precipitation, sleet, or blizzard. These are not exhaustive hazard detection, severe-weather risk scores, or safe-travel recommendations.
- Activity duration and forecast overlap, including unknown coverage and alert failures. Warnings override comparison guidance.
- Full official alert description/instruction text. No active alerts returned is explicitly not an all-clear.
- Three isolated, permanently labeled demo scenarios. Demo data never silently replaces failed live data.
- Household preferences and checked tasks saved in this browser, with reset. No medical details, tracking, account, or server-side user storage.
- Local and Lambda adapters sharing one weather service. Upstream requests have a timeout and size limit, fixed hosts, a short successful-response cache, and coalesced in-flight requests.

## Data, privacy, and limitations

NWS documentation: https://www.weather.gov/documentation/services-web-api

The server sends city-center coordinates to NWS, not a device position. No geolocation permission is requested. The server identifies itself with a descriptive User-Agent; override `NWS_USER_AGENT` with a production application name/contact before deployment.

The frontend does not automatically poll. It shows retrieval time, forecast update time, a Refresh button, and a stale-retrieval notice after ten minutes. Keep official emergency alerts enabled through another channel. Neither the dial nor checklist establishes safety. No numerical probability of damage is calculated.

Forecast and alert failures are reported independently; a failed alerts request never becomes an empty-alert all-clear. Official warnings and local protective instructions override plans. The app is not an emergency warning-delivery service.

## AWS status

**Nothing deployed.** `template.yaml` is a backend-only SAM draft: API Gateway HTTP API and a read-only Lambda function, with throttling, two concurrent executions, and seven-day logs. It does not yet provision frontend hosting, scheduled ingestion, DynamoDB alert history, maps, or billing alarms. The draft has not been validated by SAM or exercised in AWS. Those remain later work, not completed features.

Before deployment, validate the template with SAM, confirm AWS account/region and cost authorization, review the stack, set a real application contact, and prepare private S3/CloudFront frontend hosting. Throttling and budgets do not impose a hard spending cap. No public push, cloud deployment, publication, or submission has been performed.

## Project layout

- `src/`: React interface, dial, demos, and checklist.
- `shared/`: location catalog, types, and timestamp-based planning logic.
- `backend/`: NWS retrieval, local HTTP adapter, and Lambda adapter.
- `tests/`: deterministic service and planning tests.
- `docs/IMPLEMENTATION.md`: approved direction and milestone order.
- `docs/PROGRESS.md`: verified checkpoint and remaining work.

Competition timing: Keith explicitly authorized starting local development November 12 despite ambiguity around pre-event implementation. Do not claim that the organizer has confirmed eligibility.
