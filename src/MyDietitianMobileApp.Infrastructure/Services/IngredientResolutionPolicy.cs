using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Deterministic ordering and duplicate-collapse policy for live ingredient dictionaries.
/// This keeps thesis/runtime behavior stable while the physical dedupe pass is still pending.
/// </summary>
internal static class IngredientResolutionPolicy
{
    public static IReadOnlyList<Ingredient> OrderCandidates(IEnumerable<Ingredient> ingredients)
        => ingredients
            .OrderByDescending(HasDeterministicSeedId)
            .ThenByDescending(i => i.Aliases.Count)
            .ThenByDescending(i => i.CanonicalName.Length)
            .ThenBy(i => i.Id)
            .ToArray();

    public static bool TryCollapseSameCanonicalIdentity(
        IEnumerable<Ingredient> ingredients,
        out Ingredient preferred,
        out IReadOnlyList<Ingredient> orderedCandidates)
    {
        orderedCandidates = OrderCandidates(ingredients);
        preferred = orderedCandidates[0];

        if (orderedCandidates.Count <= 1)
        {
            return false;
        }

        var canonicalKeys = orderedCandidates
            .Select(i => IngredientNormalizationService.NormalizeText(i.CanonicalName))
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return canonicalKeys.Length == 1;
    }

    public static Ingredient SelectPreferred(IEnumerable<Ingredient> ingredients)
        => OrderCandidates(ingredients).First();

    private static bool HasDeterministicSeedId(Ingredient ingredient)
        => ingredient.Id.ToString("N").StartsWith("ee", StringComparison.OrdinalIgnoreCase);
}
