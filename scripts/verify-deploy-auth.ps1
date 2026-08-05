# Verify deploy auth WITHOUT firebase login (service account JSON).
# Usage:
#   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\dinebuddies-deploy.json"
#   .\scripts\verify-deploy-auth.ps1

$ErrorActionPreference = "Stop"
$KeyPath = $env:GOOGLE_APPLICATION_CREDENTIALS

if (-not $KeyPath -or -not (Test-Path -LiteralPath $KeyPath)) {
    Write-Host ""
    Write-Host "Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON file." -ForegroundColor Red
    Write-Host '  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\dinebuddies-deploy.json"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Create key: https://console.cloud.google.com/iam-admin/serviceaccounts?project=dinebuddies" -ForegroundColor Cyan
    exit 1
}

$KeyPath = (Resolve-Path -LiteralPath $KeyPath).Path
$env:GOOGLE_APPLICATION_CREDENTIALS = $KeyPath

Write-Host "Key file: $KeyPath" -ForegroundColor Cyan
Write-Host "Testing Google auth (no firebase login)..." -ForegroundColor Cyan

# Windows / corporate proxy: Node may not trust system CAs without this (Node 20.6+).
if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
}

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$FunctionsDir = Join-Path $ProjectRoot "functions"
$TestJs = Join-Path $FunctionsDir "_verify-gcp-auth-temp.cjs"

@'
const path = require('path');
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('FAIL: GOOGLE_APPLICATION_CREDENTIALS not set');
  process.exit(1);
}
let GoogleAuth;
try {
  GoogleAuth = require('google-auth-library').GoogleAuth;
} catch (e) {
  console.error('FAIL: install functions deps first: cd functions && npm install');
  process.exit(1);
}
const scopes = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/firebase',
];
(async () => {
  const auth = new GoogleAuth({ keyFile: keyPath, scopes });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const t = token && (token.token || token);
  if (!t || !String(t).length) {
    console.error('FAIL: No access token - check Firebase Admin role on project dinebuddies.');
    process.exit(1);
  }
  console.log('OK: service account can obtain access token.');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
'@ | Set-Content -Path $TestJs -Encoding UTF8

Push-Location $FunctionsDir
try {
    if (-not (Test-Path "node_modules\google-auth-library")) {
        Write-Host "Installing functions dependencies..." -ForegroundColor Cyan
        npm install
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    node "_verify-gcp-auth-temp.cjs"
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "SSL/certificate error? Try in this PowerShell session:" -ForegroundColor Yellow
        Write-Host '  $env:NODE_OPTIONS = "--use-system-ca"' -ForegroundColor Gray
        Write-Host "  .\scripts\verify-deploy-auth.ps1"
        Write-Host ""
        Write-Host "If on company network/VPN, ask IT for the proxy CA .pem and set:" -ForegroundColor Yellow
        Write-Host '  $env:NODE_EXTRA_CA_CERTS = "C:\path\to\corp-root-ca.pem"' -ForegroundColor Gray
        Write-Host ""
        Write-Host "Last resort (deploy only, same session):" -ForegroundColor Yellow
        Write-Host '  $env:NODE_TLS_REJECT_UNAUTHORIZED = "1"' -ForegroundColor Gray
        Write-Host '  (disables TLS verify - trusted network only)'
        exit 1
    }
} finally {
    Pop-Location
    Remove-Item -LiteralPath $TestJs -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Deploy with:" -ForegroundColor Green
Write-Host "  .\scripts\deploy-firebase.ps1 -FunctionsOnly" -ForegroundColor Yellow
