# Storm Signal live test

Tested November 12, 2026, approximately 9:39–9:42 PM Eastern, against the local running app at http://127.0.0.1:5173/ and its API at http://127.0.0.1:8787/.

## Result

Local live-data checks passed. One calendar-date clarity issue was found and fixed: activities crossing midnight now show the following date next to the finish time. This is not an AWS/deployed-system readiness result.

## Actual NWS checks

- Health endpoint returned `ok`.
- Kalamazoo returned live NWS data with forecast and alerts both available: 156 hourly forecast periods and zero active alerts returned at retrieval time. This is not an all-clear.
- Retrieval timestamp: `2026-11-13T02:39:54.731Z` (November 12 at 9:39 PM Eastern).
- Forecast update timestamp: `2026-11-12T21:03:26-05:00`.
- Live browser weather showed 39°F, wind 10 mph, a 30% precipitation chance, and Chance Rain Showers at the observed period. The dial flagged a later rain/snow window using the retrieved wording; these are observations at test time, not a current forecast recommendation.
- Grand Rapids and Battle Creek location changes retrieved their own point forecasts and used the correct official point-forecast links.

## Browser and controlled failure checks

- Start-time controls updated the dial and comparison times.
- Switching from a 45-minute errand to a 30-minute walk updated activity finish times.
- Pets, powered-medical-equipment preference, and a checked task survived reload. Reset cleared them.
- Simulated tornado warning remained labeled as simulated and prioritized shelter instructions above planning. Both comparisons deferred to the warning.
- Controlled HTTP 503 produced unavailable weather and unknown alert status, without injecting simulated data. Refresh recovered to actual NWS data.
- A deliberately delayed Grand Rapids request followed by Battle Creek kept Battle Creek selected and used its forecast link. The test harness was corrected to await route cleanup; the final race check completed successfully.
- Keyboard Enter operated the comparison button.
- No horizontal overflow at 360, 390, 768, 1024, or 1440 pixels.
- No application JavaScript exceptions in the initial full browser pass. Expected HTTP errors appeared during the controlled 503 check.
- Midnight fix verified in browser: November 12 at 11:41 PM plus 45 minutes displayed “Finishes Nov 13 12:26 AM”.

## Regression checks

21 deterministic tests and the production build passed after the fix. A regression test covers both same-day and midnight-crossing finish labels.

## Limits

No actual active warning was encountered in the live locations tested; urgent-warning behavior was exercised with explicitly simulated data. No physical device, screen reader, AWS infrastructure, public deployment, maps, or historical ingest was tested. Live NWS responses may change after this report.
