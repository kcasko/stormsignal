# Run Storm Signal for your own area

Storm Signal is MIT-licensed and needs no API keys: the National Weather Service and U.S. Census data it uses are free and public. A school district, county emergency office, race organiser or club can run its own copy in about 10 minutes, on a small AWS bill.

## 1. Pick your cities (one file)

Fork the repo and edit **`stormsignal.config.json`**. That is the only file you need to change.

```json
{
  "cities": [
    { "id": "boulder", "name": "Boulder, CO", "latitude": 40.015, "longitude": -105.271, "timeZone": "America/Denver" },
    { "id": "longmont", "name": "Longmont, CO", "latitude": 40.167, "longitude": -105.102, "timeZone": "America/Denver" }
  ]
}
```

- The **first city is the default** when someone opens the app.
- Every listed city gets **forecast and alert history** saved every 30 minutes (the drift panel and "alerts that ended"). Up to 25 cities.
- Anyone can still search **any U.S. ZIP, city or address**; the list only decides the default and which places keep history.
- `id`: lowercase letters, digits and dashes. `timeZone`: an IANA name such as `America/Chicago`. NWS covers U.S. locations only.

`npm test` checks the file and tells you exactly what's wrong (for example *"city 2: unknown timeZone"*).

## 2. Deploy

You need an AWS account, the AWS CLI signed in, AWS SAM CLI and Node 22.

**Windows (PowerShell):**

```powershell
npm ci
.\scripts\deploy.ps1 -UserAgent "MyTownStorm/1.0 (https://my-site.example)" -BudgetEmail you@example.com
```

**macOS / Linux:**

```bash
npm ci && npm run build
sam deploy --stack-name storm-signal --region us-east-1 --resolve-s3 --capabilities CAPABILITY_IAM \
  --parameter-overrides NwsUserAgent="MyTownStorm/1.0 (https://my-site.example)" BudgetEmail=you@example.com
BUCKET=$(aws cloudformation describe-stacks --stack-name storm-signal --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue" --output text)
DIST=$(aws cloudformation describe-stacks --stack-name storm-signal --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
aws s3 sync dist "s3://$BUCKET" --delete --exclude index.html --exclude sw.js
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control no-cache
aws s3 cp dist/sw.js "s3://$BUCKET/sw.js" --cache-control no-cache
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*"
```

- **`UserAgent` is required by NWS.** Put a website or contact in it so NWS can reach you if your app misbehaves.
- **`BudgetEmail` is optional** but recommended: AWS emails you at 50% of a monthly budget (default $5) and when the forecast passes 100%.
- The site URL is printed at the end (`SiteUrl`). One stack, no servers, no pipeline. Remove everything with `sam delete --stack-name storm-signal`.

**What it costs:** at small scale this is pennies to a few dollars a month. The scheduled snapshot runs 48 times a day; DynamoDB is on-demand with a 72-hour TTL, so storage never grows; the API is throttled at 5 requests/second; badges are cached at the CloudFront edge.

## 3. Put a live badge on your website

Every place has a badge that shows its current Storm Signal level and links back to the full explanation. In the app, open **Overview → "Put a live badge … on your website"** and copy the HTML, or build it yourself:

```html
<a href="https://YOUR-SITE/#overview?loc=boulder">
  <img src="https://YOUR-SITE/api/badge?loc=boulder" alt="Storm Signal weather risk level for Boulder, CO" height="28">
</a>
```

`loc` can be a listed city id, a 5-digit ZIP (`loc=80302`) or a point (`loc=pt:40.015,-105.271`). The badge is a plain SVG (no script, no tracking), refreshes about every 10 minutes and never claims to be an official NWS rating.

## 4. Change the thresholds (optional)

The rules are plain TypeScript tables, shared by the Lambda and the browser:

| What | Where |
| --- | --- |
| Overview levels (gusts, wind, thunder, snow, ice, heat, cold) | `OVERVIEW_RULES` in `shared/riskEngine.ts` |
| Activity rules for When to go (driving, outdoor event, home) | `ACTIVITIES` in `shared/impactEngine.ts` |
| Preparation tasks and their sources | `TASKS`, `DURING`, `AFTER` in `shared/preparationEngine.ts` |
| How official alerts set a minimum level | `alertLevel` in `shared/rules.ts` |

Change a number, run `npm test` (the tests show which explanations changed), and redeploy. `/api/rules` publishes the live thresholds as JSON, so your users can always see what your copy uses.

## 5. Reuse the pattern for other public data

Nothing above is weather-specific except the NWS client and the rule tables. The same stack fits any "public data → explained decision" app: air quality, river levels, transit delays, wildfire smoke, pollen.

1. **CloudFront in front of a private S3 site and an HTTP API** (`/api/*`): one HTTPS origin, no CORS, no keys in the browser.
2. **One Lambda as a careful upstream client:** allow-listed URLs, timeouts, payload caps, per-source failure handling, in-memory caching and request coalescing (`backend/weather.ts`).
3. **A deterministic rule engine that returns evidence** (value, threshold, time window) instead of a bare score, where missing data is "Unknown", never the safest answer (`shared/rules.ts`).
4. **EventBridge Scheduler → Lambda → DynamoDB with TTL** turns a "latest only" API into a history you can reason about (`backend/history.ts`).
5. **An edge-cached SVG badge** (`backend/badge.ts` plus a CloudFront cache policy keyed on `loc`) lets other sites embed your result at almost no cost.
6. **One `template.yaml`:** throttling, least-privilege roles, log retention, an error alarm and an optional budget.

Swap `backend/weather.ts` and the rule tables, and the rest carries over.
