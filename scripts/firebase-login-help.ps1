# Run when browser shows "Firebase CLI Login Failed" or:
#   Failed to make request to https://auth.firebase.tools/attest
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "=== Network check ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "https://auth.firebase.tools" -Method Head -TimeoutSec 15 -UseBasicParsing
    Write-Host "auth.firebase.tools reachable (status $($r.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "Cannot reach auth.firebase.tools from this PC/network." -ForegroundColor Red
    Write-Host "Try: mobile hotspot, disable VPN/proxy, or use service account deploy (see below)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Firebase login (no browser redirect) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Clear old session"
firebase logout 2>$null

Write-Host ""
Write-Host "Step 2: Login with manual code (recommended on Windows)"
Write-Host "  - A URL will appear below"
Write-Host "  - Open it in Chrome or Edge (full browser, NOT inside Cursor)"
Write-Host "  - Sign in with the Google account that owns project 'dinebuddies'"
Write-Host "  - Copy the authorization code and paste it here"
Write-Host ""

firebase login --no-localhost

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK. Verify:" -ForegroundColor Green
    firebase projects:list --project dinebuddies
} else {
    Write-Host ""
    Write-Host ""
    Write-Host "=== Deploy WITHOUT firebase login (recommended if attest fails) ===" -ForegroundColor Yellow
    Write-Host "1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=dinebuddies"
    Write-Host "2. Create key (JSON) with roles: Firebase Admin, Cloud Functions Admin, Firebase Hosting Admin"
    Write-Host '3. $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\key.json"'
    Write-Host "4. .\scripts\deploy-firebase.ps1"
    Write-Host ""
    Write-Host "Corporate proxy? Ask IT for CA cert, then:"
    Write-Host '  $env:NODE_EXTRA_CA_CERTS = "C:\path\to\corp-ca.pem"'
}
