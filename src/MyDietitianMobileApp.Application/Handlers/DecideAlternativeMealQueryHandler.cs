using MediatR;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class DecideAlternativeMealQueryHandler : IRequestHandler<DecideAlternativeMealQuery, DecideAlternativeMealResult>
    {
        private readonly IAlternativeMealDecisionService _decisionService;

        public DecideAlternativeMealQueryHandler(IAlternativeMealDecisionService decisionService)
        {
            _decisionService = decisionService;
        }

        public async Task<DecideAlternativeMealResult> Handle(
            DecideAlternativeMealQuery request,
            CancellationToken cancellationToken)
        {
            var decision = await _decisionService.DecideForMealAsync(
                request.PlannedRecipeId,
                request.MealType,
                request.ClientAvailableIngredients,
                request.DietitianId,
                cancellationToken);

            return new DecideAlternativeMealResult
            {
                CanCookOriginal = decision.CanCookOriginal,
                MissingIngredients = decision.MissingIngredients,
                Explanation = decision.Explanation,
                AlternativeRecommendations = decision.AlternativeRecommendations
                    .Select(r => new AlternativeRecipeDto
                    {
                        RecipeId = r.RecipeId,
                        RecipeName = r.RecipeName,
                        MatchPercentage = r.MatchPercentage,
                        MissingIngredientsForAlternative = r.MissingIngredientsForAlternative,
                        MissingIngredientNamesForAlternative = r.MissingIngredientNamesForAlternative,
                        NutritionalComparison = r.NutritionalComparison,
                        RecommendationReasons = r.RecommendationReasons,
                        PlanAlignmentNote = r.PlanAlignmentNote,
                        CaloriesKcal = r.CaloriesKcal,
                        ProteinGrams = r.ProteinGrams,
                        CarbsGrams = r.CarbsGrams,
                        FatGrams = r.FatGrams,
                        NutritionalScore = r.NutritionalScore,
                        CombinedScore = r.CombinedScore,
                    })
                    .ToList(),
            };
        }
    }
}
