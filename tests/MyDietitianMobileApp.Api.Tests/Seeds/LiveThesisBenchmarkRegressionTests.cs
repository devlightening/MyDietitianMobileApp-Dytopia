using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;
using Xunit.Abstractions;

namespace MyDietitianMobileApp.Api.Tests.Seeds;

public sealed class LiveThesisBenchmarkRegressionTests
{
    private readonly ITestOutputHelper _output;

    public LiveThesisBenchmarkRegressionTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    [Trait("Category", "LiveDb")]
    public async Task LiveThesisBenchmarkDatasets_Should_Run_Against_Seeded_Postgres_And_Produce_Report()
    {
        var repoRoot = FindRepoRoot(AppContext.BaseDirectory);
        var settingsPath = Path.Combine(repoRoot, "src", "MyDietitianMobileApp.Api", "appsettings.Development.json");

        File.Exists(settingsPath).Should().BeTrue();

        using var settings = JsonDocument.Parse(await File.ReadAllTextAsync(settingsPath));
        var appDb = settings.RootElement
            .GetProperty("ConnectionStrings")
            .GetProperty("AppDb")
            .GetString();

        appDb.Should().NotBeNullOrWhiteSpace();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(appDb)
            .Options;

        await using var db = new AppDbContext(options);
        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new RecipeRecommendationEngine();
        var recipeRepository = new RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));
        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var normalizationDatasetPath = Path.Combine(
            repoRoot,
            "src",
            "MyDietitianMobileApp.Api",
            "Benchmarks",
            "SampleDatasets",
            "ingredient-normalization-sample.json");

        var recommendationDatasetPath = Path.Combine(
            repoRoot,
            "src",
            "MyDietitianMobileApp.Api",
            "Benchmarks",
            "SampleDatasets",
            "recipe-recommendation-sample.json");

        var acquisitionDatasetPath = Path.Combine(
            repoRoot,
            "src",
            "MyDietitianMobileApp.Api",
            "Benchmarks",
            "SampleDatasets",
            "multimodal-acquisition-sample.json");

        var hybridRecipeDatasetPath = Path.Combine(
            repoRoot,
            "src",
            "MyDietitianMobileApp.Api",
            "Benchmarks",
            "SampleDatasets",
            "hybrid-recipe-sample.json");

        File.Exists(normalizationDatasetPath).Should().BeTrue();
        File.Exists(recommendationDatasetPath).Should().BeTrue();
        File.Exists(acquisitionDatasetPath).Should().BeTrue();
        File.Exists(hybridRecipeDatasetPath).Should().BeTrue();

        var normalization = await runner.RunNormalizationBenchmarkAsync(normalizationDatasetPath);
        var recommendation = await runner.RunRecommendationBenchmarkAsync(recommendationDatasetPath);
        var acquisition = await runner.RunMultimodalAcquisitionBenchmarkAsync(acquisitionDatasetPath);
        var hybridRecipe = await runner.RunHybridRecipeBenchmarkAsync(hybridRecipeDatasetPath);

        var report = new
        {
            generatedAtUtc = DateTime.UtcNow,
            normalization = new
            {
                normalization.DatasetName,
                normalization.DatasetVersion,
                normalization.Summary,
                failures = normalization.CaseResults
                    .Where(r => !r.IsCorrect)
                    .Select(r => new
                    {
                        r.CaseId,
                        r.RawInput,
                        r.ExpectedCanonicalName,
                        r.ActualCanonicalName,
                        r.ExpectedMatchType,
                        r.ActualMatchType,
                        r.FailureReason
                    })
                    .ToArray()
            },
            recommendation = new
            {
                recommendation.DatasetName,
                recommendation.DatasetVersion,
                recommendation.Summary,
                failures = recommendation.CaseResults
                    .Where(r => !r.IsCorrect)
                    .Select(r => new
                    {
                        r.CaseId,
                        r.Description,
                        r.ExpectedOriginalCookable,
                        r.ActualOriginalCookable,
                        r.ExpectedSelectedRecipeId,
                        r.ActualSelectedRecipeId,
                        r.ExpectedReasonCategory,
                        r.ActualReasonCategory,
                        r.FailureReason
                    })
                    .ToArray()
            },
            acquisition = new
            {
                acquisition.DatasetName,
                acquisition.DatasetVersion,
                acquisition.Summary
            },
            hybridRecipe = new
            {
                hybridRecipe.DatasetName,
                hybridRecipe.DatasetVersion,
                hybridRecipe.Summary
            }
        };

        var reportJson = JsonSerializer.Serialize(report, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        var reportDirectory = Path.Combine(repoRoot, ".tmp");
        Directory.CreateDirectory(reportDirectory);
        var reportPath = Path.Combine(reportDirectory, "live-thesis-benchmark-report.json");
        await File.WriteAllTextAsync(reportPath, reportJson);

        _output.WriteLine(reportJson);
        _output.WriteLine($"Report written to: {reportPath}");

        normalization.Summary.TotalCases.Should().Be(40);
        normalization.Summary.Accuracy.Should().BeGreaterThan(0.75);
        recommendation.Summary.TotalCases.Should().Be(10);
        recommendation.Summary.OverallAccuracy.Should().BeGreaterThan(0.60);
        acquisition.Summary.TotalCases.Should().Be(260);
        hybridRecipe.Summary.TotalCases.Should().Be(40);
    }

    private static string FindRepoRoot(string startPath)
    {
        var directory = new DirectoryInfo(startPath);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "MyDietitianMobileApp.sln")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Repository root could not be found.");
    }
}
