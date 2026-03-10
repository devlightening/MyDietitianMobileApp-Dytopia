using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services
{
    public class AlternativeMealDecisionService : IAlternativeMealDecisionService
    {
        private readonly AppDbContext _context;
        private readonly IRecipeRepository _recipeRepository;
        private readonly IRecipeRecommendationEngine _engine;

        public AlternativeMealDecisionService(
            AppDbContext context,
            IRecipeRepository recipeRepository,
            IRecipeRecommendationEngine engine)
        {
            _context = context;
            _recipeRepository = recipeRepository;
            _engine = engine;
        }

        public async Task<AlternativeMealDecision> DecideForMealAsync(
            Guid plannedRecipeId,
            MealType mealType,
            List<Guid> clientAvailableIngredients,
            Guid dietitianId,
            CancellationToken cancellationToken = default)
        {
            // Get the planned recipe
            var allRecipes = await _recipeRepository.GetAllWithIngredientsAsync(cancellationToken);
            var plannedRecipe = allRecipes.FirstOrDefault(r => r.Id == plannedRecipeId);
            
            if (plannedRecipe == null)
            {
                // Log decision with missing planned recipe
                await LogRecommendationAsync(
                    flow: "alternative_decision",
                    clientId: null,
                    dietitianId: dietitianId,
                    plannedRecipeId: plannedRecipeId,
                    selectedRecipeId: null,
                    originalCookable: false,
                    matchPercentage: null,
                    missingMandatoryCount: 0,
                    prohibitedRejected: false,
                    usedSubstitutes: false,
                    missingMandatoryIds: Array.Empty<Guid>(),
                    additionalMeta: new { reason = "Planned recipe not found" },
                    cancellationToken);

                return AlternativeMealDecision.NeedsAlternative(
                    new List<Guid>(),
                    null,
                    "Planned recipe not found.");
            }

            // Build evaluation context (no substitutes in this first slice)
            // For prohibited semantics we mirror previous behavior:
            // any overlap between recipe.ProhibitedIngredients and clientAvailableIngredients rejects the recipe.
            var context = new RecipeEvaluationContext(
                availableIngredientIds: clientAvailableIngredients,
                prohibitedIngredientIds: clientAvailableIngredients);

            var evaluation = _engine.EvaluateRecipe(plannedRecipe, context);

            if (evaluation.Rejected || evaluation.MissingMandatoryCount > 0 || !evaluation.Explanation.IsCookable)
            {
                // Missing mandatory or prohibited conflict - find alternative
                var missingNames = plannedRecipe.MandatoryIngredients
                    .Where(i => evaluation.MissingMandatoryIngredientIds.Contains(i.Id))
                    .Select(i => i.CanonicalName)
                    .ToList();

                var reason = evaluation.Explanation.RejectedBecauseProhibited
                    ? "Client has prohibited ingredients for this recipe."
                    : missingNames.Count > 0
                        ? $"Missing mandatory ingredients: {string.Join(", ", missingNames)}"
                        : "Recipe is not cookable with available ingredients.";

                var alternativeDecision = await FindBestAlternativeAsync(
                    plannedRecipe,
                    mealType,
                    clientAvailableIngredients,
                    dietitianId,
                    reason,
                    cancellationToken);

                await LogRecommendationAsync(
                    flow: "alternative_decision",
                    clientId: null,
                    dietitianId: dietitianId,
                    plannedRecipeId: plannedRecipe.Id,
                    selectedRecipeId: alternativeDecision.AlternativeRecommendation?.RecipeId,
                    originalCookable: false,
                    matchPercentage: null,
                    missingMandatoryCount: evaluation.MissingMandatoryCount,
                    prohibitedRejected: evaluation.Explanation.RejectedBecauseProhibited,
                    usedSubstitutes: evaluation.Explanation.UsedSubstituteIngredientIds.Any(),
                    missingMandatoryIds: evaluation.MissingMandatoryIngredientIds,
                    additionalMeta: new { reason },
                    cancellationToken);

                return alternativeDecision;
            }

            // Check match percentage threshold (80%) for original recipe
            var percentage = evaluation.MatchPercentage;
            if (percentage >= 80m)
            {
                var decision = AlternativeMealDecision.CanCook(
                    $"You have {percentage:F0}% of ingredients for {plannedRecipe.Name}. You can cook this recipe!");

                await LogRecommendationAsync(
                    flow: "alternative_decision",
                    clientId: null,
                    dietitianId: dietitianId,
                    plannedRecipeId: plannedRecipe.Id,
                    selectedRecipeId: plannedRecipe.Id,
                    originalCookable: true,
                    matchPercentage: percentage,
                    missingMandatoryCount: 0,
                    prohibitedRejected: false,
                    usedSubstitutes: evaluation.Explanation.UsedSubstituteIngredientIds.Any(),
                    missingMandatoryIds: Array.Empty<Guid>(),
                    additionalMeta: new { },
                    cancellationToken);

                return decision;
            }

            // Below threshold: treat as low match and look for an alternative
            var missingOptionalIds = plannedRecipe.OptionalIngredients
                .Select(i => i.Id)
                .Except(clientAvailableIngredients)
                .ToList();

            var missingOptionalNames = plannedRecipe.OptionalIngredients
                .Where(i => missingOptionalIds.Contains(i.Id))
                .Select(i => i.CanonicalName)
                .ToList();

            var lowMatchExplanation = $"You only have {percentage:F0}% of ingredients. Missing optional ingredients: {string.Join(", ", missingOptionalNames)}";

            var altDecision = await FindBestAlternativeAsync(
                plannedRecipe,
                mealType,
                clientAvailableIngredients,
                dietitianId,
                lowMatchExplanation,
                cancellationToken);

            await LogRecommendationAsync(
                flow: "alternative_decision",
                clientId: null,
                dietitianId: dietitianId,
                plannedRecipeId: plannedRecipe.Id,
                selectedRecipeId: altDecision.AlternativeRecommendation?.RecipeId,
                originalCookable: false,
                matchPercentage: percentage,
                missingMandatoryCount: 0,
                prohibitedRejected: false,
                usedSubstitutes: evaluation.Explanation.UsedSubstituteIngredientIds.Any(),
                missingMandatoryIds: Array.Empty<Guid>(),
                additionalMeta: new { lowMatch = true },
                cancellationToken);

            return altDecision;
        }

        private async Task<AlternativeMealDecision> FindBestAlternativeAsync(
            Recipe originalRecipe,
            MealType mealType,
            List<Guid> clientAvailableIngredients,
            Guid dietitianId,
            string reasonForAlternative,
            CancellationToken cancellationToken)
        {
            // Get all recipes for this dietitian (excluding the original recipe)
            var allRecipes = await _recipeRepository.GetAllWithIngredientsAsync(cancellationToken);
            var dietitianRecipes = allRecipes
                .Where(r => r.DietitianId == dietitianId && r.Id != originalRecipe.Id)
                .ToList();

            if (!dietitianRecipes.Any())
            {
                return AlternativeMealDecision.NeedsAlternative(
                    new List<Guid>(),
                    null,
                    $"{reasonForAlternative} No alternative recipes available.");
            }

            // Evaluate and rank alternative recipes using the shared engine
            var context = new RecipeEvaluationContext(
                availableIngredientIds: clientAvailableIngredients,
                prohibitedIngredientIds: clientAvailableIngredients); // recipe-level prohibitions handled by engine

            var ranked = _engine.RankRecipes(dietitianRecipes, context);
            var bestMatch = ranked.FirstOrDefault();

            if (bestMatch == null)
            {
                return AlternativeMealDecision.NeedsAlternative(
                    new List<Guid>(),
                    null,
                    $"{reasonForAlternative} No suitable alternative recipes found (all have prohibited ingredients or missing mandatory ingredients).");
            }

            var recommendation = new AlternativeRecipeRecommendation(
                bestMatch.Recipe.Id,
                bestMatch.Recipe.Name,
                bestMatch.MatchPercentage,
                bestMatch.MissingMandatoryIngredientIds.ToList(),
                "Nutritional comparison not yet implemented"); // TODO: Add nutritional comparison
            var explanation = $"{reasonForAlternative} We recommend '{bestMatch.Recipe.Name}' as an alternative ({bestMatch.MatchPercentage:F0}% ingredient match).";

            return AlternativeMealDecision.NeedsAlternative(
                new List<Guid>(),
                recommendation,
                explanation);
        }

        private async Task LogRecommendationAsync(
            string flow,
            Guid? clientId,
            Guid? dietitianId,
            Guid? plannedRecipeId,
            Guid? selectedRecipeId,
            bool originalCookable,
            decimal? matchPercentage,
            int missingMandatoryCount,
            bool prohibitedRejected,
            bool usedSubstitutes,
            IReadOnlyCollection<Guid> missingMandatoryIds,
            object? additionalMeta,
            CancellationToken cancellationToken)
        {
            try
            {
                var missingIdsJson = missingMandatoryIds != null && missingMandatoryIds.Count > 0
                    ? System.Text.Json.JsonSerializer.Serialize(missingMandatoryIds)
                    : null;

                string? additionalMetaJson = null;
                if (additionalMeta != null)
                {
                    additionalMetaJson = System.Text.Json.JsonSerializer.Serialize(additionalMeta);
                }

                var log = new RecipeRecommendationLog(
                    id: Guid.NewGuid(),
                    flow: flow,
                    clientId: clientId,
                    dietitianId: dietitianId,
                    plannedRecipeId: plannedRecipeId,
                    selectedRecipeId: selectedRecipeId,
                    originalCookable: originalCookable,
                    matchPercentage: matchPercentage,
                    missingMandatoryCount: missingMandatoryCount,
                    prohibitedRejected: prohibitedRejected,
                    usedSubstitutes: usedSubstitutes,
                    missingMandatoryIdsJson: missingIdsJson,
                    additionalMetaJson: additionalMetaJson,
                    correlationId: null);

                _context.RecipeRecommendationLogs.Add(log);
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch
            {
                // Logging must not break core decision flow
            }
        }
    }
}
