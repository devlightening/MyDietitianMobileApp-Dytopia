# Thesis Benchmark Environment

- Tarih/saat: 2026-05-08T00:04:56+03:00
- Git commit hash: `baa932f2a6286180cb141d4a9ed73b801f274577`
- OpenAI API key configured: `false`
- PostgreSQL TCP bağlantısı (`127.0.0.1:5433`): `true`

## Git Working Tree

```text
M mobile-app/.env.example
 M mobile-app/App.tsx
 M mobile-app/package-lock.json
 M mobile-app/package.json
 M mobile-app/src/api/client-state.ts
 M mobile-app/src/api/meal-logs.ts
 M mobile-app/src/auth/AuthContext.tsx
 M mobile-app/src/components/BottomBar.tsx
 M mobile-app/src/components/decor/DytopiaLogoBubble.tsx
 M mobile-app/src/components/decor/DytopiaWatermark.tsx
 M mobile-app/src/components/kitchen/RecipeSearchStage.tsx
 M mobile-app/src/components/profile/ProfileEditCard.tsx
 M mobile-app/src/components/ui/AppEmptyState.tsx
 M mobile-app/src/components/ui/DytopiaLoadingState.tsx
 M mobile-app/src/components/vision/AnalyzingView.tsx
 M mobile-app/src/hooks/useCareSignalR.ts
 M mobile-app/src/navigation/AppShell.tsx
 M mobile-app/src/navigation/RootNavigator.tsx
 M mobile-app/src/screens/DashboardScreen.tsx
 M mobile-app/src/screens/IngredientScanScreen.tsx
 M mobile-app/src/screens/KitchenResultScreen.tsx
 M mobile-app/src/screens/KitchenScreen.tsx
 M mobile-app/src/screens/LoginScreen.tsx
 M mobile-app/src/screens/MealLogScreen.tsx
 M mobile-app/src/screens/MessagesScreen.tsx
 M mobile-app/src/screens/PantryScreen.tsx
 M mobile-app/src/screens/ProfileScreen.tsx
 M mobile-app/src/screens/ReceiptScanScreen.tsx
 M mobile-app/src/screens/RegisterScreen.tsx
 M mobile-app/src/screens/ShoppingListScreen.tsx
 M mobile-app/src/screens/WelcomeScreen.tsx
 M src/MyDietitianMobileApp.Api/Controllers/AlternativeController.cs
 M src/MyDietitianMobileApp.Api/Controllers/ClientMealLogController.cs
 M src/MyDietitianMobileApp.Api/Controllers/ClientShoppingListController.cs
 M src/MyDietitianMobileApp.Api/Controllers/ClientStateController.cs
 M src/MyDietitianMobileApp.Api/Controllers/PublicRecipesController.cs
 M src/MyDietitianMobileApp.Api/Program.cs
 M src/MyDietitianMobileApp.Domain/Entities/ClientMealLog.cs
 M src/MyDietitianMobileApp.Infrastructure/Persistence/AppDbContext.cs
 M src/MyDietitianMobileApp.Infrastructure/Services/PremiumKitchenCandidateFilter.cs
 M tests/MyDietitianMobileApp.Api.Tests/Recipes/PremiumIsolationRegressionTests.cs
 M tests/MyDietitianMobileApp.Api.Tests/Recipes/PremiumKitchenMatchPolicyTests.cs
?? docs/
?? scripts/start-dytopia-cloudflare-tunnel.ps1
?? scripts/start-dytopia-remote-expo-demo.ps1
?? scripts/thesis/
?? scripts/verify-dytopia-cloudflare-tunnel.ps1
?? src/MyDietitianMobileApp.Infrastructure/Migrations/20260506033000_AddMealLogAiAnalysis.cs
?? tests/MyDietitianMobileApp.Api.SmokeTests/Benchmark/ThesisApiLatencyArtifactTests.cs
?? tests/MyDietitianMobileApp.Api.Tests/Thesis/
?? tests/docs/
?? tmp-build/
```

## Runtime Sürümleri

- `node --version`: `v24.4.1`
- `npm --version`: `FileNotFoundError: [WinError 2] Sistem belirtilen dosyayı bulamıyor`

### dotnet --info

```text
.NET SDK:
 Version:           10.0.200-preview.0.26103.119
 Commit:            a2bfa4671c
 Workload version:  10.0.200-manifests.796b3495
 MSBuild version:   18.3.0-release-26103-119+a2bfa4671

Çalışma Zamanı Ortamı:
 OS Name:     Windows
 OS Version:  10.0.22631
 OS Platform: Windows
 RID:         win-x64
 Base Path:   C:\Program Files\dotnet\sdk\10.0.200-preview.0.26103.119\

.NET iş yükleri yüklendi:
Görüntülenecek yüklü iş yükü yok.
Yeni bildirimler yüklenirken workload sets kullanacak şekilde yapılandırılmıştır.
İş yükü kümesi yüklenmemiştir. Bir iş yükü seti yüklemek için “dotnet workload restore” komutunu çalıştırın.

Host:
  Version:      10.0.2
  Architecture: x64
  Commit:       4452502459

.NET SDKs installed:
  10.0.200-preview.0.26103.119 [C:\Program Files\dotnet\sdk]

.NET runtimes installed:
  Microsoft.AspNetCore.App 8.0.23 [C:\Program Files\dotnet\shared\Microsoft.AspNetCore.App]
  Microsoft.AspNetCore.App 10.0.2 [C:\Program Files\dotnet\shared\Microsoft.AspNetCore.App]
  Microsoft.NETCore.App 3.1.28 [C:\Program Files\dotnet\shared\Microsoft.NETCore.App]
  Microsoft.NETCore.App 8.0.14 [C:\Program Files\dotnet\shared\Microsoft.NETCore.App]
  Microsoft.NETCore.App 8.0.23 [C:\Program Files\dotnet\shared\Microsoft.NETCore.App]
  Microsoft.NETCore.App 10.0.2 [C:\Program Files\dotnet\shared\Microsoft.NETCore.App]
  Microsoft.WindowsDesktop.App 8.0.23 [C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App]
  Microsoft.WindowsDesktop.App 10.0.2 [C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App]

Other architectures found:
  x86   [C:\Program Files (x86)\dotnet]
    registered at [HKLM\SOFTWARE\dotnet\Setup\InstalledVersions\x86\InstallLocation]

Environment variables:
  Not set

global.json file:
  Not found

Learn more:
  https://aka.ms/dotnet/info

Download .NET:
  https://aka.ms/dotnet/download
```

## Docker / PostgreSQL Durumu

```text
time="2026-05-08T00:04:55+03:00" level=warning msg="C:\\Users\\hy971\\source\\repos\\MyDietitianMobileApp\\docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/containers/json?filters=%7B%22label%22%3A%7B%22com.docker.compose.config-hash%22%3Atrue%2C%22com.docker.compose.oneoff%3DFalse%22%3Atrue%2C%22com.docker.compose.project%3Dmydietitianmobileapp%22%3Atrue%7D%7D": open //./pipe/dockerDesktopLinuxEngine: Access is denied.
```

## Build ve Test Komutları

| Komut | Exit code | Not |
|---|---:|---|
| `git rev-parse HEAD` | 0 |  |
| `git status --short` | 0 |  |
| `dotnet restore MyDietitianMobileApp.sln -v minimal` | 0 |  |
| `dotnet build MyDietitianMobileApp.sln -c Release -v minimal` | 1 | Çözüm build komutu oturumda exit code 1 verdi; ayrı API ve test project build komutları başarılıdır. |
| `dotnet build src\MyDietitianMobileApp.Api\MyDietitianMobileApp.Api.csproj -c Release -v minimal` | 0 |  |
| `dotnet build tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release -v minimal` | 0 |  |
| `dotnet test .\tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release --no-build --logger "trx;LogFileName=thesis-tests.trx" --results-directory .\docs\thesis-benchmark-results` | 1 | 200 geçti, 2 başarısız, 7 atlandı. |
| `dotnet test .\tests\MyDietitianMobileApp.Api.Tests\MyDietitianMobileApp.Api.Tests.csproj -c Release --filter "FullyQualifiedName~MyDietitianMobileApp.Api.Tests.Thesis.ThesisBenchmarkArtifactTests.GenerateThesisBenchmarkArtifacts" --logger "trx;LogFileName=thesis-benchmark-artifacts.trx" --results-directory .\docs\thesis-benchmark-results` | 0 | Benchmark artifact üretimi başarılı (1/1). |
| `dotnet test .\tests\MyDietitianMobileApp.Api.SmokeTests\MyDietitianMobileApp.Api.SmokeTests.csproj -c Release --filter "FullyQualifiedName~BenchmarkEndpointSmokeTests" --logger "trx;LogFileName=thesis-smoke-benchmark-endpoints.trx" --results-directory .\docs\thesis-benchmark-results` | 0 |  |
| `dotnet test .\tests\MyDietitianMobileApp.Api.SmokeTests\MyDietitianMobileApp.Api.SmokeTests.csproj -c Release --filter "FullyQualifiedName~MyDietitianMobileApp.Api.SmokeTests.Benchmark.ThesisApiLatencyArtifactTests.GenerateApiLatencyArtifacts" --logger "trx;LogFileName=thesis-api-latency-artifacts.trx" --results-directory .\docs\thesis-benchmark-results` | 0 | API latency artifact üretimi başarılı (1/1). |
