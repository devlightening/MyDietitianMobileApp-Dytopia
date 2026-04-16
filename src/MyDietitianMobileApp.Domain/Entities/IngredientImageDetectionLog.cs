using System;

namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Persistent log of every ingredient image detection event.
/// Used for:
///   - Thesis metrics: detection success rate, unresolved rate, user correction rate,
///     auto-selected rate, average confidence, barcode/text/photo comparison.
///   - Operational monitoring: cost tracking (OpenAI calls), quality assurance.
/// </summary>
public class IngredientImageDetectionLog
{
    public Guid Id { get; private set; }

    /// <summary>
    /// Groups all per-label log entries from the same scan session.
    /// Matches the SessionId returned in AnalyzeIngredientImageResult.
    /// </summary>
    public Guid SessionId { get; private set; }

    /// <summary>
    /// Client who performed the scan. Nullable for anonymous/test scans.
    /// </summary>
    public Guid? ClientId { get; private set; }

    /// <summary>
    /// How the image was acquired. Values: "camera" | "gallery" | "test".
    /// </summary>
    public string ImageSource { get; private set; } = string.Empty;

    /// <summary>
    /// Raw label as returned by the detection service before normalization.
    /// </summary>
    public string RawLabel { get; private set; } = string.Empty;

    /// <summary>
    /// Normalized form of the raw label used for resolver lookup.
    /// </summary>
    public string NormalizedLabel { get; private set; } = string.Empty;

    /// <summary>
    /// The ingredient the system automatically predicted / resolved to.
    /// </summary>
    public Guid? PredictedIngredientId { get; private set; }

    /// <summary>
    /// The ingredient the user ultimately confirmed (may differ from predicted if user corrected).
    /// Set when WasAccepted = true after review.
    /// </summary>
    public Guid? ConfirmedIngredientId { get; private set; }

    /// <summary>
    /// Confidence score from the detection pipeline (0.0 – 1.0).
    /// </summary>
    public double Confidence { get; private set; }

    /// <summary>
    /// Which resolver layer produced the match.
    /// Values: "exact_alias" | "normalized" | "mapping_table" | "fuzzy" | "llm" | "unresolved"
    /// </summary>
    public string MatchType { get; private set; } = string.Empty;

    /// <summary>
    /// True = user accepted the prediction. False = user rejected. Null = not yet reviewed.
    /// </summary>
    public bool? WasAccepted { get; private set; }

    /// <summary>
    /// True when the item was auto-selected without user review (high-confidence approved mapping).
    /// </summary>
    public bool WasAutoSelected { get; private set; }

    /// <summary>
    /// True when this detection event triggered an OpenAI API call (for cost tracking).
    /// </summary>
    public bool UsedOpenAiFallback { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    // EF Core
    private IngredientImageDetectionLog() { }

    public IngredientImageDetectionLog(
        Guid id,
        Guid sessionId,
        Guid? clientId,
        string imageSource,
        string rawLabel,
        string normalizedLabel,
        Guid? predictedIngredientId,
        double confidence,
        string matchType,
        bool wasAutoSelected,
        bool usedOpenAiFallback)
    {
        Id = id;
        SessionId = sessionId;
        ClientId = clientId;
        ImageSource = imageSource ?? "unknown";
        RawLabel = rawLabel ?? string.Empty;
        NormalizedLabel = normalizedLabel ?? string.Empty;
        PredictedIngredientId = predictedIngredientId;
        Confidence = confidence;
        MatchType = matchType ?? "unresolved";
        WasAutoSelected = wasAutoSelected;
        UsedOpenAiFallback = usedOpenAiFallback;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void RecordUserDecision(bool accepted, Guid? confirmedIngredientId)
    {
        WasAccepted = accepted;
        ConfirmedIngredientId = confirmedIngredientId;
    }
}
