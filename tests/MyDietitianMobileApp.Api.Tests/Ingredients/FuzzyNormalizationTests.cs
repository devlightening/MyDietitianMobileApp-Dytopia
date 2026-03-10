using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;
using Xunit.Abstractions;

namespace MyDietitianMobileApp.Api.Tests.Ingredients;

/// <summary>
/// Focused unit / integration tests for the fuzzy ingredient matching layer.
/// Uses an in-memory EF database pre-seeded with a specific ingredient corpus.
/// Tests are deterministic and fully self-contained (no external DB required).
/// </summary>
public class FuzzyNormalizationTests
{
    private readonly ITestOutputHelper _output;

    public FuzzyNormalizationTests(ITestOutputHelper output)
    {
        _output = output;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private static async Task<(AppDbContext db, IngredientNormalizationService svc)> CreateAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        // Seed a representative ingredient corpus
        var ingredients = new[]
        {
            ("Yoğurt",            new[] { "yogurt", "süt yoğurdu" }),
            ("Meyveli Yoğurt",    new[] { "meyveli yogurt", "aromalı yoğurt" }),
            ("Süzme Yoğurt",      new[] { "krem yoğurt" }),
            ("Laktozsuz Yoğurt",  new[] { "laktoz-free yoğurt" }),
            ("Süt",               new[] { "inek sütü", "tam yağlı süt" }),
            ("Laktozsuz Süt",     new[] { "laktoz-free süt" }),
            ("Zeytinyağı",        new[] { "sızma zeytinyağı", "extravirgin zeytinyağı" }),
            ("Karabiber",         new[] { "siyah biber", "taze öğütülmüş biber" }),
            ("Ton Balığı",        new[] { "konserve ton balığı", "su da ton balığı" }),
            ("Tavuk Göğsü",       new[] { "haşlanmış tavuk", "ızgara tavuk göğsü" }),
            ("Domates",           new[] { "cherry domates", "konserve domates" }),
            ("Havuç",             new[] { "taze havuç", "organik havuç" }),
            ("Elma",              new[] { "kırmızı elma", "yeşil elma" }),
            ("Pirinç",            new[] { "beyaz pirinç", "uzun taneli pirinç" }),
        };

        foreach (var (name, aliases) in ingredients)
        {
            var ing = new MyDietitianMobileApp.Domain.Entities.Ingredient(Guid.NewGuid(), name, isActive: true);
            foreach (var alias in aliases) ing.AddAlias(alias);
            db.Ingredients.Add(ing);
        }

        await db.SaveChangesAsync();
        var svc = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        return (db, svc);
    }

    // ─── FuzzyStringMatcher unit tests (no DB needed) ──────────────────────────

    [Theory]
    [InlineData("yogurt",     "yogurt",  1.0)]
    [InlineData("yogrt",      "yogurt",  0.80)]
    [InlineData("yogut",      "yogurt",  0.80)]
    [InlineData("zeytinyagi", "zeytinyagi", 1.0)]
    [InlineData("x",          "zeytinyagi", 0.0)]
    public void FuzzyMatcher_Similarity_ReturnsExpectedRange(string a, string b, double expectedMin)
    {
        var sim = FuzzyIngredientMatcher.Similarity(a, b);
        _output.WriteLine($"Similarity('{a}', '{b}') = {sim:F4}");
        Assert.True(sim >= expectedMin, $"Expected >= {expectedMin}, got {sim:F4}");
    }

    [Theory]
    [InlineData("yoğurt", "yogurt")]   // ğ → g
    [InlineData("süt",    "sut")]      // ü → u
    [InlineData("şeker",  "seker")]    // ş → s
    [InlineData("çay",    "cay")]      // ç → c
    [InlineData("kasar",  "kasar")]    // already ASCII
    public void TurkishFold_StripsExpectedDiacritics(string input, string expected)
    {
        var folded = FuzzyIngredientMatcher.TurkishFold(input);
        _output.WriteLine($"TurkishFold('{input}') = '{folded}'");
        Assert.Equal(expected, folded);
    }

    // ─── Full normalization pipeline tests ─────────────────────────────────────

    [Fact]
    public async Task FuzzyLayer_TypoInput_MatchesYogurt()
    {
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("yogrt");
        _output.WriteLine($"Input: yogrt → {result.MatchedCanonicalName} ({result.MatchedBy}, conf={result.Confidence})");
        _output.WriteLine($"Explanation: {result.Explanation}");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal(IngredientMatchedBy.Fuzzy, result.MatchedBy);
        Assert.Equal("Yoğurt", result.MatchedCanonicalName);
        Assert.True(result.Confidence >= 0.65 && result.Confidence < 0.95,
            $"Fuzzy confidence should be < 0.95 (alias) but got {result.Confidence}");
    }

    [Fact]
    public async Task FuzzyLayer_AnotherTypo_MatchesYogurt()
    {
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("yogut");
        _output.WriteLine($"Input: yogut → {result.MatchedCanonicalName} ({result.MatchedBy})");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal("Yoğurt", result.MatchedCanonicalName);
        Assert.True(result.Confidence < 0.95);
    }

    [Fact]
    public async Task FuzzyLayer_MissingTurkishDiacritics_MatchesZeytinyagi()
    {
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("zeytin yagi");
        _output.WriteLine($"Input: 'zeytin yagi' → {result.MatchedCanonicalName} ({result.MatchedBy}, conf={result.Confidence})");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal("Zeytinyağı", result.MatchedCanonicalName);
    }

    [Fact]
    public async Task FuzzyLayer_MissingDiacritics_MatchesSuzmeYogurt()
    {
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("suzme yogurt");
        _output.WriteLine($"Input: 'suzme yogurt' → {result.MatchedCanonicalName} ({result.MatchedBy}, conf={result.Confidence})");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal("Süzme Yoğurt", result.MatchedCanonicalName);
    }

    [Fact]
    public async Task FuzzyLayer_MissingDiacritics_MatchesTonBaligi()
    {
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("ton balik");
        _output.WriteLine($"Input: 'ton balik' → {result.MatchedCanonicalName} ({result.MatchedBy}, conf={result.Confidence})");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal("Ton Balığı", result.MatchedCanonicalName);
    }

    [Fact]
    public async Task FuzzyLayer_TypoInKarabiber_Matches()
    {
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("karabibr");
        _output.WriteLine($"Input: 'karabibr' → {result.MatchedCanonicalName} ({result.MatchedBy}, conf={result.Confidence})");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal("Karabiber", result.MatchedCanonicalName);
    }

    [Fact]
    public async Task DeterministicCanonical_BeatssFuzzy()
    {
        // Exact canonical match must win over any fuzzy match
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("Domates");
        _output.WriteLine($"Input: 'Domates' → {result.MatchedBy} conf={result.Confidence}");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal(IngredientMatchedBy.Canonical, result.MatchedBy);
        Assert.Equal(1.0, result.Confidence);
    }

    [Fact]
    public async Task DeterministicAlias_BeatsFuzzy()
    {
        // Exact alias match must win over any fuzzy match
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("inek sütü");  // exact alias of Süt
        _output.WriteLine($"Input: 'inek sütü' → {result.MatchedBy} to '{result.MatchedCanonicalName}' conf={result.Confidence}");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal(IngredientMatchedBy.Alias, result.MatchedBy);
        Assert.Equal("Süt", result.MatchedCanonicalName);
        Assert.Equal(0.95, result.Confidence);
    }

    [Fact]
    public async Task FuzzyLayer_MoreSpecificIngredient_WinsOverBroadIngredient()
    {
        // "meyveli yogurt" should match "Meyveli Yoğurt", NOT plain "Yoğurt"
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("meyveli yogurt");
        _output.WriteLine($"Input: 'meyveli yogurt' → {result.MatchedCanonicalName} ({result.MatchedBy}, conf={result.Confidence})");

        Assert.Equal(IngredientMatchStatus.Matched, result.Status);
        Assert.Equal("Meyveli Yoğurt", result.MatchedCanonicalName);
    }

    [Fact]
    public async Task FuzzyLayer_ExtremelyNoisyInput_StaysUnmatched()
    {
        // Completely random noise should not produce a fuzzy match
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("xqzplwvkj");
        _output.WriteLine($"Input: 'xqzplwvkj' → Status={result.Status}, MatchedBy={result.MatchedBy}");

        Assert.Equal(IngredientMatchStatus.Unmatched, result.Status);
        Assert.Equal(IngredientMatchedBy.None, result.MatchedBy);
    }

    [Fact]
    public async Task FuzzyLayer_FuzzyConfidence_IsWithinExpectedBand()
    {
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("yogrt");

        if (result.Status == IngredientMatchStatus.Matched && result.MatchedBy == IngredientMatchedBy.Fuzzy)
        {
            Assert.True(result.Confidence >= 0.65, $"Fuzzy confidence must be >= 0.65, got {result.Confidence}");
            Assert.True(result.Confidence < 0.95, $"Fuzzy confidence must be < 0.95 (alias level), got {result.Confidence}");
        }
    }

    [Fact]
    public async Task FuzzyLayer_ExplanationText_MentionsFuzzy()
    {
        var (_, svc) = await CreateAsync();
        var result = await svc.NormalizeAsync("yogrt");

        if (result.Status == IngredientMatchStatus.Matched && result.MatchedBy == IngredientMatchedBy.Fuzzy)
        {
            Assert.Contains("Fuzzy match", result.Explanation, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task FuzzyLayer_Logging_RecordsFuzzyMatchedBy()
    {
        var (db, svc) = await CreateAsync();
        await svc.NormalizeAsync("yogrt");

        // Check the normalization log stored "Fuzzy" as MatchedBy
        var log = await db.IngredientNormalizationLogs
            .OrderByDescending(l => l.CreatedAtUtc)
            .FirstOrDefaultAsync();

        Assert.NotNull(log);
        Assert.Equal("Fuzzy", log.MatchedBy);
        _output.WriteLine($"Log: RawInput={log.RawInput}, MatchedBy={log.MatchedBy}, Confidence={log.Confidence}");
    }

    // ─── Benchmark dataset test ─────────────────────────────────────────────────

    [Fact]
    public async Task FuzzyBenchmark_RunsAndReportsFuzzyCount()
    {
        var (db, _) = await CreateAsync();
        var normSvc = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());

        // We can't use the full BenchmarkRunner in an in-memory context (it needs recommendation engine)
        // So we exercise the normalization benchmark portion directly via dataset
        var dataset = new IngredientNormalizationBenchmarkDataset
        {
            Name = "FuzzyBenchmarkTest",
            Version = "1.0",
            Cases = new[]
            {
                new IngredientNormalizationBenchmarkCase { Id = "f01", RawInput = "yogrt",        ExpectedCanonicalName = "Yoğurt",       ExpectedMatchType = "fuzzy", Difficulty = "hard" },
                new IngredientNormalizationBenchmarkCase { Id = "f02", RawInput = "karabibr",     ExpectedCanonicalName = "Karabiber",    ExpectedMatchType = "fuzzy", Difficulty = "hard" },
                new IngredientNormalizationBenchmarkCase { Id = "f03", RawInput = "zeytin yagi",  ExpectedCanonicalName = "Zeytinyağı",   ExpectedMatchType = "fuzzy", Difficulty = "medium" },
                new IngredientNormalizationBenchmarkCase { Id = "f04", RawInput = "ton balik",    ExpectedCanonicalName = "Ton Balığı",   ExpectedMatchType = "fuzzy", Difficulty = "medium" },
                new IngredientNormalizationBenchmarkCase { Id = "f05", RawInput = "suzme yogurt", ExpectedCanonicalName = "Süzme Yoğurt", ExpectedMatchType = "fuzzy", Difficulty = "medium" },
                new IngredientNormalizationBenchmarkCase { Id = "d01", RawInput = "Domates",      ExpectedCanonicalName = "Domates",      ExpectedMatchType = "canonical", Difficulty = "easy" },
                new IngredientNormalizationBenchmarkCase { Id = "d02", RawInput = "inek sütü",    ExpectedCanonicalName = "Süt",          ExpectedMatchType = "alias",     Difficulty = "easy" },
                new IngredientNormalizationBenchmarkCase { Id = "u01", RawInput = "xqzplwvkj",    ExpectedCanonicalName = null,           ExpectedMatchType = "unmatched", Difficulty = "hard" },
            }
        };

        var caseResults = new List<IngredientNormalizationBenchmarkCaseResult>();
        foreach (var testCase in dataset.Cases)
        {
            var result = await normSvc.NormalizeAsync(testCase.RawInput);
            var actualMatchType = result.Status switch
            {
                IngredientMatchStatus.Matched when result.MatchedBy == IngredientMatchedBy.Canonical => "canonical",
                IngredientMatchStatus.Matched when result.MatchedBy == IngredientMatchedBy.Alias => "alias",
                IngredientMatchStatus.Matched when result.MatchedBy == IngredientMatchedBy.Fuzzy => "fuzzy",
                IngredientMatchStatus.Matched => "matched",
                IngredientMatchStatus.Unmatched => "unmatched",
                IngredientMatchStatus.Ambiguous => "ambiguous",
                _ => "unknown"
            };

            var expectedMatchType = testCase.ExpectedMatchType.ToLowerInvariant();
            bool isCorrect = expectedMatchType switch
            {
                "unmatched" => result.Status == IngredientMatchStatus.Unmatched,
                "canonical" => result.Status == IngredientMatchStatus.Matched && result.MatchedBy == IngredientMatchedBy.Canonical && result.MatchedCanonicalName == testCase.ExpectedCanonicalName,
                "alias" => result.Status == IngredientMatchStatus.Matched && result.MatchedBy == IngredientMatchedBy.Alias && result.MatchedCanonicalName == testCase.ExpectedCanonicalName,
                "fuzzy" => result.Status == IngredientMatchStatus.Matched && result.MatchedCanonicalName == testCase.ExpectedCanonicalName,
                _ => false
            };

            _output.WriteLine($"[{testCase.Id}] '{testCase.RawInput}' → {(isCorrect ? "✓" : "✗")} {actualMatchType} '{result.MatchedCanonicalName}' conf={result.Confidence:F3}");

            caseResults.Add(new IngredientNormalizationBenchmarkCaseResult
            {
                CaseId = testCase.Id,
                RawInput = testCase.RawInput,
                IsCorrect = isCorrect,
                ExpectedCanonicalName = testCase.ExpectedCanonicalName,
                ActualCanonicalName = result.MatchedCanonicalName,
                ExpectedMatchType = expectedMatchType,
                ActualMatchType = actualMatchType,
                Confidence = result.Confidence,
                Difficulty = testCase.Difficulty
            });
        }

        var total = caseResults.Count;
        var correct = caseResults.Count(r => r.IsCorrect);
        var fuzzyCount = caseResults.Count(r => r.ActualMatchType == "fuzzy");
        var fuzzyCorrect = caseResults.Count(r => r.ActualMatchType == "fuzzy" && r.IsCorrect);
        var accuracy = (double)correct / total;

        _output.WriteLine($"");
        _output.WriteLine($"=== Benchmark Summary ===");
        _output.WriteLine($"Total: {total}, Correct: {correct}, Accuracy: {accuracy:P1}");
        _output.WriteLine($"Fuzzy matches: {fuzzyCount}, Fuzzy correct: {fuzzyCorrect}");

        // At least the deterministic cases must pass
        var deterministicCorrect = caseResults.Where(r => r.CaseId.StartsWith("d") || r.CaseId.StartsWith("u")).Count(r => r.IsCorrect);
        Assert.True(deterministicCorrect >= 3, $"All deterministic test cases should pass, got {deterministicCorrect}");
        Assert.True(fuzzyCount > 0, "At least some fuzzy matches should be reported");
        Assert.True(accuracy >= 0.6, $"Overall benchmark accuracy should be >= 60%, got {accuracy:P1}");
    }
}
