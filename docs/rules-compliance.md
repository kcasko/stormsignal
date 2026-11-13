# Rules compliance — Weekend Challenge: No Pipeline, No Problem

Source: official Terms and Conditions (last updated Nov 12, 2026), pasted by Keith on Nov 13. Status as of Nov 13, 2026.
Legend: ✅ met · ⏳ not yet (planned) · ⚠️ needs Keith's decision · 👤 only Keith can do.

## Qualification (pass/fail — missing any item means no judging)

| # | Requirement | Status | Evidence / next step |
| --- | --- | --- | --- |
| Q1 | Working project using at least one serverless AWS service | ⏳ | Uses Lambda (×2), API Gateway HTTP API, DynamoDB, EventBridge Scheduler, S3, CloudFront and CloudWatch (`template.yaml`, validated with `sam validate --lint`). It must be **deployed and publicly reachable** to count as "built and shipped". Waiting on Keith's deploy approval. |
| Q2 | No servers or deployment pipelines to manage | ✅ | No EC2, containers or CI/CD. Deployment is one manual `scripts/deploy.ps1` run (`sam deploy` + `aws s3 sync`). |
| Q3 | Written project **published on AWS Builder Center**: the problem, what the build does, and the serverless services used and how they connect | ⏳ 👤 | Draft in `docs/submission.md` covers all four, in labelled sections. Keith publishes from his Builder Center profile after deployment. |
| Q4 | Link to a public video showing the build running end to end, in the submission's **demo** field | ⏳ 👤 | Script in `docs/demo-script.md` (2:45). It must show the **deployed** app with live data. Upload as public to YouTube, Vimeo, Facebook Video or Youku. |
| Q5 | Video under 3 minutes | ⏳ | Scripted for 2:45. Check the final file length before upload. |
| Q6 | Original project, not previously published | ✅ | Original code; no git remote; never deployed or published. Keep the repo private until submission, or publish it only during the window. |
| Q7 | Video contains no third-party trademarks, copyrighted music or other material without permission | ✅ planned | The script avoids other weather apps and brands. Use voice only, or self-made or licensed music. Record in a clean browser profile (no bookmarks bar, extensions or other tabs). AWS console footage is the sponsor's own service. |
| Q8 | Submitted before **Mon Nov 16, 1:00 PM PT (4:00 PM ET)** | ⏳ 👤 | Internal target: noon ET Nov 16. |

## Eligibility 👤 (only Keith can confirm)

- [ ] 18 or older; has a builder.aws.com profile and has registered for the Hackathon
- [ ] Not resident in an excluded country/region
- [ ] Not an employee of Amazon/AWS or its subsidiaries, or an immediate family or household member of one
- [ ] One entry only (individual, or a team of up to 5)
- [ ] Builder Center profile details are accurate. Finalists may be verified against LinkedIn or other public profiles.

## Intellectual property, privacy, representations

| Item | Status | Evidence |
| --- | --- | --- |
| Rights to everything submitted | ✅ | Original code. Census Gazetteer data is public domain. Fonts are SIL OFL 1.1 and their licenses ship in `public/licenses/`. React is MIT. NWS data and NWS/Ready.gov/FHWA guidance are U.S. Government works, paraphrased and linked. See `NOTICE.md`. |
| No implied endorsement or use of agency logos | ✅ | Footer: "Not affiliated with or endorsed by the National Weather Service, NOAA or FEMA." No logos are used. |
| Doesn't cause harm or promote harmful activity | ✅ | Safety-first behaviour: official warnings override everything; missing data shows as Unknown, never Low; never says "safe"; disclaimers on every page. |
| User privacy | ✅ | No accounts, no tracking. "Use my location" is opt-in and rounded to about 1 km in the browser. Search text is never logged or stored; custom points are logged only as `point`. Only street addresses go to the U.S. Census Geocoder. Checklist state stays in `localStorage`. Forecast history stores NWS data for listed cities only. |
| Repo license | ⚠️ | No `LICENSE` file yet. If the repo goes public, Keith picks one (`docs/PLAN.md` suggested MIT). This helps "how easily others could reuse the pattern". |

## Judging alignment (each 25%; Gate 1 is AI + human, Gate 2 is human)

| Criterion | How the entry addresses it |
| --- | --- |
| Technical innovation and originality | Evidence-returning deterministic rule engine shared by Lambda and the browser; "what would change the level" counterfactuals; forecast-drift tracking (EventBridge Scheduler → Lambda → DynamoDB TTL) on an API that only serves the latest forecast; activity-specific What If? with your own time; Unknown-not-Low handling. |
| Craft and execution (fit of services, **reliability**) | CloudFront fronting both S3 and the API (one origin); throttling and reserved concurrency; independent failure handling per NWS source; 45 unit/integration tests plus browser smoke tests. ⏳ Run a post-deploy smoke test against the public URL. |
| Usefulness and impact (**reuse of the pattern**) | Works for any U.S. place; share links; calendar reminders; offline plan. "Reuse the pattern" section in the article; rules published at `/api/rules`. ⚠️ A public repo with a license and `template.yaml` makes reuse concrete. |
| Creativity and storytelling | Problem → Overview → What If? → Storm Prep → architecture, in both article and video; the "one storm, different decisions" theme. |
