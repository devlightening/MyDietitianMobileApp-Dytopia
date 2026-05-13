Param(
    [string]$ApiBaseUrl = "https://api.dytopia.xyz",
    [switch]$NoClear
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileAppPath = Join-Path $repoRoot "mobile-app"

if (-not (Test-Path -LiteralPath (Join-Path $mobileAppPath "package.json"))) {
    Write-Error "Could not find mobile-app/package.json from $mobileAppPath"
    exit 1
}

$env:EXPO_PUBLIC_API_BASE_URL_FORCE = "1"
$env:EXPO_PUBLIC_API_BASE_URL = $ApiBaseUrl.TrimEnd("/")
$env:EXPO_PUBLIC_API_TIMEOUT_MS = if ($env:EXPO_PUBLIC_API_TIMEOUT_MS) { $env:EXPO_PUBLIC_API_TIMEOUT_MS } else { "15000" }

Write-Host "Starting Expo Go remote demo..." -ForegroundColor Cyan
Write-Host ("API URL: {0}" -f $env:EXPO_PUBLIC_API_BASE_URL)
Write-Host "Metro will use Expo tunnel mode so the phone can reach the JS bundle remotely."
Write-Host ""

Push-Location $mobileAppPath
try {
    if ($NoClear) {
        npm run start:tunnel
    } else {
        npm run start:tunnel:clear
    }
} finally {
    Pop-Location
}
