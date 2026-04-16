-- Safe optional backfill for new recipe-level Flavoring role.
-- This script is NOT auto-executed by the application.
-- Review, run in staging first, then production with care.
--
-- Rule:
--   If a RecipeIngredients row is currently Optional and Ingredient.IsCondiment = true,
--   convert role to Flavoring.
--
-- Reversible:
--   Replace 'Flavoring' with 'Optional' in the UPDATE below to revert.

BEGIN;

UPDATE "RecipeIngredients" ri
SET "Role" = 'Flavoring'
FROM "Ingredients" i
WHERE ri."IngredientId" = i."Id"
  AND ri."Role" = 'Optional'
  AND i."IsCondiment" = TRUE;

COMMIT;
