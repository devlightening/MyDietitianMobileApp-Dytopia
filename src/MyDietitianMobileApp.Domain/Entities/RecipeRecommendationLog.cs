using System;

namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Persistent log of recipe recommendation / decision outcomes for evaluation and benchmarking.
/// </summary>
public class RecipeRecommendationLog
{
    public Guid Id { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    /// <summary>
    /// Flow/source identifier, e.g. alternative_decision, kitchen_match, recipe_match.
    /// </summary>
    public string Flow { get; private set; } = string.Empty;

    public Guid? ClientId { get; private set; }
    public Guid? DietitianId { get; private set; }

    public Guid? PlannedRecipeId { get; private set; }
    public Guid? SelectedRecipeId { get; private set; }

    public bool OriginalCookable { get; private set; }
    public decimal? MatchPercentage { get; private set; }
    public int MissingMandatoryCount { get; private set; }
    public bool ProhibitedRejected { get; private set; }
    public bool UsedSubstitutes { get; private set; }

    /// <summary>
    /// Optional JSON-serialized list of missing mandatory ingredient IDs.
    /// </summary>
    public string? MissingMandatoryIdsJson { get; private set; }

    /// <summary>
    /// Optional JSON with additional per-flow metadata (e.g. eliminated counts).
    /// </summary>
    public string? AdditionalMetaJson { get; private set; }

    /// <summary>
    /// Optional correlation identifier (e.g. HttpContext.TraceIdentifier).
    /// </summary>
    public string? CorrelationId { get; private set; }

    private RecipeRecommendationLog() { } // EF Core

    public RecipeRecommendationLog(
        Guid id,
        string flow,
        Guid? clientId,
        Guid? dietitianId,
        Guid? plannedRecipeId,
        Guid? selectedRecipeId,
        bool originalCookable,
        decimal? matchPercentage,
        int missingMandatoryCount,
        bool prohibitedRejected,
        bool usedSubstitutes,
        string? missingMandatoryIdsJson,
        string? additionalMetaJson,
        string? correlationId)
    {
        Id = id;
        CreatedAtUtc = DateTime.UtcNow;
        Flow = flow ?? string.Empty;
        ClientId = clientId;
        DietitianId = dietitianId;
        PlannedRecipeId = plannedRecipeId;
        SelectedRecipeId = selectedRecipeId;
        OriginalCookable = originalCookable;
        MatchPercentage = matchPercentage;
        MissingMandatoryCount = missingMandatoryCount;
        ProhibitedRejected = prohibitedRejected;
        UsedSubstitutes = usedSubstitutes;
        MissingMandatoryIdsJson = missingMandatoryIdsJson;
        AdditionalMetaJson = additionalMetaJson;
        CorrelationId = correlationId;
    }
}

