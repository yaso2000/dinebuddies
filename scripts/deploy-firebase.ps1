# Deploy Firebase Functions + Hosting (PowerShell).
#
# After verify OK, run (keep same PowerShell session):
#   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\dinebuddies-deploy.json"
#   $env:NODE_OPTIONS = "--use-system-ca"
#   $env:NODE_TLS_REJECT_UNAUTHORIZED = "1"
#   .\scripts\deploy-firebase.ps1 -FunctionsOnly -SkipVerify

param(
    [switch]$FunctionsOnly,
    [switch]$SkipVerify,
    [string]$Only = ''
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
}

$KeyPath = if ($env:GOOGLE_APPLICATION_CREDENTIALS) { $env:GOOGLE_APPLICATION_CREDENTIALS.Trim() } else { '' }
$UsingServiceAccount = $KeyPath -and (Test-Path -LiteralPath $KeyPath)

if ($KeyPath -and -not $UsingServiceAccount) {
    Write-Host ""
    Write-Host "GOOGLE_APPLICATION_CREDENTIALS is set but the file was not found:" -ForegroundColor Red
    Write-Host "  $KeyPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Create a JSON key in Google Cloud Console, then set the real path:" -ForegroundColor Yellow
    Write-Host '  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\dinebuddies-deploy.json"' -ForegroundColor Cyan
    Write-Host "  https://console.cloud.google.com/iam-admin/serviceaccounts?project=dinebuddies" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

if ($UsingServiceAccount) {
    $KeyPath = (Resolve-Path -LiteralPath $KeyPath).Path
    $env:GOOGLE_APPLICATION_CREDENTIALS = $KeyPath
    $env:GCLOUD_PROJECT = "dinebuddies"
    $env:GOOGLE_CLOUD_PROJECT = "dinebuddies"
    Write-Host "Using service account: $KeyPath" -ForegroundColor Cyan

    Write-Host "Clearing expired Firebase CLI user session..." -ForegroundColor Cyan
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    firebase logout --non-interactive 2>&1 | Out-Null
    $ErrorActionPreference = $prevEap

    $configstore = Join-Path $env:APPDATA "configstore\firebase-tools.json"
    if (Test-Path -LiteralPath $configstore) {
        Remove-Item -LiteralPath $configstore -Force -ErrorAction SilentlyContinue
    }

    if (-not $SkipVerify) {
        Write-Host "Verifying service account token..." -ForegroundColor Cyan
        & "$ProjectRoot\scripts\verify-deploy-auth.ps1"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Fix verify errors or pass -SkipVerify if you already verified." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Skipping verify (-SkipVerify)." -ForegroundColor DarkGray
    }
} else {
    Write-Host "Using Firebase CLI user login." -ForegroundColor Cyan
}

Write-Host "Project: dinebuddies" -ForegroundColor Cyan

if (-not $FunctionsOnly) {
    if (-not (Test-Path -LiteralPath "$ProjectRoot\dist\index.html")) {
        Write-Host "Building frontend (dist/)..." -ForegroundColor Cyan
        npm run build
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

Write-Host "Installing functions dependencies..." -ForegroundColor Cyan
Push-Location "$ProjectRoot\functions"
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
Pop-Location

$deployArgs = @("--project", "dinebuddies", "--non-interactive")

$deployTarget = if ($Only) {
    $Only
} elseif ($FunctionsOnly) {
    'functions'
} else {
    'functions,hosting'
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    Write-Host "Deploying: $deployTarget" -ForegroundColor Cyan
    firebase deploy --only $deployTarget @deployArgs
    $deployExit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevEap
}

if ($deployExit -ne 0) {
    Write-Host ""
    Write-Host "Deploy failed." -ForegroundColor Red
    if ($UsingServiceAccount) {
        Write-Host "Retry with SSL bypass (same session):" -ForegroundColor Yellow
        Write-Host '  $env:NODE_TLS_REJECT_UNAUTHORIZED = "1"'
        Write-Host "  .\scripts\deploy-firebase.ps1 -FunctionsOnly -SkipVerify"
    }
    exit $deployExit
}

Write-Host "Deploy finished." -ForegroundColor Green
