Param(
    [string]$ConfigPath = "$env:USERPROFILE\.cloudflared\config.yml",
    [string]$ExpectedHostname = "api.dytopia.xyz",
    [string]$ExpectedService = "http://localhost:5000",
    [string]$HealthPath = "/health",
    [int]$TimeoutSec = 10
)

$ErrorActionPreference = "Continue"
$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Write-Check {
    Param(
        [string]$Name,
        [string]$Status,
        [string]$Details = ""
    )

    $color = switch ($Status) {
        "OK" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        default { "White" }
    }

    if ($Details) {
        Write-Host ("[{0}] {1} - {2}" -f $Status, $Name, $Details) -ForegroundColor $color
    } else {
        Write-Host ("[{0}] {1}" -f $Status, $Name) -ForegroundColor $color
    }
}

function Add-Failure {
    Param([string]$Message)
    $failures.Add($Message) | Out-Null
}

function Add-Warning {
    Param([string]$Message)
    $warnings.Add($Message) | Out-Null
}

function Test-Url {
    Param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing
        return [pscustomobject]@{
            Ok = $true
            StatusCode = [int]$response.StatusCode
            Detail = $response.Content
        }
    } catch {
        return [pscustomobject]@{
            Ok = $false
            StatusCode = $null
            Detail = $_.Exception.Message
        }
    }
}

Write-Host "Dytopia Cloudflare Tunnel verification" -ForegroundColor Cyan
Write-Host ("Config: {0}" -f $ConfigPath)
Write-Host ""

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cloudflared) {
    try {
        $version = (& $cloudflared.Source --version) -join " "
        Write-Check "cloudflared command" "OK" $version
    } catch {
        Write-Check "cloudflared command" "WARN" "Found at $($cloudflared.Source), but version check failed: $($_.Exception.Message)"
        Add-Warning "cloudflared exists but version check failed."
    }
} else {
    Write-Check "cloudflared command" "FAIL" "Not found on PATH"
    Add-Failure "Install cloudflared or add it to PATH before starting the named tunnel connector."
}

if (Test-Path -LiteralPath $ConfigPath) {
    Write-Check "cloudflared config" "OK" $ConfigPath
    $configText = Get-Content -LiteralPath $ConfigPath -Raw

    $tunnelId = if ($configText -match "(?m)^\s*tunnel:\s*(.+?)\s*$") { $Matches[1].Trim() } else { "" }
    $credentialsFile = if ($configText -match "(?m)^\s*credentials-file:\s*(.+?)\s*$") { $Matches[1].Trim() } else { "" }

    if ($tunnelId) {
        Write-Check "tunnel id in config" "OK" $tunnelId
    } else {
        Write-Check "tunnel id in config" "FAIL" "Missing 'tunnel:' entry"
        Add-Failure "The local config must reference the existing tunnel id."
    }

    if ($credentialsFile -and (Test-Path -LiteralPath $credentialsFile)) {
        Write-Check "credentials file presence" "OK" "Exists; contents were not read"
    } elseif ($credentialsFile) {
        Write-Check "credentials file presence" "FAIL" "Configured file does not exist: $credentialsFile"
        Add-Failure "The tunnel connector cannot run without the existing credentials file."
    } else {
        Write-Check "credentials file presence" "FAIL" "Missing 'credentials-file:' entry"
        Add-Failure "The local config must point at the existing tunnel credentials file."
    }

    $hasHostname = $configText -match ("(?m)^\s*-\s*hostname:\s*{0}\s*$" -f [regex]::Escape($ExpectedHostname))
    $hasService = $configText -match ("(?m)^\s*service:\s*{0}\s*$" -f [regex]::Escape($ExpectedService))

    if ($hasHostname -and $hasService) {
        Write-Check "ingress mapping" "OK" "$ExpectedHostname -> $ExpectedService"
    } else {
        Write-Check "ingress mapping" "FAIL" "Expected $ExpectedHostname -> $ExpectedService"
        Add-Failure "The local ingress mapping does not match the expected API hostname and backend port."
    }
} else {
    Write-Check "cloudflared config" "FAIL" "Missing $ConfigPath"
    Add-Failure "The local connector config was not found."
}

$connectorProcess = Get-Process cloudflared -ErrorAction SilentlyContinue
$connectorService = Get-Service -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -like "*cloudflared*" -or $_.DisplayName -like "*cloudflared*"
}

if ($connectorProcess) {
    $ids = ($connectorProcess | Select-Object -ExpandProperty Id) -join ", "
    Write-Check "cloudflared connector" "OK" "Process running, PID(s): $ids"
} elseif ($connectorService | Where-Object { $_.Status -eq "Running" }) {
    $names = (($connectorService | Where-Object { $_.Status -eq "Running" }) | Select-Object -ExpandProperty Name) -join ", "
    Write-Check "cloudflared connector" "OK" "Service running: $names"
} else {
    Write-Check "cloudflared connector" "FAIL" "No running process/service detected"
    Add-Failure "Cloudflare Dashboard will show the tunnel as Down until the local connector is running."
}

$localHealthUrl = $ExpectedService.TrimEnd("/") + $HealthPath
$localHealth = Test-Url $localHealthUrl
if ($localHealth.Ok) {
    Write-Check "local backend health" "OK" "$localHealthUrl returned HTTP $($localHealth.StatusCode)"
} else {
    Write-Check "local backend health" "FAIL" "$localHealthUrl failed: $($localHealth.Detail)"
    Add-Failure "Start the API on port 5000 before running the tunnel connector."
}

try {
    $cnameRecords = Resolve-DnsName $ExpectedHostname -Type CNAME -ErrorAction SilentlyContinue
    $aRecords = Resolve-DnsName $ExpectedHostname -Type A -ErrorAction SilentlyContinue

    $cnameTargets = @($cnameRecords | Where-Object {
        $_.Type -eq "CNAME" -and $_.Name.TrimEnd(".") -eq $ExpectedHostname
    } | Select-Object -ExpandProperty NameHost)
    $aTargets = @($aRecords | Where-Object {
        $_.Type -eq "A" -and $_.Name.TrimEnd(".") -eq $ExpectedHostname
    } | Select-Object -ExpandProperty IPAddress)

    if ($cnameTargets.Count -gt 0) {
        Write-Check "DNS CNAME" "OK" ($cnameTargets -join ", ")
    } elseif ($aTargets.Count -gt 0) {
        Write-Check "DNS CNAME" "WARN" "No CNAME returned; A record(s): $($aTargets -join ', ')"
        Add-Warning "If the hostname is meant to be a Cloudflare Tunnel route, confirm DNS/proxying in Cloudflare."
    } else {
        Write-Check "DNS lookup" "FAIL" "No CNAME or A record returned"
        Add-Failure "The public hostname is not resolving."
    }
} catch {
    Write-Check "DNS lookup" "WARN" $_.Exception.Message
    Add-Warning "DNS lookup failed locally."
}

$publicHealthUrl = "https://$ExpectedHostname$HealthPath"
$publicHealth = Test-Url $publicHealthUrl
if ($publicHealth.Ok) {
    Write-Check "public backend health" "OK" "$publicHealthUrl returned HTTP $($publicHealth.StatusCode)"
} else {
    Write-Check "public backend health" "FAIL" "$publicHealthUrl failed: $($publicHealth.Detail)"
    Add-Failure "The remote Expo Go demo is not ready until the public health endpoint responds."
}

Write-Host ""
if ($warnings.Count -gt 0) {
    Write-Host "Warnings:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host ("- {0}" -f $_) -ForegroundColor Yellow }
    Write-Host ""
}

if ($failures.Count -gt 0) {
    Write-Host "Result: NOT DEMO READY" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host ("- {0}" -f $_) -ForegroundColor Red }
    exit 1
}

Write-Host "Result: DEMO READY" -ForegroundColor Green
exit 0
