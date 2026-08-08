# Deploy Firebase Storage rules using a service account JSON (no firebase login).
#
# Prerequisites (Google Cloud Console → IAM, project dinebuddies):
#   Grant firebase-adminsdk-fbsvc@dinebuddies.iam.gserviceaccount.com:
#     - Cloud Storage for Firebase Admin  (roles/firebasestorage.admin)
#     - Firebase Rules Admin              (roles/firebaserules.admin)
#   Or at minimum: Storage Admin + Firebase Admin on that service account.
#
# Usage:
#   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\dinebuddies-firebase-adminsdk-fbsvc-e9420cacc3.json"
#   .\scripts\deploy-storage-rules.ps1

param(
    [string]$KeyPath = $env:GOOGLE_APPLICATION_CREDENTIALS
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

if (-not $KeyPath -or -not (Test-Path -LiteralPath $KeyPath)) {
    Write-Host ""
    Write-Host "Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON:" -ForegroundColor Red
    Write-Host '  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\dinebuddies-firebase-adminsdk-fbsvc-e9420cacc3.json"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If deploy fails with firebasestorage.defaultBucket.get denied, add IAM roles:" -ForegroundColor Cyan
    Write-Host "  https://console.cloud.google.com/iam-admin/iam?project=dinebuddies" -ForegroundColor Cyan
    Write-Host "  Member: firebase-adminsdk-fbsvc@dinebuddies.iam.gserviceaccount.com" -ForegroundColor Gray
    Write-Host "  Roles:  Cloud Storage for Firebase Admin + Firebase Rules Admin" -ForegroundColor Gray
    exit 1
}

$KeyPath = (Resolve-Path -LiteralPath $KeyPath).Path
$env:GOOGLE_APPLICATION_CREDENTIALS = $KeyPath
$env:GCLOUD_PROJECT = "dinebuddies"
$env:GOOGLE_CLOUD_PROJECT = "dinebuddies"
if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
}

Write-Host "Deploying storage.rules to dinebuddies..." -ForegroundColor Cyan
Write-Host "Service account key: $KeyPath" -ForegroundColor DarkGray

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
firebase logout --non-interactive 2>&1 | Out-Null
$ErrorActionPreference = $prevEap

firebase deploy --only storage --project dinebuddies --non-interactive
$exit = $LASTEXITCODE

if ($exit -ne 0) {
    Write-Host ""
    Write-Host "Deploy failed. Common fixes:" -ForegroundColor Red
    Write-Host "  1. IAM: add 'Cloud Storage for Firebase Admin' + 'Firebase Rules Admin' to the service account" -ForegroundColor Yellow
    Write-Host "  2. Or run firebase login --no-localhost (owner account) and deploy without service account" -ForegroundColor Yellow
    Write-Host "  3. Manual fallback: Firebase Console → Storage → Rules → paste storage.rules → Publish" -ForegroundColor Yellow
    Write-Host "     https://console.firebase.google.com/project/dinebuddies/storage/rules" -ForegroundColor Cyan
    exit $exit
}

Write-Host "Storage rules deployed." -ForegroundColor Green
