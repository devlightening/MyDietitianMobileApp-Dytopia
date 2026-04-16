using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Cache of resolved barcode -> canonical ingredient mappings.
/// Supports both deterministic seed rows and confirmed manual overrides.
/// </summary>
public class ProductBarcodeMapping
{
    public Guid Id { get; private set; }
    public string Barcode { get; private set; } = string.Empty;
    public string ProductName { get; private set; } = string.Empty;
    public string? Brand { get; private set; }
    public Guid? CanonicalIngredientId { get; private set; }
    public Ingredient? CanonicalIngredient { get; private set; }
    public MappingType MappingType { get; private set; }
    public double Confidence { get; private set; }
    public string SourceProvider { get; private set; } = string.Empty;
    public bool IsManualOverride { get; private set; }
    public DateTime LastVerifiedAtUtc { get; private set; }

    private ProductBarcodeMapping() { } // EF Core

    public ProductBarcodeMapping(
        Guid id,
        string barcode,
        string productName,
        string? brand,
        Guid? canonicalIngredientId,
        MappingType mappingType,
        double confidence,
        string sourceProvider,
        bool isManualOverride,
        DateTime? lastVerifiedAtUtc = null)
    {
        Id = id;
        Barcode = barcode?.Trim() ?? string.Empty;
        ProductName = productName?.Trim() ?? string.Empty;
        Brand = string.IsNullOrWhiteSpace(brand) ? null : brand.Trim();
        CanonicalIngredientId = canonicalIngredientId;
        MappingType = mappingType;
        Confidence = Math.Clamp(confidence, 0, 1);
        SourceProvider = sourceProvider?.Trim() ?? string.Empty;
        IsManualOverride = isManualOverride;
        LastVerifiedAtUtc = lastVerifiedAtUtc ?? DateTime.UtcNow;
    }

    public void UpdateResolution(
        string productName,
        string? brand,
        Guid? canonicalIngredientId,
        MappingType mappingType,
        double confidence,
        string sourceProvider,
        bool isManualOverride,
        DateTime? lastVerifiedAtUtc = null)
    {
        ProductName = productName?.Trim() ?? ProductName;
        Brand = string.IsNullOrWhiteSpace(brand) ? null : brand.Trim();
        CanonicalIngredientId = canonicalIngredientId;
        MappingType = mappingType;
        Confidence = Math.Clamp(confidence, 0, 1);
        SourceProvider = sourceProvider?.Trim() ?? SourceProvider;
        IsManualOverride = isManualOverride;
        LastVerifiedAtUtc = lastVerifiedAtUtc ?? DateTime.UtcNow;
    }
}
