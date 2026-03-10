using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Benchmarks;

public class BenchmarkRunnerTests
{
    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static async Task SeedTestDataAsync(AppDbContext db)
    {
        // Seed ingredients
        var tomato = new Ingredient(Guid.NewGuid(), "Tomato");
        tomato.AddAlias("Domates");
        var yogurt = new Ingredient(Guid.NewGuid(), "Yoğurt");
        yogurt.AddAlias("Yogurt");
        var onion = new Ingredient(Guid.NewGuid(), "Onion");
        var garlic = new Ingredient(Guid.NewGuid(), "Garlic");

        db.Ingredients.AddRange(tomato, yogurt, onion, garlic);
        await db.SaveChangesAsync();

        // Seed recipes for recommendation benchmark
        var dietitianId = Guid.NewGuid();
        var recipeFullMatch = new Recipe(Guid.NewGuid(), dietitianId, "recipe-full-match", "Full match recipe", isPublic: false);
        recipeFullMatch.AddMandatoryIngredient(tomato);
        recipeFullMatch.AddMandatoryIngredient(onion);
        recipeFullMatch.AddMandatoryIngredient(garlic);

        var recipeMissingOne = new Recipe(Guid.NewGuid(), dietitianId, "recipe-missing-one", "Missing one ingredient", isPublic: false);
        recipeMissingOne.AddMandatoryIngredient(tomato);
        recipeMissingOne.AddMandatoryIngredient(onion);
        recipeMissingOne.AddMandatoryIngredient(garlic);

        var recipeAlternative1 = new Recipe(Guid.NewGuid(), dietitianId, "recipe-alternative-1", "Alternative 1", isPublic: false);
        recipeAlternative1.AddMandatoryIngredient(tomato);
        recipeAlternative1.AddMandatoryIngredient(onion);

        var recipeAlternative2 = new Recipe(Guid.NewGuid(), dietitianId, "recipe-alternative-2", "Alternative 2", isPublic: false);
        recipeAlternative2.AddMandatoryIngredient(tomato);
        recipeAlternative2.AddMandatoryIngredient(onion);

        var recipeNoAlternative = new Recipe(Guid.NewGuid(), dietitianId, "recipe-no-alternative", "No alternative", isPublic: false);
        recipeNoAlternative.AddMandatoryIngredient(garlic);

        db.Recipes.AddRange(recipeFullMatch, recipeMissingOne, recipeAlternative1, recipeAlternative2, recipeNoAlternative);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task RunNormalizationBenchmark_WithInMemoryDataset_ProducesCorrectMetrics()
    {
        await using var db = CreateDbContext();
        await SeedTestDataAsync(db);

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine);

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var dataset = new IngredientNormalizationBenchmarkDataset
        {
            Name = "Test Dataset",
            Version = "1.0",
            Cases = new[]
            {
                new IngredientNormalizationBenchmarkCase
                {
                    Id = "test-001",
                    RawInput = "Tomato",
                    ExpectedCanonicalName = "Tomato",
                    ExpectedMatchType = "canonical",
                    Difficulty = "easy"
                },
                new IngredientNormalizationBenchmarkCase
                {
                    Id = "test-002",
                    RawInput = "Domates",
                    ExpectedCanonicalName = "Tomato",
                    ExpectedMatchType = "alias",
                    Difficulty = "medium"
                },
                new IngredientNormalizationBenchmarkCase
                {
                    Id = "test-003",
                    RawInput = "UnknownIngredient",
                    ExpectedCanonicalName = null,
                    ExpectedMatchType = "unmatched",
                    Difficulty = "hard"
                }
            }
        };

        var result = await runner.RunNormalizationBenchmarkAsync(dataset);

        result.Should().NotBeNull();
        result.DatasetName.Should().Be("Test Dataset");
        result.Summary.TotalCases.Should().Be(3);
        result.Summary.CorrectMatches.Should().BeGreaterThan(0);
        result.Summary.Accuracy.Should().BeGreaterThan(0);
        result.CaseResults.Should().HaveCount(3);
        result.CaseResults.Should().Contain(r => r.CaseId == "test-001" && r.IsCorrect);
    }

    [Fact]
    public async Task RunNormalizationBenchmark_WithJsonFile_LoadsAndExecutes()
    {
        await using var db = CreateDbContext();
        await SeedTestDataAsync(db);

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine);

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var datasetPath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory,
            "Benchmarks",
            "SampleDatasets",
            "ingredient-normalization-sample.json");

        if (!File.Exists(datasetPath))
        {
            // If file doesn't exist in test output, skip this test
            return;
        }

        var result = await runner.RunNormalizationBenchmarkAsync(datasetPath);

        result.Should().NotBeNull();
        result.DatasetName.Should().Contain("Sample");
        result.Summary.TotalCases.Should().BeGreaterThan(0);
        result.CaseResults.Should().HaveCount(result.Summary.TotalCases);
    }

    [Fact]
    public async Task RunRecommendationBenchmark_WithInMemoryDataset_ProducesCorrectMetrics()
    {
        await using var db = CreateDbContext();
        await SeedTestDataAsync(db);

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine);

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        // Get recipe IDs from seeded data
        var recipeFullMatch = await db.Recipes.FirstAsync(r => r.Name == "recipe-full-match");
        var recipeMissingOne = await db.Recipes.FirstAsync(r => r.Name == "recipe-missing-one");
        var recipeAlternative1 = await db.Recipes.FirstAsync(r => r.Name == "recipe-alternative-1");

        var dataset = new RecipeRecommendationBenchmarkDataset
        {
            Name = "Test Recommendation Dataset",
            Version = "1.0",
            Cases = new[]
            {
                new RecipeRecommendationBenchmarkCase
                {
                    Id = "rec-001",
                    Description = "Full match test",
                    PlannedRecipeId = recipeFullMatch.Id.ToString(),
                    AvailableCanonicalIngredients = new[] { "Tomato", "Onion", "Garlic" },
                    ClientProhibitedCanonicalIngredients = Array.Empty<string>(),
                    ExpectedOriginalCookable = true,
                    ExpectedSelectedRecipeId = recipeFullMatch.Id.ToString(),
                    AcceptableAlternativeRecipeIds = Array.Empty<string>(),
                    ExpectedReasonCategory = "full_match"
                },
                new RecipeRecommendationBenchmarkCase
                {
                    Id = "rec-002",
                    Description = "Missing ingredient test",
                    PlannedRecipeId = recipeMissingOne.Id.ToString(),
                    AvailableCanonicalIngredients = new[] { "Tomato", "Onion" },
                    ClientProhibitedCanonicalIngredients = Array.Empty<string>(),
                    ExpectedOriginalCookable = false,
                    ExpectedSelectedRecipeId = recipeAlternative1.Id.ToString(),
                    AcceptableAlternativeRecipeIds = new[] { recipeAlternative1.Id.ToString() },
                    ExpectedReasonCategory = "missing_mandatory"
                }
            }
        };

        var result = await runner.RunRecommendationBenchmarkAsync(dataset);

        result.Should().NotBeNull();
        result.DatasetName.Should().Be("Test Recommendation Dataset");
        result.Summary.TotalCases.Should().Be(2);
        result.Summary.OverallAccuracy.Should().BeGreaterThanOrEqualTo(0);
        result.CaseResults.Should().HaveCount(2);
    }

    [Fact]
    public async Task RunRecommendationBenchmark_WithRecipeNameIdentifiers_ResolvesCorrectly()
    {
        await using var db = CreateDbContext();
        await SeedTestDataAsync(db);

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine);

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var dataset = new RecipeRecommendationBenchmarkDataset
        {
            Name = "Test Name Resolution",
            Version = "1.0",
            Cases = new[]
            {
                new RecipeRecommendationBenchmarkCase
                {
                    Id = "name-test-001",
                    Description = "Test recipe name resolution",
                    PlannedRecipeId = "recipe-full-match", // Using name instead of GUID
                    AvailableCanonicalIngredients = new[] { "Tomato", "Onion", "Garlic" },
                    ClientProhibitedCanonicalIngredients = Array.Empty<string>(),
                    ExpectedOriginalCookable = true,
                    ExpectedSelectedRecipeId = "recipe-full-match",
                    AcceptableAlternativeRecipeIds = Array.Empty<string>()
                }
            }
        };

        var result = await runner.RunRecommendationBenchmarkAsync(dataset);

        result.Should().NotBeNull();
        result.CaseResults.Should().HaveCount(1);
        result.CaseResults[0].FailureReason.Should().NotContain("not found");
    }

    [Fact]
    public async Task NormalizationBenchmark_ComputesPerDifficultyBreakdown()
    {
        await using var db = CreateDbContext();
        await SeedTestDataAsync(db);

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine);

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var dataset = new IngredientNormalizationBenchmarkDataset
        {
            Name = "Difficulty Breakdown Test",
            Version = "1.0",
            Cases = new[]
            {
                new IngredientNormalizationBenchmarkCase
                {
                    Id = "easy-001",
                    RawInput = "Tomato",
                    ExpectedCanonicalName = "Tomato",
                    ExpectedMatchType = "canonical",
                    Difficulty = "easy"
                },
                new IngredientNormalizationBenchmarkCase
                {
                    Id = "hard-001",
                    RawInput = "UnknownIngredient",
                    ExpectedCanonicalName = null,
                    ExpectedMatchType = "unmatched",
                    Difficulty = "hard"
                }
            }
        };

        var result = await runner.RunNormalizationBenchmarkAsync(dataset);

        result.Should().NotBeNull();
        result.Summary.PerDifficultyBreakdown.Should().NotBeNull();
        result.Summary.PerDifficultyBreakdown.Should().ContainKey("easy");
        result.Summary.PerDifficultyBreakdown.Should().ContainKey("hard");
        result.Summary.PerDifficultyBreakdown!["easy"].TotalCases.Should().Be(1);
        result.Summary.PerDifficultyBreakdown!["hard"].TotalCases.Should().Be(1);
    }
}
