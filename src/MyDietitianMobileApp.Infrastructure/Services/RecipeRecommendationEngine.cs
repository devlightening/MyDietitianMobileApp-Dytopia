using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
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
                    UsedSubstituteIngredientIds = Array.Empty<Guid>(),
                    IsCookable = false,
                    IsStrongAlternativeCandidate = false,
                    Reason = "Recipe contains ingredients prohibited for the client."
                }
            };
        }

        // B) Mandatory coverage with optional substitute support
        var mandatoryIds = recipe.MandatoryIngredients.Select(i => i.Id).ToList();
        var missingMandatory = new List<Guid>();
        var usedSubstitutes = new HashSet<Guid>();

        foreach (var mandatoryId in mandatoryIds)
        {
            if (available.Contains(mandatoryId))
                continue;

            // Try substitutes if configured in context
            if (context.SubstitutesByRecipeAndRequired.TryGetValue((recipe.Id, mandatoryId), out var substitutes))
            {
                var fulfilledBySub = substitutes.Any(id => available.Contains(id));
                if (fulfilledBySub)
                {
                    foreach (var subId in substitutes)
                    {
                        if (available.Contains(subId))
                        {
                            usedSubstitutes.Add(subId);
                        }
                    }
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
                    UsedSubstituteIngredientIds = usedSubstitutes,
                    IsCookable = false,
                    IsStrongAlternativeCandidate = false,
                    Reason = "Recipe is missing mandatory ingredients."
                }
            };
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
                UsedSubstituteIngredientIds = usedSubstitutes,
                IsCookable = true,
                IsStrongAlternativeCandidate = true,
                Reason = "Recipe is cookable with available ingredients."
            }
        };
    }

    public IReadOnlyList<RecipeEvaluationResult> RankRecipes(IEnumerable<Recipe> recipes, RecipeEvaluationContext context)
    {
        var evaluated = recipes
            .Select(r => EvaluateRecipe(r, context))
            .Where(r => !r.Rejected && r.Explanation.IsCookable)
            .ToList();

        return evaluated
            .OrderByDescending(r => r.MatchPercentage)
            .ThenByDescending(r => r.MatchedOptionalCount)
            .ThenBy(r => r.Recipe.Name)
            .ToList();
    }
}

