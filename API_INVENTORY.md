# API Endpoint Inventory

## Overview
This document provides a comprehensive inventory of all API endpoints, categorized by their status (Keep/Remove/Replace) to guide the cleanup process.

---

## 🔴 REMOVE - Alias/Duplicate Endpoints

### ClientPlanAliasController
**Route:** `/api/client`  
**Reason:** Alias for `ClientPlanController` endpoints  
**Endpoints:**
- `GET /api/client/plan` → **DUPLICATE** of `/api/client/plans/today`

**Action:** Delete entire controller. Frontend should use `/api/client/plans/today` from `ClientPlanController`.

---

### DietitianLoginAliasController
**Route:** `/api/dietitian`  
**Reason:** Alias for `AuthenticationController` endpoints  
**Endpoints:**
- `POST /api/dietitian/login` → **DUPLICATE** of `/api/auth/dietitian/login`
- `POST /api/dietitian/register` → **DUPLICATE** of `/api/auth/dietitian/register`

**Action:** Delete entire controller. Frontend should use `/api/auth/dietitian/*` from `AuthenticationController`.

---

### ComplianceController
**Route:** `/api/compliance`  
**Reason:** Global compliance controller, replaced by `ClientComplianceController`  
**Endpoints:**
- `POST /api/compliance/mark` → **DUPLICATE** of `/api/client/plan/meals/{id}/done` and `/skip`
- `GET /api/compliance/daily` → Dietitian-specific, should be in `DietitianReportingController`
- `GET /api/dietitian/live-clients` → Should be in `DietitianReportingController`

**Action:** Delete entire controller. Client compliance is handled by `ClientComplianceController`, dietitian compliance viewing should be in `DietitianReportingController`.

---

### ClientProfileController
**Route:** `/api/profile`  
**Reason:** Duplicate of `ClientStateController` and `ClientProgressController`  
**Endpoints:**
- `GET /api/profile/me` → **DUPLICATE** of `/api/client/me` (`ClientStateController`)
- `POST /api/profile/measurements` → **DUPLICATE** of `/api/client/progress/measurements` (`ClientProgressController`)
- `GET /api/profile/measurements` → **DUPLICATE** of `/api/client/progress/measurements` (`ClientProgressController`)

**Action:** Delete entire controller. Use canonical routes in `ClientStateController` and `ClientProgressController`.

---

### DietPlanController
**Route:** `/api/diet-plans`  
**Reason:** Conflicts with `DietitianPlanController` which uses `/api/dietitian/plans`  
**Endpoints:**
- `POST /api/diet-plans` → **DUPLICATE** of `/api/dietitian/plans` (`DietitianPlanController`)
- `GET /api/diet-plans/{clientId}` → **DUPLICATE** of `/api/dietitian/plans/client/{clientId}` (`DietitianPlanController`)
- `POST /api/diet-plans/decide-alternative` → Recipe matching, should be in `RecipeMatchController`
- `GET /api/diet-plans/today` → **DUPLICATE** of `/api/client/plans/today` (`ClientPlanController`)

**Action:** Delete entire controller. Dietitian plan operations use `DietitianPlanController`, client plan viewing uses `ClientPlanController`.

---

### RecipeController
**Route:** `/api/recipes`  
**Reason:** Generic recipe CRUD, conflicts with specialized controllers  
**Endpoints:**
- `POST /api/recipes` → **DUPLICATE** of `/api/dietitian/recipes` (`DietitianRecipesController`)
- `GET /api/recipes` → **DUPLICATE** of `/api/dietitian/recipes` (`DietitianRecipesController`)

**Action:** Delete entire controller. Use `DietitianRecipesController` for dietitian recipes, `PublicRecipesController` for public recipes, `RecipeMatchController` for recipe matching.

---

### DevController
**Route:** `/api/dev`  
**Reason:** Debug/development endpoints  
**Endpoints:**
- `POST /api/dev/seed-today-plan` → Development-only seeding

**Action:** Keep controller but ensure it's **ONLY exposed in Development environment**. Already has `[ApiExplorerSettings(IgnoreApi = true)]` which hides it from Swagger.

---

## ✅ KEEP - Canonical Endpoints

### Authentication & Authorization

#### AuthenticationController
**Route:** `/api/auth`  
**Status:** ✅ **KEEP** (Canonical)  
**Endpoints:**
- `POST /api/auth/dietitian/login` - Dietitian login
- `POST /api/auth/dietitian/register` - Dietitian registration

---

#### ClientAuthenticationController
**Route:** `/api/auth`  
**Status:** ✅ **KEEP** (Canonical)  
**Endpoints:**
- `POST /api/auth/client/register` - Client registration
- `POST /api/auth/client/login` - Client login
- `POST /api/auth/client/activate` - Email activation
- `POST /api/auth/client/resend-activation` - Resend activation email

---

### Client Endpoints

#### ClientStateController
**Route:** `/api/client`  
**Status:** ✅ **KEEP** (Canonical for client profile/state)  
**Endpoints:**
- `GET /api/client/me` - Get current client profile and state

---

#### ClientController
**Route:** `/api/client`  
**Status:** ✅ **KEEP** (Canonical for pantry, premium activation)  
**Endpoints:**
- `POST /api/client/activate-premium` - Activate premium with access key
- `GET /api/client/pantry` - Get pantry items
- `POST /api/client/pantry` - Bulk upsert pantry items
- `DELETE /api/client/pantry/{ingredientId}` - Remove pantry item
- `GET /api/client/recipes` - Get available recipes (public + premium)
- `GET /api/client/prohibitions` - Get prohibited ingredients
- `PUT /api/client/prohibitions` - Update prohibited ingredients
- `POST /api/client/pantry/apply-pack/{packId}` - Apply ingredient pack

---

#### ClientProgressController
**Route:** `/api/client`  
**Status:** ✅ **KEEP** (Canonical for measurements/progress)  
**Endpoints:**
- `POST /api/client/progress/measurements` - Add measurement
- `GET /api/client/progress/measurements` - Get measurements
- `POST /api/client/progress/weights` - Add weight
- `GET /api/client/progress/weights` - Get weights

---

#### ClientPlanController
**Route:** `/api/client`  
**Status:** ✅ **KEEP** (Canonical for client plan viewing)  
**Endpoints:**
- `GET /api/client/plans/today` - Get today's meal plan (Premium)
- `GET /api/client/plans/week` - Get week's meal plans (Premium)
- `POST /api/client/plans/meals/{mealId}/complete` - Mark meal complete
- `DELETE /api/client/plans/meals/{mealId}/complete` - Unmark meal

---

#### ClientComplianceController
**Route:** `/api/client`  
**Status:** ✅ **KEEP** (Canonical for client compliance tracking)  
**Endpoints:**
- `POST /api/client/plan/meals/{dietPlanMealId}/done` - Mark meal done (Premium)
- `POST /api/client/plan/meals/{dietPlanMealId}/skip` - Mark meal skipped (Premium)
- `GET /api/client/compliance/today` - Get today's compliance (Premium)
- `GET /api/client/compliance/range` - Get compliance range (Premium)

---

#### ClientBrandingController
**Route:** `/api/client`  
**Status:** ✅ **KEEP** (Canonical for client viewing dietitian branding)  
**Endpoints:**
- `GET /api/client/branding` - Get active dietitian branding (Premium)

---

#### ClientNotesController
**Route:** `/api/client`  
**Status:** ✅ **KEEP** (Canonical for client viewing dietitian notes)  
**Endpoints:**
- `GET /api/client/notes` - Get dietitian notes for client (Premium)

---

#### ClientDietitianInfoController
**Route:** `/api/dietitian`  
**Status:** ✅ **KEEP** (Canonical for client viewing dietitian info)  
**Endpoints:**
- `GET /api/dietitian/info` - Get active dietitian info (Premium)

---

#### KitchenController
**Route:** `/api/client/kitchen`  
**Status:** ✅ **KEEP** (Canonical for kitchen/meal merging)  
**Endpoints:**
- `POST /api/client/kitchen/merge` - Merge meals into shopping list
- `GET /api/client/kitchen/narrative` - Get kitchen narrative

---

#### DashboardController
**Route:** `/api/client`  
**Status:** ✅ **KEEP** (Canonical for client dashboard)  
**Endpoints:**
- `GET /api/client/dashboard` - Get client dashboard data

---

### Dietitian Endpoints

#### DietitianManagementController
**Route:** `/api/dietitian`  
**Status:** ✅ **KEEP** (Canonical for client management, access keys)  
**Endpoints:**
- `GET /api/dietitian/clients` - Get all clients
- `GET /api/dietitian/clients/{clientId}` - Get client details (IDOR protected)
- `GET /api/dietitian/clients/{clientId}/measurements` - Get client measurements
- `GET /api/dietitian/access-keys` - Get all access keys
- `POST /api/dietitian/clients/{publicUserId}/access-key` - Create access key for client
- `POST /api/dietitian/access-keys` - Create access key (legacy)
- `DELETE /api/dietitian/clients/{clientId}/premium` - Revoke client premium
- `DELETE /api/dietitian/clients/{publicUserId}/premium` - Revoke client premium (canonical)

---

#### DietitianPlanController
**Route:** `/api/dietitian`  
**Status:** ✅ **KEEP** (Canonical for dietitian plan CRUD)  
**Endpoints:**
- `POST /api/dietitian/plans` - Create meal plan
- `GET /api/dietitian/plans/client/{clientId}` - Get client's active plan
- `PUT /api/dietitian/plans/{planId}` - Update plan
- `POST /api/dietitian/plans/{planId}/publish` - Publish plan
- `POST /api/dietitian/plans/{planId}/duplicate` - Duplicate plan
- `DELETE /api/dietitian/plans/{planId}` - Delete plan

---

#### DietitianRecipesController
**Route:** `/api/dietitian/recipes`  
**Status:** ✅ **KEEP** (Canonical for dietitian recipe CRUD)  
**Endpoints:**
- `GET /api/dietitian/recipes` - List dietitian recipes
- `POST /api/dietitian/recipes` - Create recipe
- `GET /api/dietitian/recipes/{recipeId}` - Get recipe details
- `PUT /api/dietitian/recipes/{recipeId}` - Update recipe
- `DELETE /api/dietitian/recipes/{recipeId}` - Delete recipe

---

#### DietitianNotesController
**Route:** `/api/dietitian`  
**Status:** ✅ **KEEP** (Canonical for dietitian notes CRUD)  
**Endpoints:**
- `GET /api/dietitian/notes/client/{clientId}` - Get notes for client
- `POST /api/dietitian/notes` - Create note
- `PUT /api/dietitian/notes/{noteId}` - Update note
- `DELETE /api/dietitian/notes/{noteId}` - Delete note

---

#### DietitianBrandingController
**Route:** `/api/dietitian`  
**Status:** ✅ **KEEP** (Canonical for dietitian branding CRUD)  
**Endpoints:**
- `GET /api/dietitian/branding` - Get branding config
- `PUT /api/dietitian/branding` - Update branding config

---

#### DietitianReportingController
**Route:** `/api/dietitian`  
**Status:** ✅ **KEEP** (Canonical for dietitian reporting/analytics)  
**Endpoints:**
- `GET /api/dietitian/reporting/client-activity` - Get client activity
- `GET /api/dietitian/reporting/compliance-summary` - Get compliance summary
- `GET /api/dietitian/dashboard` - Get dietitian dashboard

---

### Public/Shared Endpoints

#### PublicRecipesController
**Route:** `/api/public`  
**Status:** ✅ **KEEP** (Canonical for public recipes)  
**Endpoints:**
- `GET /api/public/recipes` - Get public recipes (free tier)

---

#### RecipeMatchController
**Route:** `/api/recipes`  
**Status:** ✅ **KEEP** (Canonical for recipe matching/alternative decisions)  
**Endpoints:**
- `POST /api/recipes/match` - Match recipes to pantry
- `POST /api/recipes/decide-alternative` - Decide alternative meal

---

#### IngredientController
**Route:** `/api`  
**Status:** ✅ **KEEP** (Canonical for ingredient management)  
**Endpoints:**
- `GET /api/ingredients` - List all ingredients
- `POST /api/ingredients` - Create ingredient
- `GET /api/ingredients/search` - Search ingredients

---

#### IngredientPackController
**Route:** `/api/ingredients/packs`  
**Status:** ✅ **KEEP** (Canonical for ingredient packs)  
**Endpoints:**
- `GET /api/ingredients/packs` - List ingredient packs

---

#### HealthController
**Route:** `/api`  
**Status:** ✅ **KEEP** (Health check)  
**Endpoints:**
- `GET /api/health` - Health check endpoint

---

## 📊 Summary

| Category | Count |
|----------|-------|
| **Controllers to DELETE** | 6 |
| **Controllers to KEEP** | 24 |
| **Total Controllers** | 30 |

### Controllers to Delete:
1. ❌ `ClientPlanAliasController` - Duplicate of `ClientPlanController`
2. ❌ `DietitianLoginAliasController` - Duplicate of `AuthenticationController`
3. ❌ `ComplianceController` - Duplicate of `ClientComplianceController`
4. ❌ `ClientProfileController` - Duplicate of `ClientStateController` + `ClientProgressController`
5. ❌ `DietPlanController` - Duplicate of `DietitianPlanController` + `ClientPlanController`
6. ❌ `RecipeController` - Duplicate of `DietitianRecipesController`

### DevController:
- ⚠️ **RESTRICT** to Development environment only (already has `[ApiExplorerSettings(IgnoreApi = true)]`)

---

## 🔧 Swagger Authentication Debugging

### Common Issue: Cookie Carry-Over

Swagger UI uses cookies for authentication. If you log in as a dietitian, then try to test client endpoints, the dietitian cookie may still be active, causing unexpected 403 errors.

**Solution:**
1. Clear browser cookies for `localhost:5000`
2. Use "Authorize" button in Swagger UI to explicitly set Bearer token
3. Or use Postman/curl with explicit `Authorization: Bearer <token>` headers
4. For testing different roles, use incognito/private browsing windows

### Verifying Endpoint Removal

After cleanup, verify in Swagger that these controllers are **NOT** visible:
- ❌ ClientPlanAlias
- ❌ DietitianLoginAlias
- ❌ Compliance (global)
- ❌ ClientProfile
- ❌ DietPlan
- ❌ Recipe (generic)
- ❌ Dev (hidden via `[ApiExplorerSettings(IgnoreApi = true)]`)

---

## 🎯 Next Steps

1. **Phase 1:** ✅ Remove alias controllers and update frontend references
2. **Phase 2:** ✅ Verify freemium/premium gates on all endpoints
3. **Phase 3:** ✅ Create integration tests for critical paths
4. **Phase 4:** ✅ Document web panel required endpoints
5. **Phase 5:** 🔄 Final cleanup and smoke tests
