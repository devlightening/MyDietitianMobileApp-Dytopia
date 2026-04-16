using System;

namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Maps a raw vision label (from GPT-4o or future on-device detection) to a canonical ingredient.
/// Acts as a cache layer: if a label has a high-confidence approved mapping, the backend skips
/// the OpenAI call and resolves directly from this table.
/// </summary>
public class VisionLabelMapping
{
    public Guid Id { get; private set; }

    /// <summary>
    /// Raw label as returned by the detection service (e.g. "tomato", "domates", "chicken breast").
    /// Stored lowercase-trimmed.
    /// </summary>
    public string RawLabel { get; private set; } = string.Empty;

    /// <summary>
    /// Normalized form used for lookup (lowercase, trimmed, diacritics retained).
    /// </summary>
    public string NormalizedLabel { get; private set; } = string.Empty;

    /// <summary>
    /// Resolved canonical ingredient.
    /// Nullable — an unapproved or unresolved mapping may not have an ingredient yet.
    /// </summary>
    public Guid? IngredientId { get; private set; }

    /// <summary>
    /// Minimum detection confidence at which this mapping should be used for auto-selection.
    /// Typically 0.7 for approved mappings, 0.4 for provisional ones.
    /// </summary>
    public double ConfidenceThreshold { get; private set; }

    /// <summary>
    /// True when a human or admin has verified this mapping is correct.
    /// Only approved mappings bypass the OpenAI call.
    /// </summary>
    public bool IsApproved { get; private set; }

    /// <summary>
    /// Optional human note about this mapping (e.g. "Added from Faz 1 seed").
    /// </summary>
    public string? Notes { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    // EF Core
    private VisionLabelMapping() { }

    public VisionLabelMapping(
        Guid id,
        string rawLabel,
        Guid? ingredientId,
        double confidenceThreshold,
        bool isApproved,
        string? notes = null)
    {
        Id = id;
        RawLabel = (rawLabel ?? string.Empty).Trim().ToLowerInvariant();
        NormalizedLabel = RawLabel;
        IngredientId = ingredientId;
        ConfidenceThreshold = confidenceThreshold;
        IsApproved = isApproved;
        Notes = notes;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void Approve() => IsApproved = true;
    public void SetIngredient(Guid ingredientId) => IngredientId = ingredientId;
    public void SetConfidenceThreshold(double threshold) => ConfidenceThreshold = threshold;
}
