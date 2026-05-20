# Deploy image moderation (Functions + Storage rules) without "firebase login".
# Requires a Google Cloud service account JSON key — see instructions in repo or ask your admin.
#
# Usage:
#   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\dinebuddies-deploy.json"
#   .\scripts\deploy-image-moderation.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$KeyPath = $env:GOOGLE_APPLICATION_CREDENTIALS

if (-not $KeyPath -or -not (Test-Path -LiteralPath $KeyPath)) {
    Write-Host ""
    Write-Host "GOOGLE_APPLICATION_CREDENTIALS is not set or file not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "1. Open: https://console.cloud.google.com/iam-admin/serviceaccounts?project=dinebuddies"
    Write-Host "2. Create service account (or pick existing) with roles:"
    Write-Host "   - Firebase Admin"
    Write-Host "   - Cloud Functions Admin"
    Write-Host "   - Storage Admin"
    Write-Host "3. Keys -> Add key -> JSON -> save outside this repo"
    Write-Host "4. Run:"
    Write-Host '   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\key.json"' -ForegroundColor Yellow
    Write-Host "   .\scripts\deploy-image-moderation.ps1"
    Write-Host ""
    exit 1
}

Set-Location $ProjectRoot

Write-Host "Installing functions dependencies..." -ForegroundColor Cyan
Push-Location "$ProjectRoot\functions"
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

Write-Host "Deploying (project: dinebuddies)..." -ForegroundColor Cyan
# moderateImage first; storage trigger may need Eventarc — retry enforceApprovedImageUpload if deploy fails
firebase deploy `
    --only "functions:moderateImage,storage" `
    --project dinebuddies `
    --non-interactive

if ($LASTEXITCODE -eq 0) {
    firebase deploy `
        --only "functions:enforceApprovedImageUpload" `
        --project dinebuddies `
        --non-interactive
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deploy finished successfully." -ForegroundColor Green
} else {
    Write-Host "Deploy failed. Enable Cloud Vision API:" -ForegroundColor Yellow
    Write-Host "https://console.cloud.google.com/apis/library/vision.googleapis.com?project=dinebuddies"
}

exit $LASTEXITCODE
