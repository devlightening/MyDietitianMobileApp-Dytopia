Param(
    [string]$ConfigPath = "$env:USERPROFILE\.cloudflared\config.yml",
    [string]$BackendUrl = "http://localhost:5000",
    [string]$HealthPath = "/health",
    [int]$TimeoutSec = 10
)

$ErrorActionPreference = "Stop"

function Test-Health {
    Param([string]$Url)

    try {
        Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing | Out-Null
        return $true
    } catch {
        Write-Warning ("Health check failed for {0}: {1}" -f $Url, $_.Exception.Message)
        return $false
    }
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Error "cloudflared is not on PATH. Install it or add it to PATH, then re-run this script."
    exit 1
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    Write-Error "Cloudflared config not found: $ConfigPath"
    exit 1
}

$configText = Get-Content -LiteralPath $ConfigPath -Raw
if ($configText -notmatch "(?m)^\s*tunnel:\s*.+\s*$") {
    Write-Error "Config is missing the existing tunnel id. Refusing to create or change Cloudflare resources."
    exit 1
}

$healthUrl = $BackendUrl.TrimEnd("/") + $HealthPath
if (-not (Test-Health $healthUrl)) {
    Write-Host ""
    Write-Host "Start the API first, then run this script again:" -ForegroundColor Yellow
    Write-Host '  dotnet run --project src\MyDietitianMobileApp.Api\MyDietitianMobileApp.Api.csproj --launch-profile http'
    exit 1
}

Write-Host "Starting existing Cloudflare Tunnel connector..." -ForegroundColor Cyan
Write-Host ("Config : {0}" -f $ConfigPath)
Write-Host ("Backend: {0}" -f $BackendUrl)
Write-Host "This terminal stays attached to cloudflared. Press Ctrl+C to stop the connector."
Write-Host ""

& $cloudflared.Source tunnel --config $ConfigPath run
