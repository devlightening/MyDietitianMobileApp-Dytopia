# Thesis Gap Analysis & Strategic Development Guide

> Generated: 2026-03-23
> Reference: `docs/THESIS_STRENGTHENING_MASTER_GUIDE.md`
> Classification system: **TEZ-CORE** / **INTEGRATION-PROOF** / **PRODUCT-POLISH**

---

## 1. Current Project State (Snapshot)

| Layer | Status |
|-------|--------|
| Backend API | ✅ Frozen — all endpoints implemented, Swagger clean |
| Mobile (Android) | ✅ Connectivity fixed (adb reverse + 127.0.0.1 strategy) |
| Mobile (UI) | ⚠️ Most screens functional; MessagesScreen is placeholder |
| Web Panel | ✅ Plans page working; other pages partially implemented |
| Thesis Methodology Evidence | ✅ GAP 1–7 resolved — 60-case normalization benchmark, 20-case recommendation benchmark, log explainability fields, benchmark HTTP endpoints, taxonomy smoke tests |
| Taxonomy Seed Data | ✅ Verified by `TaxonomySeedVerificationSmokeTests` (family count, rule count, SubstituteAllowed count, dangling-reference guards) |
| End-to-End Meal Compliance Chain | ⚠️ Unverified in a real database session |

---

## 2. What Is Already Strong

### Architecture & Design
- **4-layer normalization pipeline** (Canonical → Alias → Fuzzy → LLM) is a genuine thesis contribution. The confidence banding (`HIGH / MEDIUM / LOW / FAILED`) is correctly modeled and logged.
- **Taxonomy-based recipe scoring** with `mandatory / optional / prohibited / substitute` tiers maps directly to dietitian decision logic — this is the core academic claim.
- **CQRS/MediatR pattern** in Application layer shows clean separation of concerns.
- **Benchmark infrastructure** (`BenchmarkRunner`, `BenchmarkModels`, per-difficulty breakdown) is already wired; the tooling exists, it just needs data.
- **IDOR-safe ClientIdentityResolver** shows security awareness above typical thesis-level work.
- **`IngredientNormalizationLog`** and **`RecipeRecommendationLog`** entities exist and are persisted — the observability foundation is in place.

### Test Infrastructure
- `IngredientSearchAndAlternativeSmokeTests` covers the happy path end-to-end.
- `HappyPathScenarioSmokeTests` covers the full dietitian → client scenario.
- `RecipeRecommendationLoggingTests` validates log persistence.

---

## 3. What Is Still Weak — Thesis Perspective

These are the **7 critical gaps** that will undermine the thesis defense if not fixed. Each maps to a specific file and field.

---

### GAP 1 — Normalization Benchmark Dataset Is Too Small

**File:** `tests/MyDietitianMobileApp.Api.Tests/Benchmarks/SampleDatasets/ingredient-normalization-sample.json`
**Current state:** 11 test cases.
**Required:** 60+ cases with deliberate distribution:

| Category | Count |
|----------|-------|
| Exact canonical matches | 10 |
| Alias matches | 10 |
| Turkish diacritic variants (ş→s, ğ→g, ı→i, ü→u, ö→o) | 10 |
| Fuzzy matches (Levenshtein ≤ 2) | 10 |
| Ambiguous inputs (multiple candidate families) | 10 |
| LLM fallback cases (no rule match) | 10 |

**Why it matters:** A thesis claims "the system normalizes ingredients accurately." 11 cases proves nothing statistically. 60 cases with category breakdown shows you designed for coverage.

---

### GAP 2 — No Recipe Recommendation Benchmark Dataset Exists

**File:** `tests/MyDietitianMobileApp.Api.Tests/Benchmarks/SampleDatasets/` ← **missing file**
**Required file:** `recipe-recommendation-sample.json`
**Structure:**
```json
[
  {
    "id": "rec-001",
    "description": "All mandatory ingredients present",
    "difficulty": "Easy",
    "availableIngredients": ["tavuk göğsü", "zeytinyağı", "limon"],
    "recipeId": "...",
    "expectedResult": "RECOMMENDED",
    "expectedMinScore": 0.85
  }
]
```

**Why it matters:** The recommendation engine is the second thesis contribution. Without benchmark data, you cannot show precision/recall curves or score distribution histograms in the thesis.

---

### GAP 3 — AlternativeMealDecisionService Does Not Wire Taxonomy Substitutes in Production

**File:** `src/MyDietitianMobileApp.Infrastructure/Services/AlternativeMealDecisionService.cs`
**Method:** `DecideForMealAsync()`
**Problem:** `SubstitutesByRecipeAndRequired` is not populated from `IngredientTaxonomyService` in the live code path. The taxonomy data exists in the DB but the decision engine doesn't use it at runtime.
**Impact:** The alternative meal feature — which is the integration proof that the two systems (normalization + taxonomy) work together — silently falls back to a weaker path.
**Fix required:** Wire `IIngredientTaxonomyService.GetSubstitutesForIngredientAsync()` into `DecideForMealAsync()` before building the decision response.

---

### GAP 4 — Missing Timing Metrics in IngredientNormalizationLog

**File:** `src/MyDietitianMobileApp.Domain/Entities/IngredientNormalizationLog.cs` (or equivalent)
**Missing fields:**
```csharp
public long ElapsedTimeMs { get; set; }        // Total normalization time
public int CandidateCount { get; set; }         // How many candidates considered
public int AmbiguousCandidateCount { get; set; } // Candidates with equal score
```

**Why it matters:** A thesis on "intelligent ingredient matching" must report performance characteristics. Without `ElapsedTimeMs`, you cannot put a latency table in Chapter 4. Without `CandidateCount`, you cannot show complexity analysis.

---

### GAP 5 — RecipeRecommendationLog Has No Explainability Fields

**File:** `src/MyDietitianMobileApp.Domain/Entities/RecipeRecommendationLog.cs` (or equivalent)
**Missing fields:**
```csharp
public string? RejectionReasonSummary { get; set; }        // "Missing: tavuk, zeytinyağı"
public string? MissingMandatoryNamesJson { get; set; }     // JSON array of missing names
public string? SubstituteUsageSummaryJson { get; set; }    // JSON: which substitutes were used
```

**Why it matters:** Thesis Chapter 5 (evaluation) needs to explain *why* recipes were rejected. "The system rejected 43% of recipes due to missing mandatory ingredients" requires this data.

---

### GAP 6 — No HTTP Endpoint to Trigger Benchmarks

**Required endpoints (dev-only, no auth):**
```
GET /api/dev/benchmark/normalization
GET /api/dev/benchmark/recommendation
```

**Why it matters:** The thesis evaluator will want to see a live demo. "Run this endpoint and see the results" is far more convincing than "run the test suite." Also required for the smoke test layer to verify benchmark integrity after deploys.

---

### GAP 7 — Taxonomy Seed Data Completeness Unverified

**Files:**
- `scripts/seed-part1-base.sql`
- `scripts/seed-part2-users.sql`

**Missing verification:** There is no smoke test or assertion that confirms:
- At least N `IngredientFamily` rows exist
- At least N `CompatibilityRule` rows exist
- The `SubstituteAllowed` table is populated

**Why it matters:** If the thesis demo DB is empty of taxonomy data, the rule-based engine degrades silently to "no rules found" and scores everything the same. The defense audience would see a broken demo.

---

## 4. What Is Still Weak — Product/System Perspective

| Issue | Severity | Classification |
|-------|----------|----------------|
| `MessagesScreen` is a static placeholder | Medium | PRODUCT-POLISH |
| Meal-plan → completion → compliance chain not verified end-to-end in real DB | High | INTEGRATION-PROOF |
| Web panel `clients` page deleted (was removed in recent refactor) | Medium | PRODUCT-POLISH |
| No loading state feedback when benchmark endpoint is slow | Low | PRODUCT-POLISH |
| `ProfileMeasurementsScreen` has no validation on numeric fields | Low | PRODUCT-POLISH |

---

## 5. Highest-Priority Next Actions

| Priority | Task | Classification | Files Affected | Thesis Impact |
|----------|------|----------------|----------------|---------------|
| 1 | Expand normalization benchmark to 60+ cases | TEZ-CORE | `ingredient-normalization-sample.json` | Chapter 4 — evaluation table |
| 2 | Create `recipe-recommendation-sample.json` | TEZ-CORE | new file in Benchmarks/SampleDatasets/ | Chapter 4 — recommendation eval |
| 3 | Wire taxonomy substitutes in `DecideForMealAsync` | TEZ-CORE | `AlternativeMealDecisionService.cs` | Core claim validity |
| 4 | Add `ElapsedTimeMs`, `CandidateCount`, `AmbiguousCandidateCount` to NormalizationLog | TEZ-CORE | Domain entity + handler + migration | Chapter 4 — performance section |
| 5 | Add `RejectionReasonSummary`, `MissingMandatoryNamesJson`, `SubstituteUsageSummaryJson` to RecommendationLog | TEZ-CORE | Domain entity + handler + migration | Chapter 5 — explainability |
| 6 | Add `/api/dev/benchmark/*` endpoints | TEZ-CORE | new Controller or minimal API | Demo readiness |
| 7 | Add taxonomy seed verification smoke test | INTEGRATION-PROOF | `SmokeTests/` | Defense demo guard |
| 8 | Verify meal compliance chain E2E | INTEGRATION-PROOF | `HappyPathScenarioSmokeTests.cs` | Integration chapter |

---

## 6. Classification System — How to Use From Now On

Every development task must be explicitly labeled before starting:

### TEZ-CORE
> Work that directly supports the thesis academic claims. Blocked everything else if incomplete.
>
> **Examples:** normalization accuracy metrics, benchmark datasets, log explainability fields, taxonomy engine wiring.

### INTEGRATION-PROOF
> Work that shows the system functions as a connected whole. Required for the demo chapter.
>
> **Examples:** E2E meal plan completion tests, taxonomy seed verification, smoke tests against real DB.

### PRODUCT-POLISH
> UX improvements, error messages, placeholder screens. Do ONLY after TEZ-CORE is complete.
>
> **Examples:** MessagesScreen content, loading animations, form validation.

---

## 7. Proposal Template (Mandatory Format)

When proposing any new feature or fix, use this format:

```
**Classification:** TEZ-CORE / INTEGRATION-PROOF / PRODUCT-POLISH
**Thesis Chapter Impact:** Chapter N — [section name]
**Files Modified:** [exact file paths]
**Log Fields Added:** [if any — entity name + field names]
**Benchmark Coverage:** [which sample dataset cases this enables]
**Demo Readiness:** Does this make the live demo more convincing? How?
```

---

## 8. What Must NOT Happen

- Do not add UI polish before GAP 1–3 are closed.
- Do not add new screens or navigation before the benchmark datasets exist.
- Do not present `AlternativeMealDecisionService` in the thesis defense without fixing GAP 3.
- Do not skip the `ElapsedTimeMs` field — latency data is required for any "performance evaluation" section.
- Do not let `MessagesScreen` be the focus of any demo flow — route around it.

---

## 9. Thesis Defense Readiness Checklist

- [x] Normalization benchmark: 60+ cases, category distribution documented (`ingredient-normalization-sample.json` v2.0 — 10 easy / 30 medium / 20 hard)
- [x] Recommendation benchmark: dataset exists, precision/recall calculated (`recipe-recommendation-sample.json` v2.0 — 20 cases)
- [x] `AlternativeMealDecisionService` wires taxonomy substitutes (`BuildSubstitutesForRecipesAsync` via `IIngredientTaxonomyService`)
- [x] `IngredientNormalizationLog` has timing and candidate count fields (`ElapsedTimeMs`, `CandidateCount`, `AmbiguousCandidateCount` — migration `20260325120000`)
- [x] `RecipeRecommendationLog` has rejection reason and substitute usage fields (`RejectionReasonSummary`, `MissingMandatoryNamesJson`, `SubstituteUsageSummaryJson` — migration `20260325120000`)
- [x] `/api/dev/benchmark/normalization` endpoint returns JSON results (`BenchmarkController.cs`)
- [x] `/api/dev/benchmark/recommendation` endpoint returns JSON results (`BenchmarkController.cs`)
- [x] Taxonomy seed data verified by smoke test (family count, rule count, substitute count) (`TaxonomySeedVerificationSmokeTests.cs` — 6 assertions)
- [x] Meal plan → completion → compliance smoke test passes against real DB (26/26 smoke tests green — 2026-03-31)
- [x] All smoke tests green against a fresh seeded database (26/26 — 2026-03-31)

---

*This document is the strategic reference for all remaining development. Revisit and update checkboxes as items are completed.*
