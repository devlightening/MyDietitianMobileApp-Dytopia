using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

public class RecipeImportSession
{
    public Guid Id { get; private set; }
    public Guid DietitianId { get; private set; }
    public string OriginalFileName { get; private set; } = string.Empty;
    public string FileType { get; private set; } = string.Empty;
    public ImportDocumentKind DocumentKind { get; private set; } = ImportDocumentKind.Unsupported;
    public string? ParserUsed { get; private set; }
    public decimal? ConfidenceScore { get; private set; }
    public string? WarningsJson { get; private set; }
    public string? DetectedRecipeBoundaryMode { get; private set; }
    public string? TemplateKey { get; private set; }
    public string? TemplateHeaderHintsJson { get; private set; }
    public ImportSessionStatus Status { get; private set; }
    public int ParsedRecipeCount { get; private set; }
    public int UnmatchedIngredientCount { get; private set; }
    public string? ErrorMessage { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }

    private readonly List<RecipeImportSessionRecipe> _recipes = new();
    public IReadOnlyCollection<RecipeImportSessionRecipe> Recipes => _recipes.AsReadOnly();

    private RecipeImportSession() { }

    public RecipeImportSession(Guid id, Guid dietitianId, string originalFileName, string fileType)
    {
        Id = id;
        DietitianId = dietitianId;
        OriginalFileName = originalFileName;
        FileType = fileType.ToLowerInvariant();
        Status = ImportSessionStatus.Uploading;
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetStatus(ImportSessionStatus status, string? error = null)
    {
        Status = status;
        ErrorMessage = error;
        UpdatedAtUtc = DateTime.UtcNow;
        if (status == ImportSessionStatus.Completed)
            CompletedAtUtc = DateTime.UtcNow;
    }

    public void SetSummary(int recipeCount, int unmatchedCount)
    {
        ParsedRecipeCount = recipeCount;
        UnmatchedIngredientCount = unmatchedCount;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetDetection(
        ImportDocumentKind documentKind,
        string? parserUsed,
        decimal? confidenceScore,
        string? warningsJson,
        string? detectedRecipeBoundaryMode,
        string? templateKey = null,
        string? templateHeaderHintsJson = null)
    {
        DocumentKind = documentKind;
        ParserUsed = string.IsNullOrWhiteSpace(parserUsed) ? null : parserUsed.Trim();
        ConfidenceScore = confidenceScore;
        WarningsJson = string.IsNullOrWhiteSpace(warningsJson) ? null : warningsJson;
        DetectedRecipeBoundaryMode = string.IsNullOrWhiteSpace(detectedRecipeBoundaryMode)
            ? null
            : detectedRecipeBoundaryMode.Trim();
        TemplateKey = string.IsNullOrWhiteSpace(templateKey) ? null : templateKey.Trim();
        TemplateHeaderHintsJson = string.IsNullOrWhiteSpace(templateHeaderHintsJson) ? null : templateHeaderHintsJson.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
