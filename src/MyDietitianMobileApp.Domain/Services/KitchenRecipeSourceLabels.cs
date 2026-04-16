using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// API-facing source labels for kitchen match results. Not to be confused with raw <see cref="Recipe.DietitianId"/>.
/// </summary>
public static class KitchenRecipeSourceLabels
{
    public const string LinkedClinicPrivate = "LINKED_CLINIC_PRIVATE";
    public const string LinkedClinicPublic = "LINKED_CLINIC_PUBLIC";
    public const string GlobalPublicFallback = "GLOBAL_PUBLIC_FALLBACK";
    public const string OtherDietitianPublic = "OTHER_DIETITIAN_PUBLIC";

    /// <summary>
    /// Sentinel: a private recipe from another dietitian reached the evaluation loop.
    /// The candidate filter should have excluded it — this value signals a pool invariant violation.
    /// The controller must hard-reject recipes with this source type and log an error.
    /// </summary>
    public const string OtherDietitianPrivateViolation = "OTHER_DIETITIAN_PRIVATE_VIOLATION";

    /// <summary>
    /// Classifies a recipe for response metadata. <paramref name="activeDietitianId"/> is the premium client's linked clinic id.
    /// </summary>
    public static KitchenRecipeSourceMetadata Classify(Recipe recipe, Guid? activeDietitianId)
    {
        var ownerId = recipe.DietitianId;
        var owned = ownerId.HasValue && activeDietitianId.HasValue && ownerId.Value == activeDietitianId.Value;

        string sourceType;
        if (owned)
            sourceType = recipe.IsPublic ? LinkedClinicPublic : LinkedClinicPrivate;
        else if (recipe.IsPublic)
            sourceType = ownerId.HasValue ? OtherDietitianPublic : GlobalPublicFallback;
        else
            // Private recipe not owned by the linked clinic.
            // This MUST NOT appear when the candidate filter is working correctly.
            // Return a violation sentinel so the caller can hard-reject and log the incident.
            sourceType = OtherDietitianPrivateViolation;

        var isPublicFallback = recipe.IsPublic && !owned;

        return new KitchenRecipeSourceMetadata(
            SourceType: sourceType,
            SourceDietitianId: ownerId,
            IsOwnedByActiveDietitian: owned,
            IsPublicFallback: isPublicFallback);
    }
}

public readonly record struct KitchenRecipeSourceMetadata(
    string SourceType,
    Guid? SourceDietitianId,
    bool IsOwnedByActiveDietitian,
    bool IsPublicFallback);
