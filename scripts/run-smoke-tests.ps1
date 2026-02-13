Param(
    [string]$Configuration = "Release"
)

Write-Host "Running API smoke tests (configuration: $Configuration)..." -ForegroundColor Cyan

dotnet test "tests/MyDietitianMobileApp.Api.SmokeTests/MyDietitianMobileApp.Api.SmokeTests.csproj" -c $Configuration

