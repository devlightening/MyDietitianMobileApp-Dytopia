namespace MyDietitianMobileApp.Application.DTOs;

public class RecipeImportPreviewDto
{
    public Guid SessionId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string DocumentKind { get; set; } = string.Empty;
    public string? ParserUsed { get; set; }
    public decimal? ConfidenceScore { get; set; }
    public List<string> Warnings { get; set; } = new();
    public int TotalRecipes { get; set; }
    public int MatchedIngredients { get; set; }
    public int AmbiguousIngredients { get; set; }
    public int UnmatchedIngredients { get; set; }
    public int BlockingIssues { get; set; }
    public int WarningsCount { get; set; }
    public string? ErrorMessage { get; set; }
    public List<RecipeImportIssueDto> Issues { get; set; } = new();
    public List<RecipeImportPreviewRecipeDto> Recipes { get; set; } = new();
}

public class RecipeImportPreviewRecipeDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public bool NeedsReview { get; set; }
    public string? RawSourceBlock { get; set; }
    public List<string> Steps { get; set; } = new();
    public List<string> Tags { get; set; } = new();
    public string? PrepTimeText { get; set; }
    public string? CookTimeText { get; set; }
    public string? ServingsText { get; set; }
    public bool HasDuplicate { get; set; }
    public Guid? ExistingRecipeId { get; set; }
    public string DuplicateResolutionMode { get; set; } = "CreateNew";
    public bool IsSkipped { get; set; }
    public int DisplayOrder { get; set; }
    public List<RecipeImportPreviewIngredientDto> Ingredients { get; set; } = new();
    public List<RecipeImportIssueDto> Issues { get; set; } = new();
}

public class RecipeImportPreviewIngredientDto
{
    public Guid Id { get; set; }
    public string RawName { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public string? RawLineText { get; set; }
    public string? AmountRaw { get; set; }
    public decimal? AmountValue { get; set; }
    public string? Unit { get; set; }
    public string Role { get; set; } = "Mandatory";
    public Guid? MatchedIngredientId { get; set; }
    public string? MatchedCanonicalName { get; set; }
    public string MatchType { get; set; } = "None";
    public double MatchConfidence { get; set; }
    public decimal ParseConfidence { get; set; }
    public bool IsResolved { get; set; }
    public bool NeedsReview { get; set; }
    public List<string> IssueCodes { get; set; } = new();
}

public class RecipeImportIssueDto
{
    public string Severity { get; set; } = "Warning";
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Hint { get; set; }
    public Guid? SessionRecipeId { get; set; }
    public Guid? SessionIngredientId { get; set; }
}

public class ReviewImportSessionRequest
{
    public bool SaveAsTemplate { get; set; }
    public List<ReviewedRecipeDto> Recipes { get; set; } = new();
}

public class ReviewedRecipeDto
{
    public Guid Id { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public bool? IsPublic { get; set; }
    public string? DuplicateResolutionMode { get; set; }
    public Guid? TargetRecipeId { get; set; }
    public bool? IsSkipped { get; set; }
    public List<string>? Steps { get; set; }
    public List<string>? Tags { get; set; }
    public string? PrepTimeText { get; set; }
    public string? CookTimeText { get; set; }
    public string? ServingsText { get; set; }
    public bool? NeedsReview { get; set; }
    public List<ReviewedIngredientDto>? Ingredients { get; set; }
}

public class ReviewedIngredientDto
{
    public Guid Id { get; set; }
    public Guid? MatchedIngredientId { get; set; }
    public string? MatchedCanonicalName { get; set; }
    public string? Role { get; set; }
    public string? AmountRaw { get; set; }
    public decimal? AmountValue { get; set; }
    public string? Unit { get; set; }
    public bool? NeedsReview { get; set; }
    public string? ResolutionState { get; set; }
    public List<string>? IssueCodes { get; set; }
}

public class ConfirmImportResultDto
{
    public int CreatedCount { get; set; }
    public int UpdatedCount { get; set; }
    public int SkippedCount { get; set; }
    public int WarningCount { get; set; }
    public int ReviewedRecipeCount { get; set; }
    public List<string> CreatedRecipeNames { get; set; } = new();
}
