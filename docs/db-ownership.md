# DB Ownership Matrix

## Purpose

This document is the source of truth for database table ownership, consolidation, and deprecation decisions.
It exists to answer four questions clearly:

1. Which table is the canonical write model?
2. Which table is a read projection or operational projection?
3. Which table is legacy-compat and must not receive new writes?
4. Which tables are safe to merge later only after zero-reader and zero-writer verification?

This file is based on:

- live audit output from `GET /api/dev/database/consolidation-report`
- current controller, handler, and service ownership in the codebase
- actual PostgreSQL row counts observed on `2026-04-09`

## Validation Snapshot

Last live validation: `2026-04-09`

- total catalog tables: `59`
- present tables in live PostgreSQL: `59`
- missing tables: `0`
- zero-row tables: `15`

Key live signals:

- thesis core is active: `IngredientNormalizationLogs=532`, `Ingredients=156`, `IngredientFamilyMembers=120`
- recipe engine is active: `RecipeRecommendationLogs=268`, `Recipes=46`, `RecipeMandatoryIngredients=107`
- import pipeline is active: `RecipeImportSessions=18`, `RecipeImportSessionIngredients=88`
- gamification/care has real data: `ClientActivities=186`, `ClientGamificationSnapshots=45`, `ClientCareMessages=4`
- plan creation is active: `DietPlans=11`, `DietPlanDays=77`, `DietPlanMeals=231`, `MealPlans=7`, `PlanMealItems=9`, `MealCompletions=14`
- compliance and progress are still mostly empty

## Decision Vocabulary

- `Canonical`: the main write model. New features must write here.
- `Projection`: derived or operational read model. It may be written by sync/application flows, but it is not the domain source of truth.
- `Legacy-Compat`: kept for compatibility. No new feature should choose it as a new dependency.
- `Frozen`: table stays in schema, but new writes must stop and new readers must not be added.
- `Keep`: stable table family with no consolidation action now.

## Global Rules

- No table is dropped directly from live production data.
- A table can only move from `Legacy-Compat` or `Frozen` to drop-candidate after `zero readers + zero writers + backfill verified`.
- New endpoints must depend only on `Canonical` or `Projection` tables.
- New migrations must not reintroduce a second competing model for the same business intent.
- Every consolidation step must be revalidated with the live audit endpoint before merge.

## Stable Families

These families are not current consolidation targets. They are active and should be preserved.

### Identity and Access

Status: `Keep`

- `UserAccounts`
- `Dietitians`
- `Clients`
- `DietitianClientLinks`
- `AccessKeys`
- `PremiumAuditLogs`

Live note:

- all tables have rows
- premium activation and audit flow are active

### Ingredient Thesis Core

Status: `Keep`

- `Ingredients`
- `IngredientFamilies`
- `IngredientFamilyMembers`
- `IngredientCompatibilityRules`
- `IngredientNormalizationLogs`
- `IngredientPacks`
- `IngredientPackItems`

Live note:

- this is one of the healthiest data groups in the system
- normalization, taxonomy, and compatibility are already producing real evidence

### Recipe Import Pipeline

Status: `Keep`

- `RecipeImportSessions`
- `RecipeImportSessionRecipes`
- `RecipeImportSessionIngredients`
- `RecipeImportSessionIssues`

Live note:

- import is not schema-only
- live data proves upload, review, and issue tracking have already run

### Gamification and Care

Status: `Keep`

- `ClientActivities`
- `ClientEngagementEvents`
- `ClientAchievementUnlocks`
- `ClientGamificationSnapshots`
- `ClientCareMessages`
- `ClientAppointmentSummaries`
- `DietitianNotes`
- `DietitianSettings`
- `DietitianBrandingConfigs`
- `ClientGoalPreferences`
- `ClientNotificationPreferences`

Live note:

- gamification and care are real modules, not placeholders
- progress tables are still weak, but activity/gamification snapshot tables are alive

## Conflict Families

These are the ownership decisions that matter most.

### 1. Client Ingredient Restrictions

Business intent: client-specific forbidden ingredients used by recipe matching and kitchen flows.

Ownership decision:

- `Canonical`: `ClientProhibitedIngredients`
- `Frozen`: `ClientIngredientProhibitions`

Live data:

- `ClientProhibitedIngredients=5`
- `ClientIngredientProhibitions=0`

Current readers:

- `GET /api/client/prohibitions` in `src/MyDietitianMobileApp.Api/Controllers/ClientController.cs`
- `POST /api/dietitian/recipes/match` in `src/MyDietitianMobileApp.Api/Controllers/DietitianRecipesController.cs`
- `POST /api/client/kitchen/merge` in `src/MyDietitianMobileApp.Api/Controllers/KitchenController.cs`
- `POST /api/recipes/match` in `src/MyDietitianMobileApp.Api/Controllers/RecipeMatchController.cs`

Current writers:

- `PUT /api/client/prohibitions` writes `ClientProhibitedIngredients` in `src/MyDietitianMobileApp.Api/Controllers/ClientController.cs`

Decision:

- all new writes stay on `ClientProhibitedIngredients`
- no new code may write to `ClientIngredientProhibitions`
- dietitian-side match flow now reads `ClientProhibitedIngredients`

Exit criteria:

- `ClientIngredientProhibitions` has zero application readers
- audit report shows zero readers conceptually assigned to the old table

### 2. Recipe Prohibition Models

Business intent: recipe-level forbidden ingredients.

Ownership decision:

- `Canonical target`: `RecipeProhibitedIngredients`
- `Legacy/Frozen`: `RecipeProhibitions`

Live data:

- `RecipeProhibitedIngredients=0`
- `RecipeProhibitions=0`

Current readers:

- `GET /api/client/recipes/available` reads `Recipe.ProhibitedIngredients` in `src/MyDietitianMobileApp.Api/Controllers/ClientController.cs`
- `POST /api/dietitian/recipes/match` reads `Recipe.ProhibitedIngredients` in `src/MyDietitianMobileApp.Api/Controllers/DietitianRecipesController.cs`
- `POST /api/client/kitchen/merge` reads `Recipe.ProhibitedIngredients` in `src/MyDietitianMobileApp.Api/Controllers/KitchenController.cs`
- `POST /api/recipes/match` reads `Recipe.ProhibitedIngredients` in `src/MyDietitianMobileApp.Api/Controllers/RecipeMatchController.cs`

Current writers:

- `POST /api/dietitian/recipes` writes `Recipe.ProhibitedIngredients` in `src/MyDietitianMobileApp.Api/Controllers/DietitianRecipesController.cs`
- recipe import writes `Recipe.ProhibitedIngredients` through the aggregate in `src/MyDietitianMobileApp.Infrastructure/Services/Import/RecipeImportOrchestrator.cs`

Decision:

- choose `RecipeProhibitedIngredients` as the only future model
- stop creating new `RecipeProhibitions`
- keep dietitian recipe creation and dietitian recipe match logic on the canonical aggregate/navigation model

Why now:

- both tables are empty in live PostgreSQL
- this is the safest family to refactor because there is no live data migration burden yet

Exit criteria:

- `RecipeProhibitions` has zero application writers
- `RecipeProhibitions` has zero application readers
- audit readers/writers for `RecipeProhibitions` become zero

### 3. Recipe Substitute Models

Business intent: recipe-specific ingredient substitutions.

Ownership decision:

- `Canonical`: `RecipeIngredientSubstitutes`
- `Legacy-Compat`: `RecipeSubstitutes`

Live data:

- `RecipeIngredientSubstitutes=10`
- `RecipeSubstitutes=0`

Current readers:

- `POST /api/client/kitchen/merge` in `src/MyDietitianMobileApp.Api/Controllers/KitchenController.cs`
- `POST /api/recipes/match` in `src/MyDietitianMobileApp.Api/Controllers/RecipeMatchController.cs`

Current writers:

- no clear direct controller writer was found for the legacy table
- runtime reads clearly favor `RecipeIngredientSubstitutes`

Decision:

- `RecipeIngredientSubstitutes` is already the winner
- `RecipeSubstitutes` remains only as schema baggage until its readers/writers are formally zeroed

Exit criteria:

- document that no new migration or endpoint may target `RecipeSubstitutes`
- after one more audit cycle with no runtime references, mark it drop-candidate

### 4. Progress and Measurement Models

Business intent: weight, body measurements, and client progress history.

Ownership decision:

- `Canonical target`: `ClientWeightEntries` and `ClientMeasurementEntries`
- `Legacy-Compat`: `UserMeasurements`
- `Projection/Support`: `ClientDailyTrackings`

Live data:

- `UserMeasurements=0`
- `ClientWeightEntries=0`
- `ClientMeasurementEntries=0`
- `ClientDailyTrackings=0`

Current readers:

- `GET /api/client/weights` reads `ClientWeightEntries` in `src/MyDietitianMobileApp.Api/Controllers/ClientProgressController.cs`
- `GET /api/client/measurements` reads `ClientMeasurementEntries` in `src/MyDietitianMobileApp.Api/Controllers/ClientProgressController.cs`
- `GET /api/dietitian/clients/{clientId}/analytics/measurements` still reads `UserMeasurements` in `src/MyDietitianMobileApp.Api/Controllers/ClientAnalyticsController.cs`
- activity feed also reads `UserMeasurements` in `src/MyDietitianMobileApp.Api/Controllers/ClientAnalyticsController.cs`

Current writers:

- `POST /api/client/weights` writes `ClientWeightEntries`
- `POST /api/client/measurements` writes `ClientMeasurementEntries`
- `PUT /api/client/tracking/today` writes `ClientDailyTrackings`
- `AddUserMeasurementCommandHandler` still writes `UserMeasurements` in `src/MyDietitianMobileApp.Application/Handlers/AddUserMeasurementCommandHandler.cs`

Decision:

- mobile/client progress flows must own the future model
- `UserMeasurements` is legacy and should not be chosen by new code
- dietitian analytics must be refactored to read from the new client entry tables

Why now:

- all three tables are empty in live PostgreSQL
- this means we can switch ownership without backfill risk

Exit criteria:

- no analytics endpoint reads `UserMeasurements`
- no command handler writes `UserMeasurements`
- first real live entries appear in `ClientWeightEntries` and `ClientMeasurementEntries`

### 5. Plan History and Compliance Models

Business intent: plan authoring, client-visible daily meal flow, meal completion, and compliance scoring.

Ownership decision:

- `Canonical domain source`: `DietPlans`, `DietPlanDays`, `DietPlanMeals`
- `Operational projection`: `MealPlans`, `PlanMealItems`
- `Operational event ledger`: `MealCompletions`
- `Derived compliance projection`: `MealItemCompliance`, `MealCompliances`, `DailyComplianceSnapshots`
- `Legacy-Compat/Frozen`: `ClientMealPlans`, `ClientMeals`

Live data:

- `DietPlans=11`
- `DietPlanDays=77`
- `DietPlanMeals=231`
- `MealPlans=7`
- `PlanMealItems=9`
- `MealCompletions=14`
- `ClientMealPlans=1`
- `ClientMeals=0`
- `MealItems=0`
- `MealItemCompliance=0`
- `MealCompliances=0`
- `DailyComplianceSnapshots=0`
- `ComplianceScoreConfigs=0`

Current readers:

- client app reads `MealPlans` and `PlanMealItems` in `src/MyDietitianMobileApp.Api/Controllers/ClientPlanController.cs`
- legacy client plan list still reads `ClientMealPlans` in `src/MyDietitianMobileApp.Api/Controllers/ClientPlanController.cs`
- dietitian dashboard summary still uses `ClientMealPlans` and `ClientMeals` in `src/MyDietitianMobileApp.Api/Controllers/DietitianPlanController.cs`
- popular recipes uses `ClientMeals` in `src/MyDietitianMobileApp.Api/Controllers/DietitianRecipesController.cs`
- compliance query handler reads `DietPlans`, `DietPlanDays`, `DietPlanMeals`, `MealItems`, `MealItemCompliance` in `src/MyDietitianMobileApp.Application/Handlers/GetDailyComplianceQueryHandler.cs`

Current writers:

- legacy assignment writes `ClientMealPlans` and `ClientMeals` in `src/MyDietitianMobileApp.Api/Controllers/DietitianPlanController.cs`
- daily planner writes `MealPlans` and `PlanMealItems` in `src/MyDietitianMobileApp.Api/Controllers/DietitianDailyPlanController.cs`
- client meal actions write `MealCompletions` in `src/MyDietitianMobileApp.Api/Controllers/ClientPlanController.cs`
- structured compliance side is intended to write through application services, but live tables are still empty

Decision:

- do not force a single-table merge yet
- treat `DietPlans` as the domain-level source of truth for structured plan and compliance logic
- treat `MealPlans` as the client-facing operational projection that powers daily app screens
- freeze `ClientMealPlans` and `ClientMeals`; they stay only for backward compatibility until readers are removed
- bring the compliance projection to life from `MealCompletions` plus plan source data

Important note:

- the problem here is not only schema duplication
- the real issue is mixed ownership across two plan generations plus an unfinished compliance pipeline

Exit criteria:

- no new feature writes `ClientMealPlans` or `ClientMeals`
- dietitian dashboard and popular-recipe analytics stop depending on legacy tables
- `MealCompletion -> MealCompliances -> DailyComplianceSnapshots` starts producing live rows
- `ComplianceScoreConfigs` gets seeded and used

## Recommended Implementation Order

### Phase 1

- freeze `ClientIngredientProhibitions`
- freeze `RecipeSubstitutes`
- write this ownership decision into code comments and PR descriptions whenever those areas change

### Phase 2

- move dietitian recipe create/match flows away from `RecipeProhibitions`
- standardize all client restriction reads on `ClientProhibitedIngredients`

### Phase 3

- refactor analytics and commands away from `UserMeasurements`
- make `ClientWeightEntries` and `ClientMeasurementEntries` the only future-facing progress model

### Phase 4

- freeze legacy plan assignment tables at the API level
- define clear service boundaries:
  - `DietPlans*` = domain planning
  - `MealPlans*` = client-facing daily plan projection
  - `MealCompletions` = operational event
  - `MealCompliances*` and `DailyComplianceSnapshots` = derived scoring outputs

### Phase 5

- activate compliance generation so empty compliance tables begin filling from real usage
- only after live data proves the new ownership model, plan any drop migration

## Drop Policy

No table in this document is approved for immediate deletion.

Before any drop migration, all of the following must be true:

1. canonical target is live and validated
2. old table has zero writers
3. old table has zero readers
4. backfill has been verified or proven unnecessary
5. live audit confirms row-count and usage expectations

## Short Decision Summary

- `ClientProhibitedIngredients` wins over `ClientIngredientProhibitions`
- `RecipeIngredientSubstitutes` wins over `RecipeSubstitutes`
- `RecipeProhibitedIngredients` should become the only recipe prohibition model
- `ClientWeightEntries` and `ClientMeasurementEntries` should replace `UserMeasurements`
- `DietPlans` and `MealPlans` should be separated by responsibility, not prematurely merged
- `ClientMealPlans` and `ClientMeals` should be frozen, not expanded
