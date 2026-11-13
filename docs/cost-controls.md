# AWS cost controls

Storm Signal uses **two different monthly AWS Budgets**:

- `storm-signal-monthly`: **$10 per month, before promotional credits**, filtered to cost-allocation tag `Project=storm-signal`. It sends actual-spend alerts above $5 and forecast-spend alerts above $10 to the stack's configured `BudgetEmail`. The CloudFormation template owns this budget.
- `ByteGeist Monthly Cost Budget`: **$35 per month, before credits**, covering other AWS projects as well. This budget is managed separately from the Storm Signal stack and must not be deleted or recreated by application deployment. Its original 85%, 100%, and forecasted 100% notifications are retained.

The AWS stack has the user-defined `Project=storm-signal` tag. CloudFormation propagates it to supported resources, including CloudFront, Lambda, API Gateway, DynamoDB, S3, and CloudWatch Logs. The **Project** key is activated under AWS Billing > Cost allocation tags.

**Important:** AWS cost allocation may lag by 24-48 hours, and it is not retroactive by default. A new tag-filtered budget may show $0 until metered tagged usage is processed. Not every service charge is resource-tag-attributable (for example, some data transfer or usage-based services). For any uncertainty, compare the tagged cost view against the account-wide usage-based budget. Neither budget imposes a spending cap or shuts down resources; both are advisory. Promotional credits can expire, may exclude some services and may not cover all charges.

## Deployment safeguards

Use `scripts/deploy.ps1` to preserve the existing budget and weather-watch addresses when updating the stack. The script carries the project tag on every SAM deployment. To update explicitly, pass `-MonthlyBudgetUsd`, `-BudgetEmail`, and `-WatchEmail` as required.

Avoid manually changing the stack-owned `storm-signal-monthly` budget through the AWS console, since a later CloudFormation update may revert the change.
