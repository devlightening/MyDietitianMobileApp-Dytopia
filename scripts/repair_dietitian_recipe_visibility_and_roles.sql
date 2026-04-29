-- =============================================================================
-- repair_dietitian_recipe_visibility_and_roles.sql
-- Repairs dietitian-owned recipe visibility and rebuilds explicit ingredient roles
-- for clinic recipes from the legacy shadow join tables.
--
-- SAFE USAGE
-- 1. Run the report sections first in staging.
-- 2. Review the affected counts.
-- 3. Run the transaction block.
-- 4. Re-run the report sections to confirm the new state.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- REPORT: dietitian recipe counts before repair
-- -----------------------------------------------------------------------------
SELECT
    COALESCE(r."DietitianId"::text, 'SYSTEM') AS owner_id,
    COUNT(*) AS total_recipes,
    COUNT(*) FILTER (WHERE r."IsPublic" = TRUE) AS public_recipes,
    COUNT(*) FILTER (WHERE r."IsArchived" = TRUE) AS archived_recipes
FROM "Recipes" r
WHERE r."IsDemo" = FALSE
  AND r."IsDraft" = FALSE
  AND r."IsHiddenFromProduction" = FALSE
GROUP BY COALESCE(r."DietitianId"::text, 'SYSTEM')
ORDER BY owner_id;

SELECT
    COUNT(*) AS explicit_role_rows,
    COUNT(*) FILTER (WHERE "Role" = 'Flavoring') AS explicit_flavoring_rows
FROM "RecipeIngredients";

-- -----------------------------------------------------------------------------
-- APPLY: clinic recipes must be private + rebuild explicit role rows
-- -----------------------------------------------------------------------------
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TEMP TABLE tmp_recipe_visibility_changes AS
SELECT r."Id"
FROM "Recipes" r
WHERE r."DietitianId" IS NOT NULL
  AND r."IsPublic" = TRUE;

UPDATE "Recipes" r
SET "IsPublic" = FALSE
WHERE r."Id" IN (SELECT "Id" FROM tmp_recipe_visibility_changes);

CREATE TEMP TABLE tmp_existing_explicit_recipes AS
SELECT DISTINCT ri."RecipeId"
FROM "RecipeIngredients" ri;

-- Mandatory roles from shadow table
INSERT INTO "RecipeIngredients" ("Id", "RecipeId", "IngredientId", "Role", "Quantity", "Unit", "CreatedAtUtc")
SELECT
    gen_random_uuid(),
    rmi."RecipeId",
    rmi."IngredientId",
    'Mandatory',
    NULL,
    NULL,
    NOW()
FROM "RecipeMandatoryIngredients" rmi
JOIN "Recipes" r ON r."Id" = rmi."RecipeId"
WHERE r."DietitianId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "RecipeIngredients" ri
      WHERE ri."RecipeId" = rmi."RecipeId"
        AND ri."IngredientId" = rmi."IngredientId"
        AND ri."Role" = 'Mandatory'
  );

-- Optional / flavoring roles from shadow optional table.
-- Condiments are promoted to Flavoring only when an explicit role row does not already exist.
INSERT INTO "RecipeIngredients" ("Id", "RecipeId", "IngredientId", "Role", "Quantity", "Unit", "CreatedAtUtc")
SELECT
    gen_random_uuid(),
    roi."RecipeId",
    roi."IngredientId",
    CASE
        WHEN i."IsCondiment" = TRUE THEN 'Flavoring'
        ELSE 'Optional'
    END,
    NULL,
    NULL,
    NOW()
FROM "RecipeOptionalIngredients" roi
JOIN "Recipes" r ON r."Id" = roi."RecipeId"
JOIN "Ingredients" i ON i."Id" = roi."IngredientId"
WHERE r."DietitianId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "RecipeIngredients" ri
      WHERE ri."RecipeId" = roi."RecipeId"
        AND ri."IngredientId" = roi."IngredientId"
  );

-- Prohibited roles from shadow table
INSERT INTO "RecipeIngredients" ("Id", "RecipeId", "IngredientId", "Role", "Quantity", "Unit", "CreatedAtUtc")
SELECT
    gen_random_uuid(),
    rpi."RecipeId",
    rpi."IngredientId",
    'Prohibited',
    NULL,
    NULL,
    NOW()
FROM "RecipeProhibitedIngredients" rpi
JOIN "Recipes" r ON r."Id" = rpi."RecipeId"
WHERE r."DietitianId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "RecipeIngredients" ri
      WHERE ri."RecipeId" = rpi."RecipeId"
        AND ri."IngredientId" = rpi."IngredientId"
        AND ri."Role" = 'Prohibited'
  );

-- Keep flavoring roles visible in optional shadow joins for legacy consumers.
INSERT INTO "RecipeOptionalIngredients" ("RecipeId", "IngredientId")
SELECT ri."RecipeId", ri."IngredientId"
FROM "RecipeIngredients" ri
JOIN "Recipes" r ON r."Id" = ri."RecipeId"
WHERE r."DietitianId" IS NOT NULL
  AND ri."Role" IN ('Optional', 'Flavoring')
  AND NOT EXISTS (
      SELECT 1
      FROM "RecipeOptionalIngredients" roi
      WHERE roi."RecipeId" = ri."RecipeId"
        AND roi."IngredientId" = ri."IngredientId"
  )
ON CONFLICT DO NOTHING;

INSERT INTO "RecipeMandatoryIngredients" ("RecipeId", "IngredientId")
SELECT ri."RecipeId", ri."IngredientId"
FROM "RecipeIngredients" ri
JOIN "Recipes" r ON r."Id" = ri."RecipeId"
WHERE r."DietitianId" IS NOT NULL
  AND ri."Role" = 'Mandatory'
  AND NOT EXISTS (
      SELECT 1
      FROM "RecipeMandatoryIngredients" rmi
      WHERE rmi."RecipeId" = ri."RecipeId"
        AND rmi."IngredientId" = ri."IngredientId"
  )
ON CONFLICT DO NOTHING;

INSERT INTO "RecipeProhibitedIngredients" ("RecipeId", "IngredientId")
SELECT ri."RecipeId", ri."IngredientId"
FROM "RecipeIngredients" ri
JOIN "Recipes" r ON r."Id" = ri."RecipeId"
WHERE r."DietitianId" IS NOT NULL
  AND ri."Role" = 'Prohibited'
  AND NOT EXISTS (
      SELECT 1
      FROM "RecipeProhibitedIngredients" rpi
      WHERE rpi."RecipeId" = ri."RecipeId"
        AND rpi."IngredientId" = ri."IngredientId"
  )
ON CONFLICT DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
-- REPORT: after repair
-- -----------------------------------------------------------------------------
SELECT
    COUNT(*) AS public_to_private_updates
FROM tmp_recipe_visibility_changes;

SELECT
    COUNT(*) AS explicit_role_rows,
    COUNT(*) FILTER (WHERE "Role" = 'Flavoring') AS explicit_flavoring_rows
FROM "RecipeIngredients";

SELECT
    COALESCE(r."DietitianId"::text, 'SYSTEM') AS owner_id,
    COUNT(*) AS total_recipes,
    COUNT(*) FILTER (WHERE r."IsPublic" = TRUE) AS public_recipes
FROM "Recipes" r
WHERE r."IsDemo" = FALSE
  AND r."IsDraft" = FALSE
  AND r."IsHiddenFromProduction" = FALSE
GROUP BY COALESCE(r."DietitianId"::text, 'SYSTEM')
ORDER BY owner_id;
