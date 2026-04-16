using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Infrastructure.Services;

public sealed class NullBarcodeIngredientResolutionService : IBarcodeIngredientResolutionService
{
    public Task<BarcodeResolutionResult> ResolveAsync(string barcode, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new BarcodeResolutionResult
        {
            SessionId = Guid.NewGuid(),
            Barcode = barcode?.Trim() ?? string.Empty,
            MappingType = MappingType.Unresolved,
            Confidence = 0,
            RequiresConfirmation = true,
            SourceProvider = "disabled"
        });
    }

    public Task<BarcodeResolutionResult> ResolveProductAsync(
        BarcodeProductContext productContext,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new BarcodeResolutionResult
        {
            SessionId = Guid.NewGuid(),
            Barcode = productContext.Barcode,
            ProductName = productContext.ProductName,
            Brand = productContext.Brand,
            MappingType = MappingType.Unresolved,
            Confidence = 0,
            RequiresConfirmation = true,
            SourceProvider = productContext.SourceProvider
        });
    }
}
