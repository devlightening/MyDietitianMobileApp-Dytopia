-- Migration: AddMealPlanSystem
-- Created: 2026-02-05
-- Description: Adds MealPlans, PlanMealItems, and MealCompletions tables for meal planning system

-- Create MealPlans table
CREATE TABLE "MealPlans" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ClientId" UUID NOT NULL,
    "Date" DATE NOT NULL,
    "Status" VARCHAR(20) NOT NULL CHECK ("Status" IN ('Draft', 'Published')),
    "CreatedBy" UUID NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT "FK_MealPlans_Clients" FOREIGN KEY ("ClientId") REFERENCES "Clients"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_MealPlans_Dietitians" FOREIGN KEY ("CreatedBy") REFERENCES "Dietitians"("Id") ON DELETE RESTRICT
);

-- Create indexes for MealPlans
CREATE INDEX "IX_MealPlans_ClientId_Date" ON "MealPlans"("ClientId", "Date");
CREATE INDEX "IX_MealPlans_Status" ON "MealPlans"("Status");

-- Create PlanMealItems table
CREATE TABLE "PlanMealItems" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "PlanId" UUID NOT NULL,
    "Time" TIME NOT NULL,
    "Title" VARCHAR(200) NOT NULL,
    "Note" VARCHAR(1000),
    "OrderIndex" INT NOT NULL,
    "Calories" INT,
    "ProteinGrams" DECIMAL(5,1),
    "CarbsGrams" DECIMAL(5,1),
    "FatGrams" DECIMAL(5,1),
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT "FK_PlanMealItems_MealPlans" FOREIGN KEY ("PlanId") REFERENCES "MealPlans"("Id") ON DELETE CASCADE
);

-- Create indexes for PlanMealItems
CREATE INDEX "IX_PlanMealItems_PlanId" ON "PlanMealItems"("PlanId");
CREATE INDEX "IX_PlanMealItems_Time" ON "PlanMealItems"("Time");

-- Create MealCompletions table
CREATE TABLE "MealCompletions" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ClientId" UUID NOT NULL,
    "PlanMealItemId" UUID NOT NULL,
    "CompletedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "Source" VARCHAR(20) NOT NULL CHECK ("Source" IN ('Mobile', 'Web')),
    
    CONSTRAINT "FK_MealCompletions_Clients" FOREIGN KEY ("ClientId") REFERENCES "Clients"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_MealCompletions_PlanMealItems" FOREIGN KEY ("PlanMealItemId") REFERENCES "PlanMealItems"("Id") ON DELETE CASCADE,
    CONSTRAINT "UQ_MealCompletions_Client_MealItem" UNIQUE ("ClientId", "PlanMealItemId")
);

-- Create indexes for MealCompletions
CREATE INDEX "IX_MealCompletions_ClientId" ON "MealCompletions"("ClientId");
CREATE INDEX "IX_MealCompletions_PlanMealItemId" ON "MealCompletions"("PlanMealItemId");

-- Add comment for documentation
COMMENT ON TABLE "MealPlans" IS 'Daily meal plans created by dietitians for clients';
COMMENT ON TABLE "PlanMealItems" IS 'Individual meals/snacks within a meal plan';
COMMENT ON TABLE "MealCompletions" IS 'Tracks when clients complete meals from their plans';
