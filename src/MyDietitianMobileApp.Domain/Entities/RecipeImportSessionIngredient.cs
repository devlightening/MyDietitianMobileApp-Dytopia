using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

public class RecipeImportSessionIngredient
{
    public Guid Id { get; private set; }
    public Guid SessionRecipeId { get; private set; }
    public string RawName { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public string? RawLineText { get; private set; }
    public string? AmountRaw { get; private set; }
    public decimal? AmountValue { get; private set; }
    public string? UnitNormalized { get; private set; }
    public ImportIngredientRole Role { get; private set; }
    public Guid? MatchedIngredientId { get; private set; }
    public string? MatchedCanonicalName { get; private set; }
    public ImportIngredientMatchType MatchType { get; private set; }
    public double MatchConfidence { get; private set; }
    public bool IsResolved { get; private set; }
    public decimal ParseConfidence { get; private set; }
    public bool NeedsReview { get; private set; }
    public string? IssueCodesJson { get; private set; }
    public int DisplayOrder { get; private set; }

    public RecipeImportSessionRecipe SessionRecipe { get; private set; } = null!;

    private RecipeImportSessionIngredient() { }

    public RecipeImportSessionIngredient(Guid id, Guid sessionRecipeId,
        string rawName, string? amountRaw, decimal? amountValue,
        string? unitNormalized, ImportIngredientRole role, int displayOrder,
        string? rawLineText = null,
        decimal parseConfidence = 1.0m,
        IEnumerable<string>? issueCodes = null,
        bool needsReview = false)
    {
        Id = id;
        SessionRecipeId = sessionRecipeId;
        RawName = rawName;
        NormalizedName = rawName.Trim();
        RawLineText = NormalizeOptional(rawLineText);
        AmountRaw = amountRaw;
        AmountValue = amountValue;
        UnitNormalized = unitNormalized;
        Role = role;
        MatchType = ImportIngredientMatchType.None;
        ParseConfidence = parseConfidence;
        NeedsReview = needsReview;
        SetIssueCodes(issueCodes);
        DisplayOrder = displayOrder;
    }

    public void SetMatch(Guid ingredientId, string canonicalName, ImportIngredientMatchType matchType, double confidence)
    {
        MatchedIngredientId = ingredientId;
        MatchedCanonicalName = canonicalName;
        MatchType = matchType;
        MatchConfidence = confidence;
        IsResolved = true;
        NeedsReview = false;
    }

    public void MarkAmbiguous(double confidence, IEnumerable<string>? issueCodes = null)
    {
        MatchedIngredientId = null;
        MatchedCanonicalName = null;
        MatchType = ImportIngredientMatchType.Ambiguous;
        MatchConfidence = confidence;
        IsResolved = false;
        NeedsReview = true;
        SetIssueCodes(issueCodes);
    }

    public void ApplyReview(Guid? matchedIngredientId, string? matchedName,
        string? role, string? amountRaw, decimal? amountValue, string? unit,
        bool? needsReview = null,
        IEnumerable<string>? issueCodes = null)
    {
        if (matchedIngredientId.HasValue && matchedIngredientId.Value != Guid.Empty)
        {
            MatchedIngredientId = matchedIngredientId;
            MatchedCanonicalName = matchedName;
            MatchType = ImportIngredientMatchType.Manual;
            MatchConfidence = 1.0;
            IsResolved = true;
            NeedsReview = false;
        }
        if (role != null && Enum.TryParse<ImportIngredientRole>(role, true, out var r))
            Role = r;
        if (amountRaw != null) AmountRaw = amountRaw;
        if (amountValue.HasValue) AmountValue = amountValue;
        if (unit != null) UnitNormalized = unit;
        if (needsReview.HasValue) NeedsReview = needsReview.Value;
        if (issueCodes != null) SetIssueCodes(issueCodes);
    }

    public IReadOnlyList<string> GetIssueCodes()
    {
        return string.IsNullOrWhiteSpace(IssueCodesJson)
            ? Array.Empty<string>()
            : System.Text.Json.JsonSerializer.Deserialize<List<string>>(IssueCodesJson) ?? new List<string>();
    }

    private void SetIssueCodes(IEnumerable<string>? issueCodes)
    {
        var codes = (issueCodes ?? Enumerable.Empty<string>())
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        IssueCodesJson = codes.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(codes);
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
