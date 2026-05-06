using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services
{
    public class AlternativeMealDecisionService : IAlternativeMealDecisionService
    {
        private const int MaxAlternatives = 5;

        // Maximum number of missing mandatory ingredients still allowed in the alternative pool.
        // Recipes missing 1-3 mandatory ingredients are shown but ranked below fully-cookable ones.
        private const int MaxMissingForAlternative = 3;

        // Nutritional tolerance bands (fraction of target value)
        private const decimal ProteinTolerance  = 0.20m; // ±20%
        private const decimal CalorieTolerance  = 0.20m; // ±20%
        private const decimal FatTolerance      = 0.25m; // ±25%
        private const decimal CarbsTolerance    = 0.30m; // ±30%

        // Nutritional scoring weights (must sum to 100)
        private const decimal ProteinWeight  = 40m;
        private const decimal CalorieWeight  = 25m;
        private const decimal FatWeight      = 25m;
        private const decimal CarbsWeight    = 10m;

        private readonly AppDbContext _context;
        private readonly IRecipeRepository _recipeRepository;
        private readonly IRecipeRecommendationEngine _engine;
        private readonly IIngredientTaxonomyService _taxonomyService;

        public AlternativeMealDecisionService(
            AppDbContext context,
            IRecipeRepository recipeRepository,
            IRecipeRecommendationEngine engine,
            IIngredientTaxonomyService taxonomyService)
        {
            _context = context;
            _recipeRepository = recipeRepository;
            _engine = engine;
            _taxonomyService = taxonomyService;
        }

        public async Task<AlternativeMealDecision> DecideForMealAsync(
            Guid plannedRecipeId,
            MealType mealType,
            List<Guid> clientAvailableIngredients,
            Guid dietitianId,
            CancellationToken cancellationToken = default)
        {
            var allRecipes = await _recipeRepository.GetAllWithIngredientsAsync(cancellationToken);
            var plannedRecipe = allRecipes.FirstOrDefault(r => r.Id == plannedRecipeId);

            if (plannedRecipe == null)
            {
                await LogRecommendationAsync(
                    "alternative_decision", null, dietitianId, plannedRecipeId, null,
                    false, null, 0, false, false,
                    Array.Empty<Guid>(), null, null,
                    new { reason = "Planned recipe not found" }, cancellationToken);

                return AlternativeMealDecision.NeedsAlternative(
                    new List<Guid>(),
                    new List<AlternativeRecipeRecommendation>(),
                    "Planned recipe not found.");
            }

            var plannedSubstituteData = await BuildSubstitutesForRecipesAsync(
                new[] { plannedRecipe }, cancellationToken);

            var context = new RecipeEvaluationContext(
                availableIngredientIds: clientAvailableIngredients,
                prohibitedIngredientIds: new List<Guid>(),
                substitutesByRecipeAndRequired: plannedSubstituteData.SubstitutesByRecipeAndRequired,
                substituteCompatibilityByRecipeRequiredAndCandidate: plannedSubstituteData.CompatibilityByRecipeRequiredAndCandidate);

            var evaluation = _engine.EvaluateRecipe(plannedRecipe, context);

            if (evaluation.Rejected || evaluation.MissingMandatoryCount > 0 || !evaluation.Explanation.IsCookable)
            {
                var missingNames = plannedRecipe.MandatoryIngredients
                    .Where(i => evaluation.MissingMandatoryIngredientIds.Contains(i.Id))
                    .Select(i => i.CanonicalName)
                    .ToList();

                var reason = evaluation.Explanation.RejectedBecauseProhibited
                    ? "Client has prohibited ingredients for this recipe."
                    : missingNames.Count > 0
                        ? $"Missing mandatory ingredients: {string.Join(", ", missingNames)}"
                        : "Recipe is not cookable with available ingredients.";

                var alternatives = await FindAlternativesAsync(
                    plannedRecipe, mealType, clientAvailableIngredients, dietitianId, allRecipes, cancellationToken);

                await LogRecommendationAsync(
                    "alternative_decision", null, dietitianId, plannedRecipe.Id,
                    alternatives.FirstOrDefault()?.RecipeId,
                    false, null, evaluation.MissingMandatoryCount,
                    evaluation.Explanation.RejectedBecauseProhibited,
                    evaluation.Explanation.UsedSubstituteIngredientIds.Any(),
                    evaluation.MissingMandatoryIngredientIds, missingNames, null,
                    new { reason }, cancellationToken);

                return AlternativeMealDecision.NeedsAlternative(
                    evaluation.MissingMandatoryIngredientIds.ToList(),
                    alternatives,
                    reason);
            }

            var percentage = evaluation.MatchPercentage;
            if (percentage >= 80m)
            {
                await LogRecommendationAsync(
                    "alternative_decision", null, dietitianId, plannedRecipe.Id, plannedRecipe.Id,
                    true, percentage, 0, false,
                    evaluation.Explanation.UsedSubstituteIngredientIds.Any(),
                    Array.Empty<Guid>(), null, null, new { }, cancellationToken);

                return AlternativeMealDecision.CanCook(
                    $"You have {percentage:F0}% of ingredients for {plannedRecipe.Name}. You can cook this recipe!");
            }

            // Below 80% threshold — find alternatives
            var missingOptionalNames = plannedRecipe.OptionalIngredients
                .Where(i => !clientAvailableIngredients.Contains(i.Id))
                .Select(i => i.CanonicalName)
                .ToList();

            var lowMatchAlternatives = await FindAlternativesAsync(
                plannedRecipe, mealType, clientAvailableIngredients, dietitianId, allRecipes, cancellationToken);

            await LogRecommendationAsync(
                "alternative_decision", null, dietitianId, plannedRecipe.Id,
                lowMatchAlternatives.FirstOrDefault()?.RecipeId,
                false, percentage, 0, false,
                evaluation.Explanation.UsedSubstituteIngredientIds.Any(),
                Array.Empty<Guid>(), missingOptionalNames, null,
                new { lowMatch = true }, cancellationToken);

            return AlternativeMealDecision.NeedsAlternative(
                new List<Guid>(),
                lowMatchAlternatives,
                $"You only have {percentage:F0}% of ingredients. Looking for a better match.");
        }

        /// <summary>
        /// Returns up to <see cref="MaxAlternatives"/> recipe recommendations ordered by a combined score.
        ///
        /// Scoring formula per candidate:
        ///   NOTE (2026-05): weights updated to avoid suggesting side dishes (e.g., potato salad)
        ///   as alternatives for protein-centric meals when the pantry lacks the main protein.
        ///   ingredientCoverage (30%) - weighted mandatory coverage (condiments downweighted)
        ///   nutritionalProximity (50%) - macro/calorie closeness to the original recipe
        ///   proteinAlignment (15%) - protein source + amount similarity
        ///   cookability (5%) - smooth penalty by missing mandatory count
        ///   ingredientCoverage (40%) — fraction of mandatory ingredients the client already has
        ///   nutritionalProximity (45%) — macro/calorie closeness to the original recipe
        ///   cookabilityBonus  (15%) — flat bonus when ALL mandatory ingredients are present (via CombinedScore ctor)
        ///
        /// Pool: all dietitian recipes that are not archived/draft, excluding the original,
        ///       with at most <see cref="MaxMissingForAlternative"/> missing mandatory ingredients.
        ///       This ensures partial-match recipes appear when no fully-cookable alternatives exist
        ///       and prevents the same top-5 list from appearing for every planned meal.
        /// </summary>
        private async Task<List<AlternativeRecipeRecommendation>> FindAlternativesAsync(
            Recipe originalRecipe,
            MealType mealType,
            List<Guid> clientAvailableIngredients,
            Guid dietitianId,
            IReadOnlyList<Recipe> allRecipes,
            CancellationToken cancellationToken)
        {
            // Filter candidate pool: same dietitian, not the original, not archived/draft
            var candidates = allRecipes
                .Where(r => r.DietitianId == dietitianId
                         && r.Id != originalRecipe.Id
                         && !r.IsArchived
                         && !r.IsDraft)
                .ToList();

            if (candidates.Count == 0)
                return new List<AlternativeRecipeRecommendation>();

            var altSubstituteData = await BuildSubstitutesForRecipesAsync(candidates, cancellationToken);
            var context = new RecipeEvaluationContext(
                availableIngredientIds: clientAvailableIngredients,
                prohibitedIngredientIds: new List<Guid>(),
                substitutesByRecipeAndRequired: altSubstituteData.SubstitutesByRecipeAndRequired,
                substituteCompatibilityByRecipeRequiredAndCandidate: altSubstituteData.CompatibilityByRecipeRequiredAndCandidate);

            // Evaluate each candidate directly (bypasses the <=1 missing filter in RankRecipes)
            // so partially-cookable recipes can still appear when fully-cookable ones are scarce.
            var evaluated = candidates
                .Select(c => _engine.EvaluateRecipe(c, context))
                .Where(e => !e.Rejected)
                .ToList();

            if (evaluated.Count == 0)
                return new List<AlternativeRecipeRecommendation>();

            var preferredPool = evaluated
                .Where(e => e.MissingMandatoryCount <= MaxMissingForAlternative)
                .ToList();

            var recommendationPool = preferredPool.Count > 0 ? preferredPool : evaluated;

            var recommendations = recommendationPool
                .Select(eval =>
                {
                    var recipe = eval.Recipe;
                    var missingMandatoryIds = eval.MissingMandatoryIngredientIds.ToHashSet();

                    // Ingredient coverage: weighted mandatory coverage.
                    // Condiments are downweighted so "salt + spices" does not dominate the score.
                    decimal totalWeight = 0m;
                    decimal coveredWeight = 0m;
                    foreach (var ingredient in recipe.MandatoryIngredients)
                    {
                        var weight = ingredient.IsCondiment ? 0.15m : 1.0m;
                        totalWeight += weight;
                        if (!missingMandatoryIds.Contains(ingredient.Id))
                            coveredWeight += weight;
                    }

                    var ingredientCoverageScore = totalWeight > 0m
                        ? Math.Round(coveredWeight / totalWeight * 100m, 1)
                        : 0m;

                    var nutritionalScore = ComputeNutritionalScore(recipe, originalRecipe);
                    var proteinScore = ComputeProteinAlignmentScore(recipe, originalRecipe);
                    var comparison = BuildNutritionalComparison(recipe, originalRecipe);
                    var missingIngredientNames = recipe.MandatoryIngredients
                        .Where(i => eval.MissingMandatoryIngredientIds.Contains(i.Id))
                        .Select(i => i.CanonicalName)
                        .ToList();
                    var recommendationReasons = BuildRecommendationReasons(
                        recipe,
                        originalRecipe,
                        ingredientCoverageScore,
                        nutritionalScore,
                        proteinScore,
                        missingIngredientNames);
                    var planAlignmentNote = BuildPlanAlignmentNote(
                        ingredientCoverageScore,
                        nutritionalScore,
                        proteinScore,
                        eval.MissingMandatoryCount);

                    return new AlternativeRecipeRecommendation(
                        recipeId: recipe.Id,
                        recipeName: recipe.Name,
                        matchPercentage: ingredientCoverageScore,
                        missingIngredientsForAlternative: eval.MissingMandatoryIngredientIds.ToList(),
                        missingIngredientNamesForAlternative: missingIngredientNames,
                        nutritionalComparison: comparison,
                        recommendationReasons: recommendationReasons,
                        planAlignmentNote: planAlignmentNote,
                        caloriesKcal: recipe.CaloriesKcal,
                        proteinGrams: recipe.ProteinGrams,
                        carbsGrams: recipe.CarbsGrams,
                        fatGrams: recipe.FatGrams,
                        nutritionalScore: nutritionalScore,
                        proteinScore: proteinScore);
                })
                .ToList();

            // Primary ordering: combined score (already includes a smooth cookability penalty).
            recommendations = recommendations
                .OrderByDescending(r => r.CombinedScore)
                .ThenByDescending(r => r.NutritionalScore)
                .ThenByDescending(r => r.MatchPercentage)
                .ToList();

            // UX rule:
            // - If we have a strong "cookable now" option, show exactly one pantry-feasible recipe first.
            // - Fill the remaining slots primarily with near-miss recipes (missing 1-3 mandatory items),
            //   so the user also sees "close" alternatives that may require small shopping.
            var bestOverall = recommendations.FirstOrDefault();
            var bestCookable = recommendations.FirstOrDefault(r => r.MissingIngredientsForAlternative.Count == 0);

            var shouldLeadWithCookable = bestOverall != null && bestCookable != null &&
                                         (bestCookable.CombinedScore >= 55m ||
                                          bestCookable.CombinedScore >= bestOverall.CombinedScore - 7m);

            if (shouldLeadWithCookable && bestCookable != null)
            {
                var remaining = recommendations
                    .Where(r => r.RecipeId != bestCookable.RecipeId)
                    .ToList();

                var nonCookablesFirst = remaining
                    .Where(r => r.MissingIngredientsForAlternative.Count > 0)
                    .Concat(remaining.Where(r => r.MissingIngredientsForAlternative.Count == 0))
                    .Take(MaxAlternatives - 1)
                    .ToList();

                return new[] { bestCookable }
                    .Concat(nonCookablesFirst)
                    .ToList();
            }

            return recommendations.Take(MaxAlternatives).ToList();
        }

        private static List<string> BuildRecommendationReasons(
            Recipe candidate,
            Recipe target,
            decimal matchPercentage,
            decimal nutritionalScore,
            decimal proteinScore,
            IReadOnlyCollection<string> missingIngredientNames)
        {
            var reasons = new List<string>();

            if (nutritionalScore >= 85m)
            {
                reasons.Add("Besin dengesi planlanan ogune cok yakin.");
            }
            else if (nutritionalScore >= 70m)
            {
                reasons.Add("Besin dengesi planlanan ogune yakin kalir.");
            }

            if (HasStrongProteinMatch(candidate, target))
            {
                reasons.Add("Protein dengesi iyi korunur.");
            }
            else if (proteinScore >= 75m)
            {
                reasons.Add("Protein odagi planla uyumludur.");
            }

            if (missingIngredientNames.Count == 0)
            {
                reasons.Add("Ek zorunlu malzeme gerektirmez.");
            }
            else if (missingIngredientNames.Count == 1)
            {
                reasons.Add($"Sadece {missingIngredientNames.First()} eklenirse hazirlanabilir.");
            }

            if (matchPercentage >= 85m)
            {
                reasons.Add("Elinizdeki malzemelerin buyuk coguyla hazirlanabilir.");
            }
            else if (matchPercentage >= 70m)
            {
                reasons.Add("Mutfaktaki malzemelerle buyuk olcude uyumludur.");
            }

            if (reasons.Count == 0)
            {
                reasons.Add("Planlanan ogune gore kontrollu bir esneklik sunar.");
            }

            return reasons
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(3)
                .ToList();
        }

        private static bool HasStrongProteinMatch(Recipe candidate, Recipe target)
        {
            if (!candidate.ProteinGrams.HasValue || !target.ProteinGrams.HasValue || target.ProteinGrams.Value <= 0)
                return false;

            var diffRatio = Math.Abs(candidate.ProteinGrams.Value - target.ProteinGrams.Value) / target.ProteinGrams.Value;
            return diffRatio <= 0.15m;
        }

        private enum ProteinGroup
        {
            Unknown = 0,
            RedMeat,
            Poultry,
            FishSeafood,
            Legume,
            Egg,
            Dairy,
        }

        private static decimal ComputeProteinAlignmentScore(Recipe candidate, Recipe target)
        {
            // Group similarity (source) + amount proximity (grams).
            var groupScore = ComputeProteinGroupSimilarityScore(candidate, target);
            var amountScore = ComputeProteinAmountSimilarityScore(candidate, target);
            return Math.Round(groupScore * 0.60m + amountScore * 0.40m, 1);
        }

        private static decimal ComputeProteinAmountSimilarityScore(Recipe candidate, Recipe target)
        {
            if (!candidate.ProteinGrams.HasValue || !target.ProteinGrams.HasValue || target.ProteinGrams.Value <= 0m)
                return 50m; // neutral when missing data

            var diffRatio = Math.Abs(candidate.ProteinGrams.Value - target.ProteinGrams.Value) / target.ProteinGrams.Value;
            const decimal tolerance = 0.60m; // allow wider band than "strong match" (15%)
            var score = Math.Max(0m, 1m - diffRatio / tolerance) * 100m;
            return Math.Round(score, 1);
        }

        private static decimal ComputeProteinGroupSimilarityScore(Recipe candidate, Recipe target)
        {
            var targetGroup = GetDominantProteinGroup(target);
            var candidateGroup = GetDominantProteinGroup(candidate);

            if (targetGroup == ProteinGroup.Unknown && candidateGroup == ProteinGroup.Unknown)
                return 50m;

            if (targetGroup == ProteinGroup.Unknown || candidateGroup == ProteinGroup.Unknown)
                return 45m;

            if (targetGroup == candidateGroup)
                return 100m;

            var targetIsAnimal = IsAnimalProtein(targetGroup);
            var candidateIsAnimal = IsAnimalProtein(candidateGroup);

            if (targetIsAnimal && candidateIsAnimal)
                return 80m; // red meat vs poultry vs fish

            if ((targetGroup == ProteinGroup.Egg && candidateGroup == ProteinGroup.Dairy) ||
                (targetGroup == ProteinGroup.Dairy && candidateGroup == ProteinGroup.Egg))
                return 80m;

            if ((targetIsAnimal && candidateGroup == ProteinGroup.Legume) ||
                (candidateIsAnimal && targetGroup == ProteinGroup.Legume))
                return 65m;

            return 60m;
        }

        private static bool IsAnimalProtein(ProteinGroup group)
            => group is ProteinGroup.RedMeat or ProteinGroup.Poultry or ProteinGroup.FishSeafood;

        private static ProteinGroup GetDominantProteinGroup(Recipe recipe)
        {
            // Prefer mandatory non-condiment ingredients as the "core" definition of the dish.
            foreach (var ingredient in recipe.MandatoryIngredients)
            {
                if (ingredient.IsCondiment) continue;
                var group = ClassifyProteinGroup(ingredient.CanonicalName);
                if (group != ProteinGroup.Unknown)
                    return group;
            }

            // Fallback: look at the recipe name if ingredients did not reveal a protein group.
            return ClassifyProteinGroup(recipe.Name);
        }

        private static ProteinGroup ClassifyProteinGroup(string? text)
        {
            var s = NormalizeTr(text);
            if (string.IsNullOrWhiteSpace(s))
                return ProteinGroup.Unknown;

            // Poultry
            if (s.Contains("tavuk") || s.Contains("hindi"))
                return ProteinGroup.Poultry;

            // Red meat
            if (s.Contains("dana") || s.Contains("kuzu") || s.Contains("kiyma") || s.Contains("bonfile") ||
                s.Contains("kofte") || s.Contains("et ") || s.EndsWith(" et"))
                return ProteinGroup.RedMeat;

            // Fish/seafood
            if (s.Contains("balik") || s.Contains("somon") || s.Contains("ton") || s.Contains("hamsi") ||
                s.Contains("levrek") || s.Contains("palamut") || s.Contains("karides") || s.Contains("midye"))
                return ProteinGroup.FishSeafood;

            // Legumes / plant protein
            if (s.Contains("mercimek") || s.Contains("nohut") || s.Contains("fasulye") || s.Contains("barbunya") ||
                s.Contains("bakla") || s.Contains("bezelye") || s.Contains("soya") || s.Contains("tofu"))
                return ProteinGroup.Legume;

            // Egg
            if (s.Contains("yumurta"))
                return ProteinGroup.Egg;

            // Dairy
            if (s.Contains("yogurt") || s.Contains("suzme yogurt") || s.Contains("sut") || s.Contains("peynir") ||
                s.Contains("lor") || s.Contains("kefir") || s.Contains("ayran") || s.Contains("labne"))
                return ProteinGroup.Dairy;

            return ProteinGroup.Unknown;
        }

        private static string NormalizeTr(string? input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            return input
                .Trim()
                .ToLowerInvariant()
                .Replace('ç', 'c')
                .Replace('ğ', 'g')
                .Replace('ı', 'i')
                .Replace('ö', 'o')
                .Replace('ş', 's')
                .Replace('ü', 'u');
        }

        private static string BuildPlanAlignmentNote(decimal matchPercentage, decimal nutritionalScore, decimal proteinScore, int missingMandatoryCount)
        {
            // Mirror the combined score formula used by AlternativeRecipeRecommendation.
            var cookabilityScore = Math.Max(0m, 100m - missingMandatoryCount * 25m);
            var combinedScore =
                matchPercentage * 0.30m +
                nutritionalScore * 0.50m +
                proteinScore * 0.15m +
                cookabilityScore * 0.05m;

            if (nutritionalScore >= 85m && matchPercentage >= 80m)
                return "Plan uyumunu yuksek duzeyde korur.";

            if (combinedScore >= 75m)
                return "Plan akisina yakin kalir.";

            if (nutritionalScore >= 65m)
                return "Esnek bir tercih olarak dengeli kalir.";

            return "Esnek bir secenektir; kucuk bir sapma yaratabilir.";
        }

        /// <summary>
        /// Computes how nutritionally similar <paramref name="candidate"/> is to <paramref name="target"/>.
        /// Returns 0–100 where 100 = perfect match on all tracked macros.
        /// </summary>
        private static decimal ComputeNutritionalScore(Recipe candidate, Recipe target)
        {
            bool targetHasData = target.CaloriesKcal.HasValue || target.ProteinGrams.HasValue
                              || target.CarbsGrams.HasValue  || target.FatGrams.HasValue;

            bool candidateHasData = candidate.CaloriesKcal.HasValue || candidate.ProteinGrams.HasValue
                                 || candidate.CarbsGrams.HasValue  || candidate.FatGrams.HasValue;

            if (!targetHasData) return 50m; // neutral — cannot evaluate
            if (!candidateHasData) return 0m;

            decimal score = 0m;
            decimal totalWeight = 0m;

            void AddMacro(decimal? cVal, decimal? tVal, decimal tolerance, decimal weight)
            {
                if (!tVal.HasValue || tVal.Value <= 0 || !cVal.HasValue) return;
                var diff = Math.Abs(cVal.Value - tVal.Value) / tVal.Value;
                score += Math.Max(0m, 1m - diff / tolerance) * weight;
                totalWeight += weight;
            }

            AddMacro(candidate.ProteinGrams, target.ProteinGrams, ProteinTolerance, ProteinWeight);
            AddMacro(candidate.CaloriesKcal.HasValue ? (decimal)candidate.CaloriesKcal.Value : (decimal?)null,
                     target.CaloriesKcal.HasValue    ? (decimal)target.CaloriesKcal.Value    : (decimal?)null,
                     CalorieTolerance, CalorieWeight);
            AddMacro(candidate.FatGrams, target.FatGrams, FatTolerance, FatWeight);
            AddMacro(candidate.CarbsGrams, target.CarbsGrams, CarbsTolerance, CarbsWeight);

            return totalWeight == 0m ? 0m : Math.Round(score / totalWeight * 100m, 1);
        }

        /// <summary>
        /// Builds a human-readable nutritional delta string, e.g. "+3g Protein · −40 kcal".
        /// </summary>
        private static string BuildNutritionalComparison(Recipe candidate, Recipe target)
        {
            var parts = new List<string>();

            void AddDelta(decimal? cVal, decimal? tVal, string unit, bool roundToInt = false)
            {
                if (!cVal.HasValue || !tVal.HasValue) return;
                var diff = cVal.Value - tVal.Value;
                if (Math.Abs(diff) < 1m) return;
                var sign = diff > 0 ? "+" : "";
                var formatted = roundToInt ? $"{sign}{(int)Math.Round(diff)}" : $"{sign}{diff:F0}";
                parts.Add($"{formatted}{unit}");
            }

            AddDelta(candidate.ProteinGrams, target.ProteinGrams, "g Protein");
            AddDelta(candidate.CaloriesKcal.HasValue ? (decimal)candidate.CaloriesKcal.Value : (decimal?)null,
                     target.CaloriesKcal.HasValue    ? (decimal)target.CaloriesKcal.Value    : (decimal?)null,
                     " kcal", roundToInt: true);
            AddDelta(candidate.FatGrams, target.FatGrams, "g Yağ");
            AddDelta(candidate.CarbsGrams, target.CarbsGrams, "g Karbonhidrat");

            return string.Join(" · ", parts);
        }

        private async Task<SubstituteResolutionData> BuildSubstitutesForRecipesAsync(
            IEnumerable<Recipe> recipes,
            CancellationToken cancellationToken)
        {
            var result = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>();
            var compatibility = new Dictionary<(Guid, Guid, Guid), CompatibilityType>();

            foreach (var recipe in recipes)
            {
                foreach (var mandatory in recipe.MandatoryIngredients)
                {
                    var key = (recipe.Id, mandatory.Id);
                    if (result.ContainsKey(key)) continue;

                    var candidates = await _taxonomyService.GetCompatibleCandidatesAsync(
                        mandatory.Id,
                        minimumCompatibility: CompatibilityType.SubstituteAllowed,
                        cancellationToken);

                    if (candidates.Count > 0)
                    {
                        result[key] = new HashSet<Guid>(candidates.Select(c => c.Id));
                        foreach (var candidate in candidates)
                        {
                            var compatibilityType = await _taxonomyService.GetCompatibilityAsync(
                                mandatory.Id, candidate.Id, cancellationToken);
                            compatibility[(recipe.Id, mandatory.Id, candidate.Id)] = compatibilityType;
                        }
                    }
                }
            }

            return new SubstituteResolutionData(result, compatibility);
        }

        private sealed record SubstituteResolutionData(
            IReadOnlyDictionary<(Guid RecipeId, Guid RequiredIngredientId), IReadOnlySet<Guid>> SubstitutesByRecipeAndRequired,
            IReadOnlyDictionary<(Guid RecipeId, Guid RequiredIngredientId, Guid CandidateIngredientId), CompatibilityType> CompatibilityByRecipeRequiredAndCandidate);

        private async Task LogRecommendationAsync(
            string flow, Guid? clientId, Guid? dietitianId,
            Guid? plannedRecipeId, Guid? selectedRecipeId,
            bool originalCookable, decimal? matchPercentage,
            int missingMandatoryCount, bool prohibitedRejected,
            bool usedSubstitutes, IReadOnlyCollection<Guid> missingMandatoryIds,
            IReadOnlyCollection<string>? missingMandatoryNames,
            IReadOnlyCollection<(string Required, string Substitute)>? substituteUsages,
            object? additionalMeta, CancellationToken cancellationToken)
        {
            try
            {
                var missingIdsJson = missingMandatoryIds?.Count > 0
                    ? System.Text.Json.JsonSerializer.Serialize(missingMandatoryIds) : null;
                var missingNamesJson = missingMandatoryNames?.Count > 0
                    ? System.Text.Json.JsonSerializer.Serialize(missingMandatoryNames) : null;
                var substituteJson = substituteUsages?.Count > 0
                    ? System.Text.Json.JsonSerializer.Serialize(
                        substituteUsages.Select(s => new { required = s.Required, substitute = s.Substitute })) : null;

                string? rejectionReason = null;
                if (!originalCookable)
                {
                    if (prohibitedRejected) rejectionReason = "Prohibited ingredient conflict.";
                    else if (missingMandatoryNames?.Count > 0)
                        rejectionReason = $"Missing: {string.Join(", ", missingMandatoryNames)}";
                    else rejectionReason = "Recipe not cookable with available ingredients.";
                }

                var log = new RecipeRecommendationLog(
                    id: Guid.NewGuid(), flow: flow,
                    clientId: clientId, dietitianId: dietitianId,
                    plannedRecipeId: plannedRecipeId, selectedRecipeId: selectedRecipeId,
                    originalCookable: originalCookable, matchPercentage: matchPercentage,
                    missingMandatoryCount: missingMandatoryCount,
                    prohibitedRejected: prohibitedRejected, usedSubstitutes: usedSubstitutes,
                    missingMandatoryIdsJson: missingIdsJson,
                    rejectionReasonSummary: rejectionReason,
                    missingMandatoryNamesJson: missingNamesJson,
                    substituteUsageSummaryJson: substituteJson,
                    additionalMetaJson: additionalMeta != null
                        ? System.Text.Json.JsonSerializer.Serialize(additionalMeta) : null,
                    correlationId: null);

                _context.RecipeRecommendationLogs.Add(log);
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch
            {
                // Logging must not break the core decision flow
            }
        }
    }
}
