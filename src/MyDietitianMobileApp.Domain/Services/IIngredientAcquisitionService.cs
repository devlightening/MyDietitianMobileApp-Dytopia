using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Services;

public sealed class IngredientAcquisitionSelection
{
    public Guid IngredientId { get; init; }
    public MappingType MappingType { get; init; }
    public double Confidence { get; init; }
}

public sealed class IngredientAcquisitionLogRequest
{
    public Guid SessionId { get; init; }
    public AcquisitionSource Source { get; init; }
    public string RawInput { get; init; } = string.Empty;
    public IReadOnlyList<IngredientAcquisitionSelection> SelectedIngredients { get; init; } = Array.Empty<IngredientAcquisitionSelection>();
    public MappingType MappingType { get; init; } = MappingType.Unresolved;
    public bool RequiredConfirmation { get; init; }
    public bool ConfirmedByUser { get; init; }
    public int InteractionCount { get; init; }
    public long LatencyMs { get; init; }
    public DateTime StartedAtUtc { get; init; }
    public DateTime? CompletedAtUtc { get; init; }
    public string? ProductName { get; init; }
    public string? Brand { get; init; }
}

public interface IIngredientAcquisitionService
{
    Task<Guid> LogAsync(IngredientAcquisitionLogRequest request, CancellationToken cancellationToken = default);
}
