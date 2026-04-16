#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-time setup: allows Android emulator → Windows host TCP traffic on port 5000.

.DESCRIPTION
    Android emulator reaches the host machine via the special alias 10.0.2.2.
    From Windows' perspective this traffic arrives on the emulator's virtual NIC
    (NOT on the loopback adapter), so Windows Firewall treats it as an inbound
    private-network connection and blocks it by default.

    This script adds a persistent inbound firewall rule for TCP 5000 so that
    http://10.0.2.2:5000 works from any Android emulator on this machine.

    Run once; the rule survives reboots.

.NOTES
    Must be run as Administrator.
    To remove the rule later: Remove-NetFirewallRule -DisplayName "ASP.NET Dev Port 5000 (Android Emulator)"
#>

$RuleName = "ASP.NET Dev Port 5000 (Android Emulator)"

# Check if rule already exists
$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host "✅ Firewall rule '$RuleName' already exists." -ForegroundColor Green
    $existing | Format-Table DisplayName, Enabled, Direction, Action -AutoSize
} else {
    Write-Host "Adding inbound firewall rule for TCP 5000..." -ForegroundColor Cyan

    New-NetFirewallRule `
        -DisplayName  $RuleName `
        -Description  "Allows Android emulator (10.0.2.2) to reach the ASP.NET Core dev backend on port 5000." `
        -Direction    Inbound `
        -Protocol     TCP `
        -LocalPort    5000 `
        -Action       Allow `
        -Profile      Private, Domain `
        -Enabled      True | Out-Null

    Write-Host "✅ Rule added successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Restart the backend:   dotnet run --launch-profile http" -ForegroundColor White
    Write-Host "  2. Cold-boot the emulator if it was already open (AVD Manager → ▾ → Cold Boot Now)" -ForegroundColor White
    Write-Host "  3. Re-launch the Expo app — startup log should show: ✅ Backend reachable" -ForegroundColor White
}
