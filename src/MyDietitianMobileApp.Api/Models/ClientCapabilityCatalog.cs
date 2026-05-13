namespace MyDietitianMobileApp.Api.Models;

public sealed record ClientCapabilities(
    bool ManualPantry,
    bool ManualKitchen,
    bool PublicRecipes,
    bool RecipeDetail,
    bool CookingMode,
    bool PublicRecipeShoppingList,
    bool Plans,
    bool Messages,
    bool Favorites,
    bool ClinicRecipes,
    bool AiScans,
    bool Appointments,
    bool CareNotes,
    bool TodayPlanShoppingList);

public static class ClientCapabilityCatalog
{
    public static string GetSubscriptionTier(bool isPremium) => isPremium ? "premium" : "free";

    public static ClientCapabilities For(bool isPremium) => new(
        ManualPantry: true,
        ManualKitchen: true,
        PublicRecipes: true,
        RecipeDetail: true,
        CookingMode: true,
        PublicRecipeShoppingList: true,
        Plans: isPremium,
        Messages: isPremium,
        Favorites: isPremium,
        ClinicRecipes: isPremium,
        AiScans: isPremium,
        Appointments: isPremium,
        CareNotes: isPremium,
        TodayPlanShoppingList: isPremium);
}
