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
        public List<string> MissingIngredientNames { get; set; } = new();

        /// <summary>Up to 5 alternatives ordered by combined nutritional + ingredient score.</summary>
        public List<AlternativeRecipeDto> AlternativeRecommendations { get; set; } = new();

        /// <summary>Best alternative (first item). Kept for backward compatibility with older clients.</summary>
        public AlternativeRecipeDto? AlternativeRecommendation =>
            AlternativeRecommendations.Count > 0 ? AlternativeRecommendations[0] : null;

        public string Explanation { get; set; } = string.Empty;
    }

    public class AlternativeRecipeDto
    {
        public Guid RecipeId { get; set; }
        public string RecipeName { get; set; } = string.Empty;

        /// <summary>Ingredient coverage 0–100.</summary>
        public decimal MatchPercentage { get; set; }

        public List<Guid> MissingIngredientsForAlternative { get; set; } = new();
        public List<string> MissingIngredientNamesForAlternative { get; set; } = new();

        /// <summary>Human-readable nutritional delta, e.g. "+3g Protein · −40 kcal".</summary>
        public string NutritionalComparison { get; set; } = string.Empty;
        public List<string> RecommendationReasons { get; set; } = new();
        public string PlanAlignmentNote { get; set; } = string.Empty;

        // Nutritional values of the candidate recipe
        public int? CaloriesKcal { get; set; }
        public decimal? ProteinGrams { get; set; }
        public decimal? CarbsGrams { get; set; }
        public decimal? FatGrams { get; set; }

        /// <summary>Nutritional proximity score 0–100.</summary>
        public decimal NutritionalScore { get; set; }

        /// <summary>Combined ranking score (ingredient 40% + nutrition 60%).</summary>
        public decimal CombinedScore { get; set; }
    }
}
