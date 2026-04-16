# Thesis Seed Run Order

Use the scripts below in order when preparing a fresh PostgreSQL database for thesis demos, screenshots, and benchmark flows.

## Order

1. `seed-part1-base.sql`
2. `seed-part2-users.sql`
3. `seed-part3-recipes.sql`
4. `seed-part4-canonical-ops.sql`
5. `seed-part5-thesis-tracking.sql`

## What each script does

- `seed-part1-base.sql`
  - canonical ingredients
  - taxonomy families and family members
  - compatibility rules

- `seed-part2-users.sql`
  - auth users in `AuthDb`
  - dietitians and clients in `AppDb`

- `seed-part3-recipes.sql`
  - valid recipe UUIDs
  - clinic and public recipes
  - mandatory and optional recipe relations
  - legacy `RecipeIngredients` backfill for compatibility
  - canonical recipe prohibitions and ingredient substitutes

- `seed-part4-canonical-ops.sql`
  - dietitian-client links
  - access keys
  - canonical client prohibited ingredients
  - pantry items
  - client goal preferences

- `seed-part5-thesis-tracking.sql`
  - diet plans, plan days, plan meals, meal items
  - operational `MealPlans` and `PlanMealItems`
  - compliance score configs
  - meal completions, meal compliances, item compliances
  - daily compliance snapshots
  - weight, measurements, daily tracking, shopping list

## Notes

- `seed-part3-recipes.sql` intentionally replaces the old broken recipe ID pattern and uses valid UUIDs only.
- The new scripts are written to be re-runnable on the same database with deterministic IDs.
- The tracking seed focuses on `clienttest01@gmail.com` and `clienttest02@gmail.com` for thesis-friendly scenarios.
- If you already have production-like data in the same database, run these scripts on a clean environment first.
