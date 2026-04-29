using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Domain.Services
{
    /// <summary>
    /// Decision result for whether a client can cook a planned meal or needs an alternative.
    /// </summary>
    public class AlternativeMealDecision
    {
        public bool CanCookOriginal { get; }
        public List<Guid> MissingIngredients { get; }

        /// <summary>Up to 5 alternatives ordered by combined nutritional + ingredient score.</summary>
        public List<AlternativeRecipeRecommendation> AlternativeRecommendations { get; }

        /// <summary>Best alternative — first from list or null. Kept for backward compatibility.</summary>
        public AlternativeRecipeRecommendation? AlternativeRecommendation =>
            AlternativeRecommendations.Count > 0 ? AlternativeRecommendations[0] : null;

        public string Explanation { get; }

        public AlternativeMealDecision(
            bool canCookOriginal,
            List<Guid> missingIngredients,
            List<AlternativeRecipeRecommendation> alternativeRecommendations,
            string explanation)
        {
            CanCookOriginal = canCookOriginal;
            MissingIngredients = missingIngredients ?? new List<Guid>();
            AlternativeRecommendations = alternativeRecommendations ?? new List<AlternativeRecipeRecommendation>();
            Explanation = explanation;
        }

        public static AlternativeMealDecision CanCook(string explanation) =>
            new(true, new List<Guid>(), new List<AlternativeRecipeRecommendation>(), explanation);

        public static AlternativeMealDecision NeedsAlternative(
            List<Guid> missingIngredients,
            List<AlternativeRecipeRecommendation> alternatives,
            string explanation) =>
            new(false, missingIngredients, alternatives, explanation);

        // Backward-compat factory used in legacy paths
        public static AlternativeMealDecision NeedsAlternative(
            List<Guid> missingIngredients,
            AlternativeRecipeRecommendation? alternative,
            string explanation) =>
            new(false, missingIngredients,
                alternative != null
                    ? new List<AlternativeRecipeRecommendation> { alternative }
                    : new List<AlternativeRecipeRecommendation>(),
                explanation);
    }

    /// <summary>
    /// A single alternative recipe recommendation with ingredient coverage and nutritional proximity scores.
    /// </summary>
    public class AlternativeRecipeRecommendation
    {
        public Guid RecipeId { get; }
        public string RecipeName { get; }

        /// <summary>Ingredient coverage 0-100.</summary>
        public decimal MatchPercentage { get; }

        public List<Guid> MissingIngredientsForAlternative { get; }
        public List<string> MissingIngredientNamesForAlternative { get; }

        /// <summary>Human-readable delta string, e.g. "+3g Protein · -40 kcal".</summary>
        public string NutritionalComparison { get; }
        public List<string> RecommendationReasons { get; }
        public string PlanAlignmentNote { get; }

        // Nutritional values of the candidate recipe
        public int? CaloriesKcal { get; }
        public decimal? ProteinGrams { get; }
        public decimal? CarbsGrams { get; }
        public decimal? FatGrams { get; }

        /// <summary>Nutritional proximity score 0-100 (Protein 40%, Calories 25%, Fat 25%, Carbs 10%).</summary>
        public decimal NutritionalScore { get; }

        /// <summary>Combined score used for ranking: ingredient 40% + nutrition 60%.</summary>
        public decimal CombinedScore { get; }

        public AlternativeRecipeRecommendation(
            Guid recipeId,
            string recipeName,
            decimal matchPercentage,
            List<Guid> missingIngredientsForAlternative,
            List<string> missingIngredientNamesForAlternative,
            string nutritionalComparison,
            List<string> recommendationReasons,
            string planAlignmentNote,
            int? caloriesKcal,
            decimal? proteinGrams,
            decimal? carbsGrams,
            decimal? fatGrams,
            decimal nutritionalScore,
            bool isCookable = false)
        {
            RecipeId = recipeId;
            RecipeName = recipeName;
            MatchPercentage = matchPercentage;
            MissingIngredientsForAlternative = missingIngredientsForAlternative ?? new List<Guid>();
            MissingIngredientNamesForAlternative = missingIngredientNamesForAlternative ?? new List<string>();
            NutritionalComparison = nutritionalComparison;
            RecommendationReasons = recommendationReasons ?? new List<string>();
            PlanAlignmentNote = string.IsNullOrWhiteSpace(planAlignmentNote)
                ? "Plan akisina yakin kalir."
                : planAlignmentNote.Trim();
            CaloriesKcal = caloriesKcal;
            ProteinGrams = proteinGrams;
            CarbsGrams = carbsGrams;
            FatGrams = fatGrams;
            NutritionalScore = nutritionalScore;
            // Fully-cookable recipes get a 20-point bonus so they rank above partial matches
            // even when nutritional similarity is slightly lower.
            // Formula: ingredient 40% + nutrition 45% + cookability 15% (max 100).
            var cookabilityBonus = isCookable ? 20m : 0m;
            CombinedScore = Math.Min(100m, matchPercentage * 0.40m + nutritionalScore * 0.45m + cookabilityBonus);
        }
    }

    /// <summary>
    /// Domain service for determining if a client needs an alternative meal
    /// and providing the best alternative recommendations ordered by nutritional + ingredient fit.
    /// </summary>
    public interface IAlternativeMealDecisionService
    {
        Task<AlternativeMealDecision> DecideForMealAsync(
            Guid plannedRecipeId,
            MealType mealType,
            List<Guid> clientAvailableIngredients,
            Guid dietitianId,
            CancellationToken cancellationToken = default);
    }
}
