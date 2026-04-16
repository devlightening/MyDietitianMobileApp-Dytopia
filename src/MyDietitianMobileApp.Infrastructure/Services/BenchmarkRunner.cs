using System.Text.Json;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
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
    private readonly LlmNormalizationOptions _llmOptions;
    private readonly IBarcodeIngredientResolutionService _barcodeResolutionService;
    private readonly VisionIngredientOptions _visionOptions;

    public BenchmarkRunner(
        AppDbContext db,
        IIngredientNormalizationService normalizationService,
        IRecipeRecommendationEngine recommendationEngine,
        IAlternativeMealDecisionService alternativeDecisionService)
        : this(
            db,
            normalizationService,
            recommendationEngine,
            alternativeDecisionService,
            new LlmNormalizationOptions(),
            new NullBarcodeIngredientResolutionService(),
            new VisionIngredientOptions())
    {
    }

    public BenchmarkRunner(
        AppDbContext db,
        IIngredientNormalizationService normalizationService,
        IRecipeRecommendationEngine recommendationEngine,
        IAlternativeMealDecisionService alternativeDecisionService,
        LlmNormalizationOptions llmOptions)
        : this(
            db,
            normalizationService,
            recommendationEngine,
            alternativeDecisionService,
            llmOptions,
            new NullBarcodeIngredientResolutionService(),
            new VisionIngredientOptions())
    {
    }

    public BenchmarkRunner(
        AppDbContext db,
        IIngredientNormalizationService normalizationService,
        IRecipeRecommendationEngine recommendationEngine,
        IAlternativeMealDecisionService alternativeDecisionService,
        LlmNormalizationOptions llmOptions,
        IBarcodeIngredientResolutionService barcodeResolutionService,
        VisionIngredientOptions visionOptions)
    {
        _db = db;
        _normalizationService = normalizationService;
        _recommendationEngine = recommendationEngine;
        _alternativeDecisionService = alternativeDecisionService;
        _llmOptions = llmOptions;
        _barcodeResolutionService = barcodeResolutionService;
        _visionOptions = visionOptions;
    }

    // ============================================================================
    // INGREDIENT NORMALIZATION BENCHMARK
    // ============================================================================

    public async Task<IngredientNormalizationBenchmarkResult> RunNormalizationBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default)
    {
        var dataset = await LoadNormalizationDatasetAsync(datasetFilePath, cancellationToken);
        return await RunNormalizationBenchmarkAsync(dataset, cancellationToken);
    }

    public async Task<IngredientNormalizationBenchmarkResult> RunNormalizationBenchmarkAsync(
        IngredientNormalizationBenchmarkDataset dataset,
        CancellationToken cancellationToken = default)
    {
        return await RunNormalizationBenchmarkInternalAsync(
            dataset,
            _normalizationService,
            executionLabel: "configured",
            llmEnabled: _llmOptions.Enabled,
            llmProvider: GetConfiguredProviderLabel(),
            cancellationToken);
    }

    public async Task<IngredientNormalizationBenchmarkComparisonResult> RunNormalizationBenchmarkComparisonAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default)
    {
        var dataset = await LoadNormalizationDatasetAsync(datasetFilePath, cancellationToken);
        return await RunNormalizationBenchmarkComparisonAsync(dataset, cancellationToken);
    }

    public async Task<IngredientNormalizationBenchmarkComparisonResult> RunNormalizationBenchmarkComparisonAsync(
        IngredientNormalizationBenchmarkDataset dataset,
        CancellationToken cancellationToken = default)
    {
        var llmOffOptions = CloneOptions(_llmOptions);
        llmOffOptions.Enabled = false;
        llmOffOptions.Provider = "none";

        var llmOffService = new IngredientNormalizationService(
            _db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(_db, llmOffOptions),
            llmOffOptions);

        var llmOff = await RunNormalizationBenchmarkInternalAsync(
            dataset,
            llmOffService,
            executionLabel: "llm-off",
            llmEnabled: false,
            llmProvider: "none",
            cancellationToken);

        var llmOn = await RunNormalizationBenchmarkInternalAsync(
            dataset,
            _normalizationService,
            executionLabel: "configured",
            llmEnabled: _llmOptions.Enabled,
            llmProvider: GetConfiguredProviderLabel(),
            cancellationToken);

        return new IngredientNormalizationBenchmarkComparisonResult
        {
            LlmOff = llmOff,
            LlmOn = llmOn,
            Delta = new IngredientNormalizationBenchmarkComparisonDelta
            {
                AccuracyDelta = llmOn.Summary.Accuracy - llmOff.Summary.Accuracy,
                UnmatchedDelta = llmOn.Summary.UnmatchedCount - llmOff.Summary.UnmatchedCount,
                AmbiguousDelta = llmOn.Summary.AmbiguousCount - llmOff.Summary.AmbiguousCount,
                LlmMatchDelta = llmOn.Summary.LlmMatchCount - llmOff.Summary.LlmMatchCount,
                LlmCorrectDelta = llmOn.Summary.LlmCorrectCount - llmOff.Summary.LlmCorrectCount,
                AverageLatencyDeltaMs = llmOn.Summary.AverageLatencyMs - llmOff.Summary.AverageLatencyMs
            },
            ExecutedAtUtc = DateTime.UtcNow
        };
    }

    private async Task<IngredientNormalizationBenchmarkResult> RunNormalizationBenchmarkInternalAsync(
        IngredientNormalizationBenchmarkDataset dataset,
        IIngredientNormalizationService normalizationService,
        string executionLabel,
        bool llmEnabled,
        string llmProvider,
        CancellationToken cancellationToken)
    {
        var caseResults = new List<IngredientNormalizationBenchmarkCaseResult>();

        foreach (var testCase in dataset.Cases)
        {
            var sw = Stopwatch.StartNew();
            var actual = await normalizationService.NormalizeAsync(testCase.RawInput, cancellationToken);
            sw.Stop();

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
                Difficulty = testCase.Difficulty,
                ElapsedMs = sw.Elapsed.TotalMilliseconds
            });
        }

        var summary = ComputeNormalizationSummary(caseResults, dataset.Cases);

        return new IngredientNormalizationBenchmarkResult
        {
            DatasetName = dataset.Name,
            DatasetVersion = dataset.Version,
            ExecutionLabel = executionLabel,
            LlmEnabled = llmEnabled,
            LlmProvider = llmProvider,
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
        var averageLatencyMs = total > 0 ? caseResults.Average(r => r.ElapsedMs) : 0.0;

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
                    var diffAverageLatencyMs = diffTotal > 0 ? difficultyResults.Average(r => r.ElapsedMs) : 0.0;

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
                        AverageLatencyMs = diffAverageLatencyMs,
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
            AverageLatencyMs = averageLatencyMs,
            PerDifficultyBreakdown = perDifficulty.Any() ? perDifficulty : null
        };
    }

    private static async Task<IngredientNormalizationBenchmarkDataset> LoadNormalizationDatasetAsync(
        string datasetFilePath,
        CancellationToken cancellationToken)
    {
        var json = await File.ReadAllTextAsync(datasetFilePath, cancellationToken);
        var dataset = JsonSerializer.Deserialize<IngredientNormalizationBenchmarkDataset>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (dataset == null)
            throw new InvalidOperationException($"Failed to deserialize normalization dataset from {datasetFilePath}");

        return dataset;
    }

    private string GetConfiguredProviderLabel()
    {
        return _llmOptions.ResolveProvider() switch
        {
            IngredientLlmProvider.OpenAi => "openai",
            IngredientLlmProvider.Ollama => "ollama",
            _ => "none"
        };
    }

    private static LlmNormalizationOptions CloneOptions(LlmNormalizationOptions source)
    {
        return new LlmNormalizationOptions
        {
            Enabled = source.Enabled,
            Provider = source.Provider,
            BaseUrl = source.BaseUrl,
            ModelName = source.ModelName,
            ApiKeyEnvVar = source.ApiKeyEnvVar,
            MaxCandidates = source.MaxCandidates,
            MinFuzzyScoreForShortlist = source.MinFuzzyScoreForShortlist,
            MaxInputLength = source.MaxInputLength,
            MinConfidenceToAccept = source.MinConfidenceToAccept,
            MinConfidenceForAmbiguous = source.MinConfidenceForAmbiguous
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
        // Live thesis environments may contain duplicate active rows for the same canonical name
        // while physical dictionary dedupe is still pending. Collapse them deterministically.
        var allIngredients = await _db.Ingredients
            .AsNoTracking()
            .Where(i => i.IsActive)
            .ToListAsync(cancellationToken);

        var ingredientNameToId = allIngredients
            .GroupBy(i => i.CanonicalName, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => IngredientResolutionPolicy.SelectPreferred(g).Id,
                StringComparer.OrdinalIgnoreCase);

        // Pre-load recipe identifier -> Recipe mapping
        // Support both GUID strings and recipe names as identifiers
        var allRecipes = await _db.Recipes
            .AsNoTracking()
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .ToListAsync(cancellationToken);

        var recipeById = allRecipes.ToDictionary(r => r.Id.ToString(), r => r);
        var recipeByName = allRecipes
            .GroupBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderBy(r => r.IsPublic) // prefer clinic-owned recipe when names collide
                    .ThenByDescending(r => r.MandatoryIngredients.Count)
                    .ThenByDescending(r => r.OptionalIngredients.Count)
                    .ThenBy(r => r.Id)
                    .First(),
                StringComparer.OrdinalIgnoreCase);

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

    // ============================================================================
    // MULTIMODAL ACQUISITION BENCHMARK
    // ============================================================================

    public async Task<MultimodalAcquisitionBenchmarkResult> RunMultimodalAcquisitionBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default)
    {
        var json = await File.ReadAllTextAsync(datasetFilePath, cancellationToken);
        var dataset = JsonSerializer.Deserialize<MultimodalAcquisitionBenchmarkDataset>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (dataset == null)
        {
            throw new InvalidOperationException($"Failed to deserialize multimodal acquisition dataset from {datasetFilePath}");
        }

        return await RunMultimodalAcquisitionBenchmarkAsync(dataset, cancellationToken);
    }

    public async Task<MultimodalAcquisitionBenchmarkResult> RunMultimodalAcquisitionBenchmarkAsync(
        MultimodalAcquisitionBenchmarkDataset dataset,
        CancellationToken cancellationToken = default)
    {
        var caseResults = new List<MultimodalAcquisitionBenchmarkCaseResult>();

        foreach (var testCase in dataset.Cases)
        {
            var sw = Stopwatch.StartNew();
            var actual = await EvaluateAcquisitionCaseAsync(testCase, cancellationToken);
            sw.Stop();

            var expectedCanonical = testCase.ExpectedCanonicalName;
            var candidateHitAt3 = !string.IsNullOrWhiteSpace(expectedCanonical)
                                  && actual.CandidateCanonicalNames.Any(name =>
                                      string.Equals(name, expectedCanonical, StringComparison.OrdinalIgnoreCase));

            var actualMappingType = actual.MappingType.ToString();
            var expectedMappingType = testCase.ExpectedMappingType;

            bool isCorrect;
            string? failureReason = null;

            if (!testCase.ExpectedResolved)
            {
                isCorrect = !actual.Resolved;
                if (!isCorrect)
                {
                    failureReason = $"Expected unresolved, got '{actual.ActualCanonicalName}'";
                }
            }
            else
            {
                isCorrect =
                    actual.Resolved &&
                    string.Equals(actual.ActualCanonicalName, expectedCanonical, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(actualMappingType, expectedMappingType, StringComparison.OrdinalIgnoreCase) &&
                    actual.RequiresConfirmation == testCase.ExpectedRequiresConfirmation;

                if (!isCorrect)
                {
                    failureReason =
                        $"Expected '{expectedCanonical}'/{expectedMappingType}/confirm={testCase.ExpectedRequiresConfirmation}, " +
                        $"got '{actual.ActualCanonicalName ?? "unresolved"}'/{actualMappingType}/confirm={actual.RequiresConfirmation}";
                }
            }

            caseResults.Add(new MultimodalAcquisitionBenchmarkCaseResult
            {
                CaseId = testCase.Id,
                Source = testCase.Source,
                RawInput = testCase.RawInput,
                IsCorrect = isCorrect,
                CandidateHitAt3 = candidateHitAt3,
                ExpectedResolved = testCase.ExpectedResolved,
                ActualResolved = actual.Resolved,
                ExpectedCanonicalName = expectedCanonical,
                ActualCanonicalName = actual.ActualCanonicalName,
                ExpectedMappingType = expectedMappingType,
                ActualMappingType = actualMappingType,
                ExpectedRequiresConfirmation = testCase.ExpectedRequiresConfirmation,
                ActualRequiresConfirmation = actual.RequiresConfirmation,
                CandidateCanonicalNames = actual.CandidateCanonicalNames,
                ElapsedMs = sw.Elapsed.TotalMilliseconds,
                FailureReason = failureReason
            });
        }

        var summary = ComputeAcquisitionSummary(caseResults);

        return new MultimodalAcquisitionBenchmarkResult
        {
            DatasetName = dataset.Name,
            DatasetVersion = dataset.Version,
            Summary = summary,
            CaseResults = caseResults,
            ExecutedAtUtc = DateTime.UtcNow
        };
    }

    // ============================================================================
    // HYBRID RECIPE BENCHMARK
    // ============================================================================

    public async Task<HybridRecipeBenchmarkResult> RunHybridRecipeBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default)
    {
        var json = await File.ReadAllTextAsync(datasetFilePath, cancellationToken);
        var dataset = JsonSerializer.Deserialize<HybridRecipeBenchmarkDataset>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (dataset == null)
        {
            throw new InvalidOperationException($"Failed to deserialize hybrid recipe dataset from {datasetFilePath}");
        }

        return await RunHybridRecipeBenchmarkAsync(dataset, cancellationToken);
    }

    public async Task<HybridRecipeBenchmarkResult> RunHybridRecipeBenchmarkAsync(
        HybridRecipeBenchmarkDataset dataset,
        CancellationToken cancellationToken = default)
    {
        var allIngredients = await _db.Ingredients
            .AsNoTracking()
            .Where(i => i.IsActive)
            .ToListAsync(cancellationToken);

        var ingredientNameToId = allIngredients
            .GroupBy(i => i.CanonicalName, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => IngredientResolutionPolicy.SelectPreferred(g).Id,
                StringComparer.OrdinalIgnoreCase);

        var condimentIds = allIngredients
            .Where(i => i.IsCondiment)
            .Select(i => i.Id)
            .ToArray();

        var allRecipes = await _db.Recipes
            .AsNoTracking()
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .ToListAsync(cancellationToken);

        var caseResults = new List<HybridRecipeBenchmarkCaseResult>();

        foreach (var testCase in dataset.Cases)
        {
            var availableIngredientIds = testCase.AvailableCanonicalIngredients
                .Where(name => ingredientNameToId.ContainsKey(name))
                .Select(name => ingredientNameToId[name])
                .ToArray();

            var context = new RecipeEvaluationContext(
                availableIngredientIds,
                Array.Empty<Guid>(),
                condimentIngredientIds: condimentIds);

            var ranked = _recommendationEngine.RankRecipes(allRecipes, context);
            var topThree = ranked.Take(3).Select(r => ResolveRecipeIdentifier(r.Recipe)).ToArray();
            var actualTop1 = topThree.FirstOrDefault();
            var acceptableTop3 = testCase.AcceptableTop3RecipeIds.Any()
                ? testCase.AcceptableTop3RecipeIds
                : (string.IsNullOrWhiteSpace(testCase.ExpectedTop1RecipeId)
                    ? Array.Empty<string>()
                    : new[] { testCase.ExpectedTop1RecipeId });

            var top1Correct = string.IsNullOrWhiteSpace(testCase.ExpectedTop1RecipeId)
                ? string.IsNullOrWhiteSpace(actualTop1)
                : ranked.FirstOrDefault() is RecipeEvaluationResult topResult
                  && MatchesRecipeIdentifier(topResult.Recipe, testCase.ExpectedTop1RecipeId);

            var hitAt3 = acceptableTop3.Any()
                ? ranked.Take(3).Any(result =>
                    acceptableTop3.Any(expected => MatchesRecipeIdentifier(result.Recipe, expected)))
                : top1Correct;

            caseResults.Add(new HybridRecipeBenchmarkCaseResult
            {
                CaseId = testCase.Id,
                Description = testCase.Description,
                SourceMix = testCase.SourceMix,
                Top1Correct = top1Correct,
                HitAt3 = hitAt3,
                ExpectedTop1RecipeId = testCase.ExpectedTop1RecipeId,
                ActualTop1RecipeId = actualTop1,
                ActualTop3RecipeIds = topThree,
                FailureReason = top1Correct || hitAt3
                    ? null
                    : $"Expected top-1 '{testCase.ExpectedTop1RecipeId}', actual top-3: {string.Join(", ", topThree)}"
            });
        }

        var total = caseResults.Count;
        var top1CorrectCount = caseResults.Count(r => r.Top1Correct);
        var hitAt3Count = caseResults.Count(r => r.HitAt3);

        return new HybridRecipeBenchmarkResult
        {
            DatasetName = dataset.Name,
            DatasetVersion = dataset.Version,
            Summary = new HybridRecipeBenchmarkSummary
            {
                TotalCases = total,
                Top1CorrectCount = top1CorrectCount,
                HitAt3Count = hitAt3Count,
                Top1Precision = total > 0 ? (double)top1CorrectCount / total : 0d,
                HitAt3Rate = total > 0 ? (double)hitAt3Count / total : 0d
            },
            CaseResults = caseResults,
            ExecutedAtUtc = DateTime.UtcNow
        };
    }

    private async Task<AcquisitionCaseEvaluation> EvaluateAcquisitionCaseAsync(
        MultimodalAcquisitionBenchmarkCase testCase,
        CancellationToken cancellationToken)
    {
        var sourceKey = testCase.Source.Trim().ToLowerInvariant();
        return sourceKey switch
        {
            "text" => await EvaluateTextAcquisitionCaseAsync(testCase.RawInput, cancellationToken),
            "vision" => await EvaluateVisionAcquisitionCaseAsync(testCase.RawInput, cancellationToken),
            "barcode" => await EvaluateBarcodeAcquisitionCaseAsync(testCase, cancellationToken),
            _ => new AcquisitionCaseEvaluation(false, null, MappingType.Unresolved, true, Array.Empty<string>())
        };
    }

    private async Task<AcquisitionCaseEvaluation> EvaluateTextAcquisitionCaseAsync(
        string rawInput,
        CancellationToken cancellationToken)
    {
        var normalization = await _normalizationService.NormalizeAsync(rawInput, cancellationToken);
        var candidateNames = ExtractCandidateNames(normalization);

        if (normalization.Status != IngredientMatchStatus.Matched || string.IsNullOrWhiteSpace(normalization.MatchedCanonicalName))
        {
            return new AcquisitionCaseEvaluation(false, null, MappingType.Unresolved, false, candidateNames);
        }

        return new AcquisitionCaseEvaluation(
            true,
            normalization.MatchedCanonicalName,
            MappingType.ExactIngredient,
            false,
            candidateNames);
    }

    private async Task<AcquisitionCaseEvaluation> EvaluateVisionAcquisitionCaseAsync(
        string rawInput,
        CancellationToken cancellationToken)
    {
        var normalization = await _normalizationService.NormalizeAsync(rawInput, cancellationToken);
        var candidateNames = ExtractCandidateNames(normalization)
            .Where(IsClosedSetVisionIngredient)
            .ToArray();

        if (normalization.Status != IngredientMatchStatus.Matched ||
            string.IsNullOrWhiteSpace(normalization.MatchedCanonicalName) ||
            !IsClosedSetVisionIngredient(normalization.MatchedCanonicalName))
        {
            return new AcquisitionCaseEvaluation(false, null, MappingType.Unresolved, true, candidateNames);
        }

        var requiresConfirmation = IngredientAcquisitionPolicy.RequiresConfirmation(
            AcquisitionSource.Vision,
            MappingType.ExactIngredient,
            normalization.Confidence);

        return new AcquisitionCaseEvaluation(
            true,
            normalization.MatchedCanonicalName,
            MappingType.ExactIngredient,
            requiresConfirmation,
            candidateNames);
    }

    private async Task<AcquisitionCaseEvaluation> EvaluateBarcodeAcquisitionCaseAsync(
        MultimodalAcquisitionBenchmarkCase testCase,
        CancellationToken cancellationToken)
    {
        var response = await _barcodeResolutionService.ResolveProductAsync(
            new BarcodeProductContext
            {
                Barcode = testCase.Barcode ?? testCase.RawInput,
                ProductName = testCase.ProductName,
                Brand = testCase.Brand,
                CategoriesText = testCase.CategoriesText,
                SourceProvider = "benchmark"
            },
            cancellationToken);

        return new AcquisitionCaseEvaluation(
            response.Candidates.Count > 0,
            response.Candidates.FirstOrDefault()?.CanonicalName,
            response.MappingType,
            response.RequiresConfirmation,
            response.Candidates.Select(candidate => candidate.CanonicalName).Take(3).ToArray());
    }

    private MultimodalAcquisitionBenchmarkSummary ComputeAcquisitionSummary(
        IReadOnlyList<MultimodalAcquisitionBenchmarkCaseResult> caseResults)
    {
        var total = caseResults.Count;
        var top1CorrectCount = caseResults.Count(r => r.IsCorrect);
        var hitAt3Count = caseResults.Count(r => r.CandidateHitAt3);
        var unresolvedCount = caseResults.Count(r => !r.ActualResolved);
        var confirmationCount = caseResults.Count(r => r.ActualRequiresConfirmation);

        return new MultimodalAcquisitionBenchmarkSummary
        {
            TotalCases = total,
            Top1CorrectCount = top1CorrectCount,
            HitAt3Count = hitAt3Count,
            UnresolvedCount = unresolvedCount,
            ConfirmationCount = confirmationCount,
            Top1Accuracy = total > 0 ? (double)top1CorrectCount / total : 0d,
            HitAt3Rate = total > 0 ? (double)hitAt3Count / total : 0d,
            UnresolvedRate = total > 0 ? (double)unresolvedCount / total : 0d,
            ConfirmationRate = total > 0 ? (double)confirmationCount / total : 0d,
            MedianLatencyMs = ComputeMedian(caseResults.Select(r => r.ElapsedMs)),
            PerSource = caseResults
                .GroupBy(r => r.Source, StringComparer.OrdinalIgnoreCase)
                .OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase)
                .Select(group =>
                {
                    var groupResults = group.ToArray();
                    var groupTotal = groupResults.Length;
                    var groupTop1 = groupResults.Count(r => r.IsCorrect);
                    var groupHitAt3 = groupResults.Count(r => r.CandidateHitAt3);
                    var groupUnresolved = groupResults.Count(r => !r.ActualResolved);
                    var groupConfirmation = groupResults.Count(r => r.ActualRequiresConfirmation);

                    return new MultimodalAcquisitionBenchmarkSourceSummary
                    {
                        Source = group.Key,
                        TotalCases = groupTotal,
                        Top1CorrectCount = groupTop1,
                        HitAt3Count = groupHitAt3,
                        UnresolvedCount = groupUnresolved,
                        ConfirmationCount = groupConfirmation,
                        Top1Accuracy = groupTotal > 0 ? (double)groupTop1 / groupTotal : 0d,
                        HitAt3Rate = groupTotal > 0 ? (double)groupHitAt3 / groupTotal : 0d,
                        UnresolvedRate = groupTotal > 0 ? (double)groupUnresolved / groupTotal : 0d,
                        ConfirmationRate = groupTotal > 0 ? (double)groupConfirmation / groupTotal : 0d,
                        MedianLatencyMs = ComputeMedian(groupResults.Select(r => r.ElapsedMs))
                    };
                })
                .ToArray()
        };
    }

    private bool IsClosedSetVisionIngredient(string canonicalName)
    {
        var closedSet = _visionOptions.ClosedSetCanonicalNames
            .Select(IngredientAcquisitionPolicy.NormalizeLookupKey)
            .ToHashSet(StringComparer.Ordinal);

        return closedSet.Contains(IngredientAcquisitionPolicy.NormalizeLookupKey(canonicalName));
    }

    private static IReadOnlyList<string> ExtractCandidateNames(IngredientNormalizationResult normalization)
    {
        if (normalization.Candidates == null || normalization.Candidates.Count == 0)
        {
            return string.IsNullOrWhiteSpace(normalization.MatchedCanonicalName)
                ? Array.Empty<string>()
                : new[] { normalization.MatchedCanonicalName };
        }

        return normalization.Candidates
            .Select(candidate => candidate.CanonicalName)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(3)
            .ToArray();
    }

    private static double ComputeMedian(IEnumerable<double> values)
    {
        var ordered = values.OrderBy(v => v).ToArray();
        if (ordered.Length == 0)
        {
            return 0d;
        }

        if (ordered.Length % 2 == 1)
        {
            return ordered[ordered.Length / 2];
        }

        var upper = ordered.Length / 2;
        return (ordered[upper - 1] + ordered[upper]) / 2d;
    }

    private static bool MatchesRecipeIdentifier(Recipe recipe, string identifier)
    {
        return string.Equals(recipe.Id.ToString(), identifier, StringComparison.OrdinalIgnoreCase)
               || string.Equals(recipe.Name, identifier, StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveRecipeIdentifier(Recipe recipe)
    {
        return recipe.Name;
    }

    private sealed record AcquisitionCaseEvaluation(
        bool Resolved,
        string? ActualCanonicalName,
        MappingType MappingType,
        bool RequiresConfirmation,
        IReadOnlyList<string> CandidateCanonicalNames);
}
