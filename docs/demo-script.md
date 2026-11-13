# Demo video script (target 2:40, hard limit under 3:00)

Record the **deployed** site: https://d3p9tcn7282g7r.cloudfront.net. The voice-over is about 370 words, roughly 2:40 at a calm pace, which leaves 20 seconds of slack. Every number below is exactly what the app shows; if you say something different from the screen, judges notice.

## Shot list and voice-over

| Time | Screen | Voice-over |
| --- | --- | --- |
| 0:00–0:12 | **Title card** (dark background, white text): *"40% chance of thunderstorms · gusts to 45 mph"*. Fade to *"Storm Signal"*. | "A forecast tells you what the weather will do. It doesn't tell you whether to leave now or wait, cancel the party, or what to do before it hits. Storm Signal does." |
| 0:12–0:30 | **Overview, live data**, Kalamazoo. Move the cursor over: the purpose line → the level word and its five-step scale → the "Next 24 hours" numbers on the right. | "This is live National Weather Service data for any U.S. place. Up top, one answer: a five-step rating for the next twenty-four hours, the reason, and the numbers behind it. It's quiet today, so let's see it during a storm." |
| 0:30–1:00 | Click **"Quiet weather here. See it during a storm →"**. Pause on the purple *Simulated* banner. Point at **High**, then the **hour-by-hour** bar (red at 5–7 PM). Open **"Why this level and what could change it"** to show *"Would be Elevated if this changed: wind gusts stayed below 58 mph"*. Move to the **Severe Thunderstorm Watch** card: map (*"Kalamazoo, MI is inside"*), then its *Issued / Updated* timeline. Scroll to **How the forecast has changed**: *Trending worse, 33 → 60 mph*. | "This storm is a labelled simulation. It's High because gusts reach sixty miles an hour between five and seven, and it tells you exactly what would bring it down. Official alerts stay separate and unchanged, with the area they cover and when they were issued and updated. And because a Lambda saves every forecast, you can see this one has been trending worse all day." |
| 1:00–1:30 | Click **"Compare when to go →"**. Point at the bold answer: *"Lowest of these: A, leave now and C, leave in 6 hours (Elevated). Highest: B, leave in 3 hours (High)."* Point at **B** on the dial at 5 PM. Under step 3 pick **7 PM** and **:30**: option **D** appears (*Elevated*). Switch the source dropdown to **Simulated: Winter storm, snow and ice**: the answer flips to *"Lowest of these: A, leave now (Low)."* Click **Share this view**. | "When to go answers first: leaving now is Elevated, in three hours is High, right as the gusts peak. Pick your own time, seven-thirty, and it rates that too. It never calls any time safe. In a winter storm the answer flips: leave now, before the warning starts. And one link shares this exact comparison with your family." |
| 1:30–1:52 | **Storm Prep** (winter scenario still on). Toggle **My vehicle**; tick one task; point at its reason, deadline and source link. Switch the source to **Simulated: Tornado warning in effect**: the full-width warning banner appears and **During** moves first; routine tasks are paused. | "Storm Prep turns the hazards into a checklist, with a reason, a deadline and an official source for every task, and it still opens offline when the power's out. When a tornado warning is in effect, the checklist steps aside and the official instruction comes first." |
| 1:52–2:08 | Browser tab: **github.com/kcasko/stormsignal** README, where the **live badge** renders. Then open **`stormsignal.config.json`**, then **docs/reuse.md**. | "Anyone can reuse it. One line of HTML puts a live badge on a school or event website, cached at the CloudFront edge. To run it for your own town, you edit one file and deploy." |
| 2:08–2:38 | **Architecture diagram** (`docs/screenshots/00-architecture.png`, full screen) for about 12 s. Then **CloudWatch Logs Insights** results (about 8 s), then **DynamoDB → Explore items** (about 8 s). See the console steps below. | "It's fully serverless. CloudFront serves the app from a private S3 bucket and routes the API to a Lambda that reads five National Weather Service endpoints and runs a deterministic rule engine, with no AI guessing at safety advice. EventBridge Scheduler runs a second Lambda every thirty minutes that saves forecast and alert history to DynamoDB with a seventy-two-hour TTL. One SAM template, deployed by hand. No servers, no pipeline." |
| 2:38–2:48 | Back to the **Overview, live data**. Hold still. | "Storm Signal. Know the threat, see when it hits, and prepare before it does." |

If you run long, cut in this order: the *Share this view* click, the GitHub config file (keep the README badge), the DynamoDB shot.

## Before recording (10 minutes)

1. **Use a clean browser window** with no bookmarks bar, extensions or other tabs:
   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="$env:TEMP\stormsignal-demo" --window-size=1600,1000 https://d3p9tcn7282g7r.cloudfront.net
   ```
   Set page zoom to 110% so text is readable on YouTube.
2. **Reset the app state:** Overview with **Live NWS data** and Kalamazoo selected; Storm Prep tasks unticked (Storm Prep → *Reset*).
3. **Open these tabs in advance**, in order: the app; the architecture PNG; CloudWatch Logs Insights with the query already run; DynamoDB *Explore items* on the history table; the GitHub repo.
4. **Make a few live requests first** (open Overview, When to go and Storm Prep once) so CloudWatch has fresh log lines.
5. **Silence notifications** (Windows: Do not disturb).

If the live weather is stormy when you record, even better: skip the "See it during a storm" click and use the real data, keeping the same order of shots.

## Console steps for the architecture shots (us-east-1)

**CloudWatch Logs Insights:** CloudWatch → Logs Insights → log group **`/aws/lambda/storm-signal-weather`**, last 1 hour:

```
fields @timestamp, location, level, ms, alerts
| filter msg = "weather"
| sort @timestamp desc
| limit 20
```

Each row is one request: the place (custom searches show only as `point`), the resulting level and the latency. No personal data is logged.

**DynamoDB:** DynamoDB → Tables → the table whose name starts with **`storm-signal-HistoryTable`** → *Explore table items*. Each item is one saved forecast for one city (`pk` = city, `sk` = time saved), with a `ttl` that deletes it after 72 hours.

## Recording and editing (Windows, free tools)

- **Record:** Xbox Game Bar (**Win + Alt + R** starts and stops recording the active window) or OBS Studio. Record each row of the table as its own clip; that makes retakes easy.
- **Voice:** record the voice-over separately and read it at a calm pace, or talk while recording. A headset mic in a quiet room is fine.
- **Edit:** Clipchamp (built into Windows 11): drop the clips in order, add the title card as a text slide and lay the voice-over underneath. **No music** unless you made it or hold a license; voice only is safest.
- **Check the length:** it must be **under 3:00**. Export at 1080p.

## Rules for the video (from the official terms)

- Under 3:00, uploaded **public** (not unlisted or private) to YouTube, Vimeo, Facebook Video or Youku, and linked in the submission's demo field.
- Shows the project running end to end. Simulated scenarios are fine because they are visibly labelled on screen; the last shot returns to live data.
- No third-party trademarks or logos beyond the credited data sources (weather.gov appears only as the cited source), no other weather apps, no copyrighted music.

## Upload details (suggested)

- **Title:** Storm Signal — weather forecasts turned into decisions (serverless on AWS)
- **Description:**
  > Storm Signal turns National Weather Service forecasts into decisions: how risky the next 24 hours are, when it's safer to go, and what to do before it hits. Built for the AWS Builder Center Weekend Challenge "No Pipeline, No Problem": CloudFront, S3, API Gateway, Lambda, EventBridge Scheduler and DynamoDB in one SAM template, deployed by hand.
  >
  > Live app: https://d3p9tcn7282g7r.cloudfront.net
  > Code (MIT): https://github.com/kcasko/stormsignal
  >
  > Storm Signal is a planning aid, not a warning service. Simulated scenarios in this video are labelled and fictional. Not affiliated with NWS, NOAA or FEMA.
