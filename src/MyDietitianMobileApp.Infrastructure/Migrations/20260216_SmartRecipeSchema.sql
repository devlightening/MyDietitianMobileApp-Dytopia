-- Migration: Smart Recipe Schema - Add tables for ingredients, substitutes, prohibitions
-- Date: 2026-02-16
-- Purpose: Enable full recipe schema with mandatory/optional/substitute/prohibition ingredients

-- 1. RecipeIngredients junction table
CREATE TABLE "RecipeIngredients" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "RecipeId" UUID NOT NULL,
    "IngredientId" UUID NOT NULL,
    "Role" VARCHAR(20) NOT NULL CHECK ("Role" IN ('Mandatory', 'Optional')),
    "Quantity" DECIMAL(10,2),
    "Unit" VARCHAR(50),
    "CreatedAtUtc" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("RecipeId") REFERENCES "Recipes"("Id") ON DELETE CASCADE,
    FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("Id") ON DELETE RESTRICT
);

-- 2. RecipeSubstitutes table
CREATE TABLE "RecipeSubstitutes" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "RecipeId" UUID NOT NULL,
    "RequiredIngredientId" UUID NOT NULL,
    "SubstituteIngredientId" UUID NOT NULL,
    "CreatedAtUtc" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("RecipeId") REFERENCES "Recipes"("Id") ON DELETE CASCADE,
    FOREIGN KEY ("RequiredIngredientId") REFERENCES "Ingredients"("Id") ON DELETE RESTRICT,
    FOREIGN KEY ("SubstituteIngredientId") REFERENCES "Ingredients"("Id") ON DELETE RESTRICT,
    UNIQUE ("RecipeId", "RequiredIngredientId", "SubstituteIngredientId")
);

-- 3. RecipeProhibitions table
CREATE TABLE "RecipeProhibitions" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "RecipeId" UUID NOT NULL,
    "IngredientId" UUID NOT NULL,
    "Reason" VARCHAR(200),
    "CreatedAtUtc" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("RecipeId") REFERENCES "Recipes"("Id") ON DELETE CASCADE,
    FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("Id") ON DELETE RESTRICT,
    UNIQUE ("RecipeId", "IngredientId")
);

-- 4. Add new columns to Recipes table
ALTER TABLE "Recipes" 
ADD COLUMN "Tags" JSONB,
ADD COLUMN "MealType" VARCHAR(50),
ADD COLUMN "PrepTimeMinutes" INT,
ADD COLUMN "CookTimeMinutes" INT,
ADD COLUMN "Difficulty" VARCHAR(20) CHECK ("Difficulty" IN ('Easy', 'Medium', 'Hard')),
ADD COLUMN "Servings" INT,
ADD COLUMN "ImageUrl" VARCHAR(500);

-- 5. Create indexes for performance
CREATE INDEX "IX_RecipeIngredients_RecipeId" ON "RecipeIngredients" ("RecipeId");
CREATE INDEX "IX_RecipeIngredients_IngredientId" ON "RecipeIngredients" ("IngredientId");
CREATE INDEX "IX_RecipeIngredients_Role" ON "RecipeIngredients" ("Role");

CREATE INDEX "IX_RecipeSubstitutes_RecipeId" ON "RecipeSubstitutes" ("RecipeId");
CREATE INDEX "IX_RecipeSubstitutes_RequiredIngredientId" ON "RecipeSubstitutes" ("RequiredIngredientId");

CREATE INDEX "IX_RecipeProhibitions_RecipeId" ON "RecipeProhibitions" ("RecipeId");
CREATE INDEX "IX_RecipeProhibitions_IngredientId" ON "RecipeProhibitions" ("IngredientId");

CREATE INDEX "IX_Recipes_Tags" ON "Recipes" USING GIN ("Tags");
CREATE INDEX "IX_Recipes_MealType" ON "Recipes" ("MealType");
CREATE INDEX "IX_Recipes_Difficulty" ON "Recipes" ("Difficulty");

COMMENT ON TABLE "RecipeIngredients" IS 'Junction table for recipe ingredients with role (Mandatory/Optional)';
COMMENT ON TABLE "RecipeSubstitutes" IS 'Allowed ingredient substitutions for recipes';
COMMENT ON TABLE "RecipeProhibitions" IS 'Prohibited ingredients for recipes (allergies, dietary restrictions)';
COMMENT ON COLUMN "Recipes"."Tags" IS 'Recipe tags as JSON array (e.g., ["glutensiz", "yuksekprotein"])';
COMMENT ON COLUMN "Recipes"."MealType" IS 'Meal type (e.g., "Breakfast", "Lunch", "Dinner", "Snack")';
