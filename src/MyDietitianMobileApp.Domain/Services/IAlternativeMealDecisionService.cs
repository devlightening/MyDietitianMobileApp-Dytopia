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

        /// <summary>
        /// Protein alignment score 0-100. Combines both protein-source similarity
        /// (e.g., red meat vs poultry vs legumes) and protein-amount proximity.
        /// </summary>
        public decimal ProteinScore { get; }

        /// <summary>
        /// Combined score used for ranking (0-100):
        /// - Ingredient coverage (weighted, condiments downweighted): 30%
        /// - Macro/calorie proximity: 50%
        /// - Protein alignment (source + amount): 15%
        /// - Cookability (missing-mandatory penalty): 5%
        /// </summary>
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
            decimal proteinScore)
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
            ProteinScore = proteinScore;

            // Cookability score (0-100): penalize missing mandatory ingredients smoothly
            // instead of hard-prioritizing "fully cookable" side dishes over nutritionally
            // similar main meals that may require 1 item purchase.
            var missingCount = MissingIngredientsForAlternative.Count;
            var cookabilityScore = Math.Max(0m, 100m - missingCount * 25m); // 0 missing=100, 1=75, 2=50, 3=25

            var combined =
                matchPercentage * 0.30m +
                nutritionalScore * 0.50m +
                proteinScore * 0.15m +
                cookabilityScore * 0.05m;

            CombinedScore = Math.Round(Math.Min(100m, combined), 1);
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
