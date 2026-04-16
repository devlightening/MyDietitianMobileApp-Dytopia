using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Services;

public sealed class IngredientAcquisitionCandidate
{
    public Guid IngredientId { get; init; }
    public string CanonicalName { get; init; } = string.Empty;
    public MappingType MappingType { get; init; }
    public double Confidence { get; init; }
    public string SourceProvider { get; init; } = string.Empty;
    public bool RequiresConfirmation { get; init; }
}

public sealed class BarcodeProductContext
{
    public string Barcode { get; init; } = string.Empty;
    public string? ProductName { get; init; }
    public string? Brand { get; init; }
    public string? CategoriesText { get; init; }
    public string SourceProvider { get; init; } = "unknown";
}

public sealed class BarcodeResolutionResult
{
    public Guid SessionId { get; init; }
    public string Barcode { get; init; } = string.Empty;
    public string? ProductName { get; init; }
    public string? Brand { get; init; }
    public MappingType MappingType { get; init; }
    public double Confidence { get; init; }
    public bool RequiresConfirmation { get; init; }
    public string SourceProvider { get; init; } = string.Empty;
    public IReadOnlyList<IngredientAcquisitionCandidate> Candidates { get; init; } = Array.Empty<IngredientAcquisitionCandidate>();
}

public interface IBarcodeIngredientResolutionService
{
    Task<BarcodeResolutionResult> ResolveAsync(string barcode, CancellationToken cancellationToken = default);

    Task<BarcodeResolutionResult> ResolveProductAsync(
        BarcodeProductContext productContext,
        CancellationToken cancellationToken = default);
}
