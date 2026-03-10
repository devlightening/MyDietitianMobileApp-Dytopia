using System;

namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Persistent log of ingredient normalization events for evaluation and benchmarking.
/// </summary>
public class IngredientNormalizationLog
{
    public Guid Id { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public string RawInput { get; private set; } = string.Empty;
    public string NormalizedInput { get; private set; } = string.Empty;
    public string Status { get; private set; } = string.Empty;       // Matched / Unmatched / Ambiguous
    public string MatchedBy { get; private set; } = string.Empty;    // Canonical / Alias / None
    public Guid? MatchedIngredientId { get; private set; }
    public string? MatchedCanonicalName { get; private set; }
    public double Confidence { get; private set; }

    /// <summary>
    /// Optional JSON summary of top candidates and their confidences.
    /// Used for offline analysis; not required for all events.
    /// </summary>
    public string? CandidateSummaryJson { get; private set; }

    /// <summary>
    /// Optional correlation identifier (e.g. HttpContext.TraceIdentifier).
    /// </summary>
    public string? CorrelationId { get; private set; }

    /// <summary>
    /// Optional request path or flow hint (e.g. /api/ingredients/search).
    /// </summary>
    public string? RequestPath { get; private set; }

    private IngredientNormalizationLog() { } // EF Core

    public IngredientNormalizationLog(
        Guid id,
        string rawInput,
        string normalizedInput,
        string status,
        string matchedBy,
        Guid? matchedIngredientId,
        string? matchedCanonicalName,
        double confidence,
        string? candidateSummaryJson,
        string? correlationId,
        string? requestPath)
    {
        Id = id;
        CreatedAtUtc = DateTime.UtcNow;
        RawInput = rawInput ?? string.Empty;
        NormalizedInput = normalizedInput ?? string.Empty;
        Status = status ?? string.Empty;
        MatchedBy = matchedBy ?? string.Empty;
        MatchedIngredientId = matchedIngredientId;
        MatchedCanonicalName = matchedCanonicalName;
        Confidence = confidence;
        CandidateSummaryJson = candidateSummaryJson;
        CorrelationId = correlationId;
        RequestPath = requestPath;
    }
}

