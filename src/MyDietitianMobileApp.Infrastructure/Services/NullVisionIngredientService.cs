using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// No-op implementation registered when VisionIngredient.Enabled = false.
/// Always reports <see cref="VisionFeatureStatus.Disabled"/> so callers
/// can surface a meaningful message instead of silently returning empty results.
/// </summary>
public sealed class NullVisionIngredientService : IVisionIngredientService
{
    public VisionFeatureStatus GetStatus() => VisionFeatureStatus.Disabled;

    public Task<VisionDetectionResult> DetectFoodNamesAsync(
        string base64Image,
        string mediaType,
        CancellationToken cancellationToken = default)
        => Task.FromResult(VisionDetectionResult.Empty);
}
