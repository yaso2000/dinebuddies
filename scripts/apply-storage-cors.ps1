# Apply Firebase Storage CORS (run once per bucket)
# Requires: gcloud auth login && gcloud config set project dinebuddies

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CorsFile = Join-Path $Root 'storage\cors.json'

if (-not (Test-Path $CorsFile)) {
    Write-Error "Missing $CorsFile"
}

$buckets = @(
    'gs://dinebuddies.firebasestorage.app',
    'gs://dinebuddies.appspot.com'
)

foreach ($bucket in $buckets) {
    Write-Host "Applying CORS to $bucket ..."
    gcloud storage buckets update $bucket --cors-file=$CorsFile
}

Write-Host 'Done. Verify with:'
Write-Host '  gcloud storage buckets describe gs://dinebuddies.firebasestorage.app --format="json(cors_config)"'
