namespace MyDietitianMobileApp.Api.Services;

internal sealed record TableGovernanceSpec(
    string Database,
    string TableName,
    string Category,
    string Purpose,
    string DecisionCode,
    string DecisionLabel,
    string Note);

internal sealed record TableConflictFamilySpec(
    string FamilyName,
    string CanonicalCandidate,
    string Status,
    string Rationale,
    IReadOnlyList<string> Tables,
    IReadOnlyList<TableUsageReferenceSpec> Readers,
    IReadOnlyList<TableUsageReferenceSpec> Writers);

internal sealed record TableUsageReferenceSpec(
    string TableName,
    string Surface,
    string Action,
    string PathOrHandler,
    string Source);

internal static class DatabaseAuditCatalog
{
    public const string AppDb = "AppDb";
    public const string AuthDb = "AuthDb";

    public static IReadOnlyList<TableGovernanceSpec> Tables { get; } =
    [
        new(AuthDb, "UserAccounts", "IdentityAndAccess", "Authentication and account ownership store.", "Keep", "Koru", "AuthDb core table."),
        new(AppDb, "Dietitians", "IdentityAndAccess", "Dietitian profile root.", "Keep", "Koru", "Primary business table."),
        new(AppDb, "Clients", "IdentityAndAccess", "Client profile root.", "Keep", "Koru", "Primary business table."),
        new(AppDb, "DietitianClientLinks", "IdentityAndAccess", "Client to dietitian binding and premium context.", "Keep", "Koru", "Backbone for premium and care flows."),
        new(AppDb, "AccessKeys", "IdentityAndAccess", "Premium activation and binding tokens.", "Keep", "Koru", "Used by active activation flows."),
        new(AppDb, "PremiumAuditLogs", "IdentityAndAccess", "Premium lifecycle audit trail.", "Keep", "Koru", "Do not drop even when sparse."),

        new(AppDb, "Ingredients", "IngredientThesisCore", "Canonical ingredient dictionary.", "Keep", "Koru", "Thesis core table."),
        new(AppDb, "IngredientFamilies", "IngredientThesisCore", "Ingredient taxonomy family roots.", "Keep", "Koru", "Taxonomy core."),
        new(AppDb, "IngredientFamilyMembers", "IngredientThesisCore", "Ingredient to family membership links.", "Keep", "Koru", "Taxonomy queries rely on this table."),
        new(AppDb, "IngredientCompatibilityRules", "IngredientThesisCore", "Compatibility and recommendation rules between ingredients.", "Keep", "Koru", "Recommendation engine dependency."),
        new(AppDb, "IngredientNormalizationLogs", "IngredientThesisCore", "Normalization evidence and thesis benchmark trace.", "Keep", "Koru", "Critical for thesis evidence."),
        new(AppDb, "IngredientPacks", "IngredientThesisCore", "Quick add pantry packs.", "Keep", "Koru", "Active mobile UX surface."),
        new(AppDb, "IngredientPackItems", "IngredientThesisCore", "Ingredient pack membership rows.", "Keep", "Koru", "Active with IngredientPacks."),
        new(AppDb, "ClientIngredientProhibitions", "IngredientThesisCore", "Client restriction model used by some matching code paths.", "ReviewForMerge", "Birlestirme Incelemesi", "Do not drop until readers and writers are unified."),
        new(AppDb, "ClientProhibitedIngredients", "IngredientThesisCore", "Client restriction model used by kitchen and recipe match.", "ReviewForMerge", "Birlestirme Incelemesi", "Likely canonical candidate, but verify live data first."),

        new(AppDb, "Recipes", "RecipeRecommendationCore", "Recipe root table.", "Keep", "Koru", "Product core table."),
        new(AppDb, "RecipeIngredients", "RecipeRecommendationCore", "Explicit recipe ingredient relations.", "Keep", "Koru", "Active runtime usage."),
        new(AppDb, "RecipeMandatoryIngredients", "RecipeRecommendationCore", "Mandatory ingredient join table.", "Keep", "Koru", "Active EF relationship."),
        new(AppDb, "RecipeOptionalIngredients", "RecipeRecommendationCore", "Optional ingredient join table.", "Keep", "Koru", "Active EF relationship."),
        new(AppDb, "RecipeProhibitedIngredients", "RecipeRecommendationCore", "Recipe prohibited ingredient navigation join table.", "Keep", "Koru", "Likely canonical prohibition store."),
        new(AppDb, "RecipeProhibitions", "RecipeRecommendationCore", "Parallel recipe prohibition model used by legacy match flow.", "ReviewForMerge", "Birlestirme Incelemesi", "Keep until live data and readers are migrated."),
        new(AppDb, "RecipeIngredientSubstitutes", "RecipeRecommendationCore", "Ingredient-level substitute mapping for recipes.", "Keep", "Koru", "Primary substitute model in runtime reads."),
        new(AppDb, "RecipeSubstitutes", "RecipeRecommendationCore", "Older substitute model kept for compatibility.", "LegacyCompat", "Legacy-Compat", "No drop until zero readers and backfill completed."),
        new(AppDb, "RecipeRecommendationLogs", "RecipeRecommendationCore", "Recommendation and matching audit log.", "Keep", "Koru", "Thesis and debugging value."),
        new(AppDb, "RecipeImportSessions", "RecipeRecommendationCore", "Recipe import session root.", "Keep", "Koru", "Web import pipeline is active."),
        new(AppDb, "RecipeImportSessionRecipes", "RecipeRecommendationCore", "Imported recipe candidates in a session.", "Keep", "Koru", "Web import pipeline is active."),
        new(AppDb, "RecipeImportSessionIngredients", "RecipeRecommendationCore", "Imported ingredient staging rows.", "Keep", "Koru", "Web import pipeline is active."),
        new(AppDb, "RecipeImportSessionIssues", "RecipeRecommendationCore", "Import review and issue rows.", "Keep", "Koru", "Web import pipeline is active."),

        new(AppDb, "DietPlans", "PlanComplianceCore", "Rich diet plan aggregate root.", "Keep", "Koru", "Compliance handlers actively use it."),
        new(AppDb, "DietPlanDays", "PlanComplianceCore", "Diet plan day layer.", "Keep", "Koru", "Active."),
        new(AppDb, "DietPlanMeals", "PlanComplianceCore", "Diet plan meal layer.", "Keep", "Koru", "Active."),
        new(AppDb, "MealItems", "PlanComplianceCore", "Item-level meal content rows.", "Keep", "Koru", "Compliance calculations depend on it."),
        new(AppDb, "MealItemCompliance", "PlanComplianceCore", "Per-item compliance records.", "Keep", "Koru", "Compliance core."),
        new(AppDb, "MealCompliances", "PlanComplianceCore", "Per-meal compliance records.", "Keep", "Koru", "Analytics and scoring dependency."),
        new(AppDb, "ComplianceScoreConfigs", "PlanComplianceCore", "Compliance scoring configuration.", "Keep", "Koru", "Active service dependency."),
        new(AppDb, "DailyComplianceSnapshots", "PlanComplianceCore", "Daily compliance read model.", "Keep", "Koru", "Useful read model and analytics surface."),
        new(AppDb, "MealPlans", "PlanComplianceCore", "Operational daily meal plan model.", "Keep", "Koru", "Mobile and panel flows actively use it."),
        new(AppDb, "PlanMealItems", "PlanComplianceCore", "Operational meal plan items.", "Keep", "Koru", "Mobile and panel flows actively use it."),
        new(AppDb, "MealCompletions", "PlanComplianceCore", "Meal completion, skip, and alternative records.", "Keep", "Koru", "Operational core."),
        new(AppDb, "ClientMealPlans", "PlanComplianceCore", "Legacy assigned client plan model.", "LegacyCompat", "Legacy-Compat", "Marked as legacy in controller comments."),
        new(AppDb, "ClientMeals", "PlanComplianceCore", "Legacy client meal rows.", "LegacyCompat", "Legacy-Compat", "Still used in popular recipes and some reports."),

        new(AppDb, "ClientPantryItems", "ClientExperienceAndCare", "Pantry inventory.", "Keep", "Koru", "Active client experience table."),
        new(AppDb, "ClientShoppingListItems", "ClientExperienceAndCare", "Shopping list state.", "Keep", "Koru", "Active client experience table."),
        new(AppDb, "ClientGoalPreferences", "ClientExperienceAndCare", "Client goal preferences.", "Keep", "Koru", "Active client preference store."),
        new(AppDb, "ClientNotificationPreferences", "ClientExperienceAndCare", "Notification preference store.", "Keep", "Koru", "Active client preference store."),
        new(AppDb, "ClientDailyTrackings", "ClientExperienceAndCare", "Daily tracking entries.", "Keep", "Koru", "Active progress model."),
        new(AppDb, "ClientWeightEntries", "ClientExperienceAndCare", "Current client-facing weight history model.", "Keep", "Koru", "Preferred modern progress model."),
        new(AppDb, "ClientMeasurementEntries", "ClientExperienceAndCare", "Current client-facing measurement history model.", "Keep", "Koru", "Preferred modern progress model."),
        new(AppDb, "UserMeasurements", "ClientExperienceAndCare", "Legacy measurement history model.", "LegacyCompat", "Legacy-Compat", "Still read by analytics and handlers."),
        new(AppDb, "ClientActivities", "ClientExperienceAndCare", "Generic activity feed and timeline events.", "Keep", "Koru", "Useful for reporting and gamification."),
        new(AppDb, "ClientEngagementEvents", "ClientExperienceAndCare", "Gamification event ledger.", "Keep", "Koru", "New gamification core."),
        new(AppDb, "ClientAchievementUnlocks", "ClientExperienceAndCare", "Unlocked badges and achievements.", "Keep", "Koru", "Gamification core."),
        new(AppDb, "ClientGamificationSnapshots", "ClientExperienceAndCare", "Fast gamification summary read model.", "Keep", "Koru", "Dashboard dependency."),
        new(AppDb, "ClientCareMessages", "ClientExperienceAndCare", "Care hub conversation messages.", "Keep", "Koru", "Care workflow core."),
        new(AppDb, "ClientAppointmentSummaries", "ClientExperienceAndCare", "Appointment summary records.", "Keep", "Koru", "Care workflow support."),
        new(AppDb, "DietitianNotes", "ClientExperienceAndCare", "Private dietitian notes.", "Keep", "Koru", "Care workflow support."),
        new(AppDb, "DietitianSettings", "ClientExperienceAndCare", "Dietitian settings and profile preferences.", "Keep", "Koru", "Active panel surface."),
        new(AppDb, "DietitianBrandingConfigs", "ClientExperienceAndCare", "Dietitian branding configuration.", "Keep", "Koru", "Active client and panel surface."),

        new(AppDb, "__EFMigrationsHistory", "System", "EF Core migration history table.", "SystemKeep", "Kesin Koru", "Never delete manually."),
    ];

    public static IReadOnlyList<TableConflictFamilySpec> ConflictFamilies { get; } =
    [
        new(
            "ClientIngredientRestrictions",
            "ClientProhibitedIngredients",
            "ReviewForMerge",
            "The same client restriction intent is split across two tables. Keep both until a single canonical write path is chosen and live data is compared.",
            ["ClientIngredientProhibitions", "ClientProhibitedIngredients"],
            [
                new("ClientProhibitedIngredients", "HttpEndpoint", "Read", "GET /api/client/prohibitions", "Controllers/ClientController.cs"),
                new("ClientProhibitedIngredients", "HttpEndpoint", "Read", "POST /api/dietitian/recipes/match", "Controllers/DietitianRecipesController.cs"),
                new("ClientProhibitedIngredients", "HttpEndpoint", "Read", "POST /api/client/kitchen/merge", "Controllers/KitchenController.cs"),
                new("ClientProhibitedIngredients", "HttpEndpoint", "Read", "POST /api/recipes/match", "Controllers/RecipeMatchController.cs"),
            ],
            [
                new("ClientProhibitedIngredients", "HttpEndpoint", "Write", "PUT /api/client/prohibitions", "Controllers/ClientController.cs"),
            ]),
        new(
            "RecipeProhibitionModels",
            "RecipeProhibitedIngredients",
            "ReviewForMerge",
            "Recipe prohibition intent exists both as an EF navigation join table and as a parallel domain table. Both still have live readers.",
            ["RecipeProhibitions", "RecipeProhibitedIngredients"],
            [
                new("RecipeProhibitedIngredients", "HttpEndpoint", "Read", "GET /api/client/recipes/available", "Controllers/ClientController.cs"),
                new("RecipeProhibitedIngredients", "HttpEndpoint", "Read", "POST /api/dietitian/recipes/match", "Controllers/DietitianRecipesController.cs"),
                new("RecipeProhibitedIngredients", "HttpEndpoint", "Read", "POST /api/client/kitchen/merge", "Controllers/KitchenController.cs"),
                new("RecipeProhibitedIngredients", "HttpEndpoint", "Read", "GET /api/public/recipes", "Controllers/PublicRecipesController.cs"),
                new("RecipeProhibitedIngredients", "HttpEndpoint", "Read", "POST /api/recipes/match", "Controllers/RecipeMatchController.cs"),
            ],
            [
                new("RecipeProhibitedIngredients", "HttpEndpoint", "Write", "POST /api/dietitian/recipes", "Controllers/DietitianRecipesController.cs"),
                new("RecipeProhibitedIngredients", "ApplicationFlow", "Write", "Recipe import orchestration", "Infrastructure/Services/Import/RecipeImportOrchestrator.cs"),
                new("RecipeProhibitedIngredients", "ApplicationFlow", "Write", "CreateRecipeCommandHandler", "Application/Commands/CreateRecipeCommandHandler.cs"),
            ]),
        new(
            "RecipeSubstituteModels",
            "RecipeIngredientSubstitutes",
            "ReviewForMerge",
            "Ingredient-level substitutes are the clear runtime favorite, but the older substitute table still exists in the schema.",
            ["RecipeSubstitutes", "RecipeIngredientSubstitutes"],
            [
                new("RecipeIngredientSubstitutes", "HttpEndpoint", "Read", "POST /api/client/kitchen/merge", "Controllers/KitchenController.cs"),
                new("RecipeIngredientSubstitutes", "HttpEndpoint", "Read", "POST /api/recipes/match", "Controllers/RecipeMatchController.cs"),
            ],
            [
                new("RecipeIngredientSubstitutes", "SchemaOnly", "WriteCandidate", "No direct controller writer detected", "Persistence/AppDbContext.cs"),
                new("RecipeSubstitutes", "SchemaOnly", "LegacyCandidate", "No direct runtime writer detected", "Persistence/AppDbContext.cs"),
            ]),
        new(
            "ProgressMeasurementModels",
            "ClientWeightEntries + ClientMeasurementEntries",
            "ReviewForMerge",
            "The modern progress flow uses client entry tables, while older analytics and handlers still read or write UserMeasurements.",
            ["UserMeasurements", "ClientWeightEntries", "ClientMeasurementEntries"],
            [
                new("UserMeasurements", "HttpEndpoint", "Read", "GET /api/dietitian/clients/{clientId}/analytics/measurements", "Controllers/ClientAnalyticsController.cs"),
                new("UserMeasurements", "ApplicationFlow", "Read", "GetUserMeasurementsQueryHandler", "Application/Handlers/GetUserMeasurementsQueryHandler.cs"),
                new("ClientWeightEntries", "HttpEndpoint", "Read", "GET /api/client/weights", "Controllers/ClientProgressController.cs"),
                new("ClientMeasurementEntries", "HttpEndpoint", "Read", "GET /api/client/measurements", "Controllers/ClientProgressController.cs"),
            ],
            [
                new("UserMeasurements", "ApplicationFlow", "Write", "AddUserMeasurementCommandHandler", "Application/Handlers/AddUserMeasurementCommandHandler.cs"),
                new("ClientWeightEntries", "HttpEndpoint", "Write", "POST /api/client/weights", "Controllers/ClientProgressController.cs"),
                new("ClientMeasurementEntries", "HttpEndpoint", "Write", "POST /api/client/measurements", "Controllers/ClientProgressController.cs"),
            ]),
        new(
            "PlanHistoryModels",
            "MealPlans + PlanMealItems",
            "ReviewForMerge",
            "Three plan generations coexist: legacy client plans, operational meal plans, and richer diet plans. Do not delete until read and write paths are consolidated.",
            ["ClientMealPlans", "ClientMeals", "MealPlans", "PlanMealItems", "DietPlans", "DietPlanDays", "DietPlanMeals", "MealItems"],
            [
                new("ClientMealPlans", "HttpEndpoint", "Read", "GET /api/client/meal-plans", "Controllers/ClientPlanController.cs"),
                new("ClientMeals", "HttpEndpoint", "Read", "GET /api/dietitian/recipes/popular", "Controllers/DietitianRecipesController.cs"),
                new("MealPlans", "HttpEndpoint", "Read", "GET /api/client/plans/today", "Controllers/ClientPlanController.cs"),
                new("PlanMealItems", "HttpEndpoint", "Read", "POST /api/client/meals/{mealItemId}/complete", "Controllers/ClientPlanController.cs"),
                new("DietPlans", "ApplicationFlow", "Read", "GetDailyComplianceQueryHandler", "Application/Handlers/GetDailyComplianceQueryHandler.cs"),
                new("DietPlanMeals", "ApplicationFlow", "Read", "MarkMealComplianceCommandHandler", "Application/Handlers/MarkMealComplianceCommandHandler.cs"),
            ],
            [
                new("ClientMealPlans", "HttpEndpoint", "Write", "POST /api/dietitian/plans/clients/{clientId}/assign", "Controllers/DietitianPlanController.cs"),
                new("ClientMeals", "HttpEndpoint", "Write", "POST /api/dietitian/plans/clients/{clientId}/assign", "Controllers/DietitianPlanController.cs"),
                new("MealPlans", "HttpEndpoint", "Write", "POST /api/dietitian/daily-plans/clients/{clientId}", "Controllers/DietitianDailyPlanController.cs"),
                new("PlanMealItems", "HttpEndpoint", "Write", "POST /api/dietitian/daily-plans/{planId}/meals", "Controllers/DietitianDailyPlanController.cs"),
                new("DietPlans", "ApplicationFlow", "Write", "CreateDietPlanCommandHandler", "Application/Commands/CreateDietPlanCommandHandler.cs"),
            ]),
    ];
}
