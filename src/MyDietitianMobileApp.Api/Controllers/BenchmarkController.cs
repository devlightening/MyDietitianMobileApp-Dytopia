using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Api.Controllers;

[ApiController]
[Route("api/dev/benchmark")]
[ApiExplorerSettings(GroupName = "dev")]
public class BenchmarkController : ControllerBase
{
    private readonly IBenchmarkRunner _runner;
    private readonly IWebHostEnvironment _env;

    public BenchmarkController(IBenchmarkRunner runner, IWebHostEnvironment env)
    {
        _runner = runner;
        _env = env;
    }

    [HttpGet("normalization")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> RunNormalizationBenchmark(CancellationToken cancellationToken)
    {
        if (_env.IsProduction())
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Benchmark endpoints are disabled in Production." });

        var datasetPath = ResolveDatasetPath("ingredient-normalization-sample.json");
        if (datasetPath == null)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark dataset not found.",
                hint = "Ensure 'ingredient-normalization-sample.json' is deployed alongside the API binary."
            });

        try
        {
            var result = await _runner.RunNormalizationBenchmarkAsync(datasetPath, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark execution failed.",
                details = ex.Message
            });
        }
    }

    [HttpGet("normalization/llm-compare")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> RunNormalizationLlmComparison(CancellationToken cancellationToken)
    {
        if (_env.IsProduction())
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Benchmark endpoints are disabled in Production." });

        var datasetPath = ResolveDatasetPath("ingredient-normalization-sample.json");
        if (datasetPath == null)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark dataset not found.",
                hint = "Ensure 'ingredient-normalization-sample.json' is deployed alongside the API binary."
            });

        try
        {
            var result = await _runner.RunNormalizationBenchmarkComparisonAsync(datasetPath, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark comparison execution failed.",
                details = ex.Message
            });
        }
    }

    [HttpGet("recommendation")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> RunRecommendationBenchmark(CancellationToken cancellationToken)
    {
        if (_env.IsProduction())
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Benchmark endpoints are disabled in Production." });

        var datasetPath = ResolveDatasetPath("recipe-recommendation-sample.json");
        if (datasetPath == null)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark dataset not found.",
                hint = "Ensure 'recipe-recommendation-sample.json' is deployed alongside the API binary."
            });

        try
        {
            var result = await _runner.RunRecommendationBenchmarkAsync(datasetPath, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark execution failed.",
                details = ex.Message
            });
        }
    }

    [HttpGet("acquisition")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> RunAcquisitionBenchmark(CancellationToken cancellationToken)
    {
        if (_env.IsProduction())
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Benchmark endpoints are disabled in Production." });

        var datasetPath = ResolveDatasetPath("multimodal-acquisition-sample.json");
        if (datasetPath == null)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark dataset not found.",
                hint = "Ensure 'multimodal-acquisition-sample.json' is deployed alongside the API binary."
            });

        try
        {
            var result = await _runner.RunMultimodalAcquisitionBenchmarkAsync(datasetPath, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark execution failed.",
                details = ex.Message
            });
        }
    }

    [HttpGet("hybrid-recipe")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> RunHybridRecipeBenchmark(CancellationToken cancellationToken)
    {
        if (_env.IsProduction())
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Benchmark endpoints are disabled in Production." });

        var datasetPath = ResolveDatasetPath("hybrid-recipe-sample.json");
        if (datasetPath == null)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark dataset not found.",
                hint = "Ensure 'hybrid-recipe-sample.json' is deployed alongside the API binary."
            });

        try
        {
            var result = await _runner.RunHybridRecipeBenchmarkAsync(datasetPath, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Benchmark execution failed.",
                details = ex.Message
            });
        }
    }

    private string? ResolveDatasetPath(string fileName)
    {
        var candidates = new[]
        {
            Path.Combine(_env.ContentRootPath, "Benchmarks", "SampleDatasets", fileName),
            Path.Combine(AppContext.BaseDirectory, "Benchmarks", "SampleDatasets", fileName),
            Path.Combine(AppContext.BaseDirectory, fileName),
        };

        return candidates.FirstOrDefault(System.IO.File.Exists);
    }
}
