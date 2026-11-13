# Manual deployment (no pipeline). Requires: AWS CLI signed in, SAM CLI, Node 22.
# Creates billable resources (CloudFront, Lambda, API Gateway, S3) — run only with explicit approval.
#   .\scripts\deploy.ps1 -UserAgent "StormSignal/0.2 (https://your-site-or-repo, you@example.com)" [-BudgetEmail you@example.com]
param(
  [string]$Stack = "storm-signal",
  [string]$Region = "us-east-1",
  [Parameter(Mandatory = $true)][string]$UserAgent,
  [string]$BudgetEmail = ""
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

# Confirm which account we're about to deploy into (uses the existing SSO profile; no new credentials).
$identity = aws sts get-caller-identity --output json | ConvertFrom-Json
if ($LASTEXITCODE -or -not $identity.Account) { throw "AWS credentials unavailable. Run: aws sso login --profile <your SSO profile>" }
Write-Host "Deploying stack '$Stack' to account $($identity.Account) in $Region as $($identity.Arn)"

npm run build
if ($LASTEXITCODE) { throw "build failed" }

$overrides = @("NwsUserAgent=""$UserAgent""")
if ($BudgetEmail) { $overrides += "BudgetEmail=$BudgetEmail" }
sam deploy --template-file template.yaml --stack-name $Stack --region $Region `
  --capabilities CAPABILITY_IAM --resolve-s3 --no-fail-on-empty-changeset `
  --parameter-overrides $overrides
if ($LASTEXITCODE) { throw "sam deploy failed" }

$outputs = aws cloudformation describe-stacks --stack-name $Stack --region $Region `
  --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
$get = { param($k) ($outputs | Where-Object OutputKey -eq $k).OutputValue }
$bucket = & $get "SiteBucketName"
$dist = & $get "DistributionId"

# Hashed assets cache for a year; index.html is always revalidated.
aws s3 sync dist "s3://$bucket" --delete --exclude index.html --exclude sw.js --cache-control "public,max-age=31536000,immutable"
aws s3 cp dist/index.html "s3://$bucket/index.html" --cache-control "no-cache"
aws s3 cp dist/sw.js "s3://$bucket/sw.js" --cache-control "no-cache" --content-type "text/javascript"
aws cloudfront create-invalidation --distribution-id $dist --paths "/index.html" "/sw.js" | Out-Null

Write-Host "Site: $(& $get 'SiteUrl')"
Write-Host "Verify: $(& $get 'SiteUrl')/api/health"
