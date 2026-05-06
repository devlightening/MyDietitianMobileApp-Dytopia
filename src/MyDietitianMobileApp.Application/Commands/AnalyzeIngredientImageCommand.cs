using MediatR;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Application.Commands;

/// <summary>
/// Command: analyze a food image and return matched ingredients ready for the kitchen basket.
/// </summary>
public class AnalyzeIngredientImageCommand : IRequest<AnalyzeIngredientImageResult>
{
    public string Base64Image { get; }
    public string MediaType { get; }
    public VisionScanKind ScanKind { get; }

    public AnalyzeIngredientImageCommand(
        string base64Image,
        string mediaType,
        VisionScanKind scanKind = VisionScanKind.Ingredient)
    {
        Base64Image = base64Image;
        MediaType = mediaType;
        ScanKind = scanKind;
    }
}

public enum VisionScanKind
{
    Ingredient = 0,
    Receipt = 1,
}

/// <summary>
/// One ingredient successfully identified from the image and normalized to a DB entry.
/// </summary>
public class DetectedIngredientDto
{
    public Guid IngredientId { get; init; }
    public string CanonicalName { get; init; } = string.Empty;
    public double Confidence { get; init; }
    /// <summary>The raw name GPT-4o returned before normalization.</summary>
    public string DetectedName { get; init; } = string.Empty;
    /// <summary>Normalized (lowercase-trimmed) form used for resolver lookup.</summary>
    public string NormalizedLabel { get; init; } = string.Empty;
    /// <summary>
    /// Which resolver layer matched it.
    /// Values: "mapping_table" | "canonical" | "exact_alias" | "fuzzy" | "llm"
    /// </summary>
    public string MatchedBy { get; init; } = string.Empty;
    public MappingType MappingType { get; init; } = MappingType.ExactIngredient;
    /// <summary>True when the ingredient can be added without user confirmation.</summary>
    public bool IsAutoSelected { get; init; }
    /// <summary>True when the match exists but the user should review before accepting.</summary>
    public bool RequiresConfirmation { get; init; }
}

/// <summary>
/// Result of the image analysis + normalization pipeline.
/// </summary>
public class AnalyzeIngredientImageResult
{
    public Guid SessionId { get; init; }

    /// <summary>Ingredients that were successfully normalized — ready to add to kitchen basket.</summary>
    public IReadOnlyList<DetectedIngredientDto> Matched { get; init; } = Array.Empty<DetectedIngredientDto>();

    /// <summary>Food names GPT detected but the normalization pipeline could not resolve.</summary>
    public IReadOnlyList<string> Unmatched { get; init; } = Array.Empty<string>();

    /// <summary>Total raw names GPT detected (Matched.Count + Unmatched.Count may be ≤ this due to deduplication).</summary>
    public int TotalDetected { get; init; }

    /// <summary>
    /// Availability state of the vision feature.
    /// Values: "active" | "disabled" | "api_key_missing"
    /// When not "active" the response will have no matched/unmatched items.
    /// </summary>
    public string FeatureStatus { get; init; } = "active";

    /// <summary>Prompt tokens consumed by the GPT-4o vision call (0 when feature is not active).</summary>
    public int PromptTokens { get; init; }

    /// <summary>Completion tokens consumed by the GPT-4o vision call (0 when feature is not active).</summary>
    public int CompletionTokens { get; init; }

    /// <summary>
    /// Machine-readable failure reason. Null on success.
    /// "image_too_large" — image exceeded the configured MaxImageBytes limit.
    /// </summary>
    public string? Reason { get; init; }

    /// <summary>User-facing Turkish message when Reason is set. Null on success.</summary>
    public string? UserMessage { get; init; }
}
