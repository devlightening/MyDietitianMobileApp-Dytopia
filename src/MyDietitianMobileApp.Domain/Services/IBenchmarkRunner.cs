namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Benchmark/evaluation runner for thesis-grade metrics.
/// 
/// This service executes controlled test cases against the current deterministic
/// normalization and recommendation logic, producing reproducible metrics for analysis.
/// </summary>
public interface IBenchmarkRunner
{
    /// <summary>
    /// Execute ingredient normalization benchmark from a dataset file.
    /// </summary>
    Task<IngredientNormalizationBenchmarkResult> RunNormalizationBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Execute ingredient normalization benchmark from an in-memory dataset.
    /// </summary>
    Task<IngredientNormalizationBenchmarkResult> RunNormalizationBenchmarkAsync(
        IngredientNormalizationBenchmarkDataset dataset,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Execute the normalization benchmark twice: once with the deterministic baseline
    /// (LLM disabled) and once with the currently configured runtime pipeline.
    /// </summary>
    Task<IngredientNormalizationBenchmarkComparisonResult> RunNormalizationBenchmarkComparisonAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Execute the normalization benchmark twice: once with the deterministic baseline
    /// (LLM disabled) and once with the currently configured runtime pipeline.
    /// </summary>
    Task<IngredientNormalizationBenchmarkComparisonResult> RunNormalizationBenchmarkComparisonAsync(
        IngredientNormalizationBenchmarkDataset dataset,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Execute recipe recommendation benchmark from a dataset file.
    /// </summary>
    Task<RecipeRecommendationBenchmarkResult> RunRecommendationBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Execute recipe recommendation benchmark from an in-memory dataset.
    /// </summary>
    Task<RecipeRecommendationBenchmarkResult> RunRecommendationBenchmarkAsync(
        RecipeRecommendationBenchmarkDataset dataset,
        CancellationToken cancellationToken = default);

    Task<MultimodalAcquisitionBenchmarkResult> RunMultimodalAcquisitionBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default);

    Task<MultimodalAcquisitionBenchmarkResult> RunMultimodalAcquisitionBenchmarkAsync(
        MultimodalAcquisitionBenchmarkDataset dataset,
        CancellationToken cancellationToken = default);

    Task<HybridRecipeBenchmarkResult> RunHybridRecipeBenchmarkAsync(
        string datasetFilePath,
        CancellationToken cancellationToken = default);

    Task<HybridRecipeBenchmarkResult> RunHybridRecipeBenchmarkAsync(
        HybridRecipeBenchmarkDataset dataset,
        CancellationToken cancellationToken = default);
}
