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

        public async Task<DecideAlternativeMealResult> Handle(DecideAlternativeMealQuery request, CancellationToken cancellationToken)
        {
            var decision = await _decisionService.DecideForMealAsync(
                request.PlannedRecipeId,
                request.MealType,
                request.ClientAvailableIngredients,
                request.DietitianId,
                cancellationToken);

            var result = new DecideAlternativeMealResult
            {
                CanCookOriginal = decision.CanCookOriginal,
                MissingIngredients = decision.MissingIngredients,
                Explanation = decision.Explanation
            };

            if (decision.AlternativeRecommendation != null)
            {
                result.AlternativeRecommendation = new AlternativeRecipeDto
                {
                    RecipeId = decision.AlternativeRecommendation.RecipeId,
                    RecipeName = decision.AlternativeRecommendation.RecipeName,
                    MatchPercentage = decision.AlternativeRecommendation.MatchPercentage,
                    MissingIngredientsForAlternative = decision.AlternativeRecommendation.MissingIngredientsForAlternative,
                    NutritionalComparison = decision.AlternativeRecommendation.NutritionalComparison
                };
            }

            return result;
        }
    }
}
