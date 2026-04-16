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
        if (!isPremium)
            return query.Where(r => r.IsPublic);

        if (!activeDietitianId.HasValue)
            return query.Where(r => r.IsPublic);

        var aid = activeDietitianId.Value;

        // Linked clinic (private or "published" under this tenant)
        var linked = query.Where(r => r.DietitianId == aid);

        if (!allowGlobalPublicFallback)
            return linked;

        // Fallback: public recipes not owned by this clinic (includes system catalog where DietitianId is null)
        return query.Where(r =>
            r.DietitianId == aid
            || (r.IsPublic && (r.DietitianId == null || r.DietitianId != aid)));
    }
}
