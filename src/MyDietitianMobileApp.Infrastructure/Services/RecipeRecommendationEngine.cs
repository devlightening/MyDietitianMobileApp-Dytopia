using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Deterministic implementation of the shared recipe recommendation engine.
/// 
/// This engine:
/// - rejects recipes containing prohibited ingredients
/// - enforces mandatory ingredient coverage (with optional substitutes)
/// - scores recipes by coverage of mandatory+optional ingredients
/// - produces structured explanation metadata for each evaluation
/// 
/// It does not perform fuzzy or LLM-based reasoning; those can be layered on later.
/// </summary>
public class RecipeRecommendationEngine : IRecipeRecommendationEngine
{
    private static int GetCompatibilityRank(CompatibilityType compatibilityType) => compatibilityType switch
    {
        CompatibilityType.ExactOnly => 3,
        CompatibilityType.SubstituteAllowed => 2,
        CompatibilityType.FamilyCompatible => 1,
        _ => 0,
    };

    public RecipeEvaluationResult EvaluateRecipe(Recipe recipe, RecipeEvaluationContext context)
    {
        var available = context.AvailableIngredientIds;
        var prohibited = context.ProhibitedIngredientIds;

        // A) Reject if any prohibited ingredient is present in recipe-level prohibitions
        var recipeProhibitedIds = recipe.ProhibitedIngredients.Select(i => i.Id).ToHashSet();
        var hasProhibitedConflict = recipeProhibitedIds.Overlaps(prohibited);

        if (hasProhibitedConflict)
        {
            return new RecipeEvaluationResult
            {
                Recipe = recipe,
                Rejected = true,
                MatchPercentage = 0,
                MissingMandatoryCount = 0,
                MissingMandatoryIngredientIds = Array.Empty<Guid>(),
                MatchedOptionalCount = 0,
                Explanation = new RecipeEvaluationExplanation
                {
                    RejectedBecauseProhibited = true,
                    MissingMandatoryCount = 0,
                    MissingMandatoryIngredientIds = Array.Empty<Guid>(),
                    MatchedOptionalCount = 0,
                    ExactMandatoryMatchedCount = 0,
                    SubstituteMandatoryMatchedCount = 0,
                    UsedSubstituteIngredientIds = Array.Empty<Guid>(),
                    IsCookable = false,
                    IsStrongAlternativeCandidate = false,
                    Reason = "Recipe contains ingredients prohibited for the client."
                }
            };
        }

        // B) Mandatory coverage with optional substitute support
        var mandatoryIds = recipe.MandatoryIngredients.Select(i => i.Id).ToList();

        // B-0) Quality guardrail — reject recipes with zero mandatory ingredients.
        // A recipe with 0 mandatory ingredients would score 100 % by vacuous truth,
        // meaning ANY ingredient basket "fully matches" it. This is semantically wrong
        // and was the primary cause of false FULL_MATCH results (thesis AC-01).
        if (mandatoryIds.Count == 0)
        {
            return new RecipeEvaluationResult
            {
                Recipe = recipe,
                Rejected = true,
                MatchPercentage = 0,
                MissingMandatoryCount = 0,
                MissingMandatoryIngredientIds = Array.Empty<Guid>(),
                MatchedOptionalCount = 0,
                Explanation = new RecipeEvaluationExplanation
                {
                    RejectedBecauseProhibited = false,
                    MissingMandatoryCount = 0,
                    MissingMandatoryIngredientIds = Array.Empty<Guid>(),
                    MatchedOptionalCount = 0,
                    ExactMandatoryMatchedCount = 0,
                    SubstituteMandatoryMatchedCount = 0,
                    UsedSubstituteIngredientIds = Array.Empty<Guid>(),
                    IsCookable = false,
                    IsStrongAlternativeCandidate = false,
                    Reason = "QUALITY_INVALID: Recipe has no mandatory ingredients — excluded from recommendation pool."
                }
            };
        }

        var missingMandatory = new List<Guid>();
        var usedSubstitutes = new HashSet<Guid>();
        var exactMandatoryMatchedCount = 0;
        var substituteMandatoryMatchedCount = 0;

        foreach (var mandatoryId in mandatoryIds)
        {
            if (available.Contains(mandatoryId))
            {
                exactMandatoryMatchedCount++;
                continue;
            }

            // Try substitutes if configured in context
            if (context.SubstitutesByRecipeAndRequired.TryGetValue((recipe.Id, mandatoryId), out var substitutes))
            {
                var chosenSubstituteId = substitutes
                    .Where(id => available.Contains(id))
                    .OrderByDescending(id =>
                    {
                        return context.SubstituteCompatibilityByRecipeRequiredAndCandidate
                            .TryGetValue((recipe.Id, mandatoryId, id), out var compatibilityType)
                            ? GetCompatibilityRank(compatibilityType)
                            : GetCompatibilityRank(CompatibilityType.SubstituteAllowed);
                    })
                    .ThenBy(id => id)
                    .FirstOrDefault();

                if (chosenSubstituteId != Guid.Empty)
                {
                    usedSubstitutes.Add(chosenSubstituteId);
                    substituteMandatoryMatchedCount++;
                    continue;
                }
            }

            // Still missing
            missingMandatory.Add(mandatoryId);
        }

        var missingCount = missingMandatory.Count;

        // For the alternative engine, we treat any missing mandatory as non-cookable.
        if (missingCount > 0)
        {
            return new RecipeEvaluationResult
            {
                Recipe = recipe,
                Rejected = false,
                MatchPercentage = 0,
                MissingMandatoryCount = missingCount,
                MissingMandatoryIngredientIds = missingMandatory,
                MatchedOptionalCount = 0,
                Explanation = new RecipeEvaluationExplanation
                {
                    RejectedBecauseProhibited = false,
                    MissingMandatoryCount = missingCount,
                    MissingMandatoryIngredientIds = missingMandatory,
                    MatchedOptionalCount = 0,
                    ExactMandatoryMatchedCount = exactMandatoryMatchedCount,
                    SubstituteMandatoryMatchedCount = substituteMandatoryMatchedCount,
                    UsedSubstituteIngredientIds = usedSubstitutes,
                    IsCookable = false,
                    IsStrongAlternativeCandidate = false,
                    Reason = $"Recipe is missing mandatory ingredients. Exact coverage={exactMandatoryMatchedCount}, substitute coverage={substituteMandatoryMatchedCount}."
                }
            };
        }

        // B-2) Condiment-only guardrail.
        // If every matched mandatory ingredient is a condiment/pantry helper (oil, salt, spice…),
        // the match has no real culinary meaning. For example: selecting only "Ayçiçek Yağı"
        // should not produce a FULL_MATCH for any recipe whose only mandatory ingredient is oil.
        if (context.CondimentIngredientIds.Count > 0 && mandatoryIds.Count > 0)
        {
            var matchedMandatoryIds = mandatoryIds.Except(missingMandatory).ToHashSet();
            if (matchedMandatoryIds.Count > 0 &&
                matchedMandatoryIds.All(id => context.CondimentIngredientIds.Contains(id)))
            {
                return new RecipeEvaluationResult
                {
                    Recipe = recipe,
                    Rejected = true,
                    MatchPercentage = 0,
                    MissingMandatoryCount = 0,
                    MissingMandatoryIngredientIds = Array.Empty<Guid>(),
                    MatchedOptionalCount = 0,
                    Explanation = new RecipeEvaluationExplanation
                    {
                        RejectedBecauseProhibited = false,
                        MissingMandatoryCount = 0,
                        MissingMandatoryIngredientIds = Array.Empty<Guid>(),
                        MatchedOptionalCount = 0,
                        ExactMandatoryMatchedCount = exactMandatoryMatchedCount,
                        SubstituteMandatoryMatchedCount = substituteMandatoryMatchedCount,
                        UsedSubstituteIngredientIds = usedSubstitutes,
                        IsCookable = false,
                        IsStrongAlternativeCandidate = false,
                        Reason = "CONDIMENT_ONLY_MATCH: All matched mandatory ingredients are condiments/pantry helpers — not a meaningful recipe match."
                    }
                };
            }
        }

        // C) Score based on overall coverage of mandatory + optional ingredients
        var optionalIds = recipe.OptionalIngredients.Select(i => i.Id).ToList();
        var allRequired = mandatoryIds.Concat(optionalIds).Distinct().ToList();

        // Mandatory coverage: any mandatory not in missingMandatory is considered covered
        var coveredMandatory = mandatoryIds.Except(missingMandatory).ToHashSet();
        var coveredRequired = new HashSet<Guid>(coveredMandatory);
        // Optional coverage: only those actually present in available set
        foreach (var optId in optionalIds)
        {
            if (available.Contains(optId))
            {
                coveredRequired.Add(optId);
            }
        }
        var matchedOptionalCount = optionalIds.Count(id => available.Contains(id));

        decimal matchPercentage;
        if (allRequired.Count == 0)
        {
            matchPercentage = 100m;
        }
        else
        {
            matchPercentage = (decimal)coveredRequired.Count / allRequired.Count * 100m;
        }

        return new RecipeEvaluationResult
        {
            Recipe = recipe,
            Rejected = false,
            MatchPercentage = matchPercentage,
            MissingMandatoryCount = 0,
            MissingMandatoryIngredientIds = Array.Empty<Guid>(),
            MatchedOptionalCount = matchedOptionalCount,
            Explanation = new RecipeEvaluationExplanation
            {
                RejectedBecauseProhibited = false,
                MissingMandatoryCount = 0,
                MissingMandatoryIngredientIds = Array.Empty<Guid>(),
                MatchedOptionalCount = matchedOptionalCount,
                ExactMandatoryMatchedCount = exactMandatoryMatchedCount,
                SubstituteMandatoryMatchedCount = substituteMandatoryMatchedCount,
                UsedSubstituteIngredientIds = usedSubstitutes,
                IsCookable = true,
                IsStrongAlternativeCandidate = true,
                Reason = $"Recipe is cookable with available ingredients. Exact coverage={exactMandatoryMatchedCount}, substitute coverage={substituteMandatoryMatchedCount}."
            }
        };
    }

    public IReadOnlyList<RecipeEvaluationResult> RankRecipes(IEnumerable<Recipe> recipes, RecipeEvaluationContext context)
    {
        // Include FULL_MATCH (missing=0) and ONE_MISSING (missing=1); exclude rejected and NOT_ELIGIBLE (2+)
        var evaluated = recipes
            .Select(r => EvaluateRecipe(r, context))
            .Where(r => !r.Rejected && r.MissingMandatoryCount <= 1)
            .ToList();

        return evaluated
            // FULL_MATCH before ONE_MISSING
            .OrderBy(r => r.MissingMandatoryCount)
            .ThenByDescending(r => r.Explanation.ExactMandatoryMatchedCount)
            .ThenBy(r => r.Explanation.SubstituteMandatoryMatchedCount)
            .ThenByDescending(r => r.MatchPercentage)
            .ThenByDescending(r => r.MatchedOptionalCount)
            .ThenBy(r => r.Recipe.Name)
            .ToList();
    }
}

