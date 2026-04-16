using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

public class RecipeImportSessionRecipe
{
    public Guid Id { get; private set; }
    public Guid SessionId { get; private set; }
    public string RawTitle { get; private set; } = string.Empty;
    public string NormalizedTitle { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsPublic { get; private set; }
    public string? RawSourceBlock { get; private set; }
    public string? StepsJson { get; private set; }
    public string? TagsJson { get; private set; }
    public string? PrepTimeText { get; private set; }
    public string? CookTimeText { get; private set; }
    public string? ServingsText { get; private set; }
    public bool NeedsReview { get; private set; }
    public bool HasDuplicate { get; private set; }
    public Guid? ExistingRecipeId { get; private set; }
    public ImportDuplicateResolutionMode DuplicateResolutionMode { get; private set; }
    public bool IsSkipped { get; private set; }
    public int DisplayOrder { get; private set; }

    public RecipeImportSession Session { get; private set; } = null!;
    private readonly List<RecipeImportSessionIngredient> _ingredients = new();
    public IReadOnlyCollection<RecipeImportSessionIngredient> Ingredients => _ingredients.AsReadOnly();

    private RecipeImportSessionRecipe() { }

    public RecipeImportSessionRecipe(
        Guid id,
        Guid sessionId,
        string rawTitle,
        string? description,
        bool isPublic,
        int displayOrder,
        string? rawSourceBlock = null,
        IEnumerable<string>? steps = null,
        IEnumerable<string>? tags = null,
        string? prepTimeText = null,
        string? cookTimeText = null,
        string? servingsText = null,
        bool needsReview = false)
    {
        Id = id;
        SessionId = sessionId;
        RawTitle = rawTitle;
        NormalizedTitle = rawTitle.Trim();
        Description = description;
        IsPublic = isPublic;
        RawSourceBlock = string.IsNullOrWhiteSpace(rawSourceBlock) ? null : rawSourceBlock.Trim();
        SetSteps(steps);
        SetTags(tags);
        PrepTimeText = NormalizeOptional(prepTimeText);
        CookTimeText = NormalizeOptional(cookTimeText);
        ServingsText = NormalizeOptional(servingsText);
        NeedsReview = needsReview;
        DuplicateResolutionMode = ImportDuplicateResolutionMode.CreateNew;
        DisplayOrder = displayOrder;
    }

    public void MarkDuplicate(Guid? existingRecipeId)
    {
        HasDuplicate = true;
        ExistingRecipeId = existingRecipeId;
        DuplicateResolutionMode = ImportDuplicateResolutionMode.CreateNew;
    }

    public void ApplyReview(string? title, string? description, bool? isPublic,
        string? duplicateMode, Guid? targetId, bool? isSkipped,
        IEnumerable<string>? steps = null,
        IEnumerable<string>? tags = null,
        string? prepTimeText = null,
        string? cookTimeText = null,
        string? servingsText = null,
        bool? needsReview = null)
    {
        if (!string.IsNullOrWhiteSpace(title)) NormalizedTitle = title.Trim();
        if (description != null) Description = description;
        if (isPublic.HasValue) IsPublic = isPublic.Value;
        if (isSkipped.HasValue) IsSkipped = isSkipped.Value;
        if (steps != null) SetSteps(steps);
        if (tags != null) SetTags(tags);
        if (prepTimeText != null) PrepTimeText = NormalizeOptional(prepTimeText);
        if (cookTimeText != null) CookTimeText = NormalizeOptional(cookTimeText);
        if (servingsText != null) ServingsText = NormalizeOptional(servingsText);
        if (needsReview.HasValue) NeedsReview = needsReview.Value;
        if (duplicateMode != null && Enum.TryParse<ImportDuplicateResolutionMode>(duplicateMode, true, out var mode))
        {
            DuplicateResolutionMode = mode;
            ExistingRecipeId = targetId;
        }
    }

    public IReadOnlyList<string> GetSteps()
    {
        return string.IsNullOrWhiteSpace(StepsJson)
            ? Array.Empty<string>()
            : System.Text.Json.JsonSerializer.Deserialize<List<string>>(StepsJson) ?? new List<string>();
    }

    public IReadOnlyList<string> GetTags()
    {
        return string.IsNullOrWhiteSpace(TagsJson)
            ? Array.Empty<string>()
            : System.Text.Json.JsonSerializer.Deserialize<List<string>>(TagsJson) ?? new List<string>();
    }

    private void SetSteps(IEnumerable<string>? steps)
    {
        var list = (steps ?? Enumerable.Empty<string>())
            .Where(step => !string.IsNullOrWhiteSpace(step))
            .Select(step => step.Trim())
            .ToList();

        StepsJson = list.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(list);
    }

    private void SetTags(IEnumerable<string>? tags)
    {
        var list = (tags ?? Enumerable.Empty<string>())
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Select(tag => tag.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        TagsJson = list.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(list);
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
