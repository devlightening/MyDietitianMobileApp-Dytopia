using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Production benchmark/evaluation runner for thesis-grade metrics.
/// 
/// Executes controlled test cases against the current deterministic normalization
/// and recommendation logic, producing reproducible metrics for analysis.
/// </summary>
public class BenchmarkRunner : IBenchmarkRunner
{
    private readonly AppDbContext _db;
    private readonly IIngredientNormalizationService _normalizationService;
    private readonly IRecipeRecommendationEngine _recommendationEngine;
    private readonly IAlternativeMealDecisionService _alternativeDecisionService;

    public BenchmarkRunner(
        AppDbContext db,
        IIngredientNormalizationService normalizationService,
        IRecipeRecommendationEngine recommendationEngine,
        IAlternativeMealDecisionService alternativeDecisionService)
    {
        _db = db;
        _normalizationService = normalizationService;
        _recommendationEngine = recommendationEngine;
        _alternativeDecisionService = alternativeDecisionService;
    }

    // ============================================================================
    // INGREDIENT NORMALIZATION BENCHMARK
    // ============================================================================

    public async Task<IngredientNormalizationBenchmarkResult> RunNormalizationBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default)
    {
        var json = await File.ReadAllTextAsync(datasetFilePath, cancellationToken);
        var dataset = JsonSerializer.Deserialize<IngredientNormalizationBenchmarkDataset>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (dataset == null)
            throw new InvalidOperationException($"Failed to deserialize normalization dataset from {datasetFilePath}");

        return await RunNormalizationBenchmarkAsync(dataset, cancellationToken);
    }

    public async Task<IngredientNormalizationBenchmarkResult> RunNormalizationBenchmarkAsync(
        IngredientNormalizationBenchmarkDataset dataset,
        CancellationToken cancellationToken = default)
    {
        var caseResults = new List<IngredientNormalizationBenchmarkCaseResult>();

        foreach (var testCase in dataset.Cases)
        {
            var actual = await _normalizationService.NormalizeAsync(testCase.RawInput, cancellationToken);

            var expectedMatchType = testCase.ExpectedMatchType.ToLowerInvariant();
            var actualMatchType = actual.Status switch
            {
                IngredientMatchStatus.Matched when actual.MatchedBy == IngredientMatchedBy.Canonical => "canonical",
                IngredientMatchStatus.Matched when actual.MatchedBy == IngredientMatchedBy.Alias => "alias",
                IngredientMatchStatus.Matched when actual.MatchedBy == IngredientMatchedBy.Fuzzy => "fuzzy",
                IngredientMatchStatus.Matched when actual.MatchedBy == IngredientMatchedBy.Llm => "llm",
                IngredientMatchStatus.Matched => "matched",
                IngredientMatchStatus.Unmatched => "unmatched",
                IngredientMatchStatus.Ambiguous => "ambiguous",
                _ => "unknown"
            };

            var expectedCanonical = testCase.ExpectedCanonicalName;
            var actualCanonical = actual.MatchedCanonicalName;

            bool isCorrect = false;
            string? failureReason = null;

            if (expectedMatchType == "unmatched")
            {
                isCorrect = actual.Status == IngredientMatchStatus.Unmatched;
                if (!isCorrect)
                    failureReason = $"Expected unmatched, got {actualMatchType}";
            }
            else if (expectedMatchType == "ambiguous")
            {
                isCorrect = actual.Status == IngredientMatchStatus.Ambiguous;
                if (!isCorrect)
                    failureReason = $"Expected ambiguous, got {actualMatchType}";
            }
            else if (expectedMatchType == "canonical" || expectedMatchType == "alias"
                     || expectedMatchType == "fuzzy" || expectedMatchType == "llm")
            {
                if (actual.Status != IngredientMatchStatus.Matched)
                {
                    isCorrect = false;
                    failureReason = $"Expected matched ({expectedMatchType}), got {actualMatchType}";
                }
                else if (expectedMatchType == "canonical" && actual.MatchedBy != IngredientMatchedBy.Canonical)
                {
                    isCorrect = false;
                    failureReason = $"Expected canonical match, got {actualMatchType} match";
                }
                else if (expectedMatchType == "alias" && actual.MatchedBy != IngredientMatchedBy.Alias)
                {
                    isCorrect = false;
                    failureReason = $"Expected alias match, got {actualMatchType} match";
                }
                else if ((expectedMatchType == "fuzzy" || expectedMatchType == "llm")
                         && actual.MatchedBy != IngredientMatchedBy.Fuzzy
                         && actual.MatchedBy != IngredientMatchedBy.Llm)
                {
                    // For fuzzy/llm benchmark cases, accept canonical or alias matches too (they are better)
                    if (actual.Status == IngredientMatchStatus.Matched &&
                        !string.IsNullOrEmpty(expectedCanonical) &&
                        actualCanonical == expectedCanonical)
                    {
                        isCorrect = true; // Got a better (deterministic) match for the same ingredient
                    }
                    else
                    {
                        isCorrect = false;
                        failureReason = $"Expected {expectedMatchType}/matched ({expectedCanonical}), got {actualMatchType} to '{actualCanonical}'";
                    }
                }
                else if (!string.IsNullOrEmpty(expectedCanonical) && actualCanonical != expectedCanonical)
                {
                    isCorrect = false;
                    failureReason = $"Expected canonical name '{expectedCanonical}', got '{actualCanonical}'";
                }
                else
                {
                    isCorrect = true;
                }
            }
            else
            {
                failureReason = $"Unknown expected match type: {expectedMatchType}";
            }

            caseResults.Add(new IngredientNormalizationBenchmarkCaseResult
            {
                CaseId = testCase.Id,
                RawInput = testCase.RawInput,
                IsCorrect = isCorrect,
                ExpectedCanonicalName = expectedCanonical,
                ActualCanonicalName = actualCanonical,
                ExpectedMatchType = expectedMatchType,
                ActualMatchType = actualMatchType,
                FailureReason = failureReason,
                Confidence = actual.Confidence,
                Difficulty = testCase.Difficulty
            });
        }

        var summary = ComputeNormalizationSummary(caseResults, dataset.Cases);

        return new IngredientNormalizationBenchmarkResult
        {
            DatasetName = dataset.Name,
            DatasetVersion = dataset.Version,
            Summary = summary,
            CaseResults = caseResults,
            ExecutedAtUtc = DateTime.UtcNow
        };
    }

    private static IngredientNormalizationBenchmarkSummary ComputeNormalizationSummary(
        IReadOnlyList<IngredientNormalizationBenchmarkCaseResult> caseResults,
        IReadOnlyList<IngredientNormalizationBenchmarkCase> cases)
    {
        var total = caseResults.Count;
        var correct = caseResults.Count(r => r.IsCorrect);
        var incorrect = total - correct;
        var unmatched = caseResults.Count(r => r.ActualMatchType == "unmatched");
        var ambiguous = caseResults.Count(r => r.ActualMatchType == "ambiguous");
        var canonical = caseResults.Count(r => r.ActualMatchType == "canonical");
        var alias = caseResults.Count(r => r.ActualMatchType == "alias");
        var fuzzy = caseResults.Count(r => r.ActualMatchType == "fuzzy");
        var fuzzyCorrect = caseResults.Count(r => r.ActualMatchType == "fuzzy" && r.IsCorrect);
        var llm = caseResults.Count(r => r.ActualMatchType == "llm");
        var llmCorrect = caseResults.Count(r => r.ActualMatchType == "llm" && r.IsCorrect);
        var accuracy = total > 0 ? (double)correct / total : 0.0;

        var perDifficulty = cases
            .Where(c => !string.IsNullOrEmpty(c.Difficulty))
            .GroupBy(c => c.Difficulty!)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var difficultyCases = g.Select(c => c.Id).ToHashSet();
                    var difficultyResults = caseResults.Where(r => difficultyCases.Contains(r.CaseId)).ToList();

                    var diffTotal = difficultyResults.Count;
                    var diffCorrect = difficultyResults.Count(r => r.IsCorrect);
                    var diffIncorrect = diffTotal - diffCorrect;
                    var diffUnmatched = difficultyResults.Count(r => r.ActualMatchType == "unmatched");
                    var diffAmbiguous = difficultyResults.Count(r => r.ActualMatchType == "ambiguous");
                    var diffCanonical = difficultyResults.Count(r => r.ActualMatchType == "canonical");
                    var diffAlias = difficultyResults.Count(r => r.ActualMatchType == "alias");
                    var diffFuzzy = difficultyResults.Count(r => r.ActualMatchType == "fuzzy");
                    var diffFuzzyCorrect = difficultyResults.Count(r => r.ActualMatchType == "fuzzy" && r.IsCorrect);
                    var diffLlm = difficultyResults.Count(r => r.ActualMatchType == "llm");
                    var diffLlmCorrect = difficultyResults.Count(r => r.ActualMatchType == "llm" && r.IsCorrect);
                    var diffAccuracy = diffTotal > 0 ? (double)diffCorrect / diffTotal : 0.0;

                    return new IngredientNormalizationBenchmarkSummary
                    {
                        TotalCases = diffTotal,
                        CorrectMatches = diffCorrect,
                        IncorrectMatches = diffIncorrect,
                        UnmatchedCount = diffUnmatched,
                        AmbiguousCount = diffAmbiguous,
                        Accuracy = diffAccuracy,
                        CanonicalMatchCount = diffCanonical,
                        AliasMatchCount = diffAlias,
                        FuzzyMatchCount = diffFuzzy,
                        FuzzyCorrectCount = diffFuzzyCorrect,
                        LlmMatchCount = diffLlm,
                        LlmCorrectCount = diffLlmCorrect,
                        PerDifficultyBreakdown = null
                    };
                });

        return new IngredientNormalizationBenchmarkSummary
        {
            TotalCases = total,
            CorrectMatches = correct,
            IncorrectMatches = incorrect,
            UnmatchedCount = unmatched,
            AmbiguousCount = ambiguous,
            Accuracy = accuracy,
            CanonicalMatchCount = canonical,
            AliasMatchCount = alias,
            FuzzyMatchCount = fuzzy,
            FuzzyCorrectCount = fuzzyCorrect,
            LlmMatchCount = llm,
            LlmCorrectCount = llmCorrect,
            PerDifficultyBreakdown = perDifficulty.Any() ? perDifficulty : null
        };
    }

    // ============================================================================
    // RECIPE RECOMMENDATION BENCHMARK
    // ============================================================================

    public async Task<RecipeRecommendationBenchmarkResult> RunRecommendationBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default)
    {
        var json = await File.ReadAllTextAsync(datasetFilePath, cancellationToken);
        var dataset = JsonSerializer.Deserialize<RecipeRecommendationBenchmarkDataset>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (dataset == null)
            throw new InvalidOperationException($"Failed to deserialize recommendation dataset from {datasetFilePath}");

        return await RunRecommendationBenchmarkAsync(dataset, cancellationToken);
    }

    public async Task<RecipeRecommendationBenchmarkResult> RunRecommendationBenchmarkAsync(
        RecipeRecommendationBenchmarkDataset dataset,
        CancellationToken cancellationToken = default)
    {
        // Pre-load ingredient name -> ID mapping
        var ingredientNameToId = await _db.Ingredients
            .AsNoTracking()
            .Where(i => i.IsActive)
            .ToDictionaryAsync(
                i => i.CanonicalName,
                i => i.Id,
                StringComparer.OrdinalIgnoreCase,
                cancellationToken);

        // Pre-load recipe identifier -> Recipe mapping
        // Support both GUID strings and recipe names as identifiers
        var allRecipes = await _db.Recipes
            .AsNoTracking()
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .ToListAsync(cancellationToken);

        var recipeById = allRecipes.ToDictionary(r => r.Id.ToString(), r => r);
        var recipeByName = allRecipes.ToDictionary(r => r.Name, r => r, StringComparer.OrdinalIgnoreCase);

        var caseResults = new List<RecipeRecommendationBenchmarkCaseResult>();

        foreach (var testCase in dataset.Cases)
        {
            // Resolve planned recipe
            Recipe? plannedRecipe = null;
            if (Guid.TryParse(testCase.PlannedRecipeId, out var plannedGuid))
            {
                recipeById.TryGetValue(testCase.PlannedRecipeId, out plannedRecipe);
            }
            else
            {
                recipeByName.TryGetValue(testCase.PlannedRecipeId, out plannedRecipe);
            }

            if (plannedRecipe == null)
            {
                caseResults.Add(new RecipeRecommendationBenchmarkCaseResult
                {
                    CaseId = testCase.Id,
                    Description = testCase.Description,
                    IsCorrect = false,
                    FailureReason = $"Planned recipe '{testCase.PlannedRecipeId}' not found",
                    ExpectedOriginalCookable = testCase.ExpectedOriginalCookable,
                    ActualOriginalCookable = false
                });
                continue;
            }

            // Resolve available ingredient IDs
            var availableIngredientIds = testCase.AvailableCanonicalIngredients
                .Where(name => ingredientNameToId.ContainsKey(name))
                .Select(name => ingredientNameToId[name])
                .ToList();

            // Note: AlternativeMealDecisionService currently doesn't accept prohibited ingredients
            // as a separate parameter. The benchmark will test the current service behavior.
            // For full prohibited ingredient testing, the recommendation engine would need to be
            // called directly with a proper RecipeEvaluationContext.

            // Execute alternative decision flow
            var decision = await _alternativeDecisionService.DecideForMealAsync(
                plannedRecipeId: plannedRecipe.Id,
                mealType: MealType.Breakfast, // Default for benchmark; could be parameterized
                clientAvailableIngredients: availableIngredientIds,
                dietitianId: plannedRecipe.DietitianId ?? Guid.Empty,
                cancellationToken);

            // Compare actual vs expected
            var originalCookableCorrect = decision.CanCookOriginal == testCase.ExpectedOriginalCookable;
            var actualSelectedRecipeId = decision.AlternativeRecommendation?.RecipeId.ToString();
            var expectedSelectedRecipeId = testCase.ExpectedSelectedRecipeId;

            bool selectedRecipeCorrect = false;
            bool noSolutionCorrect = false;
            string? failureReason = null;
            string? actualReasonCategory = null;

            if (decision.CanCookOriginal)
            {
                actualReasonCategory = "full_match";
                if (testCase.ExpectedOriginalCookable)
                {
                    selectedRecipeCorrect = true; // Original cookable is the "selected" recipe
                    noSolutionCorrect = true; // Not a "no solution" case
                }
                else
                {
                    failureReason = "Expected original not cookable, but it was cookable";
                }
            }
            else
            {
                if (decision.AlternativeRecommendation != null)
                {
                    actualReasonCategory = "alternative_found";
                    var acceptableIds = testCase.AcceptableAlternativeRecipeIds
                        .Select(id => Guid.TryParse(id, out var g) ? g.ToString() : id)
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    if (string.IsNullOrEmpty(expectedSelectedRecipeId))
                    {
                        // Expected no solution, but got alternative
                        failureReason = "Expected no solution, but alternative was recommended";
                        noSolutionCorrect = false;
                    }
                    else if (actualSelectedRecipeId == expectedSelectedRecipeId ||
                             acceptableIds.Contains(actualSelectedRecipeId ?? ""))
                    {
                        selectedRecipeCorrect = true;
                        noSolutionCorrect = true;
                    }
                    else
                    {
                        failureReason = $"Expected recipe '{expectedSelectedRecipeId}' or acceptable alternative, got '{actualSelectedRecipeId}'";
                    }
                }
                else
                {
                    actualReasonCategory = "no_solution";
                    if (string.IsNullOrEmpty(expectedSelectedRecipeId))
                    {
                        noSolutionCorrect = true;
                        selectedRecipeCorrect = true; // No solution is correct
                    }
                    else
                    {
                        failureReason = $"Expected solution '{expectedSelectedRecipeId}', but no alternative was found";
                    }
                }
            }

            var isCorrect = originalCookableCorrect && selectedRecipeCorrect && noSolutionCorrect;

            caseResults.Add(new RecipeRecommendationBenchmarkCaseResult
            {
                CaseId = testCase.Id,
                Description = testCase.Description,
                OriginalCookableCorrect = originalCookableCorrect,
                SelectedRecipeCorrect = selectedRecipeCorrect,
                NoSolutionCorrect = noSolutionCorrect,
                IsCorrect = isCorrect,
                ExpectedOriginalCookable = testCase.ExpectedOriginalCookable,
                ActualOriginalCookable = decision.CanCookOriginal,
                ExpectedSelectedRecipeId = expectedSelectedRecipeId,
                ActualSelectedRecipeId = actualSelectedRecipeId,
                MatchPercentage = decision.AlternativeRecommendation?.MatchPercentage,
                FailureReason = failureReason,
                ExpectedReasonCategory = testCase.ExpectedReasonCategory,
                ActualReasonCategory = actualReasonCategory
            });
        }

        var summary = ComputeRecommendationSummary(caseResults);

        return new RecipeRecommendationBenchmarkResult
        {
            DatasetName = dataset.Name,
            DatasetVersion = dataset.Version,
            Summary = summary,
            CaseResults = caseResults,
            ExecutedAtUtc = DateTime.UtcNow
        };
    }

    private static RecipeRecommendationBenchmarkSummary ComputeRecommendationSummary(
        IReadOnlyList<RecipeRecommendationBenchmarkCaseResult> caseResults)
    {
        var total = caseResults.Count;
        var correct = caseResults.Count(r => r.IsCorrect);
        var originalCookableCorrect = caseResults.Count(r => r.OriginalCookableCorrect);
        var selectedRecipeCorrect = caseResults.Count(r => r.SelectedRecipeCorrect);
        var noSolutionCorrect = caseResults.Count(r => r.NoSolutionCorrect);

        var overallAccuracy = total > 0 ? (double)correct / total : 0.0;
        var originalCookableAccuracy = total > 0 ? (double)originalCookableCorrect / total : 0.0;
        var selectedRecipeAccuracy = total > 0 ? (double)selectedRecipeCorrect / total : 0.0;
        var noSolutionAccuracy = total > 0 ? (double)noSolutionCorrect / total : 0.0;

        var matchPercentages = caseResults
            .Where(r => r.MatchPercentage.HasValue)
            .Select(r => r.MatchPercentage!.Value)
            .ToList();
        var avgMatchPercentage = matchPercentages.Any() ? (decimal?)matchPercentages.Average(r => (double)r) : null;

        return new RecipeRecommendationBenchmarkSummary
        {
            TotalCases = total,
            CorrectCases = correct,
            OriginalCookableCorrect = originalCookableCorrect,
            SelectedRecipeCorrect = selectedRecipeCorrect,
            NoSolutionCorrect = noSolutionCorrect,
            OverallAccuracy = overallAccuracy,
            OriginalCookableAccuracy = originalCookableAccuracy,
            SelectedRecipeAccuracy = selectedRecipeAccuracy,
            NoSolutionAccuracy = noSolutionAccuracy,
            AverageMatchPercentage = avgMatchPercentage
        };
    }
}
