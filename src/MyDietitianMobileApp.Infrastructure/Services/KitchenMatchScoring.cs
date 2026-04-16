using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Deterministic scoring for kitchen match ranking.
///
/// Weight hierarchy (highest to lowest contribution):
///   1. matchStatus tier base   — FULL_MATCH=1000 / ONE_MISSING=720 / PARTIAL_MATCH=560
///   2. core mandatory matched  — ×118 per ingredient (protein, legume, main vegetable)
///   3. clinic bonus            — +260 for recipes owned by the active dietitian
///   4. core optional matched   — ×28 per ingredient (supporting vegetables, flavour base)
///   5. condiment mandatory matched — ×14 (salt, oil, spice as mandatory)
///   6. condiment optional matched  — ×8 (salt, oil, spice as optional — minimal signal)
///   7. substitute penalty      — −12 per substitute used
///   8. public fallback penalty — −80 for recipes outside the linked clinic
///
/// Core vs condiment distinction prevents "Tuz" from inflating a recipe's score
/// beyond recipes that match on real protein/base ingredients.
/// </summary>
public static class KitchenMatchScoring
{
    public const double NormalizeDivisor = 3200.0;

    // Weight constants — public so tests can reference them symbolically without magic numbers
    public const int CoreMandatoryWeight      = 118;
    public const int CondimentMandatoryWeight = 14;
    public const int CoreOptionalWeight       = 28;
    public const int CondimentOptionalWeight  = 8;
    public const int SubstitutePenaltyWeight  = 12;
    public const int ClinicBonus              = 260;
    public const int FallbackPenalty          = -80;

    /// <summary>
    /// Compute a score breakdown for a single evaluated recipe.
    /// </summary>
    /// <param name="availableIngredientIds">
    /// The client's basket (used to split optional matches into core vs condiment).
    /// When null the old behaviour is preserved: all optionals weighted uniformly.
    /// </param>
    public static KitchenMatchScoreBreakdown Compute(
        Recipe recipe,
        RecipeEvaluationResult eval,
        int missingCount,
        string matchStatus,
        IReadOnlySet<Guid> condimentIds,
        bool isOwnedByActiveDietitian,
        bool isPublicFallback,
        IReadOnlySet<Guid>? availableIngredientIds = null,
        IReadOnlySet<Guid>? optionalFlavoringIngredientIds = null)
    {
        // ── Mandatory breakdown ──────────────────────────────────────────────
        var mandatory = recipe.MandatoryIngredients.ToList();
        var missingSet = eval.MissingMandatoryIngredientIds.ToHashSet();

        var coreMandatoryMatched = 0;
        var condimentMandatoryMatched = 0;
        foreach (var ing in mandatory)
        {
            if (missingSet.Contains(ing.Id)) continue;
            if (condimentIds.Contains(ing.Id))
                condimentMandatoryMatched++;
            else
                coreMandatoryMatched++;
        }

        // ── Optional breakdown: core vs condiment ────────────────────────────
        // When availableIngredientIds is provided we split optionals into
        // core (vegetables, proteins) and condiment (salt, oil, spice) groups.
        // Condiment optionals contribute far less signal — they are present in
        // almost every recipe and almost every basket.
        var coreOptionalMatched = 0;
        var condimentOptionalMatched = 0;

        if (availableIngredientIds != null)
        {
            foreach (var opt in recipe.OptionalIngredients)
            {
                if (!availableIngredientIds.Contains(opt.Id)) continue;
                if ((optionalFlavoringIngredientIds?.Contains(opt.Id) ?? false) || condimentIds.Contains(opt.Id))
                    condimentOptionalMatched++;
                else
                    coreOptionalMatched++;
            }
        }
        else
        {
            // Legacy path: no basket provided, treat all optionals uniformly.
            // coreOptionalMatched absorbs the total so weight stays at CoreOptionalWeight.
            coreOptionalMatched = eval.MatchedOptionalCount;
        }

        var optionalWeightContribution =
            coreOptionalMatched * CoreOptionalWeight
            + condimentOptionalMatched * CondimentOptionalWeight;

        // ── Tier + adjustments ───────────────────────────────────────────────
        var tierBase = matchStatus switch
        {
            "FULL_MATCH"    => 1000,
            "ONE_MISSING"   => 720,
            "PARTIAL_MATCH" => 560,
            _               => 500
        };

        var coreWeight        = coreMandatoryMatched * CoreMandatoryWeight;
        var condimentWeight   = condimentMandatoryMatched * CondimentMandatoryWeight;
        var substitutePenalty = eval.Explanation.UsedSubstituteIngredientIds.Count * SubstitutePenaltyWeight;
        var clinicBonus       = isOwnedByActiveDietitian ? ClinicBonus : 0;
        var fallbackPenalty   = isPublicFallback ? FallbackPenalty : 0;

        var raw =
            tierBase
            + coreWeight
            + condimentWeight
            + optionalWeightContribution
            + clinicBonus
            - substitutePenalty
            + fallbackPenalty;

        var normalized = Math.Round(Math.Min(1.0, Math.Max(0.0, raw / NormalizeDivisor)), 4);

        // ── Coverage % for human-readable reason ────────────────────────────
        var totalMandatory  = mandatory.Count;
        var matchedMandatory = coreMandatoryMatched + condimentMandatoryMatched;
        var coveragePct     = totalMandatory > 0
            ? (int)Math.Round((double)matchedMandatory / totalMandatory * 100)
            : 0;

        var rankingReason = BuildReason(
            matchStatus,
            isOwnedByActiveDietitian,
            isPublicFallback,
            coreMandatoryMatched,
            condimentMandatoryMatched,
            coreOptionalMatched,
            condimentOptionalMatched,
            missingCount,
            coveragePct);

        return new KitchenMatchScoreBreakdown(
            Raw:                       raw,
            NormalizedScore:           normalized,
            CoreMandatoryMatched:      coreMandatoryMatched,
            CondimentMandatoryMatched: condimentMandatoryMatched,
            CoreOptionalMatched:       coreOptionalMatched,
            CondimentOptionalMatched:  condimentOptionalMatched,
            MatchedOptionalCount:      coreOptionalMatched + condimentOptionalMatched,
            MandatoryCoveragePct:      coveragePct,
            RankingReason:             rankingReason);
    }

    private static string BuildReason(
        string matchStatus,
        bool owned,
        bool publicFallback,
        int coreM,
        int condM,
        int coreOpt,
        int condOpt,
        int missing,
        int coveragePct)
    {
        var scope = owned
            ? "Klinik tarifi"
            : publicFallback ? "Genel katalog (fallback)" : "Genel";

        var mandatoryPart = $"zorunlu kapsama %{coveragePct} (çekirdek={coreM}, baharat={condM})";
        var optionalPart  = coreOpt + condOpt > 0
            ? $", opsiyonel eşleşme={coreOpt + condOpt} (çekirdek={coreOpt}, baharat={condOpt})"
            : string.Empty;

        return matchStatus switch
        {
            "FULL_MATCH"    => $"Tam uyum · {scope} · {mandatoryPart}{optionalPart}",
            "ONE_MISSING"   => $"Bir zorunlu eksik · {scope} · {mandatoryPart}{optionalPart}",
            "PARTIAL_MATCH" => $"Kısmi uyum ({missing} zorunlu eksik) · {scope} · {mandatoryPart}{optionalPart}",
            _               => scope
        };
    }
}

public readonly record struct KitchenMatchScoreBreakdown(
    double Raw,
    double NormalizedScore,
    int CoreMandatoryMatched,
    int CondimentMandatoryMatched,
    /// <summary>Core (non-condiment) optional ingredients present in the basket.</summary>
    int CoreOptionalMatched,
    /// <summary>Condiment/pantry-helper optional ingredients present in the basket.</summary>
    int CondimentOptionalMatched,
    /// <summary>Total optional ingredients matched (core + condiment).</summary>
    int MatchedOptionalCount,
    /// <summary>Percentage of mandatory ingredients covered (0–100).</summary>
    int MandatoryCoveragePct,
    string RankingReason);
