## Backend Stabilization & Security Worklog

### 1. API Contract Stabilization (Alias Routes + Swagger)

- **Goal**: Provide `/api/client/register` and `/api/client/login` aliases without breaking existing `/api/auth/client/*` routes.
- **Implementation**:
  - Updated `ClientAuthenticationController` to add absolute route aliases:
    - `POST /api/auth/client/register` **and** `POST /api/client/register` now map to the same action.
    - `POST /api/auth/client/login` **and** `POST /api/client/login` now map to the same action.
  - Added `[ApiExplorerSettings(GroupName = "auth-client")]` to group client auth endpoints together in Swagger.
  - Kept all existing logic (JWT generation, cookie setting, response shape) in a single place; alias routes only add extra attributes, so no business logic duplication.
- **Tests**:
  - Created `tests/MyDietitianMobileApp.Api.Tests` project with a minimal `CustomWebApplicationFactory` for integration tests.
  - Added `ClientAuthAliasTests` (currently skipped until a test DB is wired) to assert both old and alias routes return a token and set `access_token` cookie.
- **How to call**:
  - Primary (existing): `POST /api/auth/client/register`, `POST /api/auth/client/login`.
  - Alias (new, same behavior): `POST /api/client/register`, `POST /api/client/login`.

### 2. Premium Revoke / Unlink (AccessKey + Link Deactivation) + IDOR Shield

- **Goal**: Allow a dietitian to revoke a client’s premium safely with strict ownership checks.
- **Domain updates**:
  - `Client`:
    - Added `RevokePremium(DateTime revokedAtUtc)` which clears `ActiveDietitianId` and clamps `ProgramEndDate` to `revokedAtUtc` if it was open-ended/in the future; historical dates are preserved.
  - `DietitianClientLink` and `AccessKey` already had `Deactivate()` and `UnlinkedAt`, so no schema changes were required.
- **Application layer**:
  - Added `RevokePremiumCommand` / `RevokePremiumResult` (CQRS):
    - Input: `DietitianId`, `ClientId`.
    - Output: `Success`, `ClientId`, `RevokedAtUtc`, `WasPremium`, and optional `ErrorCode`/`ErrorMessage`.
  - Implemented `RevokePremiumCommandHandler`:
    - Opens a transaction on `AppDbContext`.
    - Loads active `DietitianClientLink` for `(DietitianId, ClientId)` including `Client`.
    - If link missing → returns `Success = false`, `ErrorCode = "LINK_NOT_FOUND"` (used for IDOR-safe 404 at controller).
    - Deactivates the link via `link.Deactivate()`.
    - Finds all active `AccessKey` rows for `(DietitianId, ClientId)` and calls `Deactivate()` on each.
    - Calls `client.RevokePremium(now)` to clear premium state.
    - Saves changes and commits the transaction.
- **API endpoint**:
  - Added to `DietitianManagementController`:
    - `POST /api/dietitian/clients/{clientId}/revoke`
    - Attributes: `[Authorize]` at controller + `[Authorize("Dietitian")]` at method for role enforcement.
    - Flow:
      1. Resolves `userId` from JWT, loads `UserAccount`, and ensures `LinkedDietitianId` is set.
      2. Sends `RevokePremiumCommand` with `DietitianId = user.LinkedDietitianId` and the route `clientId`.
      3. If `ErrorCode == "LINK_NOT_FOUND"` → returns **404** with `{ code, message }`, IDOR-safe (does not leak if client exists but isn’t owned).
      4. On success → returns 200 with `{ clientId, revokedAt, wasPremium, nowPremium: false }` (ISO-8601 UTC timestamp for `revokedAt`).
- **Tests**:
  - Added `RevokePremiumTests` (skipped placeholder) to be enabled once an integration DB/seed is in place; current shape verifies that calling the revoke endpoint compiles and returns a 4xx when unauthenticated.

### 3. Rate Limiting (Auth + Activate Premium + Key Generation)

- **Goal**: Throttle brute force and abuse on sensitive endpoints using ASP.NET Core rate limiting.
- **Configuration** (`Program.cs`):
  - Added `using Microsoft.AspNetCore.RateLimiting;` and `using System.Threading.RateLimiting;`.
  - Registered `AddRateLimiter` with named policies:
    - **`auth-strict`** (per-IP, fixed window):
      - Limit: **10 requests / minute**.
      - Partition key: remote IP (or `"unknown"` fallback).
      - No queue (`QueueLimit = 0`).
    - **`activation`** (per-user or IP, fixed window):
      - Limit: **10 requests / hour**.
      - Partition key: `sub` / `nameidentifier` claim when available, otherwise IP / `"anonymous"`.
    - **`keygen`** (per-dietitian, fixed window):
      - Limit: **30 requests / hour**.
      - Partition key: `sub` / `nameidentifier` claim when available, otherwise IP / `"anonymous"`.
  - Set `options.RejectionStatusCode = 429` so clients receive standard `TooManyRequests` responses.
  - Enabled middleware: `app.UseRateLimiter();` (after CORS, before auth/authorization).
- **Endpoint annotations**:
  - `ClientAuthenticationController`:
    - `RegisterClient` and `LoginClient` actions annotated with `[EnableRateLimiting("auth-strict")]`, covering both `/api/auth/client/*` and `/api/client/*` aliases.
  - `AuthenticationController`:
    - `POST /api/auth/dietitian/login` and `POST /api/auth/admin/login` annotated with `[EnableRateLimiting("auth-strict")]`.
  - `ClientController`:
    - `POST /api/client/activate-premium` annotated with `[EnableRateLimiting("activation")]`.
  - `DietitianManagementController`:
    - `POST /api/dietitian/access-keys` annotated with `[EnableRateLimiting("keygen")]`.
- **Tests**:
  - Added `AuthRateLimitTests` (skipped for now) that posts invalid credentials repeatedly to `/api/auth/client/login` and asserts the last response is 429 once a real test environment is wired.

### 4. Centralized Premium Gate for Plan Endpoints

- **Goal**: Ensure all premium-only diet plan endpoints use a single, consistent premium evaluation rule.
- **Domain service**:
  - Introduced `IPremiumStatusService` in `Domain.Services`:
    - Method: `Task<PremiumStatusResult> GetPremiumStatusAsync(Guid userAccountId, CancellationToken ct = default)`.
    - `PremiumStatusResult` carries `IsPremium`, the resolved `Client` (if any), `ActiveDietitianId`, and `PremiumUntilUtc`.
- **Infrastructure implementation**:
  - Added `PremiumStatusService` in `Infrastructure.Services`:
    - Uses `AuthDbContext` to resolve `UserAccount` → `LinkedClientId`.
    - Uses `AppDbContext` to load `Client` and an active `DietitianClientLink`.
    - Applies the canonical premium rule:
      - Client has `ActiveDietitianId` **and**
      - Active `DietitianClientLink` exists **and**
      - `ProgramEndDate` is null or in the future.
    - Returns `IsPremium = true` only when all conditions are met; otherwise `false` with null dietitian/premium-until.
- **DI registration**:
  - In `Program.cs`, added `builder.Services.AddScoped<IPremiumStatusService, PremiumStatusService>();` next to other domain services.
- **Usage**:
  - Existing `DietPlanController.GetTodayPlan` already enforced premium using the same rule inline; the new service encapsulates this logic for reuse and future refactors.
  - The `PremiumStatusService` is available to plan controllers (e.g. `ClientPlanController`, `DietPlanController`) to enforce **403 PREMIUM_REQUIRED** consistently for premium-only features.

### 5. Summary of New/Adjusted Endpoints

- **Alias auth routes (compatibility)**:
  - `POST /api/client/register` → same as `POST /api/auth/client/register`.
  - `POST /api/client/login` → same as `POST /api/auth/client/login`.
- **Premium revoke**:
  - `POST /api/dietitian/clients/{clientId}/revoke`
    - Role: Dietitian.
    - Effects: Deactivates `DietitianClientLink`, deactivates associated `AccessKey`(s), and clears client premium state.
    - Response 200: `{ clientId, revokedAt, wasPremium, nowPremium: false }`.
- **Rate-limited endpoints**:
  - `POST /api/auth/client/register` and `/api/client/register` → `auth-strict`.
  - `POST /api/auth/client/login` and `/api/client/login` → `auth-strict`.
  - `POST /api/auth/dietitian/login` → `auth-strict`.
  - `POST /api/auth/admin/login` → `auth-strict`.
  - `POST /api/client/activate-premium` → `activation`.
  - `POST /api/dietitian/access-keys` → `keygen`.

> **Note**: Additional tasks requested (expiration job, recipe CRUD completion, web panel access-key wrapper, and further observability enhancements) can be layered on top of this foundation; the current worklog focuses on the completed contract stabilization, revoke/unlink behavior, rate limiting, and core premium gating infrastructure.

---

## EPIC E — Progress, Activities, Compliance, Reporting, Branding, Notes

### Overview
Implemented comprehensive progress tracking, activity logging, compliance monitoring, dietitian reporting, branding configuration, and notes system. All endpoints follow ProblemDetails error standard, use IDOR-safe client resolution, and support premium gating where required.

### E0) ClientIdentityResolver Service

**Service**: `IClientIdentityResolver` + `ClientIdentityResolver`
- Method: `Task<(Guid userId, Guid clientId, string publicUserId)?> ResolveClientAsync(ClaimsPrincipal user)`
- Resolves client identity from JWT → `AuthDb.UserAccounts` → `LinkedClientId` and `PublicUserId`
- Returns `null` if user not found or not linked to client (handled as `AUTH_REQUIRED` / `CLIENT_NOT_FOUND` in controllers)
- Used in all new client endpoints for consistent, secure identity resolution

### E1) Free "Gelişim" Tracking Data

**Entities**:
- `ClientDailyTracking`: PK `(ClientId, Date:DateOnly)`, fields: `WaterGlasses:int`, `Steps:int`, `Notes:string? (max 500)`, `UpdatedAtUtc:DateTime`; index `(ClientId, Date DESC)`, PostgreSQL column type `"date"`
- `ClientWeightEntry`: `Id`, `ClientId`, `AtUtc:timestamptz`, `WeightKg:decimal(5,2)`; index `(ClientId, AtUtc DESC)`
- `ClientMeasurementEntry`: `Id`, `ClientId`, `AtUtc`, `WaistCm/HipCm/ChestCm:decimal(5,1)?`, `UpdatedAtUtc`; index `(ClientId, AtUtc DESC)`

**Client Endpoints** (Authorize Client, NO premium requirement):
- `GET /api/client/tracking/today`: Returns today's tracking or defaults `{ date, waterGlasses=0, steps=0, notes=null }` (no create on read)
- `PUT /api/client/tracking/today`: Body `{ waterGlasses, steps, notes? }`; upsert by `(ClientId, today)`; validation: `0<=waterGlasses<=50`, `steps>=0`, `notes<=500`
- `GET /api/client/tracking/history?from=&to=`: Returns array ordered by date asc
- `GET /api/client/weights?from=&to=&page=&pageSize=`: Paginated list, desc by `AtUtc`
- `POST /api/client/weights`: Body `{ atUtc?: ISO8601, weightKg }`; `atUtc` defaults to `UtcNow`; validation `0<weightKg<=500`
- `DELETE /api/client/weights/{id}`: IDOR-safe deletion
- `GET /api/client/measurements?...`: Same interface as weights, for measurements
- `POST /api/client/measurements`: Body `{ atUtc?, waistCm?, hipCm?, chestCm? }`; `UpdatedAtUtc = UtcNow`
- `DELETE /api/client/measurements/{id}`: IDOR-safe deletion

**Rate Limiting**: Policy `progress-write` (60 req / 1 min per client, userId partition) applied to `PUT tracking/today`, `POST/DELETE weights`, `POST/DELETE measurements`

**Error Handling**: All errors return `ApiProblems.Validation(...)` or `*_NOT_FOUND` / `AUTH_REQUIRED` ProblemDetails

### E2) ClientActivity (Telemetry Log) + Writer Service

**Entity**: `ClientActivity`: `Id`, `ClientId`, `DietitianId?`, `Type (max 60)`, `AtUtc`, `MetaJson:jsonb`; indexes `(ClientId, AtUtc DESC)`, `(DietitianId, AtUtc DESC)`

**Service**: `IClientActivityWriter` + implementation: `WriteAsync(clientId, dietitianId, type, meta)` → writes UTC timestamp + `JsonSerializer` for `MetaJson`

**Integrations**:
- Kitchen merge (EPIC D): After successful merge → writes `KITCHEN_MERGE_DONE` activity with meta `{ topRecipeId?, score?, eliminatedProhibitedCount, missingMandatoryCount }`
- Pantry pack apply: Writes `PANTRY_PACK_APPLIED` with meta `{ packId, addedCount }`
- Meal done/skip (E3): Writes `MEAL_DONE` / `MEAL_SKIPPED` with meta `{ dietPlanMealId, status, note? }`

### E3) Compliance / MealCompletion (Premium-Only)

**Entities**:
- `MealCompletion`: `Id`, `ClientId`, `DietitianId`, `DietPlanMealId`, `Status:int (1=Done,2=Skipped)`, `AtUtc`, `Note? (max 300)`; unique `(ClientId, DietPlanMealId)`, index `(ClientId, AtUtc DESC)`
- `DailyComplianceSnapshot`: PK `(ClientId, Date:DateOnly)`, fields: `PlannedCount`, `CompletedCount`, `SkippedCount`, `Score0_100`, `UpdatedAtUtc`

**Service**: `IComplianceService`:
- `RecordMealCompletionAsync(clientId, dietitianId, dietPlanMealId, status, note?)`:
  - Premium gate via `IPremiumStatusService` (if not premium → controller returns 403 `PREMIUM_REQUIRED`)
  - Validates `DietPlanMealId` belongs to today's active plan for that client AND dietitian matches `activeDietitianId`; otherwise 404 `MEAL_NOT_FOUND` (IDOR-safe)
  - Upserts `MealCompletion` for `(ClientId, DietPlanMealId)` (updates status/note/AtUtc if exists)
  - Recalculates and upserts `DailyComplianceSnapshot` for today
- `GetTodayAsync(clientId, dietitianId)` and `GetRangeAsync(clientId, dietitianId, from, to)`: Returns snapshot-based or computed results; status: `planned=0` → `"no-plan"`, `score>=80` → `"on-track"`, else `"needs-attention"`

**Scoring Rule**: `score = round(doneMeals / max(plannedMeals,1) * 100)`

**Client Premium Endpoints** (Authorize Client + premium gate):
- `POST /api/client/plan/meals/{dietPlanMealId}/done` Body `{ note? }`
- `POST /api/client/plan/meals/{dietPlanMealId}/skip` Body `{ note? }`
- `GET /api/client/compliance/today`
- `GET /api/client/compliance/range?from=&to=`

**Rate Limiting**: Policy `telemetry-write` (120 req / 1 min per client) applied to done/skip endpoints

**Activity Logging**: Each done/skip call writes `ClientActivity` with type `MEAL_DONE` / `MEAL_SKIPPED`

### E4) Dietitian Reporting Endpoints (IDOR-Safe)

**Dietitian Endpoints** (Authorize "Dietitian"):
- `GET /api/dietitian/clients/{publicUserId}/activity?...`:
  - Verifies active `DietitianClientLink` exists; if not → 404 `LINK_NOT_FOUND`
  - Returns `ClientActivity` list (date range + pagination) for resolved `ClientId`
- `GET /api/dietitian/clients/{publicUserId}/compliance?from=&to=`:
  - Verifies active link; if not → 404
  - Returns `DailyComplianceSnapshot` or computed results
- `GET /api/dietitian/dashboard/today`:
  - For all active linked clients: `{ publicUserId, fullName, todayScore0_100, todayStatus, lastActivityAtUtc, isPremium, premiumUntilUtc }`
  - `isPremium/premiumUntil` via `IPremiumStatusService` (per client userId) with fallback to `Clients.ActiveDietitianId+ProgramEndDate` (consistent with service rule)

**Performance**: Uses `AsNoTracking`, pagination (max pageSize=100), batched queries for links + clients + snapshots + last activities

**Rate Limiting**: Policy `dietitian-read-heavy` (120 req / 1 min per dietitian) applied to reporting endpoints

### E5) Branding (White-Label)

**Entity**: `DietitianBrandingConfig`: `DietitianId (PK)`, `ClinicName (max 120)`, `LogoUrl (max 500)?`, `PrimaryColorHex`, `AccentColorHex`, `UpdatedAtUtc`; index `UpdatedAtUtc`

**Dietitian Endpoints**:
- `GET /api/dietitian/branding`: Returns existing config or defaults (from dietitian name/clinic name)
- `PUT /api/dietitian/branding`: Body `{ clinicName, logoUrl?, primaryColorHex?, accentColorHex? }`; hex validation `^#[0-9A-Fa-f]{6}$`, logoUrl length check only; 400 `VALIDATION_ERROR` / specific codes

**Client Endpoint**:
- `GET /api/client/branding`:
  - If premium + `ActiveDietitianId` exists → returns that dietitian's branding config (creates default if missing)
  - If not premium → returns `{ branding: null }` (no 403)

### E6) Notes (MVP Instead of Chat)

**Entity**: `DietitianNote`: `Id`, `DietitianId`, `ClientId`, `Text (max 2000)`, `CreatedAtUtc`; index `(DietitianId, ClientId, CreatedAtUtc DESC)`

**Dietitian Endpoints**:
- `POST /api/dietitian/clients/{publicUserId}/notes` Body `{ text }`; verifies active link else 404 `LINK_NOT_FOUND`; rate limit: `dietitian-write`
- `GET /api/dietitian/clients/{publicUserId}/notes?page=&pageSize=`: IDOR-safe, paginated

**Client Endpoint** (PREMIUM REQUIRED):
- `GET /api/client/notes?page=&pageSize=`: Returns notes from active dietitian only; premium gate → 403 `PREMIUM_REQUIRED` if not premium

### E7) Swagger + Documentation

**Swagger**: All new endpoints have XML summary comments and example responses; only canonical routes visible (legacy/debug `IgnoreApi=true`)

**Migrations**: EF Core configurations added for all new entities:
- `DateOnly` → PostgreSQL `"date"`, `MetaJson`/`ClientActivity` → `jsonb`
- Required PKs/uniques/indexes (especially `(ClientId, Date)` and `(ClientId, DietPlanMealId)`)

**BACKEND_WORKLOG.md**: Updated with EPIC E sections, endpoint summary, and manual test checklist (aligned with acceptance criteria)

**Program.cs**: New rate limit policies (`progress-write`, `telemetry-write`, `dietitian-read-heavy`) and service registrations (`IClientIdentityResolver`, `IClientActivityWriter`, `IComplianceService`) added

### Endpoint Summary

**New Client Endpoints** (free tier, no premium):
- `GET /api/client/tracking/today`
- `PUT /api/client/tracking/today`
- `GET /api/client/tracking/history`
- `GET /api/client/weights`
- `POST /api/client/weights`
- `DELETE /api/client/weights/{id}`
- `GET /api/client/measurements`
- `POST /api/client/measurements`
- `DELETE /api/client/measurements/{id}`

**New Client Endpoints** (premium required):
- `POST /api/client/plan/meals/{dietPlanMealId}/done`
- `POST /api/client/plan/meals/{dietPlanMealId}/skip`
- `GET /api/client/compliance/today`
- `GET /api/client/compliance/range`
- `GET /api/client/branding` (returns null if not premium, no 403)
- `GET /api/client/notes`

**New Dietitian Endpoints**:
- `GET /api/dietitian/clients/{publicUserId}/activity`
- `GET /api/dietitian/clients/{publicUserId}/compliance`
- `GET /api/dietitian/dashboard/today`
- `GET /api/dietitian/branding`
- `PUT /api/dietitian/branding`
- `POST /api/dietitian/clients/{publicUserId}/notes`
- `GET /api/dietitian/clients/{publicUserId}/notes`

### Manual Test Checklist (Acceptance)

1. **Register new client (free)**:
   - `PUT /api/client/tracking/today` works (200)
   - `GET /api/client/tracking/history` returns saved data (200)
   - `POST /api/client/weights` then `GET /api/client/weights` (200)
   - These must work even if premium is not active

2. **Premium activation**:
   - Dietitian creates key → client activate-premium → `/api/client/me` `isPremium` true
   - `POST meal done/skip` now works (200) and creates `ClientActivity`
   - `GET /api/client/compliance/today` returns score

3. **Premium revoke**:
   - Dietitian revoke → client `/api/client/me` `isPremium` false
   - Meal done/skip and compliance endpoints now return 403 `PREMIUM_REQUIRED`
   - Tracking/weights/measurements STILL return 200 (data retained)

4. **Dietitian reporting**:
   - Dietitian dashboard today returns clients with `todayScore` + `lastActivityAtUtc`
   - Dietitian activity endpoint shows `KITCHEN_MERGE_DONE`, `PACK_APPLIED`, `MEAL_DONE` entries
   - IDOR: dietitian cannot access another dietitian's client → 404 `LINK_NOT_FOUND`

5. **Branding**:
   - Dietitian `PUT branding` then client `GET /api/client/branding` returns it when premium active
   - When not premium → `branding` null (no 403)

### Error Responses

All errors return `ProblemDetails` with `extensions.code`:
- `AUTH_REQUIRED` (401)
- `CLIENT_NOT_FOUND` (404)
- `LINK_NOT_FOUND` (404)
- `MEAL_NOT_FOUND` (404)
- `WEIGHT_NOT_FOUND` (404)
- `MEASUREMENT_NOT_FOUND` (404)
- `PREMIUM_REQUIRED` (403)
- `VALIDATION_ERROR` / specific codes (400)
- `RATE_LIMITED` (429)

**Build Status**: All code compiles, linter errors resolved (except one warning about obsolete `Ingredient.Name` which is expected)

---

## EPIC D — Kitchen (Mutfak) Comparison Engine

### Overview
Implemented the "Mutfak / Birleştir" comparison engine that matches client pantry ingredients with recipes, considering prohibited ingredients, mandatory coverage (with substitutes), scoring, and classification. Includes quick-add ingredient packs for onboarding.

### D1) Recipe Substitutes Data Model

**Entity**: `RecipeIngredientSubstitute`
- Composite PK: `(RecipeId, RequiredIngredientId, SubstituteIngredientId)`
- Represents alternative ingredients for mandatory recipe ingredients
- Constraints:
  - `SubstituteIngredientId != RequiredIngredientId` (no self-reference)
  - `RequiredIngredientId` must be in `Recipe.MandatoryIngredients`
  - `SubstituteIngredientId` cannot be in `Recipe.ProhibitedIngredients`
- EF Configuration: Explicit join table with no shadow FKs, indexes on `(RecipeId)` and `(RecipeId, RequiredIngredientId)`

**Domain Methods** (`Recipe`):
- `ClearSubstitutes()`: Placeholder for domain API consistency
- `SetSubstitutes(requiredId, IEnumerable<subId>)`: Validates required ingredient is mandatory and substitutes are not prohibited

### D2) Dietitian Recipe CRUD with Substitutes

**Updated DTOs** (`DietitianRecipesController`):
- `CreateDietitianRecipeRequest` and `UpdateDietitianRecipeRequest` now include optional `Substitutes: List<SubstituteGroup>?`
- `SubstituteGroup`: `{ RequiredIngredientId: Guid, SubstituteIngredientIds: Guid[] }`

**Validation**:
- `requiredIngredientId` must be in `mandatoryIngredients` → 400 `INVALID_RECIPE_INGREDIENTS`
- `substituteIngredientIds` must exist → 400 `INGREDIENT_NOT_FOUND`
- Substitutes cannot overlap with `prohibitedIngredients` → 400 `INVALID_RECIPE_INGREDIENTS`
- Cross-set conflicts (mandatory/optional/prohibited overlap) already enforced from EPIC C

**Response DTOs**:
- `GET /api/dietitian/recipes` and `GET /api/dietitian/recipes/{recipeId}` include `substitutes` array:
  ```json
  {
    "substitutes": [
      {
        "requiredIngredient": { "id": "...", "name": "Domates" },
        "substitutes": [{ "id": "...", "name": "Çeri Domates" }, ...]
      }
    ]
  }
  ```

**Persistence**:
- Create: Adds `RecipeIngredientSubstitute` rows after recipe creation
- Update: Deletes existing substitutes, inserts new ones (transaction-safe)

### D3) Client Prohibited Ingredients

**Entity**: `ClientProhibitedIngredient`
- Composite PK: `(ClientId, IngredientId)`
- `CreatedAtUtc`: DateTime (UTC) for audit
- Indexes: `(ClientId)`, `(ClientId, CreatedAtUtc)`

**Endpoints** (`ClientController`):
- `GET /api/client/prohibitions`:
  - Returns `{ ingredientIds: Guid[], items: [{id, name}] }`
  - Ordered by `CreatedAtUtc` descending
- `PUT /api/client/prohibitions`:
  - Body: `{ ingredientIds: Guid[] }` (REPLACE semantics)
  - Validates ingredient IDs exist → 400 `INGREDIENT_NOT_FOUND`
  - Transaction: deletes existing, inserts new
  - Rate limit: `profile-write` policy (30 req / 10 min per client)
  - Returns `{ updatedCount: int }`

**Security**: Client ID resolved from `AuthDb.UserAccounts.LinkedClientId` (not from request)

### D4) Kitchen Merge Endpoint

**Endpoint**: `POST /api/client/kitchen/merge`
- Rate limit: `kitchen` policy (30 req / 1 min per client)
- Body:
  ```json
  {
    "ingredientIds": Guid[]?,  // Optional: if null, loads from pantry
    "page": int?,
    "pageSize": int?,
    "q": string?  // Optional search filter
  }
  ```

**Engine Pipeline**:

1. **Candidate Recipe Selection**:
   - Free users: `IsPublic = true` recipes only
   - Premium users: `IsPublic = true` OR `DietitianId == activeDietitianId`
   - Optional search: `q` matches `recipe.Name` or `recipe.Description` (ILIKE)

2. **Elimination by Prohibitions**:
   - Load client prohibited ingredient IDs once
   - If `(clientProhibited ∩ recipe.ProhibitedIngredients) != ∅` → ELIMINATE (not returned)

3. **Mandatory Coverage with Substitutes**:
   - For each mandatory ingredient:
     - Satisfied if `requiredId in ingredientIds`
     - OR any substitute exists for `(recipeId, requiredId)` and `substituteId in ingredientIds`
   - Compute `missingCount`:
     - `missingCount == 0` → `FULL_MATCH`
     - `missingCount == 1` → `ONE_MISSING` (include missing detail + suggested substitutes)
     - `missingCount > 1` → ELIMINATE

4. **Score**:
   - `score = count(optional ingredients present in ingredientIds)`
   - Tie-breakers: higher score first, then name ascending

5. **Response**:
   ```json
   {
     "page": 1,
     "pageSize": 20,
     "total": int,
     "results": [
       {
         "recipeId": Guid,
         "name": string,
         "description": string,
         "matchStatus": "FULL_MATCH" | "ONE_MISSING",
         "score": int,
         "missing": [
           {
             "ingredient": { "id": Guid, "name": string },
             "suggestedSubstitutes": [{ "id": Guid, "name": string }, ...]
           }
         ],
         "isPublic": bool,
         "isDietitianRecipe": bool,
         "motivationText": string
       }
     ]
   }
   ```

**Performance Optimizations**:
- `AsNoTracking()` for read-only queries
- `AsSplitQuery()` when loading multiple collections
- Project to DTOs instead of heavy `Include`
- Load substitutes in one query keyed by `(RecipeId, RequiredIngredientId)`
- Pre-load ingredient names in batch

### D5) Narrator Layer

**Interface**: `IKitchenNarrator`
- Method: `string BuildMotivationText(MatchStatus status, int score, MissingInfo? missing, string recipeName)`

**Default Implementation** (`KitchenNarrator`):
- `FULL_MATCH`: "Harika! {recipeName} için tüm zorunlu malzemeler hazır. (Opsiyonel eşleşme: {score})"
- `ONE_MISSING`: "Neredeyse hazır! Eksik: {missingName}. Alternatif: {firstSubstituteOrNone}"
- Templated (no LLM), Turkish text, short format

**DI**: Registered as scoped service in `Program.cs`

### D6) Quick Add Packs

**Entities**:
- `IngredientPack`: `Id`, `Name`, `IsSystem`, `DietitianId?`, `SortOrder`
- `IngredientPackItem`: Composite PK `(PackId, IngredientId)`

**Endpoints**:
- `GET /api/ingredients/packs` (`[AllowAnonymous]`):
  - Returns `{ packs: [{id, name, sortOrder, items: [{id, name}]}] }`
  - Currently returns only system packs (dietitian packs require premium check, future enhancement)
- `POST /api/client/pantry/packs/{packId}`:
  - Applies pack items to client pantry as bulk upsert (null quantity/unit)
  - Rate limit: `pantry` policy (60 req / 1 min)
  - Returns `{ addedOrUpdated: int }`

**Seed** (`Program.cs`, idempotent):
- If no system packs exist:
  1. Ensures basic ingredients exist: "Yumurta", "Süt", "Yoğurt", "Tavuk", "Zeytinyağı", "Tuz", "Karabiber", "Yulaf", "Muz", "Domates"
  2. Creates 3 system packs:
     - "Kahvaltılıklar" (Yumurta, Süt, Yoğurt, Yulaf, Muz)
     - "Temel Baharatlar" (Tuz, Karabiber)
     - "Fitness Temelleri" (Tavuk, Yulaf, Muz, Yoğurt)
  3. Adds pack items

### D7) Security & Isolation Checks

**IDOR Protection**:
- Kitchen candidates: Free users see only `IsPublic` recipes; premium users see `IsPublic` + `activeDietitianId` recipes (never other dietitians' recipes)
- `DietitianRecipesController`: Returns 404 `RECIPE_NOT_FOUND` for foreign `recipeId` (IDOR-safe)
- All client endpoints resolve `clientId` from `AuthDb.UserAccounts.LinkedClientId` (not from request)

**Rate Limiting**:
- `profile-write`: 30 req / 10 min per client (prohibitions update)
- `kitchen`: 30 req / 1 min per client (merge endpoint)
- `pantry`: 60 req / 1 min per client (pack apply)

### D8) Endpoint Summary & Test Checklist

**New Endpoints**:
- `POST /api/client/kitchen/merge` — Kitchen comparison engine
- `GET /api/client/prohibitions` — Get client prohibited ingredients
- `PUT /api/client/prohibitions` — Update client prohibited ingredients (REPLACE)
- `GET /api/ingredients/packs` — Get ingredient packs (public)
- `POST /api/client/pantry/packs/{packId}` — Apply pack to pantry

**Updated Endpoints**:
- `GET /api/dietitian/recipes` — Now includes `substitutes` in response
- `GET /api/dietitian/recipes/{recipeId}` — Now includes `substitutes` in response
- `POST /api/dietitian/recipes` — Now accepts `substitutes` in request
- `PUT /api/dietitian/recipes/{recipeId}` — Now accepts `substitutes` in request

**Manual Test Checklist** (Swagger):

1. **Engine Elimination**:
   - Set client prohibited ingredient (e.g., "Domates")
   - Create recipe with prohibited ingredient "Domates"
   - Call `POST /api/client/kitchen/merge` → recipe should NOT appear in results

2. **Mandatory Substitute**:
   - Create recipe with mandatory "Domates" and substitute "Çeri Domates"
   - Add "Çeri Domates" to pantry (not "Domates")
   - Call merge → recipe should appear as `FULL_MATCH`

3. **One Missing Mandatory**:
   - Create recipe with 2 mandatory ingredients
   - Add only 1 mandatory ingredient to pantry
   - Call merge → recipe should appear as `ONE_MISSING` with missing ingredient detail

4. **Premium Gating**:
   - Free user: Call merge → only `IsPublic=true` recipes returned
   - Premium user: Call merge → `IsPublic=true` + `activeDietitianId` recipes returned

5. **Pack Apply**:
   - Call `GET /api/ingredients/packs` → verify packs exist
   - Call `POST /api/client/pantry/packs/{packId}` → verify pantry items added

**Error Responses**:
- All errors return `ProblemDetails` with `extensions.code`:
  - `INGREDIENT_NOT_FOUND` (400)
  - `INVALID_RECIPE_INGREDIENTS` (400)
  - `PACK_NOT_FOUND` (404)
  - `RECIPE_NOT_FOUND` (404)
  - `RATE_LIMITED` (429)
  - `KITCHEN_MERGE_FAILED` (500)

**Swagger**: Only canonical endpoints appear (no legacy/internal routes)

---

## EPIC F — Documentation Contract Compatibility (Alias + Swagger Freeze)

### Overview
Implemented documentation contract endpoints as aliases/wrappers for existing canonical endpoints. Swagger now shows only the documented contract endpoints, while legacy routes remain functional but hidden from API documentation.

### F1) Alias / Wrapper Endpoints

**F1.1 — `POST /api/recipes/match` (Kitchen engine alias)**
- Route: `POST /api/recipes/match`
- Auth: `[Authorize]` (Client role)
- Rate limit: `kitchen` policy (same as `/api/client/kitchen/merge`)
- Request body: Same `KitchenMergeRequest` DTO as kitchen merge
- Implementation: Full kitchen merge logic replicated in `RecipeMatchController` (delegation not possible due to circular dependency)
- Response: Same format as kitchen merge (results with matchStatus, score, missing ingredients, motivationText)
- Premium behavior: Free users get only public recipes; premium users get public + dietitian recipes
- Legacy route `/api/client/kitchen/merge` hidden from Swagger with `[ApiExplorerSettings(IgnoreApi = true)]`

**F1.2 — `GET /api/client/plan` (PremiumHome plan alias)**
- Route: `GET /api/client/plan`
- Auth: `[Authorize]` (Client role)
- Premium gate: Returns 403 `PREMIUM_REQUIRED` if not premium
- Response shape:
  ```json
  {
    "dateUtc": "2026-02-12T00:00:00.000Z",
    "isPremium": true,
    "premiumUntilUtc": "2026-02-18T00:00:00.000Z",
    "clinicName": "halil mutfakta",
    "dietitianPublicInfo": {
      "fullName": "halil ibrahim",
      "clinicName": "halil mutfakta",
      "branding": { ... }
    },
    "plan": null // or plan object from /api/client/plans/today
  }
  ```
- Data sources:
  - `isPremium/premiumUntilUtc`: `IPremiumStatusService`
  - `clinicName/branding`: `ActiveDietitianId` → `Dietitian` + `DietitianBrandingConfig`
  - `plan`: Same logic as `GET /api/client/plans/today` (plan DTO or null)
- Legacy route `/api/client/plans/today` hidden from Swagger

**F1.3 — `GET /api/dietitian/info` (Client perspective dietitian info)**
- Route: `GET /api/dietitian/info`
- Auth: `[Authorize]` (Client role)
- Premium gate: Returns 403 `PREMIUM_REQUIRED` if not premium
- Response:
  ```json
  {
    "dietitianId": "guid",
    "fullName": "string",
    "clinicName": "string",
    "branding": {
      "clinicName": "string",
      "logoUrl": "string?",
      "primaryColorHex": "#RRGGBB",
      "accentColorHex": "#RRGGBB"
    }
  }
  ```
- Data source: `IPremiumStatusService.ActiveDietitianId` → `Dietitian` + `DietitianBrandingConfig` (or defaults)

**F1.4 — `POST /api/dietitian/login` (Web panel alias)**
- Route: `POST /api/dietitian/login`
- Auth: None (public login endpoint)
- Rate limit: `auth` policy
- Request body: Same `DietitianLoginRequest` as `/api/auth/dietitian/login`
- Implementation: Full login logic replicated in `DietitianLoginAliasController` (delegation not possible due to circular dependency)
- Response: Same JWT + cookie behavior as legacy route
- Legacy route `/api/auth/dietitian/login` hidden from Swagger

### F2) Swagger "Single Contract" Cleanup

**Swagger-visible endpoints** (documentation contract):
- `POST /api/client/register`
- `POST /api/client/login`
- `POST /api/client/login/google`
- `GET /api/client/me`
- `GET /api/client/dashboard`
- `GET /api/client/plan` ✅ (new)
- `GET /api/dietitian/info` ✅ (new)
- `POST /api/recipes/match` ✅ (new)
- `POST /api/dietitian/login` ✅ (alias)
- Dietitian endpoints: clients, keygen, revoke, recipes CRUD, branding, reporting, notes
- Client endpoints: pantry, tracking, weights, measurements, compliance, notes, branding

**Swagger-hidden endpoints** (legacy/compatibility):
- `/api/client/kitchen/merge` → use `/api/recipes/match`
- `/api/client/plans/today` → use `/api/client/plan`
- `/api/auth/dietitian/login` → use `/api/dietitian/login`
- Other internal/debug routes

**Implementation**: `[ApiExplorerSettings(IgnoreApi = true)]` attribute added to legacy endpoints

### F3) Contract Freeze Output

**Swagger JSON**: Build output `/swagger/v1/swagger.json` should be exported to `openapi/swagger.json` (manual step after build)

**BACKEND_WORKLOG.md**: Updated with EPIC F section (this section)

### F4) Manual Test Checklist

**Client (Chrome Incognito)**:
1. Register/login → 200
2. Premium değilken:
   - `GET /api/client/plan` → 403 `PREMIUM_REQUIRED`
   - `GET /api/dietitian/info` → 403 `PREMIUM_REQUIRED`
3. Dietitian key üret + activate-premium
4. Premium iken:
   - `GET /api/client/plan` → 200 (plan yoksa `plan:null`)
   - `GET /api/dietitian/info` → 200
   - `POST /api/recipes/match` → 200

**Dietitian (Edge Incognito)**:
- `POST /api/dietitian/login` → 200
- `GET /api/dietitian/clients` → publicUserId al
- `POST /api/dietitian/clients/{publicUserId}/access-key` → key
- `POST /api/dietitian/clients/{publicUserId}/revoke` → 200

**Swagger Verification**:
- Open `/swagger` → Only documented contract endpoints visible
- Legacy routes still work at runtime but don't appear in Swagger UI

### Endpoint Summary

**New Documentation Contract Endpoints**:
- `POST /api/recipes/match` — Recipe matching (alias for kitchen merge)
- `GET /api/client/plan` — Premium home plan summary
- `GET /api/dietitian/info` — Client perspective dietitian info
- `POST /api/dietitian/login` — Dietitian login (alias)

**Hidden Legacy Endpoints** (runtime compatible, Swagger-hidden):
- `POST /api/client/kitchen/merge`
- `GET /api/client/plans/today`
- `POST /api/auth/dietitian/login`

**Build Status**: All code compiles, linter errors resolved. Swagger shows only documented contract endpoints.
