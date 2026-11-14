# Storm Signal competition demo: recording master

**Target duration: 2:35, hard cutoff 2:59.** Record the actual deployed application at https://d3p9tcn7282g7r.cloudfront.net. Use an uncluttered 1080p screen recording with voice, no licensed background music and no fake weather presented as live.

**Before recording:** Open the real site at `/#overview` with Kalamazoo selected, source **Live NWS data**. Prepare a second tab with `docs/screenshots/12-architecture-submission.png` and a third tab with GitHub `main`. Avoid showing credentials or private emails. Test the route with Kalamazoo to Grand Rapids before starting so AWS/NWS calls have a warm cache; **click Check route again on camera** to show the actual flow.

| Time | What judges see | Narration (adapt to actual screen data) |
|---|---|---|
| 0:00-0:17 | Live overview. Pause on official data source, the risk level, its evidence and updated timestamp. | "A forecast tells me wind speed and a chance of rain. It doesn't answer the question I care about: should I change my plans? This is Storm Signal, reading real National Weather Service data." |
| 0:17-0:39 | Click the clearly labelled severe-storm simulation. Show the large Simulated label, evidence and forecast drift. | "To show unusual conditions without claiming there's a real storm today, I've switched to a labelled simulation. The level comes from written rules and actual measurements. The history view shows what got worse." |
| 0:39-1:02 | When to go comparison. Show 'now', 3h, 6h and the dial. | "The same forecast now becomes a decision. I can compare leaving now, in three hours, or in six. The app shows why the scores differ, and doesn't claim any time is safe." |
| 1:02-1:32 | Return to Live data, When to go -> Weather along a trip; set destination Grand Rapids, departure 3 hours from now; click Check route; zoom route and show warning panel, arrival-time samples. | "For a trip, Amazon Location calculates the route. The map checks available official warning boundaries along it. Three forecast samples look at when I'll reach each point, not just the weather right now. Missing coverage stays visible." |
| 1:32-1:51 | Storm Prep, then select clearly labelled winter simulation, show checklist and source link. | "Storm Prep turns hazards into actions, with reasons, approximate deadlines and official sources. The checklist works offline. Official urgent warnings take priority over normal suggestions." |
| 1:51-2:14 | Architecture diagram with mouse tracing Browser -> CloudFront/S3 -> API Gateway/Lambda -> NWS, and EventBridge -> Lambda -> DynamoDB/SNS. | "It's all serverless: CloudFront and private S3 serve the site, API Gateway calls Lambda, and EventBridge schedules another Lambda that records changing forecasts in DynamoDB. SNS emails an opt-in subscriber when risk rises. I deploy the stack with AWS SAM, by hand." |
| 2:14-2:29 | GitHub main README, tests and template.yaml. | "The code, documented thresholds, tests and SAM template are public. It's a reusable pattern: external data in, explainable decisions out, and an honest Unknown when sources fail." |
| 2:29-2:35 | Back to real Overview. Hold for final six seconds. | "Storm Signal. Know what changed before you change your plans." |

## Capture and review requirements

- Video is **public and under three minutes**, then pasted into the Builder Center project's **Demo** field.
- Do not imply that simulated severe-weather screens or the synthetic SNS email represent real active warnings.
- Route warnings are active at request time; future-arrival risk is sampled, not a continuous hazard scan.
- If the route is slow or fails while filming, cut and retry the take; keep any failure explanation accurate.
- For the architecture still, use `docs/screenshots/12-architecture-submission.png`. Other evidence images are in `docs/screenshots/`.
- Before upload, watch the **actual exported MP4**, confirm text is legible and duration is below 3:00, and open the published video from a signed-out browser window.
- Final Builder Center post: copy `docs/submission-ready.md` **minus the editor checklist**, upload screenshots, insert the public video in Demo, then verify the posted project URL.
- **Challenge deadline: Monday, November 16, 2026 at 1:00 PM Pacific / 4:00 PM Eastern.** Aim for Sunday rather than the final hour.

## Evidence file locations

- `docs/screenshots/01-overview-live.png`: live NWS overview
- `docs/screenshots/04-prep-sim-winter.png`: visibly simulated winter preparation
- `docs/screenshots/08-drift-sim-thunderstorm.png`: labelled simulation / drift evidence
- `docs/screenshots/10-route-live.png`: live desktop route and forecast checks
- `docs/screenshots/11-route-live-mobile.png`: live mobile route rendering
- `docs/screenshots/12-architecture-submission.png`: up-to-date serverless architecture

**Completed November 14, 2026:** Amazon Polly-narrated, captioned 2:12 video was publicly published and independently verified in a signed-out YouTube browser session: https://youtu.be/tEDXWOmK88M. **Still pending:** hosted article screenshots, Builder Center publication and challenge submission.
