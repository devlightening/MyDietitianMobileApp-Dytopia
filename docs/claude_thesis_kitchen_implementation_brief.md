# Thesis-Aligned Implementation Brief
## MyDietitian - Premium Kitchen, Multi-Layer Ingredient Standardization, and Rule-Based Recipe Recommendation

**Audience:** Claude Code / AI pair programmer  
**Goal:** Implement thesis-aligned logic and premium UX in the Kitchen flow so the product demonstrates the core academic contribution, not just visual UI.

---

## 1) Why this work matters

This project is not just a mobile diet app. The thesis is explicitly about solving **ingredient inconsistency in free-text user input** and building a **rule-based, explainable, measurable recipe recommendation system** on top of standardized ingredient data.

The implementation must therefore prioritize:

1. **Multi-layer ingredient normalization**  
2. **Ingredient taxonomy / family / variant / substitute logic**  
3. **Deterministic, explainable rule-based recommendation**  
4. **Dietitian-specific premium/private recipe isolation**  
5. **Measurable logs and benchmarkability**  
6. **A polished mobile flow that visibly demonstrates the method**

This is critical because the thesis frames the UI as only the presentation layer of a deeper engineering problem: standardizing noisy ingredient inputs and producing reliable recipe suggestions from them.

---

## 2) Thesis summary that must guide implementation

### 2.1 Core thesis problem
Users enter ingredients in noisy ways: misspellings, Turkish-character loss, incomplete names, family-level names, variant names, etc. The thesis states that raw free-text ingredient data causes inconsistency and lowers recommendation quality.

Examples from the thesis direction:
- `suzme yogurt`
- `süzme yogurt`
- `yoğurt`
- `meyveli yoğurt`
- `light ton`

The system must **not** treat all of these as identical. It must normalize them into standard ingredient identities while preserving family / variant / compatibility meaning.

### 2.2 Recommendation must be role-based, not text-search-based
The thesis explicitly says recipe applicability must not depend only on text similarity. Ingredients in a recipe can be:
- **mandatory**
- **optional**
- **forbidden**
- **alternative / substitute**

Therefore the recommendation engine must reject, accept, or downgrade recipes using deterministic rules.

### 2.3 Premium / tenant isolation is thesis-critical
The thesis explicitly includes a **multi-tenant SaaS structure** where each dietitian owns a private recipe pool and premium users can access recipes belonging to their linked dietitian.

That means:
- Premium users should **primarily** see recipes from their linked dietitian.
- Private clinic recipes from other dietitians must never leak.
- Visibility and tenant isolation are not optional UX features; they are part of the thesis architecture.

### 2.4 The system must be measurable
The thesis requires logging and benchmarkability. That means we need structured logs and metrics for:
- exact / alias / fuzzy / LLM normalization rates
- unmatched / ambiguous rate
- full / substitute-based / partial / rejected recommendation counts
- false or irrelevant recommendation cases
- tenant isolation correctness

---

## 3) Current product problems to fix

These issues must be treated as thesis-breaking issues, not cosmetic issues.

### 3.1 Premium Kitchen logic is not sufficiently consistent
Observed product problem:
- Premium user selects ingredients like **nohut + yağ**
- System still suggests something logically unrelated such as **omlet** in clinic recipes

This is a major issue because it means the engine is likely ranking recipes without properly enforcing required ingredient logic and/or tenant priority.

### 3.2 Kitchen recommendations are not thesis-aligned enough
If a user selects a sparse ingredient set, the engine must not surface recipes that are clearly unsupported by required ingredients just because they are clinic recipes or have a loose score.

### 3.3 Result screen UX does not yet communicate trustworthy reasoning
The post-merge recipe results area must feel premium and also explain:
- why a recipe is shown
- whether it is full match / applicable via substitute / partial / blocked
- whether it comes from the linked dietitian pool
- what is missing
- why a recipe was prioritized

### 3.4 Kitchen design must support the thesis demo
The Kitchen flow is now a thesis showcase. It must make the recommendation engine feel:
- intelligent
- deterministic
- trustworthy
- premium
- clinically curated

---

## 4) Product/engineering target state

We want the Kitchen flow to behave like this:

1. User selects or enters ingredients.
2. Inputs are normalized into canonical ingredient identities.
3. Candidate recipes are filtered by **visibility + linked dietitian + premium rules**.
4. Each candidate is evaluated using **mandatory / optional / forbidden / alternative / taxonomy relationships**.
5. Irrelevant recipes are rejected.
6. Remaining recipes are scored and ranked deterministically.
7. Result UI shows the best recommendation clearly and explains the reasoning.
8. Logs are written so the thesis can report measurable outcomes.

---

## 5) Hard business rules for Premium Kitchen

Implement these rules decisively.

### 5.1 Premium user scope
If the current mobile user is premium and linked to a dietitian:

**First-class pool:**
- recipes owned by the linked dietitian
- clinic/private recipes intentionally shared with that dietitian's premium users
- optionally dietitian-prioritized public recipes if your current model supports them

**Secondary pool (optional, lower priority):**
- globally visible public recipes

**Never allowed:**
- private recipes belonging to a different dietitian
- premium/clinic recipes outside the user's linked tenant context

### 5.2 Ranking priority
For premium users, ranking order must strongly prefer:
1. linked dietitian's valid clinic/private recipes
2. linked dietitian's public recipes
3. globally visible public recipes

But **priority must not bypass recipe validity**.
A clinic recipe with missing mandatory ingredients must not outrank a logically correct public recipe just because it is a clinic recipe.

### 5.3 Recommendation validity principle
Do not show obviously wrong recipes.

Example:
- Selected: `nohut + yağ`
- Do **not** suggest omlet unless the recipe is actually modeled in a way that makes it legitimately applicable through valid substitute/optional logic.

If required ingredients are missing, the recipe must be:
- rejected, or
- heavily downgraded into a clearly labeled partial/non-applicable group

The default visible recommendation list should contain only **credible** suggestions.

---

## 6) Required recommendation model

## 6.1 Candidate recipe model assumptions
Each recipe should have ingredient-role definitions, such as:
- `mandatory`
- `optional`
- `forbidden`
- `alternativeGroup`
- `substituteAllowed`

If the current data model is incomplete, extend it in a minimal but correct way.

### 6.2 Ingredient relationship model
The engine must use taxonomy/relationship knowledge, not string matching only.

Support at least these concepts:
- canonical ingredient
- aliases
- family/group
- variant/member
- substitute compatibility
- disallowed variant / incompatible sibling

Example:
- `Yoğurt` = base family/canonical
- `Süzme Yoğurt` = acceptable substitute in some rules
- `Meyveli Yoğurt` = same family but not acceptable in every recipe

### 6.3 Evaluation categories
Each recipe result should end in one of these categories:
- **Exact / Full match** - all mandatory ingredients satisfied directly
- **Compatible substitute match** - mandatory satisfied through allowed substitute relationship
- **Partial / not yet applicable** - some optional matched but mandatory missing
- **Blocked** - forbidden ingredient present, or missing mandatory beyond acceptable rule threshold

### 6.4 Rejection rules
A recipe should be rejected from main results when any of these are true:
- missing one or more hard mandatory ingredients with no allowed substitute
- contains user-selected forbidden ingredient conflict under recipe rules
- belongs to another tenant's private pool
- is lower than minimum relevance threshold

You may still keep rejected or weak results in debug/logging, but do not surface them as normal user recommendations.

### 6.5 Score design
Use a deterministic score, for example:

```text
baseScore
+ tenantPriorityBoost
+ mandatoryCoverageScore
+ substituteCompatibilityScore
+ optionalCoverageBonus
- missingMandatoryPenalty
- forbiddenPenalty
- lowSpecificityPenalty
- weakMatchPenalty
```

### 6.6 Suggested scoring behavior
Use business-safe scoring logic like this:

- Full direct mandatory satisfaction: very high positive weight
- Allowed substitute for mandatory: positive but lower than direct match
- Optional ingredient matched: small positive weight
- Missing mandatory: heavy penalty
- Forbidden conflict: immediate block or massive penalty
- Linked dietitian ownership: priority boost only **after** recipe passes logical validity
- Public fallback recipe: allowed, but lower tenant priority

### 6.7 Minimum threshold
Do not show recipes with a score below a minimum display threshold.

If needed, return separate arrays:
- `featured`
- `validResults`
- `partialResults`
- `blockedOrRejected`

But the primary UI should emphasize only valid, trustworthy suggestions.

---

## 7) Multi-layer normalization requirements

The thesis requires multi-layer normalization. Implement or tighten this pipeline.

### 7.1 Layer order
1. **Exact canonical match**
2. **Alias match**
3. **Fuzzy match**
4. **LLM fallback** (bounded and controlled)

### 7.2 Exact canonical match
If normalized text directly equals a canonical ingredient name, resolve immediately.

### 7.3 Alias match
Use known synonyms, common spellings, Turkish/English variations, and user-facing aliases.

Examples:
- `yogurt` -> `Yoğurt`
- `suzme yogurt` -> `Süzme Yoğurt`
- `olive oil` -> `Zeytinyağı`

### 7.4 Fuzzy match
Use fuzzy logic for:
- missing Turkish characters
- small misspellings
- transpositions
- incomplete but highly likely strings

But do not let fuzzy match create unsafe random mappings.
Use confidence thresholds.

### 7.5 LLM fallback
Use only when exact/alias/fuzzy fail.

LLM fallback must:
- work on a bounded candidate list
- return confidence and reason if possible
- never bypass tenant or recommendation rules
- never silently hallucinate unsupported mappings

### 7.6 Normalization outputs
Each normalization event should return structured metadata, e.g.:

```json
{
  "rawInput": "suzme yogurt",
  "normalizedText": "suzme yogurt",
  "resolvedIngredientId": "ingredient_123",
  "resolvedCanonicalName": "Süzme Yoğurt",
  "layer": "alias",
  "confidence": 0.97,
  "isAmbiguous": false,
  "candidateSet": []
}
```

This is important for thesis logs and benchmarking.

---

## 8) Logging and benchmark requirements

This section is thesis-critical. Claude must not ignore it.

### 8.1 Normalization log
Create or improve structured logs capturing:
- raw input
- normalized input
- matched canonical ingredient
- layer used (`exact`, `alias`, `fuzzy`, `llm`, `unmatched`, `ambiguous`)
- confidence
- ambiguity info
- timestamp
- user id / tenant context (if safe)

### 8.2 Recommendation log
Create or improve logs capturing:
- selected ingredient ids
- linked dietitian id
- premium/free status
- candidate count before filtering
- candidate count after tenant filtering
- candidate count after rule filtering
- winning recipe id
- result category (`full`, `substitute`, `partial`, `blocked`)
- missing mandatory list
- forbidden conflicts
- final score

### 8.3 Benchmark support
Support benchmark/test cases that can answer:
- What percent resolved via exact/alias/fuzzy/LLM?
- How many inputs remained unmatched/ambiguous?
- How often did recommendations fall into full/substitute/partial/blocked?
- What is the false suggestion rate?
- Were premium tenant boundaries respected 100%?

### 8.4 False suggestion tracking
Specifically record and test false suggestions such as:
- selected set weakly overlaps with recipe but recipe is still surfaced inappropriately
- clinic recipe surfaced despite missing mandatory ingredients
- recipe surfaced from the wrong dietitian pool

This is essential for thesis defensibility.

---

## 9) API and backend expectations

Claude should inspect the current backend and improve the Kitchen recommendation endpoint accordingly.

## 9.1 Endpoint contract expectations
The Kitchen match endpoint should return enough data for trustworthy UI.

Suggested response shape:

```json
{
  "featured": { ... },
  "validResults": [ ... ],
  "partialResults": [ ... ],
  "meta": {
    "selectedIngredientIds": [ ... ],
    "selectedIngredientNames": [ ... ],
    "premium": true,
    "activeDietitianId": "...",
    "tenantRecipeCount": 12,
    "publicRecipeCount": 8,
    "normalizationSummary": {
      "exact": 1,
      "alias": 1,
      "fuzzy": 0,
      "llm": 0,
      "unmatched": 0,
      "ambiguous": 0
    }
  }
}
```

Adjust to the existing codebase, but keep the same spirit.

### 9.2 Backend behavior
The endpoint must:
1. Resolve selected ingredients to canonical IDs
2. Determine tenant context
3. Filter candidate recipes by tenant visibility and premium rules
4. Evaluate recipe rules deterministically
5. Rank valid candidates
6. Return explainable payloads
7. Log normalization and recommendation execution

### 9.3 Recipe explanation fields
Each returned recipe should ideally include explanation-ready fields like:
- `score`
- `matchedMandatory`
- `matchedOptional`
- `missingMandatory`
- `usedSubstitutes`
- `forbiddenConflicts`
- `isDietitianRecipe`
- `dietitianPriority`
- `reasonLabel` or equivalent

These fields are valuable both for UI and thesis explanation.

---

## 10) Mobile Kitchen UX requirements

The Kitchen flow must become a thesis showcase.

### 10.1 KitchenScreen
Keep or improve:
- ingredient entry/search
- selected ingredient chips or capsules
- premium combine CTA
- polished motion

But ensure:
- **Combine / Find Recipes button stays fixed correctly**
- it never slips under the bottom navigation area
- it is safe-area aware from first render
- it does not shift unpredictably on keyboard focus

### 10.2 Combine CTA behavior
The CTA should always be visible and should communicate readiness clearly.

Suggested states:
- Empty: disabled but premium, with helper text
- Ready: active, high-emphasis, includes selected ingredient count
- Merging: transitions into analysis state

### 10.3 Merge/loading experience
After tapping the combine button, the result-loading area must feel significantly more premium.

Requirements:
- visually centered reactor/core
- cleaner, more professional composition
- no cluttered loading state
- premium motion
- clear explanation text such as:
  - `Tarif motoru çalışıyor`
  - `Malzemeler analiz ediliyor`
  - `Uyumlu tarifler hazırlanıyor`

This screen must feel like an intelligence engine, not a generic spinner.

---

## 11) Recipe results screen requirements

This is one of the biggest problem areas. Claude must improve both logic and design.

### 11.1 Main UX goal
The post-merge recipe area must look premium and also communicate trustworthy relevance.

### 11.2 Required result hierarchy
Use a strong editorial hierarchy such as:
1. **Best recommendation / featured recipe**
2. **Linked dietitian valid recipes**
3. **Other valid public recipes**
4. **Partial / missing-ingredient suggestions** (optional, clearly labeled)

### 11.3 Dietitian recipe priority
For premium users:
- recipes from the linked dietitian should be visually prioritized **if they are logically valid**
- invalid clinic recipes must not be artificially promoted

### 11.4 Explanation UI
Each recipe card should communicate:
- why it is recommended
- whether it is a clinic recipe
- whether it is full or substitute-based match
- what is missing if partial

### 11.5 Design requirements
The results area should be redesigned to feel:
- more premium
- less list-like
- more report/editorial-like
- more clinically curated
- more trustworthy

### 11.6 Strong visual states
Use clearer states for:
- Full match
- Valid via substitute
- Partial / missing ingredients
- Not shown / blocked (logged but not user-facing)

### 11.7 No misleading hero recommendation
Do not feature a clinic recipe if it is logically weaker than another valid result.
The featured card must be both:
- highly ranked
- defensibly relevant

---

## 12) Concrete recommendation logic examples

These examples should become automated tests.

### Example A - thesis positive path
Dietitian recipe:
- `Yoğurtlu Yulaf Kasesi`
- mandatory: `Yoğurt`, `Yulaf`
- optional: `Muz`
- incompatible variant: `Meyveli Yoğurt`
- allowed substitute: `Süzme Yoğurt` for `Yoğurt`

User input:
- `suzme yogurt`
- `yulaf`
- `muz`

Expected behavior:
- normalization resolves correctly
- substitute rule accepts `Süzme Yoğurt`
- recipe is surfaced as valid / full-ish substitute-compatible result
- explanation says why

### Example B - thesis negative path
Selected:
- `nohut`
- `yağ`

Recipe:
- `Omlet`
- mandatory: `Yumurta`
- optional: `Peynir`

Expected behavior:
- omlet is **not** surfaced as main valid recommendation
- missing mandatory `Yumurta` should block or severely downgrade it
- if shown at all, it must be clearly outside main valid results

### Example C - tenant isolation
Premium user linked to Dietitian A.
Dietitian B has a private clinic recipe.

Expected behavior:
- Dietitian B private recipe never appears
- only Dietitian A private/clinic recipes and allowed public recipes are considered

### Example D - incompatible variant
Recipe expects plain yogurt family compatibility but explicitly disallows fruit yogurt variant.
Selected:
- `meyveli yoğurt`
- `yulaf`

Expected behavior:
- recipe not treated as full valid match
- system either rejects or downgrades with clear reason

---

## 13) Acceptance criteria

Claude's work is only acceptable if these are true.

### 13.1 Logic acceptance
- Premium users primarily see their linked dietitian's recipes
- No cross-tenant private recipe leakage
- Obviously irrelevant recipes are filtered out
- Mandatory / optional / forbidden / substitute rules all affect scoring
- Nohut + yağ does not surface omlet as a valid top recommendation
- Normalization layer info is loggable
- Recommendation results are explainable

### 13.2 UX acceptance
- Combine CTA is stable and correctly fixed
- Merge screen feels premium and centered
- Result screen is visually strong and trustworthy
- Featured recipe is defensibly the best recommendation
- Clinic recipe priority is visible but not logically abusive

### 13.3 Thesis acceptance
- The implementation visibly demonstrates the thesis problem and solution
- The system can produce logs/metrics for evaluation
- The Kitchen flow now showcases multi-layer normalization + rule-based recommendation + tenant isolation

---

## 14) Deliverables Claude should produce

Claude should not respond with only surface styling.

I want Claude to deliver:

1. **Backend logic improvements** for normalization, filtering, rule evaluation, ranking, and logs
2. **Kitchen result API improvements** if needed
3. **Mobile Kitchen UI improvements** for combine flow and result screen
4. **Recipe card/result hierarchy redesign**
5. **Tests / scenarios / benchmark cases** matching the thesis
6. **A short implementation summary** showing how the thesis is now reflected in the product

---

## 15) Files and areas Claude should inspect

Claude should inspect the current project and update the appropriate files. At minimum, inspect:

### Mobile
- `mobile-app/src/screens/KitchenScreen.tsx`
- `mobile-app/src/screens/KitchenResultScreen.tsx`
- recipe/result-related components used by the Kitchen flow

### Backend
- Kitchen match/recommendation endpoint
- ingredient normalization / search / alias / fuzzy matching logic
- recipe rule evaluation services
- dietitian-premium visibility / tenant isolation logic
- logging / benchmark tables or services

### Web panel
- recipe authoring model
- ingredient role definitions
- dietitian recipe ownership / visibility settings

Do not guess. Inspect real implementation and align changes with existing architecture.

---

## 16) Implementation priorities

Priority order:

### Priority 1 - Correctness
- tenant isolation
- mandatory ingredient enforcement
- substitute logic
- removal of obviously wrong recommendations

### Priority 2 - Thesis evidence
- normalization logs
- recommendation logs
- measurable metrics
- benchmark cases

### Priority 3 - Premium Kitchen UX
- stable combine CTA
- premium merge/loading state
- premium result screen with strong hierarchy

### Priority 4 - Final polish
- motion refinement
- card polish
- microcopy polish

---

## 17) Instruction to Claude

Claude, your task is to make the implementation thesis-aligned, measurable, logically correct, and product-grade.

Do **not** only polish the UI.
Do **not** only improve animations.
Do **not** rank clinic recipes above logic.
Do **not** show irrelevant recommendations just because a recipe is premium or clinic-owned.

You must make the Kitchen flow demonstrate:
- multi-layer normalization
- ingredient taxonomy
- rule-based recommendation
- premium dietitian recipe isolation
- explainable result ranking
- measurable logs
- premium result UX

This work should make the thesis visible in the running product.

