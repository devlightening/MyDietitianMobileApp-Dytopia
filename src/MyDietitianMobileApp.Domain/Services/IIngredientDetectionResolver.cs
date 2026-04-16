namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Resolves a raw vision detection label to a canonical ingredient.
///
/// Resolution chain:
///   1. VisionLabelMappings cache (approved)  — fastest, no OpenAI call
///   2. VisionLabelMappings cache (provisional)
///   3. IngredientNormalizationService fallback (canonical → alias → fuzzy → LLM)
///   4. unresolved
///
/// Produces a <see cref="DetectionResolverResult"/> with auto-select and review flags
/// that the vision scan flow uses to populate the review screen.
/// </summary>
public interface IIngredientDetectionResolver
{
    /// <summary>
    /// Resolve a single raw detection label to a canonical ingredient.
    /// Never throws — returns unresolved result on any failure.
    /// </summary>
    /// <param name="sessionId">
    /// Groups all per-label log entries from the same scan session.
    /// Pass <see cref="Guid.Empty"/> when no session context is available.
    /// </param>
    Task<DetectionResolverResult> ResolveAsync(
        string rawLabel,
        Guid sessionId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of resolving a single raw detection label.
/// </summary>
public class DetectionResolverResult
{
    /// <summary>Raw label as received from the vision service.</summary>
    public string RawLabel { get; init; } = string.Empty;

    /// <summary>Normalized (lowercase, trimmed) form used for lookup.</summary>
    public string NormalizedLabel { get; init; } = string.Empty;

    /// <summary>Resolved canonical ingredient ID. Null if unresolved.</summary>
    public Guid? MatchedIngredientId { get; init; }

    /// <summary>Canonical name of the matched ingredient. Null if unresolved.</summary>
    public string? MatchedIngredientName { get; init; }

    /// <summary>
    /// Confidence in the match (0.0–1.0).
    /// 0.0 when unresolved.
    /// </summary>
    public double Confidence { get; init; }

    /// <summary>
    /// Which layer produced the match.
    /// Values: "mapping_table" | "canonical" | "exact_alias" | "fuzzy" | "llm" | "unresolved"
    /// </summary>
    public string MatchType { get; init; } = "unresolved";

    /// <summary>
    /// True when the match can be added to the pantry / kitchen basket without user confirmation.
    /// Requires: approved mapping with specific label (confidence ≥ 0.85) or exact canonical/alias match.
    /// </summary>
    public bool IsAutoSelected { get; init; }

    /// <summary>
    /// True when a match was found but the user should review before accepting.
    /// Covers: general labels (chicken, pepper), fuzzy matches, unapproved mappings.
    /// False for unresolved items — they are shown as "unrecognized" in the review UI.
    /// </summary>
    public bool RequiresReview { get; init; }

    // ── Convenience factories ──────────────────────────────────────────

    public static DetectionResolverResult Unresolved(string rawLabel, string normalizedLabel) =>
        new()
        {
            RawLabel = rawLabel,
            NormalizedLabel = normalizedLabel,
            MatchType = "unresolved",
            IsAutoSelected = false,
            RequiresReview = false,
        };
}
