using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Per-acquisition telemetry record used for thesis metrics and benchmark validation.
/// One acquisition session may emit multiple rows when a single action resolves multiple ingredients.
/// </summary>
public class IngredientAcquisitionLog
{
    public Guid Id { get; private set; }
    public Guid SessionId { get; private set; }
    public AcquisitionSource Source { get; private set; }
    public string RawInput { get; private set; } = string.Empty;
    public Guid? ResolvedIngredientId { get; private set; }
    public Ingredient? ResolvedIngredient { get; private set; }
    public MappingType MappingType { get; private set; }
    public double Confidence { get; private set; }
    public bool RequiredConfirmation { get; private set; }
    public bool ConfirmedByUser { get; private set; }
    public int InteractionCount { get; private set; }
    public long LatencyMs { get; private set; }
    public DateTime StartedAtUtc { get; private set; }
    public DateTime CompletedAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    private IngredientAcquisitionLog() { } // EF Core

    public IngredientAcquisitionLog(
        Guid id,
        Guid sessionId,
        AcquisitionSource source,
        string rawInput,
        Guid? resolvedIngredientId,
        MappingType mappingType,
        double confidence,
        bool requiredConfirmation,
        bool confirmedByUser,
        int interactionCount,
        long latencyMs,
        DateTime startedAtUtc,
        DateTime? completedAtUtc = null)
    {
        Id = id;
        SessionId = sessionId;
        Source = source;
        RawInput = rawInput?.Trim() ?? string.Empty;
        ResolvedIngredientId = resolvedIngredientId;
        MappingType = mappingType;
        Confidence = Math.Clamp(confidence, 0, 1);
        RequiredConfirmation = requiredConfirmation;
        ConfirmedByUser = confirmedByUser;
        InteractionCount = Math.Max(0, interactionCount);
        LatencyMs = Math.Max(0, latencyMs);
        StartedAtUtc = startedAtUtc;
        CompletedAtUtc = completedAtUtc ?? DateTime.UtcNow;
        CreatedAtUtc = DateTime.UtcNow;
    }
}
