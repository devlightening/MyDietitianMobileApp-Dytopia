Param(
    [string]$Configuration = "Release",
    [string]$OutputRoot = "docs/thesis-evidence",
    [string]$VSTestPath = "C:\Program Files\dotnet\sdk\10.0.200-preview.0.26103.119\vstest.console.dll"
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $PSScriptRoot "..\$OutputRoot\$timestamp"
$outputDir = [System.IO.Path]::GetFullPath($outputDir)

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Invoke-And-Capture {
    param(
        [string]$Name,
        [string]$Command
    )

    $logPath = Join-Path $outputDir "$Name.log"
    Write-Section $Name
    Write-Host $Command -ForegroundColor DarkGray

    & powershell -NoProfile -Command $Command 2>&1 |
        Tee-Object -FilePath $logPath
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$gitCommit = ""

try {
    $gitCommit = (git -C $repoRoot rev-parse HEAD).Trim()
} catch {
    $gitCommit = "unknown"
}

$metadata = @(
    "timestamp=$timestamp"
    "configuration=$Configuration"
    "repoRoot=$repoRoot"
    "gitCommit=$gitCommit"
)

Set-Content -Path (Join-Path $outputDir "metadata.txt") -Value $metadata -Encoding UTF8

$unitDll = Join-Path $repoRoot "tests/MyDietitianMobileApp.Api.Tests/bin/$Configuration/net8.0/MyDietitianMobileApp.Api.Tests.dll"
$smokeDll = Join-Path $repoRoot "tests/MyDietitianMobileApp.Api.SmokeTests/bin/$Configuration/net8.0/MyDietitianMobileApp.Api.SmokeTests.dll"

if (-not (Test-Path $VSTestPath)) {
    throw "vstest.console.dll not found: $VSTestPath"
}

if (-not (Test-Path $unitDll)) {
    throw "Prebuilt unit test assembly not found: $unitDll"
}

if (-not (Test-Path $smokeDll)) {
    throw "Prebuilt smoke test assembly not found: $smokeDll"
}

Invoke-And-Capture `
    -Name "benchmark-unit-tests" `
    -Command "Set-Location '$repoRoot'; dotnet exec '$VSTestPath' '$unitDll' /TestCaseFilter:`"FullyQualifiedName~MyDietitianMobileApp.Api.Tests.Benchmarks.BenchmarkRunnerTests`""

Invoke-And-Capture `
    -Name "benchmark-endpoint-smoke-tests" `
    -Command "Set-Location '$repoRoot'; dotnet exec '$VSTestPath' '$smokeDll' /TestCaseFilter:`"FullyQualifiedName~MyDietitianMobileApp.Api.SmokeTests.Benchmark.BenchmarkEndpointSmokeTests`""

Invoke-And-Capture `
    -Name "taxonomy-smoke-tests" `
    -Command "Set-Location '$repoRoot'; dotnet exec '$VSTestPath' '$smokeDll' /TestCaseFilter:`"FullyQualifiedName~MyDietitianMobileApp.Api.SmokeTests.Taxonomy.TaxonomySeedVerificationSmokeTests`""

Invoke-And-Capture `
    -Name "meal-compliance-smoke-tests" `
    -Command "Set-Location '$repoRoot'; dotnet exec '$VSTestPath' '$smokeDll' /TestCaseFilter:`"FullyQualifiedName~MyDietitianMobileApp.Api.SmokeTests.Dietitian.MealPlanComplianceSmokeTests`""

Write-Section "Thesis Evidence Output"
Write-Host "Artifacts saved to: $outputDir" -ForegroundColor Green
