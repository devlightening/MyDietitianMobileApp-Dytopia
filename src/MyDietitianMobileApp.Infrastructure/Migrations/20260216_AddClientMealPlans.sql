-- Migration: Add ClientMealPlans and ClientMeals tables
-- Generated: 2026-02-16

-- Create ClientMealPlans table
CREATE TABLE IF NOT EXISTS "ClientMealPlans" (
    "Id" UUID PRIMARY KEY,
    "ClientId" UUID NOT NULL,
    "DietitianId" UUID NOT NULL,
    "Name" VARCHAR(200) NOT NULL,
    "Description" TEXT NULL,
    "StartDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "EndDate" TIMESTAMP WITH TIME ZONE NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAtUtc" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAtUtc" TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Foreign keys
    CONSTRAINT "FK_ClientMealPlans_Clients" FOREIGN KEY ("ClientId") 
        REFERENCES "Clients"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ClientMealPlans_Dietitians" FOREIGN KEY ("DietitianId") 
        REFERENCES "Dietitians"("Id") ON DELETE CASCADE
);

-- Create ClientMeals table
CREATE TABLE IF NOT EXISTS "ClientMeals" (
    "Id" UUID PRIMARY KEY,
    "ClientMealPlanId" UUID NOT NULL,
    "RecipeId" UUID NOT NULL,
    "DayOfWeek" INTEGER NOT NULL CHECK ("DayOfWeek" >= 0 AND "DayOfWeek" <= 6),
    "MealType" VARCHAR(50) NOT NULL CHECK ("MealType" IN ('breakfast', 'lunch', 'dinner', 'snack')),
    "Servings" INTEGER NOT NULL CHECK ("Servings" > 0),
    "CompletedAt" TIMESTAMP WITH TIME ZONE NULL,
    "CreatedAtUtc" TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Foreign keys
    CONSTRAINT "FK_ClientMeals_ClientMealPlans" FOREIGN KEY ("ClientMealPlanId") 
        REFERENCES "ClientMealPlans"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ClientMeals_Recipes" FOREIGN KEY ("RecipeId") 
        REFERENCES "Recipes"("Id") ON DELETE RESTRICT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "IX_ClientMealPlans_ClientId" ON "ClientMealPlans"("ClientId");
CREATE INDEX IF NOT EXISTS "IX_ClientMealPlans_DietitianId" ON "ClientMealPlans"("DietitianId");
CREATE INDEX IF NOT EXISTS "IX_ClientMealPlans_StartDate" ON "ClientMealPlans"("StartDate");
CREATE INDEX IF NOT EXISTS "IX_ClientMealPlans_IsActive" ON "ClientMealPlans"("IsActive");

CREATE INDEX IF NOT EXISTS "IX_ClientMeals_ClientMealPlanId" ON "ClientMeals"("ClientMealPlanId");
CREATE INDEX IF NOT EXISTS "IX_ClientMeals_RecipeId" ON "ClientMeals"("RecipeId");
CREATE INDEX IF NOT EXISTS "IX_ClientMeals_CompletedAt" ON "ClientMeals"("CompletedAt");
CREATE INDEX IF NOT EXISTS "IX_ClientMeals_DayOfWeek" ON "ClientMeals"("DayOfWeek");

-- Add composite index for active plan queries
CREATE INDEX IF NOT EXISTS "IX_ClientMealPlans_Client_Active_Dates" 
    ON "ClientMealPlans"("ClientId", "IsActive", "StartDate", "EndDate");

-- Add composite index for compliance queries
CREATE INDEX IF NOT EXISTS "IX_ClientMeals_Plan_Completed" 
    ON "ClientMeals"("ClientMealPlanId", "CompletedAt");

COMMENT ON TABLE "ClientMealPlans" IS 'Meal plans assigned to clients by dietitians';
COMMENT ON TABLE "ClientMeals" IS 'Individual meals within a client meal plan';
COMMENT ON COLUMN "ClientMeals"."DayOfWeek" IS '0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN "ClientMeals"."CompletedAt" IS 'Timestamp when client marked meal as completed';
