# Validation Report - 2026-04-10

## Scope

This validation pass focused on:

- applying the thesis seed set to the live PostgreSQL database
- verifying thesis-critical backend data chains
- hardening duplicate-sensitive normalization and benchmark behavior
- aligning benchmark datasets with the seeded live thesis dictionary and recipe pool
- running live benchmark regression tests plus benchmark smoke tests
- checking web/mobile compile health

## Live Seed Result

Live PostgreSQL seed application and verification passed via:

- `tests/MyDietitianMobileApp.Api.Tests/Seeds/LiveThesisSeedIntegrationTests.cs`

Generated report:

- `.tmp/live-thesis-seed-report.json`

Key live counts after seed application:

- `RecipeProhibitedIngredients`: `7`
- `RecipeIngredientSubstitutes`: `17`
- `ComplianceScoreConfigs`: `3`
- `DietPlans`: `13`
- `DietPlanDays`: `82`
- `DietPlanMeals`: `246`
- `MealItems`: `21`
- `MealCompletions`: `21`
- `MealCompliances`: `6`
- `MealItemCompliance`: `8`
- `DailyComplianceSnapshots`: `5`
- `ClientWeightEntries`: `5`
- `ClientMeasurementEntries`: `3`
- `ClientDailyTrackings`: `4`
- `ClientShoppingListItems`: `4`

All thesis seed checks passed:

- client prohibited ingredient
- recipe prohibited ingredient
- recipe substitute
- operational meal plan
- compliance snapshot
- weight history
- measurement history
- shopping list

## Code Hardening

Implemented in:

- `src/MyDietitianMobileApp.Infrastructure/Services/IngredientNormalizationService.cs`
- `src/MyDietitianMobileApp.Infrastructure/Services/IngredientResolutionPolicy.cs`
- `src/MyDietitianMobileApp.Infrastructure/Services/BenchmarkRunner.cs`

Behavioral changes:

- exact canonical duplicate rows with the same canonical identity now collapse deterministically instead of returning false ambiguity
- exact alias duplicate rows with the same canonical identity now collapse deterministically
- fuzzy candidates are collapsed by canonical identity before ambiguity margin evaluation
- benchmark ingredient mapping now collapses duplicate canonical ingredient rows instead of crashing or selecting unstable IDs
- live thesis benchmark datasets now use the seeded Turkish canonical dictionary and stable recipe GUIDs:
  - `src/MyDietitianMobileApp.Api/Benchmarks/SampleDatasets/ingredient-normalization-sample.json`
  - `src/MyDietitianMobileApp.Api/Benchmarks/SampleDatasets/recipe-recommendation-sample.json`

Regression coverage added:

- `tests/MyDietitianMobileApp.Api.Tests/Ingredients/IngredientNormalizationServiceTests.cs`
- `tests/MyDietitianMobileApp.Api.Tests/Benchmarks/BenchmarkRunnerTests.cs`
- `tests/MyDietitianMobileApp.Api.Tests/Seeds/LiveThesisBenchmarkRegressionTests.cs`

## Live Benchmark Result

Diagnostic baseline report:

- `.tmp/live-benchmark-diagnostics.json`

Final live thesis benchmark report:

- `.tmp/live-thesis-benchmark-report.json`

Executed via:

- `tests/MyDietitianMobileApp.Api.Tests/Seeds/LiveThesisBenchmarkRegressionTests.cs`

Observed summary:

- normalization:
  - `totalCases = 40`
  - `correctMatches = 40`
  - `accuracy = 1.00`
  - `ambiguousCount = 0`
- recommendation:
  - `totalCases = 10`
  - `correctCases = 10`
  - `overallAccuracy = 1.00`
  - `selectedRecipeAccuracy = 1.00`

Interpretation:

- duplicate live dictionary rows still exist physically in PostgreSQL
- however, they no longer block thesis benchmark execution or distort live benchmark evidence
- benchmark reporting is now aligned with the actual seeded clinic dictionary and recipe pool

## Test Results

### Targeted backend regression tests

Executed:

- `IngredientNormalizationServiceTests`
- `BenchmarkRunnerTests`
- `LiveThesisBenchmarkRegressionTests`

Result:

- `21 / 21` passed

### Benchmark smoke tests

Executed:

- `BenchmarkEndpointSmokeTests`

Result:

- `2 / 2` passed

### Earlier high-signal validation retained

Already validated in the same thesis-hardening cycle:

- backend smoke suite: `16 / 16` passed
- backend core high-signal suite: `61 / 61` passed
- seed sanity and live seed diagnostics: passed
- web panel build: passed
- mobile TypeScript compile: passed

## Frontend Validation

### Web panel

Executed:

- `npm run build`

Result:

- passed

### Mobile app

Executed:

- `npx tsc --noEmit`

Result:

- passed

## Current Thesis Readiness Interpretation

Strong / ready:

- schema availability
- seedability
- canonical restriction/substitute/prohibition models
- plan/compliance/progress/shopping chains
- import pipeline
- benchmark execution path
- benchmark smoke coverage
- web production build
- mobile TypeScript compile health

No blocker remains on the thesis benchmark path.

Remaining non-blocking cleanup item:

- physical ingredient deduplication in live PostgreSQL is still worth doing later for long-term data hygiene

## Recommended Next Step

1. Capture final thesis screenshots directly from the benchmark endpoints and `.tmp/live-thesis-benchmark-report.json`.
2. Run one final end-to-end mobile/web demo pass on the seeded clinic client.
3. Keep `.tmp/live-benchmark-diagnostics.json` as an appendix note for data-quality transparency.
4. If time remains, perform a separate physical dedupe/backfill pass on the ingredient dictionary after thesis evidence is frozen.
