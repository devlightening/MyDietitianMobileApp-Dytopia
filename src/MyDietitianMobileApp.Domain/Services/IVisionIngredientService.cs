namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Sends a food image to a vision model and returns raw detected food names.
/// Contract: never throws — returns <see cref="VisionDetectionResult.Empty"/> on any failure.
/// </summary>
public interface IVisionIngredientService
{
    /// <summary>
    /// Returns the current availability state of the feature.
    /// Call this before <see cref="DetectFoodNamesAsync"/> to surface
    /// config problems to the caller without making a network request.
    /// </summary>
    VisionFeatureStatus GetStatus();

    /// <param name="base64Image">Base64-encoded image bytes (no data URI prefix).</param>
    /// <param name="mediaType">MIME type: "image/jpeg" | "image/png" | "image/webp"</param>
    Task<VisionDetectionResult> DetectFoodNamesAsync(
        string base64Image,
        string mediaType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads a market receipt image and extracts pantry-worthy ingredient/product names.
    /// Contract: never throws — returns <see cref="VisionDetectionResult.Empty"/> on failure.
    /// </summary>
    Task<VisionDetectionResult> DetectReceiptItemsAsync(
        string base64Image,
        string mediaType,
        CancellationToken cancellationToken = default);
}
