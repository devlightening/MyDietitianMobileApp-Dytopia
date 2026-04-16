namespace MyDietitianMobileApp.Infrastructure.Services.Import;

public class ImportReviewRequest
{
    public List<ImportReviewedRecipe> Recipes { get; set; } = new();
    public bool SaveAsTemplate { get; set; }
}

public class ImportReviewedRecipe
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
    public List<ImportReviewedIngredient>? Ingredients { get; set; }
}

public class ImportReviewedIngredient
{
    public Guid Id { get; set; }
    public Guid? MatchedIngredientId { get; set; }
    public string? MatchedCanonicalName { get; set; }
    public string? Role { get; set; }
    public string? AmountRaw { get; set; }
    public decimal? AmountValue { get; set; }
    public string? Unit { get; set; }
    public bool? NeedsReview { get; set; }
    public List<string>? IssueCodes { get; set; }
    public string? ResolutionState { get; set; }
}
