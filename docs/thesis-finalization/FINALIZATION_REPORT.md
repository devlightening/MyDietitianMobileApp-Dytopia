# Dytopia Thesis Finalization Report

- Generated at: 2026-05-08 13:55:38
- Final DOCX: `C:\Users\hy971\source\repos\MyDietitianMobileApp\tmp-build\Dytopia_Bitirme_Tezi_Final_v7.docx`
- Source DOCX: `C:\Users\hy971\source\repos\MyDietitianMobileApp\tmp-build\son_Dytopia_Bitirme_Tezi_Profesyonel_Taslak_v6_benchmark.docx`
- Normalization: 72/73 correct, 98,63% accuracy, false match 0,00%
- Recipe engine: 36/36 correct, 100,00% accuracy
- Premium guard: 100,00%; tenant isolation: 100,00%
- API latency normalization: avg 42,24 ms, p95 59,43 ms
- API latency recommendation: avg 2,13 ms, p95 2,67 ms
- OpenAI fallback: skipped; API key not configured.

## Final Test Results

- `dotnet build src/MyDietitianMobileApp.Api/MyDietitianMobileApp.Api.csproj -c Release`: passed.
- `dotnet build MyDietitianMobileApp.sln -c Release`: exited with code 1 but produced no compiler error diagnostics in the captured log; project-level API build passed.
- `dotnet test tests/MyDietitianMobileApp.Api.Tests/MyDietitianMobileApp.Api.Tests.csproj -c Release`: 210 total, 203 passed, 0 failed, 7 skipped.
- `dotnet test tests/MyDietitianMobileApp.Api.SmokeTests/MyDietitianMobileApp.Api.SmokeTests.csproj -c Release --filter ThesisApiLatencyArtifactTests`: 1 total, 1 passed.

## Document Revisions

- Updated methodology from planned 300-500 normalization cases to the actually executed 73-case benchmark.
- Added mobile/web screenshots and benchmark charts.
- Added ara-test failure analysis table with final pass status.
- Updated discussion/conclusion with actual benchmark values.
- Reordered appendices so Ek A-C appear before code inventories.
- Removed teslim öncesi placeholder appendix.
- Corrected selected bibliography entries verified against current web metadata.

## Render and Export

- Artifact-tool render: passed, 90 pages.
- PDF export: skipped/unavailable; LibreOffice binary not found and Word executable not installed in common Office paths.
- Render QA report: docs/thesis-finalization/screenshot-and-render-check.md.

