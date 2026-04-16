-- =============================================================================
-- repair-recipe-shadow-tables.sql
-- Syncs RecipeIngredients (explicit, Role-based) rows into the EF Core shadow
-- join tables (RecipeMandatoryIngredients, RecipeOptionalIngredients) for all
-- recipes that currently have 0 shadow rows.
--
-- SAFE TO RUN MULTIPLE TIMES: all inserts are guarded by NOT EXISTS + ON CONFLICT.
-- =============================================================================

-- -------------------------------------------------------
-- Step 1: Repair mandatory ingredients (Role = 'Mandatory')
-- -------------------------------------------------------
INSERT INTO "RecipeMandatoryIngredients" ("RecipeId", "IngredientId")
SELECT ri."RecipeId", ri."IngredientId"
FROM "RecipeIngredients" ri
WHERE ri."Role" = 'Mandatory'
  AND EXISTS (SELECT 1 FROM "Recipes" r WHERE r."Id" = ri."RecipeId")
  AND EXISTS (SELECT 1 FROM "Ingredients" i WHERE i."Id" = ri."IngredientId")
  AND NOT EXISTS (
      SELECT 1 FROM "RecipeMandatoryIngredients" rmi
      WHERE rmi."RecipeId" = ri."RecipeId"
        AND rmi."IngredientId" = ri."IngredientId"
  )
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- Step 2: Repair optional ingredients (Role = 'Optional')
-- -------------------------------------------------------
INSERT INTO "RecipeOptionalIngredients" ("RecipeId", "IngredientId")
SELECT ri."RecipeId", ri."IngredientId"
FROM "RecipeIngredients" ri
WHERE ri."Role" = 'Optional'
  AND EXISTS (SELECT 1 FROM "Recipes" r WHERE r."Id" = ri."RecipeId")
  AND EXISTS (SELECT 1 FROM "Ingredients" i WHERE i."Id" = ri."IngredientId")
  AND NOT EXISTS (
      SELECT 1 FROM "RecipeOptionalIngredients" roi
      WHERE roi."RecipeId" = ri."RecipeId"
        AND roi."IngredientId" = ri."IngredientId"
  )
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- Step 3: Verification — show all recipes with counts
-- -------------------------------------------------------
SELECT
    r."Id",
    r."Name",
    COUNT(DISTINCT rmi."IngredientId") AS mandatory_shadow,
    COUNT(DISTINCT roi."IngredientId") AS optional_shadow,
    COUNT(DISTINCT ri."IngredientId")  AS explicit_total,
    CASE
        WHEN COUNT(DISTINCT rmi."IngredientId") = 0
         AND COUNT(DISTINCT ri."IngredientId") > 0
        THEN 'STILL_ORPHANED'
        ELSE 'OK'
    END AS status
FROM "Recipes" r
LEFT JOIN "RecipeMandatoryIngredients" rmi ON rmi."RecipeId" = r."Id"
LEFT JOIN "RecipeOptionalIngredients"  roi ON roi."RecipeId" = r."Id"
LEFT JOIN "RecipeIngredients"          ri  ON ri."RecipeId"  = r."Id"
GROUP BY r."Id", r."Name"
ORDER BY mandatory_shadow ASC, r."Name";
