# Endpoint Inventory

Generated at: 2026-02-13 00:13:24 UTC

| Method | Route | Auth Required | Roles / Policy | RateLimitPolicy |
|--------|-------|---------------|----------------|-----------------|
| GET | `/debug/build` | No | - | - |
| GET | `/debug/endpoints` | No | - | - |
| GET | `api/admin/ingredients` | Yes | Policy: Admin | - |
| POST | `api/admin/ingredients` | Yes | Policy: Admin | - |
| PUT | `api/admin/ingredients/{id}` | Yes | Policy: Admin | - |
| PATCH | `api/admin/ingredients/{id}/toggle-active` | Yes | Policy: Admin | - |
| POST | `api/auth/admin/login` | No | - | auth-strict |
| POST | `api/auth/client/login` | No | - | auth |
| POST | `api/auth/client/register` | No | - | auth-strict |
| POST | `api/auth/dietitian/login` | No | - | auth-strict |
| POST | `api/auth/dietitian/register` | No | - | auth-strict |
| POST | `api/auth/logout` | No | - | - |
| POST | `api/client/activate-premium` | Yes | - | activation |
| GET | `api/client/branding` | Yes | - | - |
| GET | `api/client/compliance/range` | Yes | - | - |
| GET | `api/client/compliance/today` | Yes | - | - |
| GET | `api/client/dashboard` | Yes | - | - |
| POST | `api/client/kitchen/merge` | Yes | - | kitchen |
| POST | `api/client/login` | No | - | auth |
| POST | `api/client/login/google` | No | - | auth |
| GET | `api/client/me` | Yes | - | - |
| DELETE | `api/client/meals/{mealItemId}/complete` | Yes | Roles: Client | - |
| POST | `api/client/meals/{mealItemId}/complete` | Yes | Roles: Client | - |
| GET | `api/client/measurements` | Yes | - | - |
| POST | `api/client/measurements` | Yes | - | progress-write |
| DELETE | `api/client/measurements/{id:guid}` | Yes | - | progress-write |
| GET | `api/client/notes` | Yes | - | - |
| GET | `api/client/pantry` | Yes | - | pantry |
| POST | `api/client/pantry/items` | Yes | - | pantry |
| DELETE | `api/client/pantry/items/{ingredientId:guid}` | Yes | - | pantry |
| POST | `api/client/pantry/packs/{packId:guid}` | Yes | - | pantry |
| POST | `api/client/plan/meals/{dietPlanMealId:guid}/done` | Yes | - | telemetry-write |
| POST | `api/client/plan/meals/{dietPlanMealId:guid}/skip` | Yes | - | telemetry-write |
| GET | `api/client/plans/today` | Yes | Roles: Client | - |
| GET | `api/client/plans/week` | Yes | Roles: Client | - |
| GET | `api/client/prohibitions` | Yes | - | - |
| PUT | `api/client/prohibitions` | Yes | - | profile-write |
| GET | `api/client/recipes/available` | Yes | - | - |
| POST | `api/client/register` | No | - | auth-strict |
| GET | `api/client/tracking/history` | Yes | - | - |
| GET | `api/client/tracking/today` | Yes | - | - |
| PUT | `api/client/tracking/today` | Yes | - | progress-write |
| GET | `api/client/weights` | Yes | - | - |
| POST | `api/client/weights` | Yes | - | progress-write |
| DELETE | `api/client/weights/{id:guid}` | Yes | - | progress-write |
| POST | `api/dev/seed-today-plan` | Yes | Policy: Client | - |
| GET | `api/dietitian/access-keys` | Yes | - | - |
| POST | `api/dietitian/access-keys` | Yes | - | keygen |
| GET | `api/dietitian/branding` | Yes | Policy: Dietitian | - |
| PUT | `api/dietitian/branding` | Yes | Policy: Dietitian | dietitian-write |
| GET | `api/dietitian/clients` | Yes | - | - |
| POST | `api/dietitian/clients/{clientId:guid}/revoke` | Yes | Policy: Dietitian | - |
| GET | `api/dietitian/clients/{clientId}` | Yes | - | - |
| GET | `api/dietitian/clients/{clientId}/plans` | Yes | Roles: Dietitian | - |
| POST | `api/dietitian/clients/{clientId}/plans` | Yes | Roles: Dietitian | - |
| POST | `api/dietitian/clients/{publicUserId}/access-key` | Yes | - | keygen |
| GET | `api/dietitian/clients/{publicUserId}/activity` | Yes | Policy: Dietitian | dietitian-read-heavy |
| GET | `api/dietitian/clients/{publicUserId}/compliance` | Yes | Policy: Dietitian | dietitian-read-heavy |
| GET | `api/dietitian/clients/{publicUserId}/measurements` | Yes | - | - |
| GET | `api/dietitian/clients/{publicUserId}/notes` | Yes | Policy: Dietitian | - |
| POST | `api/dietitian/clients/{publicUserId}/notes` | Yes | Policy: Dietitian | dietitian-write |
| POST | `api/dietitian/clients/{publicUserId}/revoke` | Yes | Policy: Dietitian | - |
| GET | `api/dietitian/dashboard/today` | Yes | Policy: Dietitian | dietitian-read-heavy |
| GET | `api/dietitian/info` | Yes | - | - |
| DELETE | `api/dietitian/plans/{planId}` | Yes | Roles: Dietitian | - |
| POST | `api/dietitian/plans/{planId}/duplicate` | Yes | Roles: Dietitian | - |
| PUT | `api/dietitian/plans/{planId}/items` | Yes | Roles: Dietitian | - |
| POST | `api/dietitian/plans/{planId}/publish` | Yes | Roles: Dietitian | - |
| GET | `api/dietitian/recipes` | Yes | Policy: Dietitian | - |
| POST | `api/dietitian/recipes` | Yes | Policy: Dietitian | dietitian-write |
| DELETE | `api/dietitian/recipes/{recipeId:guid}` | Yes | Policy: Dietitian | dietitian-write |
| GET | `api/dietitian/recipes/{recipeId:guid}` | Yes | Policy: Dietitian | - |
| PUT | `api/dietitian/recipes/{recipeId:guid}` | Yes | Policy: Dietitian | dietitian-write |
| GET | `api/health` | No | - | - |
| GET | `api/ingredients/packs` | No | - | - |
| GET | `api/ingredients/search` | No | - | - |
| GET | `api/public/recipes` | No | - | - |
| POST | `api/recipes/match` | Yes | - | kitchen |
