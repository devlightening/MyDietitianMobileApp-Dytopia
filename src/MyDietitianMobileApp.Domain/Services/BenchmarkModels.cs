namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Dataset models and result models for benchmark/evaluation execution.
/// </summary>

// ============================================================================
// INGREDIENT NORMALIZATION BENCHMARK MODELS
// ============================================================================

/// <summary>
/// Single test case entry in an ingredient normalization benchmark dataset.
/// </summary>
public class IngredientNormalizationBenchmarkCase
{
    public string Id { get; init; } = string.Empty;
    public string RawInput { get; init; } = string.Empty;
    public string? ExpectedCanonicalName { get; init; }
    public string ExpectedMatchType { get; init; } = string.Empty; // "canonical", "alias", "unmatched", "ambiguous"
    public string? Difficulty { get; init; } // e.g., "easy", "medium", "hard"
    public string? Notes { get; init; }
}

/// <summary>
/// Complete ingredient normalization benchmark dataset.
/// </summary>
public class IngredientNormalizationBenchmarkDataset
{
    public string Name { get; init; } = string.Empty;
    public string Version { get; init; } = "1.0";
    public string? Description { get; init; }
    public IReadOnlyList<IngredientNormalizationBenchmarkCase> Cases { get; init; } = Array.Empty<IngredientNormalizationBenchmarkCase>();
}

/// <summary>
/// Result for a single normalization benchmark case.
/// </summary>
public class IngredientNormalizationBenchmarkCaseResult
{
    public string CaseId { get; init; } = string.Empty;
    public string RawInput { get; init; } = string.Empty;
    public bool IsCorrect { get; init; }
    public string? ExpectedCanonicalName { get; init; }
    public string? ActualCanonicalName { get; init; }
    public string ExpectedMatchType { get; init; } = string.Empty;
    public string ActualMatchType { get; init; } = string.Empty;
    public string? FailureReason { get; init; }
    public double Confidence { get; init; }
    public string? Difficulty { get; init; }
}

/// <summary>
/// Summary metrics for ingredient normalization benchmark execution.
/// </summary>
public class IngredientNormalizationBenchmarkSummary
{
    public int TotalCases { get; init; }
    public int CorrectMatches { get; init; }
    public int IncorrectMatches { get; init; }
    public int UnmatchedCount { get; init; }
    public int AmbiguousCount { get; init; }
    public double Accuracy { get; init; }
    public int CanonicalMatchCount { get; init; }
    public int AliasMatchCount { get; init; }
    public int FuzzyMatchCount { get; init; }
    public int FuzzyCorrectCount { get; init; }
    public int LlmMatchCount { get; init; }
    public int LlmCorrectCount { get; init; }
    public Dictionary<string, IngredientNormalizationBenchmarkSummary>? PerDifficultyBreakdown { get; init; }
}

/// <summary>
/// Complete result of ingredient normalization benchmark execution.
/// </summary>
public class IngredientNormalizationBenchmarkResult
{
    public string DatasetName { get; init; } = string.Empty;
    public string DatasetVersion { get; init; } = string.Empty;
    public IngredientNormalizationBenchmarkSummary Summary { get; init; } = null!;
    public IReadOnlyList<IngredientNormalizationBenchmarkCaseResult> CaseResults { get; init; } = Array.Empty<IngredientNormalizationBenchmarkCaseResult>();
    public DateTime ExecutedAtUtc { get; init; }
}

// ============================================================================
// RECIPE RECOMMENDATION BENCHMARK MODELS
// ============================================================================

/// <summary>
/// Single test case entry in a recipe recommendation benchmark dataset.
/// </summary>
public class RecipeRecommendationBenchmarkCase
{
    public string Id { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string PlannedRecipeId { get; init; } = string.Empty; // Can be GUID string or recipe name identifier
    public IReadOnlyList<string> AvailableCanonicalIngredients { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> ClientProhibitedCanonicalIngredients { get; init; } = Array.Empty<string>();
    public bool ExpectedOriginalCookable { get; init; }
    public string? ExpectedSelectedRecipeId { get; init; } // null means no solution expected
    public IReadOnlyList<string> AcceptableAlternativeRecipeIds { get; init; } = Array.Empty<string>();
    public string? ExpectedReasonCategory { get; init; } // e.g., "prohibited", "missing_mandatory", "full_match"
}

/// <summary>
/// Complete recipe recommendation benchmark dataset.
/// </summary>
public class RecipeRecommendationBenchmarkDataset
{
    public string Name { get; init; } = string.Empty;
    public string Version { get; init; } = "1.0";
    public string? Description { get; init; }
    public IReadOnlyList<RecipeRecommendationBenchmarkCase> Cases { get; init; } = Array.Empty<RecipeRecommendationBenchmarkCase>();
}

/// <summary>
/// Result for a single recommendation benchmark case.
/// </summary>
public class RecipeRecommendationBenchmarkCaseResult
{
    public string CaseId { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public bool OriginalCookableCorrect { get; init; }
    public bool SelectedRecipeCorrect { get; init; }
    public bool NoSolutionCorrect { get; init; }
    public bool IsCorrect { get; init; }
    public bool ExpectedOriginalCookable { get; init; }
    public bool ActualOriginalCookable { get; init; }
    public string? ExpectedSelectedRecipeId { get; init; }
    public string? ActualSelectedRecipeId { get; init; }
    public decimal? MatchPercentage { get; init; }
    public string? FailureReason { get; init; }
    public string? ExpectedReasonCategory { get; init; }
    public string? ActualReasonCategory { get; init; }
}

/// <summary>
/// Summary metrics for recipe recommendation benchmark execution.
/// </summary>
public class RecipeRecommendationBenchmarkSummary
{
    public int TotalCases { get; init; }
    public int CorrectCases { get; init; }
    public int OriginalCookableCorrect { get; init; }
    public int SelectedRecipeCorrect { get; init; }
    public int NoSolutionCorrect { get; init; }
    public double OverallAccuracy { get; init; }
    public double OriginalCookableAccuracy { get; init; }
    public double SelectedRecipeAccuracy { get; init; }
    public double NoSolutionAccuracy { get; init; }
    public decimal? AverageMatchPercentage { get; init; }
}

/// <summary>
/// Complete result of recipe recommendation benchmark execution.
/// </summary>
public class RecipeRecommendationBenchmarkResult
{
    public string DatasetName { get; init; } = string.Empty;
    public string DatasetVersion { get; init; } = string.Empty;
    public RecipeRecommendationBenchmarkSummary Summary { get; init; } = null!;
    public IReadOnlyList<RecipeRecommendationBenchmarkCaseResult> CaseResults { get; init; } = Array.Empty<RecipeRecommendationBenchmarkCaseResult>();
    public DateTime ExecutedAtUtc { get; init; }
}
