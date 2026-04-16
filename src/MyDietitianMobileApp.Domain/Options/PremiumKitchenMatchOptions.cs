namespace MyDietitianMobileApp.Domain.Options;

/// <summary>
/// Product policy for premium client kitchen matching (source-of-truth on server).
/// </summary>
public sealed class PremiumKitchenMatchOptions
{
    public const string SectionName = "PremiumKitchenMatch";

    /// <summary>
    /// When true, premium users may see <c>IsPublic</c> recipes that are not owned by the linked clinic
    /// (system catalog and other dietitians' published recipes), ranked below clinic-owned recipes.
    /// When false, only recipes with <c>DietitianId == ActiveDietitianId</c> are considered.
    /// </summary>
    public bool AllowGlobalPublicFallback { get; set; }
}
