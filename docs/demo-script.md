# Demo video script (target 2:45, hard limit under 3:00)

Record the **deployed** site. Any simulated scenario stays visibly labelled on screen.

| Time | Screen | Voice-over |
| --- | --- | --- |
| 0:00–0:20 | Title card, then plain text on a dark slide: "40% chance of thunderstorms · gusts to 45 mph". (No screenshots of other weather apps or brands.) | "A forecast tells you what the weather will do. It doesn't tell you whether to leave now or wait, cancel the party, or bring in the patio furniture. Storm Signal turns National Weather Service data into those decisions." |
| 0:20–0:50 | Overview, live data, pick a city. Point to the level, "Why this level", the official alerts column, the hourly gusts row, and the retrieval time. | "This is live NWS data for [city]. Storm Signal gives a level from Low to Critical, and every level shows its evidence: the value, the threshold, and the hours. Official NWS alerts stay in their own column with NWS's own severity. And if any data is missing, the level says Unknown, never Low." |
| 0:50–1:30 | Switch source to "Simulated: Severe thunderstorms + wind" (banner visible). What If? → Driving: A/B/C. Read the differences line. Switch to Outdoor event: the ratings jump. | "Here's a labelled simulated storm, so you can see the dangerous case. Driving: leaving now is Elevated, in three hours High, as 60 mph gusts arrive. Storm Signal explains why and never calls a time 'safe'. Same storm, outdoor event: lightning exposure pushes every option higher. One storm, different decisions, different consequences." |
| 1:30–2:05 | Storm Prep: toggle Home/Vehicle. Check two tasks. Show reason, timing ("Before about Fri 5:00 PM…") and source link. Scroll to During/After. Then switch to the tornado scenario: banner, During first, tasks dimmed. | "Storm Prep builds the checklist from the hazards in the forecast. Every task has a reason, a deadline from the forecast, and a source from NWS or Ready.gov. Progress is saved in your browser only. When a tornado warning is in effect, the checklist steps aside and the official instruction comes first." |
| 2:05–2:35 | Architecture diagram from `docs/architecture.md`, then CloudWatch Logs Insights showing the JSON log lines. | "It's fully serverless. CloudFront serves the React app from a private S3 bucket and routes /api to an HTTP API and one Lambda function. The Lambda calls five NWS endpoints, normalizes them, and runs a deterministic rule engine. No AI guesses at safety advice. It's throttled and has a capped concurrency of three, deployed by hand with SAM. No servers, no pipeline." |
| 2:35–2:45 | Back to Overview, live. | "Storm Signal. Know the threat, understand the impact, prepare before it hits." |

Rules for the video (from the official terms): under 3:00; public on YouTube, Vimeo, Facebook Video or Youku; no third-party trademarks and no copyrighted music unless licensed. Use voice only, or music you created or properly licensed. Weather.gov pages may appear only as the cited data source.

Before recording: switch back to Live NWS data at the end so the last frame isn't simulated, and close any other tabs.
