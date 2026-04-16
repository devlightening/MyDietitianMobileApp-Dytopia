#!/usr/bin/env bash
set -euo pipefail

CONFIGURATION="${1:-Release}"

echo "Running API smoke tests (configuration: ${CONFIGURATION})..."

dotnet test "tests/MyDietitianMobileApp.Api.SmokeTests/MyDietitianMobileApp.Api.SmokeTests.csproj" -c "${CONFIGURATION}"

