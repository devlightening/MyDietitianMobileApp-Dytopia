Mevcut pipeline artık uçtan uca doğrulandı:
detect -> resolve -> review -> confirm -> kitchen -> tarif bul zinciri çalışıyor.

Şimdi `claude_full_db_vision_resolver_plan.md` planına geçiyoruz.

Ama çok önemli bir sınır var:

* Mevcut çalışan detection pipeline’ı bir anda bozma
* Öncelik resolver tarafında seed-first bağımlılığı kaldırmak
* `VisionLabelMappings` helper/cache olsun
* asıl ingredient universe tüm `Ingredients` tablosu olsun
* detection prompt tarafındaki closed-set mantığını ilk adımda tamamen sökme
* önce resolver’ı full DB-driven yap, çalışan akışı koru
* sonra gerekiyorsa detection universe genişletmesini ikinci adım olarak öner

Önce mevcut resolver ve VisionLabelMappings kullanımını analiz et.
Sonra MD planına göre kontrollü implementasyona başla.
Session sonunda bana:

1. seed-first bağımlılığın nerelerde kaldığını
2. full DB resolution’ın nasıl çalıştığını
3. hangi davranışların korunduğunu
4. detection tarafında neyi bilerek değiştirmediğini
   raporla.






# MyDietitian — Full Ingredients–Driven Vision Resolver Plan
## Claude Implementation Brief

## Objective
Build the image-to-ingredient pipeline professionally so that the existing **resolver + cache + review** architecture is used to its full effect, while **removing dependency on hand-maintained seed mapping as the primary source of truth**.

The system must work against the **entire `Ingredients` table**, not just a small seeded subset.

The user should be able to take a food photo, and the system should:
1. detect candidate food/product labels from the image,
2. resolve those labels against the application's real ingredient database,
3. show high-confidence matches automatically,
4. send ambiguous matches to user review,
5. only mark confirmed/resolved items as selected before recipe matching.

This plan is designed to continue from the current project state without destroying working flows.

---

## Critical product decision
We are **not** continuing with the idea that a small seed dataset is the real detection universe.

### New rule
- `Ingredients` table is the **true ingredient universe**
- `VisionLabelMappings` is only an **assistive cache/acceleration layer**
- If a label is not already in `VisionLabelMappings`, the system must still try to resolve it using:
  - aliases
  - canonical names
  - normalization
  - fuzzy similarity
  - optional LLM-assisted normalization when needed

### Therefore
The system should understand image results even if the raw labels are in English and the database canonical names are in Turkish.

Examples:
- `tomato` -> `Domates`
- `cucumber` -> `Salatalık`
- `chicken breast` -> `Tavuk Göğsü`
- `romaine lettuce` -> `Marul`
- `lemon` -> `Limon`

This matching must happen through the real DB-driven resolution chain, not by relying only on pre-seeded label rows.

---

## Non-negotiable implementation principles
1. Do not break the current kitchen/manual ingredient selection flow.
2. Do not treat `VisionLabelMappings` as the only source of truth.
3. Do not require manual seed coverage for every ingredient before the feature works.
4. Use the entire `Ingredients` table dynamically.
5. Keep review mandatory for uncertain matches.
6. Only resolved ingredients become selected items before recipe matching.
7. Mobile app must never directly hold API keys.
8. Backend remains the source of truth for label resolution and ingredient confirmation.

---

# Target architecture

## Final chain
**Photo -> Detection -> Resolver -> Cache -> Review -> Selected Ingredient IDs -> Recipe Match**

### 1. Detection
Image is analyzed by the current vision source.

Current reality of the repo:
- primary image analysis is remote vision, not true on-device
- keep that for now unless architecture is explicitly changed later

### 2. Resolver
The resolver must become the heart of the system.

Input:
- raw labels from image model

Output:
- matched ingredient result objects with confidence and review flags

### 3. Cache
`VisionLabelMappings` should become:
- a learned shortcut
- a confidence memory
- a speed improvement layer

Not the only matching source.

### 4. Review
If confidence is not good enough or the label is too generic:
- user reviews and confirms

### 5. Selection
Only confirmed or high-confidence resolved ingredients are added as selected ingredients for kitchen matching.

---

# What Claude must change conceptually

## Current issue to fix
The current direction risks over-relying on seed data.

That is not acceptable for the long-term product behavior.

### New target behavior
When a raw image label comes in:
- first check cached mapping if available
- but if mapping is missing, still attempt resolution using the full DB

This means the resolver must be **DB-driven**, not seed-driven.

---

# Resolution strategy — required order

For each `rawLabel`, apply this exact sequence:

## Layer 1 — Exact canonical name match
Try exact match against:
- `Ingredients.Name`
- `Ingredients.CanonicalName`

Case-insensitive and normalized.

## Layer 2 — Exact alias match
Try exact match against:
- `Ingredients.Aliases` JSON array
- normalized comparison

This should work for both Turkish and English aliases already stored in DB.

## Layer 3 — VisionLabelMappings cache match
If a cached mapping exists:
- use it as a strong shortcut
- approved mapping can boost confidence
- provisional mapping can still require review

Important:
This is not the first and only truth layer.
It is a performance/helper layer.

## Layer 4 — Normalization pipeline
Normalize the raw label before matching.

Must include:
- lowercase
- whitespace normalization
- punctuation cleanup
- ASCII/Turkish variant handling
- singular/plural cleanup where possible
- common food wording cleanup

Examples:
- `tomatoes` -> `tomato`
- `romaine lettuce` stays meaningful
- `tavuk gogsu` -> `tavuk göğsü`
- `kirmizi biber` -> `kırmızı biber`

## Layer 5 — Fuzzy candidate search over Ingredients
Search across the full ingredient universe using fuzzy similarity against:
- canonical names
- display names
- aliases

This should return ranked candidates, not an immediate blind selection.

## Layer 6 — Optional LLM normalization / semantic assist
Only if the above fails or is low-confidence:
- use the existing LLM/vision normalization assist carefully
- ask for canonical food identity, not direct pantry selection
- still resolve final answer against DB

This step is an assistive step, never the source of truth.

## Layer 7 — Unresolved
If nothing is strong enough:
- mark unresolved
- do not auto-select
- allow review/search fallback

---

# Confidence and selection rules

## Auto-select only if all are true
- high confidence
- specific enough label
- clear ingredient match
- no near-tie ambiguity
- no generic category problem

Examples that may auto-select:
- tomato
- cucumber
- broccoli
- lemon
- banana
- chicken breast

## Review required if any of these is true
- generic label (`pepper`, `cheese`, `chicken`, `milk`)
- multiple close candidates
- provisional mapping
- fuzzy-only weak match
- LLM-assisted semantic guess
- label not specific enough

## Never auto-select
- unresolved
- category-only detection
- low confidence semantic guess
- obvious family mismatch

---

# Cache strategy — how VisionLabelMappings should really be used

## New role of VisionLabelMappings
It is a **dynamic acceleration layer**, not a static seed dependency.

### Use it for:
- fast lookup for previously resolved labels
- confidence memory
- approved reviewer-confirmed mappings
- reducing repeated expensive semantic work

### Do not use it as:
- the only resolution source
- a requirement for all ingredients to exist before feature works

## Recommended evolution
Whenever a user confirms a reviewed match:
- update or create a `VisionLabelMappings` record
- increase trust for that label over time

This makes the system improve from real usage.

---

# Seed data policy
## Important change
We do **not** want the system to depend on manually curated seed data forever.

### New policy
- existing seed rows may remain as bootstrap data
- but feature logic must work even if a label is not seeded
- the full `Ingredients` table must always be considered

### Therefore
Claude must revise any code path that assumes:
> "if mapping not in VisionLabelMappings, then detection is effectively unknown"

That assumption must be removed.

---

# Entire Ingredients table must be used
This is mandatory.

## Requirement
The resolver must dynamically search across the whole `Ingredients` table.

That includes:
- all canonical names
- all display names
- all aliases
- current and future rows

If a new ingredient is added tomorrow in admin/web panel,
the image resolver should be able to match to it without requiring a new seed deployment, as long as aliases and canonical information are sufficient.

---

# Backend responsibilities
Claude must keep the heavy logic in backend.

## Backend must own:
- raw label normalization
- candidate resolution
- confidence scoring
- cache lookup/update
- review flagging
- final ingredient identity

## Backend endpoints should support
- image analysis request
- structured detection result response
- review confirmation
- optional mapping promotion/update after confirmation

---

# Expected response model
The image analysis result should return structured objects like:

```json
{
  "sessionId": "guid",
  "totalDetected": 5,
  "matched": [
    {
      "rawLabel": "tomato",
      "normalizedLabel": "tomato",
      "matchedIngredientId": "uuid",
      "matchedIngredientName": "Domates",
      "confidence": 0.94,
      "matchType": "exact_alias",
      "isAutoSelected": true,
      "requiresReview": false
    }
  ],
  "review": [
    {
      "rawLabel": "pepper",
      "normalizedLabel": "pepper",
      "candidateIngredientIds": ["uuid1", "uuid2"],
      "candidateIngredientNames": ["Biber", "Kırmızı Biber"],
      "confidence": 0.68,
      "matchType": "generic_label",
      "isAutoSelected": false,
      "requiresReview": true
    }
  ],
  "unresolved": [
    {
      "rawLabel": "unknown_food",
      "normalizedLabel": "unknown_food",
      "confidence": 0.12,
      "matchType": "unresolved",
      "isAutoSelected": false,
      "requiresReview": false
    }
  ]
}
```

---

# Mobile behavior
Mobile must reflect backend truth.

## In scan results UI:
### Green
- safely resolved
- pre-selected

### Yellow
- review required
- user must choose

### Red
- unresolved
- not selected

## Important
The user must see resolved ingredient names from the DB, not just raw English labels.

Example:
- raw label: `tomato`
- shown label: `Domates`

If review is required:
- show the user-facing ingredient candidates from DB
- not just raw model output

---

# Review confirmation flow
When user confirms a yellow item:
1. matched ingredient becomes selected
2. result is stored as accepted
3. optional cache/mapping update may occur
4. ingredient is added to selected ingredient chips before recipe matching

This means review is not just UI; it is learning data.

---

# Logging and metrics
The existing logging tables must be used professionally.

## IngredientImageDetectionLogs should support thesis/product metrics:
- how many raw labels came from image
- how many auto-selected
- how many required review
- how many unresolved
- how many user-confirmed
- how many were corrected
- latency
- provider used
- whether cached mapping existed
- whether LLM assist was needed

## This allows measurement of:
- auto-select rate
- review rate
- unresolved rate
- correction rate
- cache usefulness
- approximate cost reduction

---

# Cost reduction logic — make it actually effective
If you want resolver + cache + review to save real money, use them like this:

## Expensive part
The remote vision call that turns image into initial labels.

## Money-saving parts
### Resolver
Reduces wrong selections and avoids repeated downstream retries.

### Cache
Makes repeated labels faster and more reliable.
Also reduces need for deeper normalization/semantic escalation.

### Review
Avoids bad automatic pantry pollution, which would otherwise damage recipe matching quality.

## Additional professional rule
If a label has already been confidently resolved before, do not send it into deeper fallback logic again unless confidence/regime changed.

---

# Required implementation tasks for Claude
Claude must revise the system so that:

1. `VisionLabelMappings` is treated as helper/cache, not as the primary universe.
2. Resolver actively queries the full `Ingredients` table.
3. Alias + canonical + fuzzy logic works even for non-seeded labels.
4. Review flow returns DB-matched candidates, not raw ambiguous strings only.
5. Confirmation can feed back into mapping/cache.
6. The result sent to kitchen before recipe match contains only resolved ingredient IDs.

---

# Sessionized execution request
Do not implement this as a giant uncontrolled refactor.

## First do analysis
Before code changes:
- inspect current resolver
- inspect current vision service
- inspect current use of `VisionLabelMappings`
- inspect current ingredient alias resolution logic
- identify everywhere that still assumes seed-first behavior

Then implement carefully.

---

# Acceptance criteria
All must be true:

1. A raw image label can resolve through the full `Ingredients` table even if not pre-seeded.
2. `VisionLabelMappings` helps but does not gate the feature.
3. English labels can resolve to Turkish DB ingredients.
4. High-confidence specific labels auto-select.
5. Generic labels require review.
6. Unresolved labels do not pollute pantry selection.
7. Review candidates come from the DB.
8. Confirmed review can strengthen future mapping behavior.
9. Only resolved ingredient IDs proceed to recipe matching.
10. Existing kitchen/manual flows remain stable.

---

# Deliverables Claude must return
After implementation, return:
1. root cause analysis of current seed dependence
2. files changed
3. how full-DB resolution now works
4. whether `VisionLabelMappings` is now helper/cache only
5. example matches:
   - tomato -> Domates
   - cucumber -> Salatalık
   - chicken breast -> Tavuk Göğsü
   - romaine lettuce -> Marul
   - lemon -> Limon
   - pepper -> review
6. what gets logged
7. how confirmed review updates future behavior
8. remaining risks
