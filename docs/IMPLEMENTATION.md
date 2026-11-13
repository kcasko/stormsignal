# StormSignal implementation handoff

Prepared November 12, 2026. Local development was authorized and started November 12. See PROGRESS.md for implemented behavior and validation. No cloud resources, public repository, deployment, or submission exists.

## Approved interface

The approved design is the interactive prototype at:

`C:\Users\keith\Documents\Codex\2026-11-12\referenced-chatgpt-conversation-this-is-an-3\outputs\storm-signal-prototype.html`

Preserve its storm-window dial, explicit PM hour labels, A/B start-time markers on the rim, contrasting household preparation rail, and preparation timeline. Do not restore instrument needles, generic slogan heroes, or repeated dashboard cards. Use the supplied discovery galleries to find actual live references when further design work is necessary; do not copy gallery previews as finished product designs.

The prototype is fictional. Its sample 5–9 PM window must never be presented as a live forecast. The application must derive any live window from the selected location's actual, timestamped forecast or alert interval, and explain the basis of that interval. A date and local timezone are required, including when an interval crosses midnight. A 12-hour ring must not imply that different dates or AM/PM periods are interchangeable. Retain a readable text alternative.

## First working milestone

Build one local, end-to-end slice before adding scheduled ingestion or historical storage:

1. React + TypeScript frontend retaining the approved design and responsive behavior.
2. A read-only weather API handler usable locally and in AWS Lambda. Retrieve the NWS point metadata, hourly forecast, and active alerts for an explicitly selected location.
3. Start with a documented Southwest Michigan location catalog, including Kalamazoo, Grand Rapids, Battle Creek, and nearby locations. Label its scope accurately. Nationwide city/ZIP search is a later milestone, not an implemented promise.
4. Display separate live, loading, unavailable, and simulated states. Demo data must never silently replace a failed live request. Show retrieval and forecast update times; mark stale data visibly. Never equate an empty alerts response with safety.
5. Compare activity intervals against forecast/alert intervals using real dates. Show forecast evidence, unknown values, and uncertainty. No numerical safety score or safe-departure recommendation. Warnings and official protective instructions take precedence.
6. Hazard-aware household checklist with pets and powered-medical-equipment options. Persist ordinary preparation preferences locally only, with reset and clear persistence behavior. Do not store private medical details.
7. Preparation timeline with source links and conditions on outdoor tasks. It must never encourage waiting to take protective action or treating an expired forecast interval as an all-clear.

## API shape

`GET /api/weather?location=<catalog-id>` returns a validated location, `source: live`, `fetchedAt`, `forecastUpdatedAt`, normalized hourly periods, active alerts including original instruction text and source links, and any component-level availability errors. It must not claim successful alerts retrieval when only the forecast succeeded.

`GET /api/health` reports application health without AWS credentials.

Use one request schema and normalization layer for the local adapter and Lambda adapter. Allowlist NWS upstream hosts/paths, use descriptive User-Agent headers, bound request time and payload size, and honor cache/retry guidance. Render official text as text, never HTML. Avoid exposing arbitrary upstream URLs through the API.

Demo scenarios are separate, explicitly labeled frontend fixtures. They should exercise thunderstorm planning, an urgent tornado warning, winter conditions, and unavailable data. A tornado warning must prioritize immediate shelter instructions over comparisons.

## Serverless delivery, after local verification

First deployment target: API Gateway HTTP API → Lambda for read-only weather retrieval; private S3 → CloudFront for the frontend. Region/account and permission to incur charges must be confirmed before deployment. No automatic deployment pipeline.

Add DynamoDB and scheduled EventBridge ingestion only after the live slice works and the historical-alert requirements have been reviewed. An on-demand snapshot is not a historical event log. Do not report that a missing alert was cancelled merely because a poll failed. Step Functions is optional; do not add services merely to decorate the architecture diagram.

Prepare infrastructure as code locally for review, including throttling, bounded logs, least-privilege permissions, HTTPS, cache rules, and teardown instructions. Cost controls reduce exposure but are not hard billing caps. No credentials belong in the repository or frontend bundle.

## Verification gates

- Type checking and production build.
- Deterministic tests for midnight/timezone boundaries, activity overlap, missing forecast values, warnings overriding comparison, malformed upstream data, timeout/partial failure, freshness, and demo/live isolation.
- Local browser checks for location changes, request races, complete official-alert text, checklist persistence/reset, keyboard controls, and mobile layouts.
- Real NWS retrieval check with exact data source and observed outcome recorded. Passing fixture tests does not establish upstream connectivity.
- Infrastructure validation before any authorized deployment. Public URL validation after deployment, with no assumption that local success proves AWS readiness.

## Competition rules verified November 12

Source: https://builder.aws.com/build/hackathons/65918542-15dd-3a71-95ac-76af95da8774/weekend-challenge-no-pipeline-no-problem (Rules tab; updated November 12, 2026).

- Window: November 13 at 12:00 AM Pacific through November 16 at 1:00 PM Pacific, corresponding to 3:00 AM Friday through 4:00 PM Monday Eastern.
- The rules frame building and shipping within that period. They do not explicitly resolve whether pre-event implementation is permitted. Keith explicitly chose “Start coding now” on November 12 after the uncertainty was explained. This is user authorization to develop locally, not organizer confirmation of eligibility.
- Original, previously unpublished project; at least one serverless AWS service; no servers or deployment pipelines to manage.
- Publish a written Builder Center project explaining the problem, behavior, services, and connections.
- Include a public end-to-end video under three minutes in the submission's demo field. Accepted hosts include YouTube, Vimeo, Facebook Video, and Youku.
- Four equally weighted judging criteria: innovation/originality, craft/execution, usefulness/impact, creativity/storytelling.
- Eligibility includes age 18+, a Builder Center profile, country exclusions, and Amazon employee/household exclusions. Submission is one entry per person/team; teams may contain up to five people. Personal eligibility has not been independently verified.

Nothing has been published, submitted, or deployed. The earlier PLAN.md is preserved as the original proposal; this handoff records the approved interface and revised incremental implementation order.
