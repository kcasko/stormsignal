# Storm Signal Watch (optional SNS email)

Storm Signal Watch sends an **opt-in planning email** when the next saved forecast snapshot for one configured catalog city increases from one known Storm Signal risk level to a higher known level. The snapshot Lambda already runs every 30 minutes.

This is a one-recipient demonstration, **not** a public subscribe form or emergency alert service. No subscriber emails are collected by the website. Email addresses are held in the AWS CloudFormation stack and SNS subscription. Do not use a third party's email without consent.

## Enable

Deploy with the existing manual deployment script and optional parameters (this updates billable AWS resources):

```powershell
.\scripts\deploy.ps1 -UserAgent "StormSignal/0.2 (https://github.com/kcasko/stormsignal, contact@example.com)" -WatchEmail "YOUR_EMAIL@example.com" -WatchLocation "kalamazoo"
```

Replace the contact and recipient addresses. The watch stays **off** when `WatchEmail` is omitted. The chosen city must match an id in `stormsignal.config.json` and be included in the catalog snapshot schedule.

AWS SNS sends a confirmation email. **The recipient must select Confirm subscription** before notifications can arrive. SNS email can unsubscribe at any time using its link. When redeploying, supply the same WatchEmail and WatchLocation to retain the subscription; omitting WatchEmail disables it, removes its managed resources and may require reconfirmation to re-enable it.

## Rules

- Only risk increases trigger email, e.g. Moderate to High.
- The email compares available matching future forecast hours in the previous and current snapshots, reports meaningful increases in wind, thunder chance, snow or ice, and gives the peak/increase time in the city's local time. It never invents missing measurements or claims the change caused the level increase; if reliable evidence is unavailable, it says so.
- Unknown values, first snapshots, unchanged levels, decreases, and different locations do not trigger email.
- An identical forecast issuance is skipped by the existing history logic.
- After a new issuance is saved, a failed SNS publish is logged but does not stop other cities being processed.
- At worst an increase might not email if an invocation stops after saving the snapshot but before delivery; this is deliberately a lightweight demonstration rather than a guaranteed-delivery emergency service.
- This first version does **not** automatically notify every new official warning when the calculated level stays constant.

## Safety and limitations

This watch is not real-time. Scheduler runs every 30 minutes, NWS may update between checks, and email delivery is not guaranteed. Keep official mobile emergency alerts enabled. The message links back to Storm Signal and tells the reader to follow NWS and local authorities. The UI does not currently show a subscription form.

Estimated cost depends on Lambda invocations, SNS publishes and email deliveries. Check AWS pricing and the budget before enabling widely.
