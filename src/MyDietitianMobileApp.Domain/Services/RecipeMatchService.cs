using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Service for matching recipes to client baskets and dietary restrictions
/// </summary>
public class RecipeMatchService
{
    /// <summary>
    /// Match recipes based on client basket and restrictions
    /// </summary>
    public List<RecipeMatchResult> MatchRecipes(
        List<Guid> basketIngredientIds,
        List<Guid> clientProhibitedIngredientIds,
        List<Recipe> recipePool,
        List<RecipeIngredient> allRecipeIngredients,
        List<RecipeProhibition> allRecipeProhibitions)
    {
        var results = new List<RecipeMatchResult>();

        foreach (var recipe in recipePool)
        {
            // Get recipe's ingredients and prohibitions
            var recipeIngredients = allRecipeIngredients
                .Where(ri => ri.RecipeId == recipe.Id)
                .ToList();

            var recipeProhibitions = allRecipeProhibitions
                .Where(rp => rp.RecipeId == recipe.Id)
                .ToList();

            // Check if recipe is compatible with client restrictions
            var prohibitedIngredientIds = recipeProhibitions
                .Select(rp => rp.IngredientId)
                .ToHashSet();

            var hasProhibitedIngredient = prohibitedIngredientIds
                .Any(pid => clientProhibitedIngredientIds.Contains(pid));

            if (hasProhibitedIngredient)
            {
                // Skip recipes with prohibited ingredients
                continue;
            }

            // Calculate match score
            var mandatoryIngredients = recipeIngredients
                .Where(ri => ri.Role == "Mandatory")
                .Select(ri => ri.IngredientId)
                .ToList();

            var optionalIngredients = recipeIngredients
                .Where(ri => ri.Role == "Optional")
                .Select(ri => ri.IngredientId)
                .ToList();

            if (mandatoryIngredients.Count == 0)
            {
                // Skip recipes with no mandatory ingredients
                continue;
            }

            // Count how many mandatory ingredients are in basket
            var matchedMandatory = mandatoryIngredients
                .Count(mi => basketIngredientIds.Contains(mi));

            // Calculate score (% of mandatory ingredients available)
            var score = (double)matchedMandatory / mandatoryIngredients.Count * 100;

            // Find missing mandatory ingredients
            var missingMandatory = mandatoryIngredients
                .Where(mi => !basketIngredientIds.Contains(mi))
                .ToList();

            // Count matched optional ingredients (bonus)
            var matchedOptional = optionalIngredients
                .Count(oi => basketIngredientIds.Contains(oi));

            results.Add(new RecipeMatchResult
            {
                RecipeId = recipe.Id,
                RecipeName = recipe.Name,
                Score = Math.Round(score, 1),
                MandatoryIngredientsCount = mandatoryIngredients.Count,
                MatchedMandatoryCount = matchedMandatory,
                MissingMandatoryIngredientIds = missingMandatory,
                OptionalIngredientsCount = optionalIngredients.Count,
                MatchedOptionalCount = matchedOptional,
                IsFullMatch = missingMandatory.Count == 0
            });
        }

        // Sort by score descending, then by missing count ascending
        return results
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.MissingMandatoryIngredientIds.Count)
            .ThenByDescending(r => r.MatchedOptionalCount)
            .ToList();
    }
}

/// <summary>
/// Result of recipe matching algorithm
/// </summary>
public class RecipeMatchResult
{
    public Guid RecipeId { get; set; }
    public string RecipeName { get; set; } = string.Empty;
    public double Score { get; set; }
    public int MandatoryIngredientsCount { get; set; }
    public int MatchedMandatoryCount { get; set; }
    public List<Guid> MissingMandatoryIngredientIds { get; set; } = new();
    public int OptionalIngredientsCount { get; set; }
    public int MatchedOptionalCount { get; set; }
    public bool IsFullMatch { get; set; }
}
