# MyDietitian — Web Panel Recipe Import (DOCX / XLSX / CSV) Implementation Spec

## Document purpose

This document defines a complete implementation brief for adding recipe import via drag-and-drop to the dietitian web panel.

Goal:
- Dietitians can still create recipes manually from the advanced recipe editor.
- Dietitians can also drag and drop DOCX / XLSX / CSV files containing recipes.
- The system parses uploaded files, converts them into the app’s structured recipe schema, shows a review/preview screen, lets the dietitian correct issues, and only then persists the recipes to the database.

This is not a mock-only task.
This must be implemented across:
- Backend API
- Domain / Application / Infrastructure layers
- Database
- Web panel UI
- Validation / review / confirm flow
- Tests

---

# 1. Product goal

The web panel already supports manual recipe entry.
Now we want to add a second input mode:

1. Manual mode
   - Dietitian enters recipe by hand through the advanced editor.

2. Import mode
   - Dietitian drags and drops a DOCX / XLSX / CSV file.
   - System analyzes the file.
   - Extracts recipes and ingredients.
   - Tries to match ingredient names to the existing ingredient dictionary / taxonomy.
   - Shows a structured preview.
   - Dietitian fixes unmatched or ambiguous parts.
   - User confirms import.
   - Recipes are inserted into the real recipe tables.

This feature should make the panel feel like:
- “I am not typing everything from scratch”
- “I can migrate my clinic’s existing recipe archive into the system”
- “The app turns my unstructured files into structured clinical recipe data”

---

# 2. Core product principles

## 2.1 Import must never directly write to production recipe tables on upload
Uploading a file must not immediately create real recipes.

Correct pipeline:

Upload → Parse → Normalize → Match → Validate → Preview → Dietitian Fixes → Confirm → Save

Only the Confirm step writes to real recipe tables.

---

## 2.2 AI is optional, not required
The first production version must be built without depending on AI.

Rules:
- XLSX / CSV: deterministic, rule-based parsing
- DOCX: deterministic extraction first
- AI can be added later as an optional improvement layer for messy documents, but the core feature must work without it

---

## 2.3 Imported recipes must end up in the same schema as manually entered recipes
The output of import is not a separate fake recipe type.

Imported recipes must become the same structured entity model used by the web panel:
- title
- description
- ingredients
- amount
- unit
- role
- tags
- visibility
- dietitian ownership
- optional prohibited items / notes / metadata if supported by existing schema

---

## 2.4 Ingredient names must be standardized
User-facing file content may contain:
- domates
- çeri domates
- salkım domates
- suzme yogurt
- süzme yoğurt

The system must try to map them into the project’s canonical ingredient structure.

This is critical because the recommendation / matching engine depends on clean canonical ingredient IDs.

---

# 3. Where this fits in the current product

The project already has the concept of:
- dietitian-owned recipe content
- signature / private recipes
- advanced recipe editor with ingredient roles
- ingredient dictionary / normalization layer
- private repository behavior for premium users

This import feature must integrate into that architecture, not bypass it.

Imported recipes should support:
- private/signature recipes
- public recipes if allowed by the current panel
- dietitian-scoped ownership
- ingredient role logic such as:
  - mandatory
  - optional
  - substitute
  - prohibited if the recipe model already supports it

---

# 4. Classification

Classification: PRODUCT-POLISH
Secondary Value: Demo readiness / real product value / B2B SaaS readiness
Thesis Relation: Not thesis-core. Do not break or delay TEZ-CORE / INTEGRATION-PROOF items to implement this.

---

# 5. User story

## Primary user story
As a dietitian,
I want to upload my existing recipe files (DOCX / XLSX / CSV) into the panel,
so I do not need to manually retype my recipe archive.

## Secondary user story
As a dietitian,
I want the import flow to detect problems before saving,
so that I can fix ingredient matches, quantities, and roles safely.

## Tertiary user story
As a premium-content owner,
I want imported recipes to become my private / signature recipe pool,
so my connected clients can later see them in the app.

---

# 6. Supported file formats

## Phase 1 required
- .xlsx
- .csv

## Phase 2 required
- .docx

## Not required now
- .pdf
- image OCR
- handwritten notes
- .doc
- copy/paste rich text ingestion

---

# 7. Expected input models

## 7.1 XLSX / CSV expected structure
The importer should support a template-friendly tabular format.

Recommended columns:

- recipe_title
- recipe_description
- meal_type
- visibility
- tags
- ingredient_name
- amount
- unit
- role
- group_key
- notes

Behavior:
Each row represents one ingredient row.
Rows with the same recipe_title belong to the same recipe.

Supported role values:
- mandatory
- optional
- substitute
- prohibited

Accepted synonyms should also be normalized:
- zorunlu → mandatory
- opsiyonel → optional
- alternatif → substitute
- yasak → prohibited

---

## 7.2 DOCX expected structure
DOCX parsing should support structured clinic documents where recipes are written in a fairly readable format.

Example pattern:

Ton Balıklı Salata
Açıklama: Yüksek proteinli hafif öğün.

Malzemeler:
- 1 kutu ton balığı
- 2 adet domates
- 1/2 limon
- İsteğe bağlı dereotu

Hazırlanışı:
- Tüm malzemeleri karıştır.
- Soğuk servis et.

DOCX parsing rules:
- recipe title
- optional description
- ingredient block
- step / preparation block

Acceptable structures:
- heading + paragraphs
- bullet lists
- numbered lists
- simple tables

If a DOCX is too unstructured:
- create issues/warnings
- do not fail silently
- still try to produce preview candidates where possible

---

# 8. End-to-end workflow

## Step 1 — User enters import mode
In /dashboard/recipes, add an import entry point:
- “Tarif İçe Aktar” button
- drag-and-drop dropzone
- accepted formats: .xlsx, .csv, .docx

The manual editor must remain available.

## Step 2 — Upload
Frontend uploads the file to backend.

Recommended endpoint:
POST /api/dietitian/recipes/imports

Multipart form data:
- file
- optional defaults:
  - defaultVisibility
  - defaultMealType
  - defaultTags
  - defaultOwnershipMode

Response:
- creates an import session
- returns a session ID and parse result summary

## Step 3 — Parse
Backend selects parser based on extension.

Suggested parser services:
- IRecipeImportParser
- ExcelRecipeImportParser
- CsvRecipeImportParser
- DocxRecipeImportParser

Output of parsers must be a raw candidate model, not domain entities yet.

## Step 4 — Normalize
Raw content is cleaned and standardized.

Normalization tasks:
- trim
- lowercase compare form
- Turkish diacritic-safe compare form
- normalize units (gr, gram, g → g)
- normalize amounts (yarım, 1/2 → 0.5)
- normalize role names
- normalize visibility values
- normalize ingredient raw strings

## Step 5 — Match to ingredient dictionary
For each imported ingredient:
- attempt exact canonical match
- attempt alias match
- attempt normalized compare match
- optionally attempt fuzzy match under safe threshold

Possible outcomes:
1. matched
2. ambiguous
3. unmatched

Each imported ingredient must store:
- raw text
- normalized text
- matched ingredient id if found
- confidence / match type
- issue state if unresolved

## Step 6 — Validate
Recipe-level validations:
- missing title
- no ingredients
- duplicate titles within same upload
- duplicate title against existing dietitian recipes
- unsupported visibility
- unsupported role value

Ingredient-level validations:
- ingredient unmatched
- missing amount
- missing unit
- invalid numeric amount
- ambiguous ingredient match
- empty ingredient row

Validation severity:
- info
- warning
- error

## Step 7 — Preview
Backend returns structured preview DTO.

Frontend shows:
- summary cards
- per recipe:
  - title
  - description
  - ingredient list
  - role chips
  - amount/unit
  - visibility
  - match status
  - issues

## Step 8 — Dietitian fixes issues
Editable items:
- recipe title
- description
- visibility
- tags
- ingredient match
- amount
- unit
- role
- remove ingredient
- remove recipe
- merge duplicate recipes
- choose:
  - create new
  - update existing
  - skip

## Step 9 — Confirm import
Frontend sends resolved import payload.

Endpoint:
POST /api/dietitian/recipes/imports/{sessionId}/confirm

Backend:
- revalidates everything
- starts transaction
- inserts final real recipes
- inserts recipe ingredients / roles
- applies ownership / visibility
- marks import session as completed

---

# 9. Backend architecture

## 9.1 High-level layers

API layer:
- upload endpoint
- preview endpoint(s)
- review/update endpoint(s)
- confirm endpoint
- import history endpoint (optional)

Application layer:
- orchestration
- commands / queries
- DTO mapping
- validation flow
- session lifecycle

Domain layer:
- import session states
- issue types
- import rules
- recipe ownership rules
- invariants

Infrastructure layer:
- file parsing
- file storage
- repository access
- dictionary matching
- persistence

## 9.2 Suggested application services
- RecipeImportOrchestrator
- RecipeImportNormalizationService
- RecipeImportIngredientMatchingService
- RecipeImportValidationService
- RecipeImportPreviewService
- RecipeImportCommitService

Parser services:
- ExcelRecipeImportParser
- CsvRecipeImportParser
- DocxRecipeImportParser

Support services:
- ImportFileStorageService
- RecipeDuplicateDetectionService
- RecipeImportAuditService

---

# 10. Database design

## 10.1 Why staging tables are required
Do not write raw uploads straight into Recipes.

We need a staging/import area because:
- files may contain bad data
- user must review before commit
- we need issue tracking
- we need safe rollback
- we may want import history later

## 10.2 Recommended tables

### RecipeImportSessions
Columns:
- Id
- DietitianId
- OriginalFileName
- StoredFilePath or blob reference
- FileType
- Status (Uploaded, Parsed, NeedsReview, ReadyToConfirm, Completed, Failed, Cancelled)
- CreatedAtUtc
- UpdatedAtUtc
- CompletedAtUtc
- SummaryJson

### RecipeImportSessionRecipes
Columns:
- Id
- SessionId
- RawTitle
- NormalizedTitle
- Description
- MealType
- Visibility
- TagsJson
- Status
- DuplicateResolutionMode (CreateNew, UpdateExisting, Skip)
- TargetRecipeId nullable
- DisplayOrder

### RecipeImportSessionIngredients
Columns:
- Id
- SessionRecipeId
- RawName
- NormalizedName
- AmountRaw
- AmountValue nullable
- UnitRaw
- UnitNormalized
- RoleRaw
- RoleNormalized
- MatchedIngredientId nullable
- MatchType (Exact, Alias, Normalized, Fuzzy, Manual, None)
- MatchConfidence nullable
- IsResolved
- DisplayOrder

### RecipeImportSessionIssues
Columns:
- Id
- SessionId
- SessionRecipeId nullable
- SessionIngredientId nullable
- Severity
- Code
- Message
- MetadataJson
- IsResolved
- ResolvedAtUtc

### Optional: RecipeImportAuditLogs
Columns:
- Id
- SessionId
- Action
- ActorDietitianId
- PayloadJson
- CreatedAtUtc

---

# 11. Real recipe persistence rules

When confirm succeeds, create real data in existing domain tables.

Expected target:
- Recipes
- RecipeIngredients / join table(s)
- tags / steps / notes tables if present in current schema

Required ownership:
- imported recipes belong to the current authenticated dietitian
- default visibility should usually be private/signature
- public publication must only be allowed if current product rules allow it

Important:
A premium client must later only see recipes allowed for their linked dietitian context.

---

# 12. Security and authorization

Required rules:
- Only authenticated dietitians can import recipe files
- One dietitian cannot access another dietitian’s import sessions
- One dietitian cannot confirm or edit another dietitian’s staged import
- Public recipe visibility must be validated, not blindly trusted from file input
- File type and size must be validated server-side
- Malicious upload types must be rejected
- Parsing must not execute macros or unsafe content

Suggested file restrictions:
- .xlsx
- .csv
- .docx
- max upload size configurable
- reject .xlsm, .exe, .zip, .rar, .pdf for now

---

# 13. Frontend implementation — web panel

## 13.1 Recipes page structure
The current /dashboard/recipes page should be enhanced with:
- existing manual recipe editor
- recipe list / library
- import trigger
- import review modal or dedicated route

Recommended UI architecture:
- manual form stays in current page
- import opens:
  - either right-side drawer
  - or full-page wizard at /dashboard/recipes/import

Recommended choice:
Use a dedicated route/wizard because preview and correction UI will grow large.

## 13.2 New web components
- RecipeImportButton
- RecipeImportDropzone
- RecipeImportWizard
- RecipeImportStepHeader
- RecipeImportSummaryCards
- ImportedRecipeCard
- ImportedIngredientRow
- ImportIssueBadge
- IngredientMatchSelect
- RoleSelector
- VisibilitySelector
- DuplicateResolutionSelector
- ImportConfirmPanel
- ImportCompletionState

## 13.3 UX states
- Empty state
- Hover state
- Uploading state
- Parsed state
- Needs review state
- Ready state
- Completed state
- Failed state

---

# 14. Import wizard steps
A — Upload
B — Parse result
C — Review
D — Confirm
E — Complete

---

# 15. Import behavior by file type

## 15.1 CSV
Most deterministic.
Use header-based mapping.
If headers do not match exactly, support a fallback header alias map.

## 15.2 XLSX
Support the same logical model as CSV.
Read first sheet by default.
Ignore blank rows.

## 15.3 DOCX
DOCX importer must:
- extract paragraphs
- detect headings
- detect list blocks
- detect tables
- group content into recipe blocks

Minimum supported patterns:
1. Heading + ingredient bullets + preparation bullets
2. Recipe title line + Malzemeler + list
3. Table with recipe name and ingredient lines

If parse confidence is weak:
- still create preview draft
- surface warning

---

# 16. Ingredient matching strategy

Match order:
1. exact canonical name
2. alias match
3. normalized compare match
4. safe fuzzy match
5. unresolved

Match confidence:
- HIGH
- MEDIUM
- LOW
- UNRESOLVED

Review rules:
- HIGH can be auto-accepted
- MEDIUM can be shown but still accepted automatically unless user changes
- LOW should create warning
- UNRESOLVED should create error or blocking review item

---

# 17. Duplicate handling

When imported recipe title matches an existing dietitian recipe:
show duplicate resolution options.

For each duplicate:
- Create new recipe
- Update existing recipe
- Skip this recipe

Do not auto-update existing recipes without explicit dietitian choice.

---

# 18. Validation rules

Recipe-level blocking errors:
- no title
- no ingredients
- invalid visibility value
- unresolved duplicate choice when required

Ingredient-level blocking errors:
- no ingredient name
- unmatched ingredient still unresolved
- invalid amount format if amount provided but unparsable

Non-blocking warnings:
- no description
- no unit
- optional ingredient with missing amount
- low-confidence fuzzy match
- partial DOCX parse

---

# 19. API contract proposal

POST /api/dietitian/recipes/imports
- creates import session and parses file

GET /api/dietitian/recipes/imports/{sessionId}
- returns preview state

PUT /api/dietitian/recipes/imports/{sessionId}/review
- saves user corrections to staged data

POST /api/dietitian/recipes/imports/{sessionId}/confirm
- commits staged recipes to real tables

Optional:
GET /api/dietitian/recipes/imports/history

---

# 20. Suggested domain / DTO models
- RawImportedRecipeDto
- RawImportedIngredientDto
- RecipeImportPreviewDto
- RecipeImportPreviewRecipeDto
- RecipeImportPreviewIngredientDto
- RecipeImportIssueDto
- ConfirmRecipeImportCommand
- ReviewedImportedRecipeDto
- ReviewedImportedIngredientDto

---

# 21. Failure handling

Upload failures:
- invalid extension
- too large file
- empty file
- unreadable file

Parse failures:
- unsupported structure
- no recipe-like content found
- corrupted spreadsheet/docx

Review failures:
- session not found
- session owned by different dietitian
- correction payload invalid

Confirm failures:
- unresolved blocking issues remain
- target duplicate update recipe no longer exists
- db transaction failure

All failure responses must be clear and user-readable in Turkish.

---

# 22. Logging and observability

At minimum log:
- upload start
- parse success/failure
- recipe count found
- unmatched ingredient count
- confirm success/failure
- created/updated/skipped counts

Recommended entity:
- RecipeImportLog or audit trail per session

---

# 23. Testing strategy

Unit tests:
- CSV parser groups rows correctly
- XLSX parser reads repeated recipe titles correctly
- DOCX parser extracts title + ingredients + steps for supported template
- units normalize
- roles normalize
- Turkish strings normalize correctly
- exact match
- alias match
- unmatched ingredient
- ambiguous ingredient
- missing title
- no ingredients
- unresolved match blocks confirm

Integration tests:
- upload CSV → preview → confirm → recipes inserted
- upload XLSX with duplicates → update existing path
- upload DOCX with partial parse → warnings returned
- unauthorized dietitian cannot access another session

Web E2E / smoke tests:
- drag-and-drop upload opens review state
- unmatched ingredient can be manually resolved
- confirm creates recipes visible in recipe list
- imported recipe appears as private/signature under current dietitian

---

# 24. Acceptance criteria

The feature is complete only when all of the following are true:
1. Dietitian can manually create recipes as before
2. Dietitian can upload .csv, .xlsx, and .docx
3. Upload does not directly create production recipes
4. Ingredient names are matched to dictionary where possible
5. Unmatched/ambiguous ingredients can be fixed in UI
6. Confirm step inserts real recipes successfully
7. Imported recipes belong to correct dietitian
8. Private/signature visibility is preserved
9. Errors are shown clearly
10. Web page refreshes and imported recipes appear in recipe list

---

# 25. Delivery order

Phase 1:
- CSV import
- import session tables
- preview + confirm
- ingredient matching
- web review UI

Phase 2:
- XLSX import
- duplicate resolution UI
- import history

Phase 3:
- DOCX import
- richer parse rules
- better correction UX

Phase 4 optional:
- AI-assisted extraction for badly structured DOCX
- saved import templates
- downloadable import sample template

---

# 26. What must NOT happen
- Do not bypass ingredient dictionary and save raw free-text ingredients only
- Do not insert directly into Recipes at upload time
- Do not make this a frontend-only fake parser
- Do not silently skip failed ingredients without surfacing issues
- Do not allow cross-dietitian access to staged imports
- Do not replace the manual editor; import is additive
- Do not couple the feature to AI-only extraction

---

# 27. Suggested implementation targets

Backend files likely affected:
- API controller(s) under dietitian recipe area
- Application commands / queries for import workflow
- Infrastructure parsers for CSV/XLSX/DOCX
- Ingredient matching service integration
- EF Core entities + migrations for import session tables
- repositories / DbContext

Web panel files likely affected:
- recipes page
- new import wizard route/page
- drag-and-drop component
- review cards
- summary widgets
- mutation hooks / API client
- optimistic refresh or post-confirm refresh logic

---

# 28. Final instruction to Claude

You must implement this feature end-to-end.

Working mode:
Act as a senior full-stack engineer familiar with:
- Next.js App Router
- TypeScript
- ASP.NET Core
- EF Core
- clean architecture / CQRS-style layering
- import pipelines
- staged review workflows

Delivery requirements:
1. Audit existing recipe domain + recipe editor schema first
2. Reuse existing recipe entities instead of inventing parallel permanent models
3. Add staging/import models for upload/review/confirm
4. Implement CSV + XLSX first in a stable way
5. Implement DOCX support in a deterministic, review-first way
6. Build the web review/confirm experience
7. Add tests
8. Provide exact changed files
9. Provide migration(s)
10. Leave the feature in a testable state

Important constraints:
- Maintain dietitian ownership and tenant isolation
- Keep imported recipes compatible with the existing premium/private recipe flow
- Use ingredient dictionary matching
- Keep manual recipe entry intact
- Do not use AI as a required dependency for the first working version

---

# 29. Claude task prompt (paste below)

You are implementing a new Recipe Import feature for my MyDietitian project.

I already have a dietitian web panel with a manual advanced recipe editor.
Now I want the dietitian to also be able to drag and drop DOCX / XLSX / CSV recipe files into the web panel.

This must be implemented end-to-end across:
- backend
- database
- web panel
- parsing
- validation
- preview/review
- confirm/save flow

Core workflow:
Upload → Parse → Normalize → Match → Validate → Preview → Dietitian Fixes → Confirm → Save

Do NOT save imported files directly into the real recipe tables on upload.
Use staging/import session tables first.
Only the confirm step may write into the actual recipe tables.

Business behavior:
- Dietitian can still create recipes manually exactly as before
- Import is an additional capability
- Imported recipes must become real structured recipes compatible with the existing recipe engine
- Imported recipes must preserve dietitian ownership and private/signature visibility
- Premium clients later need to see those imported dietitian-owned recipes through the existing private repository logic

File support:
Phase 1:
- CSV
- XLSX

Phase 2:
- DOCX

Parsing rules:
- CSV/XLSX should be deterministic and template-friendly
- DOCX should first use deterministic extraction:
  - headings
  - paragraphs
  - bullet lists
  - numbered lists
  - tables
- AI is NOT required for the first version
- If DOCX parse is partial, return warnings and require review instead of failing silently

Ingredient handling:
This project already has an ingredient dictionary / normalization concept.
You must integrate import with that system.

For each imported ingredient:
- try exact canonical match
- try alias match
- try normalized compare match
- optionally safe fuzzy match
- mark as matched / ambiguous / unmatched

Dietitian must be able to fix unresolved ingredients in the review UI before confirm.

Required UX:
Add this to the web panel recipe area:
- a Tarif İçe Aktar entry point
- drag-and-drop upload zone
- review wizard or dedicated import page
- summary cards
- per-recipe preview cards
- per-ingredient correction controls
- confirm action
- success state

Do NOT remove the existing manual recipe editor.

Required backend design:
Implement:
- import session tables
- parser services
- normalization service
- ingredient matching service
- validation service
- preview DTOs
- confirm command
- transaction-based persistence into real recipe tables

Required endpoints:
- POST /api/dietitian/recipes/imports
- GET /api/dietitian/recipes/imports/{sessionId}
- PUT /api/dietitian/recipes/imports/{sessionId}/review
- POST /api/dietitian/recipes/imports/{sessionId}/confirm

Required validation:
Blocking examples:
- missing recipe title
- no ingredients
- unresolved unmatched ingredient
- invalid role
- invalid duplicate handling choice

Warnings:
- low confidence fuzzy match
- missing amount
- partial DOCX parse

Duplicate behavior:
When imported recipe title matches an existing dietitian recipe, allow:
- Create new
- Update existing
- Skip

Do not auto-overwrite existing recipes without explicit choice.

Security:
- Only authenticated dietitians can upload/import
- One dietitian cannot read another dietitian’s import sessions
- Public/private visibility rules must still be validated server-side
- Restrict file types and file sizes

Testing:
Add:
- parser unit tests
- matching/validation unit tests
- integration tests for upload → preview → confirm
- at least one web smoke/E2E path if the project already uses UI testing patterns

Delivery output I want:
1. Root-level implementation plan
2. Files changed
3. Migrations added
4. Code changes
5. Test coverage added
6. Any assumptions made
7. Exact steps to test manually

Do not stay abstract.
Actually implement the feature in the existing project structure.
