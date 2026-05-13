using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Benchmarks;

public class BenchmarkRunnerTests
{
    private sealed class FakeLlmClient : IIngredientLlmClient
    {
        private readonly Func<IReadOnlyList<LlmCandidateIngredient>, LlmIngredientMatchResult> _handler;

        public FakeLlmClient(Func<IReadOnlyList<LlmCandidateIngredient>, LlmIngredientMatchResult> handler)
        {
            _handler = handler;
        }

        public Task<LlmIngredientMatchResult> MatchAsync(
            string normalizedInput,
            IReadOnlyList<LlmCandidateIngredient> candidates,
            System.Threading.CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_handler(candidates));
        }
    }

    private sealed class StaticHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            return new HttpClient { BaseAddress = new Uri("https://example.test/") };
        }
    }

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

    private static async Task SeedAcquisitionAndHybridDataAsync(AppDbContext db)
    {
        var tomato = new Ingredient(Guid.NewGuid(), "Tomato");
        tomato.AddAlias("Domates");
        var egg = new Ingredient(Guid.NewGuid(), "Egg");
        egg.AddAlias("Yumurta");
        var banana = new Ingredient(Guid.NewGuid(), "Banana");
        banana.AddAlias("Muz");
        var cucumber = new Ingredient(Guid.NewGuid(), "Cucumber");
        cucumber.AddAlias("Salatalik");
        var yogurt = new Ingredient(Guid.NewGuid(), "Yogurt");
        yogurt.AddAlias("Yogurt");
        var milk = new Ingredient(Guid.NewGuid(), "Milk");
        milk.AddAlias("Sut");
        var oat = new Ingredient(Guid.NewGuid(), "Oat");
        oat.AddAlias("Yulaf");
        var cheese = new Ingredient(Guid.NewGuid(), "Cheese");
        cheese.AddAlias("Peynir");
        var tuna = new Ingredient(Guid.NewGuid(), "Tuna");
        tuna.AddAlias("Ton Baligi");

        db.Ingredients.AddRange(tomato, egg, banana, cucumber, yogurt, milk, oat, cheese, tuna);
        await db.SaveChangesAsync();

        var dietitianId = Guid.NewGuid();

        var recipeOmelette = new Recipe(Guid.NewGuid(), dietitianId, "recipe-omelette", "Omelette", isPublic: false);
        recipeOmelette.AddMandatoryIngredient(egg);
        recipeOmelette.AddMandatoryIngredient(tomato);

        var recipeSmoothie = new Recipe(Guid.NewGuid(), dietitianId, "recipe-smoothie", "Smoothie", isPublic: false);
        recipeSmoothie.AddMandatoryIngredient(banana);
        recipeSmoothie.AddMandatoryIngredient(yogurt);

        var recipeTunaSalad = new Recipe(Guid.NewGuid(), dietitianId, "recipe-tuna-salad", "Tuna Salad", isPublic: false);
        recipeTunaSalad.AddMandatoryIngredient(tuna);
        recipeTunaSalad.AddMandatoryIngredient(cucumber);

        var recipeOatBowl = new Recipe(Guid.NewGuid(), dietitianId, "recipe-oat-bowl", "Oat Bowl", isPublic: false);
        recipeOatBowl.AddMandatoryIngredient(milk);
        recipeOatBowl.AddMandatoryIngredient(oat);

        var recipeSalad = new Recipe(Guid.NewGuid(), dietitianId, "recipe-salad", "Salad", isPublic: false);
        recipeSalad.AddMandatoryIngredient(cheese);
        recipeSalad.AddMandatoryIngredient(tomato);

        db.Recipes.AddRange(recipeOmelette, recipeSmoothie, recipeTunaSalad, recipeOatBowl, recipeSalad);
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
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

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
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var datasetPath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory,
            "Benchmarks",
            "SampleDatasets",
            "ingredient-normalization-sample.json");

        File.Exists(datasetPath).Should().BeTrue(
            "ingredient-normalization-sample.json must be copied to the test output directory. " +
            "Ensure the .csproj includes: <None Include=\"Benchmarks\\SampleDatasets\\**\\*.json\" CopyToOutputDirectory=\"PreserveNewest\" />");

        var result = await runner.RunNormalizationBenchmarkAsync(datasetPath);

        // ── Shape ──────────────────────────────────────────────────────────────
        result.Should().NotBeNull();
        result.DatasetName.Should().Contain("Sample");
        result.DatasetVersion.Should().NotBeNullOrWhiteSpace();
        result.ExecutedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(30));
        result.Summary.TotalCases.Should().Be(60, "dataset v2.0 contains 60 cases");
        result.CaseResults.Should().HaveCount(result.Summary.TotalCases);

        // ── Correctness ────────────────────────────────────────────────────────
        // Deterministic correct: canonical (10) + alias (10) + ambiguous-unmatched (10) = 30.
        // Fuzzy/diacritic (20) should also pass, giving ~50 total.
        // LLM fallback (10) will be incorrect with NullIngredientLlmClient — intentional.
        // Floor of 38 gives comfortable headroom while proving the deterministic layers work.
        result.Summary.CorrectMatches.Should().BeGreaterThanOrEqualTo(38,
            "canonical, alias, and unmatched cases are deterministic; diacritic/fuzzy layers " +
            "should push the total above 38 correct out of 60");
        result.Summary.Accuracy.Should().BeGreaterThan(0.60,
            "at minimum 38/60 deterministic+fuzzy cases must pass, giving >63% accuracy " +
            "even without the LLM layer active");

        // ── Layer coverage ─────────────────────────────────────────────────────
        result.Summary.CanonicalMatchCount.Should().BeGreaterThanOrEqualTo(8,
            "dataset contains 10 canonical cases (can-001..010); most should reach Layer A");
        result.Summary.AliasMatchCount.Should().BeGreaterThanOrEqualTo(8,
            "dataset contains 10 alias cases (ali-001..010); most should reach Layer B");
        result.Summary.UnmatchedCount.Should().BeGreaterThanOrEqualTo(8,
            "dataset contains 10 ambiguous cases (amb-001..010) that must not match; " +
            "plus 10 LLM cases that fall through to unmatched without a real LLM client");

        // ── Per-difficulty breakdown ───────────────────────────────────────────
        result.Summary.PerDifficultyBreakdown.Should().NotBeNull();
        result.Summary.PerDifficultyBreakdown.Should().ContainKey("easy");
        result.Summary.PerDifficultyBreakdown.Should().ContainKey("medium");
        result.Summary.PerDifficultyBreakdown.Should().ContainKey("hard");
        result.Summary.PerDifficultyBreakdown!["easy"].TotalCases.Should().Be(10,
            "easy cases: can-001..010 (exact canonical matches)");
        result.Summary.PerDifficultyBreakdown!["medium"].TotalCases.Should().Be(30,
            "medium cases: ali-001..010 (alias) + dia-001..010 (diacritic) + fuz-001..010 (fuzzy)");
        result.Summary.PerDifficultyBreakdown!["hard"].TotalCases.Should().Be(20,
            "hard cases: amb-001..010 (ambiguous/unmatched) + llm-001..010 (LLM fallback)");
        result.Summary.PerDifficultyBreakdown!["easy"].Accuracy.Should().Be(1.0,
            "all easy (exact canonical) cases must be correct");

        // ── Case-level spot checks ─────────────────────────────────────────────
        result.CaseResults.Should().Contain(r => r.CaseId == "can-001" && r.IsCorrect,
            "exact canonical match 'Tomato' must be correct");
        result.CaseResults.Should().Contain(r => r.CaseId == "ali-001" && r.IsCorrect,
            "alias 'Domates' → Tomato must be correct");
        result.CaseResults.Should().Contain(r => r.CaseId == "amb-001" && r.IsCorrect,
            "ambiguous input below fuzzy threshold must correctly be unmatched");
        result.CaseResults.Should().Contain(r =>
            r.CaseId.StartsWith("fuz-") && r.IsCorrect,
            "at least one fuzzy case must pass");
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
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

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
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

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
    public async Task RunRecommendationBenchmark_WithDuplicateRecipeNames_DoesNotThrow()
    {
        await using var db = CreateDbContext();
        await SeedTestDataAsync(db);

        var duplicateDietitianId = Guid.NewGuid();
        var duplicateClinic = new Recipe(Guid.NewGuid(), duplicateDietitianId, "duplicate-name", "Clinic duplicate", isPublic: false);
        duplicateClinic.AddMandatoryIngredient(await db.Ingredients.FirstAsync(i => i.CanonicalName == "Tomato"));

        var duplicatePublic = new Recipe(Guid.NewGuid(), null, "duplicate-name", "Public duplicate", isPublic: true);
        duplicatePublic.AddMandatoryIngredient(await db.Ingredients.FirstAsync(i => i.CanonicalName == "Tomato"));

        db.Recipes.AddRange(duplicateClinic, duplicatePublic);
        await db.SaveChangesAsync();

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var dataset = new RecipeRecommendationBenchmarkDataset
        {
            Name = "Duplicate Recipe Name Dataset",
            Version = "1.0",
            Cases = new[]
            {
                new RecipeRecommendationBenchmarkCase
                {
                    Id = "dup-001",
                    Description = "duplicate names should resolve deterministically",
                    PlannedRecipeId = "duplicate-name",
                    AvailableCanonicalIngredients = new[] { "Tomato" },
                    ClientProhibitedCanonicalIngredients = Array.Empty<string>(),
                    ExpectedOriginalCookable = true,
                    ExpectedSelectedRecipeId = "duplicate-name",
                    AcceptableAlternativeRecipeIds = Array.Empty<string>()
                }
            }
        };

        var result = await runner.RunRecommendationBenchmarkAsync(dataset);

        result.CaseResults.Should().HaveCount(1);
        result.CaseResults[0].FailureReason.Should().NotContain("not found");
    }

    [Fact]
    public async Task RunRecommendationBenchmark_WithDuplicateCanonicalIngredients_DoesNotThrow()
    {
        await using var db = CreateDbContext();
        await SeedTestDataAsync(db);

        var duplicateTomato = new Ingredient(Guid.NewGuid(), "Tomato");
        db.Ingredients.Add(duplicateTomato);
        await db.SaveChangesAsync();

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var dataset = new RecipeRecommendationBenchmarkDataset
        {
            Name = "Duplicate Canonical Ingredient Dataset",
            Version = "1.0",
            Cases = new[]
            {
                new RecipeRecommendationBenchmarkCase
                {
                    Id = "dup-ing-001",
                    Description = "duplicate canonical ingredient rows should resolve deterministically",
                    PlannedRecipeId = "recipe-full-match",
                    AvailableCanonicalIngredients = new[] { "Tomato", "Onion", "Garlic" },
                    ClientProhibitedCanonicalIngredients = Array.Empty<string>(),
                    ExpectedOriginalCookable = true,
                    ExpectedSelectedRecipeId = "recipe-full-match",
                    AcceptableAlternativeRecipeIds = Array.Empty<string>(),
                    ExpectedReasonCategory = "full_match"
                }
            }
        };

        var result = await runner.RunRecommendationBenchmarkAsync(dataset);

        result.CaseResults.Should().HaveCount(1);
        result.CaseResults[0].FailureReason.Should().BeNull();
        result.CaseResults[0].ActualOriginalCookable.Should().BeTrue();
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
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

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

    [Fact]
    public async Task RunNormalizationBenchmarkComparison_WithConfiguredLlm_ReturnsOnOffDelta()
    {
        await using var db = CreateDbContext();
        await SeedTestDataAsync(db);

        var llmOptions = new LlmNormalizationOptions
        {
            Enabled = true,
            Provider = "openai",
            MinConfidenceToAccept = 0.75,
            MinConfidenceForAmbiguous = 0.50
        };

        var seededIngredients = await db.Ingredients.ToListAsync();
        var yogurtName = seededIngredients.Single(i => i.Aliases.Contains("Yogurt")).CanonicalName;

        var fakeLlm = new FakeLlmClient(candidates =>
        {
            var yogurtCandidate = candidates.First(c => c.CanonicalName == yogurtName);
            return LlmIngredientMatchResult.Match(yogurtCandidate.IngredientId, 0.88, "semantic fallback matched yogurt");
        });

        var normalizationService = new IngredientNormalizationService(
            db,
            fakeLlm,
            new IngredientLlmCandidateBuilder(db, llmOptions),
            llmOptions);
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService, llmOptions);

        var dataset = new IngredientNormalizationBenchmarkDataset
        {
            Name = "LLM Comparison Dataset",
            Version = "1.0",
            Cases = new[]
            {
                new IngredientNormalizationBenchmarkCase
                {
                    Id = "llm-001",
                    RawInput = "light yogurt bowl",
                    ExpectedCanonicalName = yogurtName,
                    ExpectedMatchType = "llm",
                    Difficulty = "hard"
                }
            }
        };

        var result = await runner.RunNormalizationBenchmarkComparisonAsync(dataset);

        result.LlmOff.LlmEnabled.Should().BeFalse();
        result.LlmOn.LlmEnabled.Should().BeTrue();
        result.LlmOff.Summary.LlmMatchCount.Should().Be(0);
        result.LlmOn.Summary.LlmMatchCount.Should().Be(1);
        result.Delta.LlmMatchDelta.Should().Be(1);
        result.Delta.LlmCorrectDelta.Should().Be(1);
        result.Delta.AccuracyDelta.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task RunMultimodalAcquisitionBenchmark_WithInMemoryDataset_ProducesPerSourceMetrics()
    {
        await using var db = CreateDbContext();
        await SeedAcquisitionAndHybridDataAsync(db);

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));
        var barcodeService = new BarcodeIngredientResolutionService(
            db,
            new StaticHttpClientFactory(),
            normalizationService,
            new OpenFoodFactsOptions { Enabled = false },
            NullLogger<BarcodeIngredientResolutionService>.Instance);

        var runner = new BenchmarkRunner(
            db,
            normalizationService,
            recommendationEngine,
            alternativeDecisionService,
            new LlmNormalizationOptions(),
            barcodeService,
            new VisionIngredientOptions
            {
                ClosedSetCanonicalNames = ["Tomato", "Banana"]
            });

        var dataset = new MultimodalAcquisitionBenchmarkDataset
        {
            Name = "Acquisition Test Dataset",
            Version = "1.0",
            Cases = new[]
            {
                new MultimodalAcquisitionBenchmarkCase
                {
                    Id = "text-001",
                    Source = "text",
                    RawInput = "Domates",
                    ExpectedCanonicalName = "Tomato",
                    ExpectedMappingType = "ExactIngredient",
                    ExpectedRequiresConfirmation = false,
                    ExpectedResolved = true
                },
                new MultimodalAcquisitionBenchmarkCase
                {
                    Id = "barcode-001",
                    Source = "barcode",
                    RawInput = "869000000001",
                    Barcode = "869000000001",
                    ProductName = "Ton Baligi Konservesi",
                    CategoriesText = "seafood, canned-fish",
                    ExpectedCanonicalName = "Tuna",
                    ExpectedMappingType = "IngredientFamily",
                    ExpectedRequiresConfirmation = true,
                    ExpectedResolved = true
                },
                new MultimodalAcquisitionBenchmarkCase
                {
                    Id = "vision-001",
                    Source = "vision",
                    RawInput = "muz",
                    ExpectedCanonicalName = "Banana",
                    ExpectedMappingType = "ExactIngredient",
                    ExpectedRequiresConfirmation = false,
                    ExpectedResolved = true
                },
                new MultimodalAcquisitionBenchmarkCase
                {
                    Id = "vision-002",
                    Source = "vision",
                    RawInput = "paket yogurt",
                    ExpectedCanonicalName = null,
                    ExpectedMappingType = "Unresolved",
                    ExpectedRequiresConfirmation = true,
                    ExpectedResolved = false
                }
            }
        };

        var result = await runner.RunMultimodalAcquisitionBenchmarkAsync(dataset);

        result.Summary.TotalCases.Should().Be(4);
        result.Summary.PerSource.Should().HaveCount(3);
        result.Summary.Top1CorrectCount.Should().BeGreaterThanOrEqualTo(3);
        result.CaseResults.Should().Contain(r => r.CaseId == "barcode-001" && r.ActualCanonicalName == "Tuna");
        result.CaseResults.Should().Contain(r => r.CaseId == "vision-002" && !r.ActualResolved);
    }

    [Fact]
    public async Task RunHybridRecipeBenchmark_WithInMemoryDataset_ComputesTop1AndHitAt3()
    {
        await using var db = CreateDbContext();
        await SeedAcquisitionAndHybridDataAsync(db);

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var recommendationEngine = new MyDietitianMobileApp.Infrastructure.Services.RecipeRecommendationEngine();
        var recipeRepository = new MyDietitianMobileApp.Infrastructure.Persistence.RecipeRepository(db);
        var alternativeDecisionService = new AlternativeMealDecisionService(db, recipeRepository, recommendationEngine, new IngredientTaxonomyService(db));

        var runner = new BenchmarkRunner(db, normalizationService, recommendationEngine, alternativeDecisionService);

        var dataset = new HybridRecipeBenchmarkDataset
        {
            Name = "Hybrid Recipe Dataset",
            Version = "1.0",
            Cases = new[]
            {
                new HybridRecipeBenchmarkCase
                {
                    Id = "hybrid-001",
                    Description = "Omelette ingredients",
                    AvailableCanonicalIngredients = new[] { "Tomato", "Egg" },
                    ExpectedTop1RecipeId = "recipe-omelette",
                    AcceptableTop3RecipeIds = new[] { "recipe-omelette", "recipe-salad" }
                },
                new HybridRecipeBenchmarkCase
                {
                    Id = "hybrid-002",
                    Description = "Tuna salad ingredients",
                    AvailableCanonicalIngredients = new[] { "Tuna", "Cucumber" },
                    ExpectedTop1RecipeId = "recipe-tuna-salad",
                    AcceptableTop3RecipeIds = new[] { "recipe-tuna-salad", "recipe-salad" }
                }
            }
        };

        var result = await runner.RunHybridRecipeBenchmarkAsync(dataset);

        result.Summary.TotalCases.Should().Be(2);
        result.Summary.Top1CorrectCount.Should().BeGreaterThanOrEqualTo(2);
        result.Summary.HitAt3Count.Should().BeGreaterThanOrEqualTo(2);
        result.CaseResults.Should().Contain(r => r.CaseId == "hybrid-001" && r.Top1Correct);
        result.CaseResults.Should().Contain(r => r.CaseId == "hybrid-002" && r.HitAt3);
    }
}
