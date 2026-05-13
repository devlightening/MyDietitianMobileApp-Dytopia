using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Candidate pool construction for kitchen matching (premium vs free).
/// </summary>
public static class PremiumKitchenCandidateFilter
{
    /// <summary>
    /// Production-safe base filter (demo/draft/hidden/archive) should be applied by the caller before this.
    /// </summary>
    public static IQueryable<Recipe> ApplyVisibilityPolicy(
        IQueryable<Recipe> query,
        bool isPremium,
        Guid? activeDietitianId,
        bool allowGlobalPublicFallback)
    {
        static IQueryable<Recipe> SystemPublicCatalog(IQueryable<Recipe> source)
            => source.Where(r => r.IsPublic && r.DietitianId == null);

        if (!isPremium)
            return SystemPublicCatalog(query);

        if (!activeDietitianId.HasValue)
            return SystemPublicCatalog(query);

        var aid = activeDietitianId.Value;

        // Linked clinic (private or "published" under this tenant)
        var linked = query.Where(r => r.DietitianId == aid);

        if (!allowGlobalPublicFallback)
            return linked;

        // Fallback is intentionally limited to the system public catalog.
        // Public recipes owned by another dietitian are tenant content and stay hidden.
        return query.Where(r =>
            r.DietitianId == aid
            || (r.IsPublic && r.DietitianId == null));
    }
}
