using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MediatR;

namespace MyDietitianMobileApp.Application.Queries
{
    public class DecideAlternativeMealQuery : IRequest<DecideAlternativeMealResult>
    {
        public Guid DietitianId { get; }
        public Guid PlannedRecipeId { get; }
        public MealType MealType { get; }
        public List<Guid> ClientAvailableIngredients { get; }

        public DecideAlternativeMealQuery(
            Guid dietitianId,
            Guid plannedRecipeId,
            MealType mealType,
            List<Guid> clientAvailableIngredients)
        {
            DietitianId = dietitianId;
            PlannedRecipeId = plannedRecipeId;
            MealType = mealType;
            ClientAvailableIngredients = clientAvailableIngredients ?? new List<Guid>();
        }
    }

    public class DecideAlternativeMealResult
    {
        public bool CanCookOriginal { get; set; }
        public List<Guid> MissingIngredients { get; set; } = new();
        /// <summary>Human-readable names for missing ingredients (parallel to MissingIngredients list)</summary>
        public List<string> MissingIngredientNames { get; set; } = new();
        public AlternativeRecipeDto? AlternativeRecommendation { get; set; }
        public string Explanation { get; set; } = string.Empty;
    }

    public class AlternativeRecipeDto
    {
        public Guid RecipeId { get; set; }
        public string RecipeName { get; set; } = string.Empty;
        public decimal MatchPercentage { get; set; }
        public List<Guid> MissingIngredientsForAlternative { get; set; } = new();
        public string NutritionalComparison { get; set; } = string.Empty;
    }
}
