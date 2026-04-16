# Endpoint Inventory

Generated at: 2026-04-13 09:24:03 UTC

| Method | Route | Auth Required | Roles / Policy | RateLimitPolicy |
|--------|-------|---------------|----------------|-----------------|
| GET | `/debug/build` | No | - | - |
| GET | `/debug/endpoints` | No | - | - |
| GET | `/health` | No | - | - |
| ANY | `/hubs/sync` | Yes | - | - |
| ANY | `/hubs/sync/negotiate` | Yes | - | - |
| GET | `api/admin/dietitians` | Yes | Roles: Admin | - |
| POST | `api/admin/dietitians/{id}/limits` | Yes | Roles: Admin | - |
| GET | `api/admin/ingredients` | Yes | Policy: Admin | - |
| POST | `api/admin/ingredients` | Yes | Policy: Admin | - |
| PUT | `api/admin/ingredients/{id}` | Yes | Policy: Admin | - |
| PATCH | `api/admin/ingredients/{id}/toggle-active` | Yes | Policy: Admin | - |
| POST | `api/alternative/decide` | Yes | Roles: Client | - |
| POST | `api/auth/admin/login` | No | - | auth-strict |
| POST | `api/auth/change-password` | Yes | - | auth-strict |
| POST | `api/auth/client/login` | No | - | auth |
| POST | `api/auth/client/register` | No | - | auth-strict |
| POST | `api/auth/dietitian/login` | No | - | auth-strict |
| POST | `api/auth/dietitian/register` | No | - | auth-strict |
| POST | `api/auth/logout` | No | - | - |
| GET | `api/auth/me` | Yes | - | - |
| POST | `api/client/activate-premium` | Yes | - | activation |
| GET | `api/client/appointments` | Yes | Roles: Client | - |
| POST | `api/client/appointments/{appointmentId:guid}/attendance` | Yes | Roles: Client | profile-write |
| GET | `api/client/branding` | Yes | - | - |
| GET | `api/client/compliance/range` | Yes | - | - |
| GET | `api/client/compliance/today` | Yes | - | - |
| GET | `api/client/dashboard` | Yes | - | - |
| POST | `api/client/gamification/ping` | Yes | - | - |
| GET | `api/client/gamification/summary` | Yes | - | - |
| POST | `api/client/kitchen/merge` | Yes | - | kitchen |
| POST | `api/client/login` | No | - | auth |
| POST | `api/client/login/google` | No | - | auth |
| GET | `api/client/me` | Yes | - | - |
| PUT | `api/client/me` | Yes | - | profile-write |
| GET | `api/client/meal-plans` | Yes | Roles: Client | - |
| POST | `api/client/meals/{mealItemId}/alternative` | Yes | Roles: Client | - |
| DELETE | `api/client/meals/{mealItemId}/complete` | Yes | Roles: Client | - |
| POST | `api/client/meals/{mealItemId}/complete` | Yes | Roles: Client | - |
| POST | `api/client/meals/{mealItemId}/skip` | Yes | Roles: Client | - |
| GET | `api/client/meals/next` | Yes | Roles: Client | - |
| GET | `api/client/measurements` | Yes | - | - |
| POST | `api/client/measurements` | Yes | - | progress-write |
| DELETE | `api/client/measurements/{id:guid}` | Yes | - | progress-write |
| GET | `api/client/messages` | Yes | Roles: Client | - |
| POST | `api/client/messages` | Yes | Roles: Client | profile-write |
| GET | `api/client/notes` | Yes | - | - |
| GET | `api/client/notification-preferences` | Yes | - | - |
| PUT | `api/client/notification-preferences` | Yes | - | profile-write |
| POST | `api/client/notification-preferences/heartbeat` | Yes | - | profile-write |
| POST | `api/client/notification-preferences/sync-mark` | Yes | - | profile-write |
| GET | `api/client/pantry` | Yes | Roles: Client | - |
| PUT | `api/client/pantry` | Yes | Roles: Client | pantry |
| DELETE | `api/client/pantry/{ingredientId:guid}` | Yes | Roles: Client | pantry |
| GET | `api/client/pantry/items` | Yes | - | pantry |
| POST | `api/client/pantry/items` | Yes | - | pantry |
| DELETE | `api/client/pantry/items/{ingredientId:guid}` | Yes | - | pantry |
| POST | `api/client/pantry/packs/{packId:guid}` | Yes | - | pantry |
| POST | `api/client/plan/meals/{dietPlanMealId:guid}/done` | Yes | - | telemetry-write |
| POST | `api/client/plan/meals/{dietPlanMealId:guid}/skip` | Yes | - | telemetry-write |
| GET | `api/client/plans/today` | Yes | Roles: Client | - |
| GET | `api/client/plans/week` | Yes | Roles: Client | - |
| GET | `api/client/preferences` | Yes | Roles: Client | - |
| PUT | `api/client/preferences` | Yes | Roles: Client | profile-write |
| GET | `api/client/prohibitions` | Yes | - | - |
| PUT | `api/client/prohibitions` | Yes | - | profile-write |
| GET | `api/client/recipes/available` | Yes | - | - |
| POST | `api/client/register` | No | - | auth-strict |
| GET | `api/client/shopping-list` | Yes | Roles: Client | - |
| POST | `api/client/shopping-list` | Yes | Roles: Client | profile-write |
| DELETE | `api/client/shopping-list/{itemId:guid}` | Yes | Roles: Client | profile-write |
| PATCH | `api/client/shopping-list/{itemId:guid}/toggle` | Yes | Roles: Client | profile-write |
| DELETE | `api/client/shopping-list/checked` | Yes | Roles: Client | profile-write |
| POST | `api/client/shopping-list/generate/recipe/{recipeId:guid}` | Yes | Roles: Client | profile-write |
| POST | `api/client/shopping-list/generate/today-plan` | Yes | Roles: Client | profile-write |
| POST | `api/client/shopping-list/ingredients` | Yes | Roles: Client | profile-write |
| GET | `api/client/tracking/history` | Yes | - | - |
| GET | `api/client/tracking/today` | Yes | - | - |
| PUT | `api/client/tracking/today` | Yes | - | progress-write |
| GET | `api/client/weights` | Yes | - | - |
| POST | `api/client/weights` | Yes | - | progress-write |
| DELETE | `api/client/weights/{id:guid}` | Yes | - | progress-write |
| GET | `api/contact` | No | - | - |
| POST | `api/contact` | No | - | contact |
| DELETE | `api/contact/{id:guid}` | No | - | - |
| PATCH | `api/contact/{id:guid}/read` | No | - | - |
| GET | `api/dev/benchmark/normalization` | No | - | - |
| GET | `api/dev/benchmark/normalization/llm-compare` | No | - | - |
| GET | `api/dev/benchmark/recommendation` | No | - | - |
| GET | `api/dev/database/consolidation-report` | No | - | - |
| GET | `api/dietitian/access-keys` | Yes | - | - |
| POST | `api/dietitian/access-keys` | Yes | - | keygen |
| GET | `api/dietitian/appointments` | Yes | Policy: Dietitian | - |
| DELETE | `api/dietitian/branding` | Yes | Policy: Dietitian | dietitian-write |
| GET | `api/dietitian/branding` | Yes | Policy: Dietitian | - |
| PUT | `api/dietitian/branding` | Yes | Policy: Dietitian | dietitian-write |
| POST | `api/dietitian/branding/logo` | Yes | Policy: Dietitian | dietitian-write |
| GET | `api/dietitian/care-hub/summary` | Yes | Policy: Dietitian | - |
| GET | `api/dietitian/clients` | Yes | - | - |
| POST | `api/dietitian/clients/{clientId:guid}/access-keys/{keyId:guid}/extend` | Yes | - | - |
| GET | `api/dietitian/clients/{clientId:guid}/care` | Yes | Policy: Dietitian | - |
| POST | `api/dietitian/clients/{clientId:guid}/care/appointments` | Yes | Policy: Dietitian | dietitian-write |
| DELETE | `api/dietitian/clients/{clientId:guid}/care/appointments/{appointmentId:guid}` | Yes | Policy: Dietitian | dietitian-write |
| PUT | `api/dietitian/clients/{clientId:guid}/care/appointments/{appointmentId:guid}` | Yes | Policy: Dietitian | dietitian-write |
| POST | `api/dietitian/clients/{clientId:guid}/care/notes` | Yes | Policy: Dietitian | dietitian-write |
| POST | `api/dietitian/clients/{clientId:guid}/care/replies` | Yes | Policy: Dietitian | dietitian-write |
| GET | `api/dietitian/clients/{clientId:guid}/notes` | Yes | Policy: Dietitian | - |
| POST | `api/dietitian/clients/{clientId:guid}/notes` | Yes | Policy: Dietitian | dietitian-write |
| POST | `api/dietitian/clients/{clientId:guid}/revoke` | Yes | Policy: Dietitian | - |
| GET | `api/dietitian/clients/{clientId}` | Yes | - | - |
| GET | `api/dietitian/clients/{clientId}/activities` | Yes | - | - |
| GET | `api/dietitian/clients/{clientId}/analytics/activity` | Yes | - | - |
| GET | `api/dietitian/clients/{clientId}/analytics/compliance-trend` | Yes | - | - |
| GET | `api/dietitian/clients/{clientId}/analytics/measurements` | Yes | - | - |
| GET | `api/dietitian/clients/{clientId}/measurements` | Yes | - | - |
| POST | `api/dietitian/clients/{publicUserId}/access-key` | Yes | - | keygen |
| GET | `api/dietitian/clients/{publicUserId}/activity` | Yes | Policy: Dietitian | dietitian-read-heavy |
| GET | `api/dietitian/clients/{publicUserId}/compliance` | Yes | Policy: Dietitian | dietitian-read-heavy |
| POST | `api/dietitian/clients/{publicUserId}/revoke` | Yes | Policy: Dietitian | - |
| DELETE | `api/dietitian/daily-plans/{planId:guid}` | Yes | - | - |
| POST | `api/dietitian/daily-plans/{planId:guid}/meals` | Yes | - | - |
| DELETE | `api/dietitian/daily-plans/{planId:guid}/meals/{mealId:guid}` | Yes | - | - |
| PUT | `api/dietitian/daily-plans/{planId:guid}/meals/{mealId:guid}` | Yes | - | - |
| PUT | `api/dietitian/daily-plans/{planId:guid}/publish` | Yes | - | - |
| PUT | `api/dietitian/daily-plans/{planId:guid}/unpublish` | Yes | - | - |
| GET | `api/dietitian/daily-plans/clients/{clientId:guid}` | Yes | - | - |
| POST | `api/dietitian/daily-plans/clients/{clientId:guid}` | Yes | - | - |
| POST | `api/dietitian/daily-plans/clients/{clientId:guid}/apply-template` | Yes | - | - |
| POST | `api/dietitian/daily-plans/clients/{clientId:guid}/bulk-publish` | Yes | - | - |
| POST | `api/dietitian/daily-plans/clients/{clientId:guid}/copy-day` | Yes | - | - |
| POST | `api/dietitian/daily-plans/clients/{clientId:guid}/copy-week` | Yes | - | - |
| GET | `api/dietitian/dashboard/activity` | Yes | - | - |
| GET | `api/dietitian/dashboard/stats` | Yes | - | - |
| GET | `api/dietitian/dashboard/summary` | Yes | - | - |
| GET | `api/dietitian/dashboard/today` | Yes | Policy: Dietitian | dietitian-read-heavy |
| GET | `api/dietitian/gamification/activity` | Yes | - | - |
| GET | `api/dietitian/gamification/clients/{clientId:guid}` | Yes | - | - |
| GET | `api/dietitian/gamification/summary` | Yes | - | - |
| GET | `api/dietitian/info` | Yes | - | - |
| GET | `api/dietitian/live-clients` | Yes | - | - |
| GET | `api/dietitian/plan-templates` | Yes | - | - |
| POST | `api/dietitian/plan-templates` | Yes | - | - |
| DELETE | `api/dietitian/plan-templates/{id:guid}` | Yes | - | - |
| GET | `api/dietitian/plan-templates/{id:guid}` | Yes | - | - |
| POST | `api/dietitian/plan-templates/from-plan` | Yes | - | - |
| GET | `api/dietitian/plans/clients/{clientId:guid}` | Yes | - | - |
| POST | `api/dietitian/plans/clients/{clientId:guid}/assign` | Yes | - | - |
| GET | `api/dietitian/recipes` | Yes | - | - |
| POST | `api/dietitian/recipes` | Yes | - | - |
| DELETE | `api/dietitian/recipes/{id:guid}` | Yes | - | - |
| GET | `api/dietitian/recipes/{id:guid}` | Yes | - | - |
| PUT | `api/dietitian/recipes/{id:guid}` | Yes | - | - |
| GET | `api/dietitian/recipes/{id:guid}/analytics` | Yes | - | - |
| DELETE | `api/dietitian/recipes/{id:guid}/favorite` | Yes | - | - |
| POST | `api/dietitian/recipes/{id:guid}/favorite` | Yes | - | - |
| POST | `api/dietitian/recipes/imports` | Yes | - | - |
| GET | `api/dietitian/recipes/imports/{sessionId:guid}` | Yes | - | - |
| POST | `api/dietitian/recipes/imports/{sessionId:guid}/confirm` | Yes | - | - |
| PUT | `api/dietitian/recipes/imports/{sessionId:guid}/review` | Yes | - | - |
| POST | `api/dietitian/recipes/match` | Yes | - | - |
| GET | `api/dietitian/recipes/overview` | Yes | - | - |
| GET | `api/dietitian/recipes/popular` | Yes | - | - |
| GET | `api/dietitian/recipes/slug/{slug}` | Yes | - | - |
| POST | `api/dietitian/retention/campaigns` | Yes | - | - |
| GET | `api/dietitian/retention/expired-clients` | Yes | - | - |
| GET | `api/dietitian/settings` | Yes | Policy: DietitianOnly | - |
| PUT | `api/dietitian/settings` | Yes | Policy: DietitianOnly | - |
| DELETE | `api/dietitian/settings/logo` | Yes | Policy: DietitianOnly | - |
| POST | `api/dietitian/settings/logo` | Yes | Policy: DietitianOnly | - |
| GET | `api/health` | No | - | - |
| POST | `api/ingredients/analyze-image` | Yes | Policy: Client | kitchen-vision |
| GET | `api/ingredients/packs` | No | - | - |
| GET | `api/ingredients/search` | No | - | - |
| GET | `api/public/recipes` | No | - | - |
| POST | `api/recipes/decide-alternative` | Yes | Roles: Client | - |
| POST | `api/recipes/match` | Yes | - | kitchen |
