using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Handlers;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;
using Xunit.Abstractions;

namespace MyDietitianMobileApp.Api.Tests.Ingredients;

/// <summary>
/// Integration tests verifying that the real ingredient search flow
/// (SearchIngredientsQueryHandler + IIngredientNormalizationService + IIngredientRepository)
/// now benefits from the full normalization pipeline.
///
/// Uses an in-memory EF DB — no external services required.
/// All tests run deterministically.
/// </summary>
public class NormalizedSearchIntegrationTests
{
    private readonly ITestOutputHelper _output;

    public NormalizedSearchIntegrationTests(ITestOutputHelper output)
    {
        _output = output;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// In-memory-safe repository stub that mimics IngredientRepository.Search()
    /// without using EF.Functions.ILike (which requires PostgreSQL).
    /// </summary>
    private class InMemoryIngredientRepository : MyDietitianMobileApp.Domain.Repositories.IIngredientRepository
    {
        private readonly AppDbContext _db;
        public InMemoryIngredientRepository(AppDbContext db) => _db = db;

        public MyDietitianMobileApp.Domain.Entities.Ingredient GetById(Guid id)
            => _db.Ingredients.FirstOrDefault(i => i.Id == id)!;

        public System.Collections.Generic.IEnumerable<MyDietitianMobileApp.Domain.Entities.Ingredient> Search(string searchTerm, int maxResults = 20)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return Array.Empty<MyDietitianMobileApp.Domain.Entities.Ingredient>();

            var normalized = searchTerm.Trim().ToLower();
            var all = _db.Ingredients.Where(i => i.IsActive).ToList();

            var byName = all.Where(i => i.CanonicalName.Contains(normalized, StringComparison.OrdinalIgnoreCase));
            var byAlias = all
                .Where(i => i.Aliases.Any(a => a.Contains(normalized, StringComparison.OrdinalIgnoreCase)))
                .Where(i => !byName.Any(n => n.Id == i.Id));

            return byName.Concat(byAlias)
                .OrderBy(i => i.CanonicalName)
                .Take(maxResults)
                .ToList();
        }

        public System.Collections.Generic.IEnumerable<MyDietitianMobileApp.Domain.Entities.Ingredient> GetAll()
            => _db.Ingredients.OrderBy(i => i.CanonicalName).ToList();

        public bool ExistsByCanonicalName(string canonicalName, Guid? excludeId = null)
        {
            var n = canonicalName.Trim().ToLower();
            var q = _db.Ingredients.AsQueryable();
            if (excludeId.HasValue) q = q.Where(i => i.Id != excludeId.Value);
            return q.Any(i => i.CanonicalName.ToLower() == n);
        }
    }

    private static async Task<(AppDbContext db, SearchIngredientsQueryHandler handler)> CreateAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        // Seed a representative ingredient corpus
        var corpus = new[]
        {
            ("Yoğurt",           new[] { "yogurt", "süt yoğurdu" }),
            ("Meyveli Yoğurt",   new[] { "meyveli yogurt", "aromalı yoğurt" }),
            ("Süzme Yoğurt",     new[] { "krem yoğurt" }),
            ("Laktozsuz Yoğurt", new[] { "laktoz-free yoğurt" }),
            ("Süt",              new[] { "inek sütü", "tam yağlı süt" }),
            ("Zeytinyağı",       new[] { "sızma zeytinyağı" }),
            ("Karabiber",        new[] { "siyah biber", "taze öğütülmüş biber" }),
            ("Ton Balığı",       new[] { "konserve ton balığı", "ton" }),
            ("Tavuk Göğsü",      new[] { "haşlanmış tavuk", "ızgara tavuk göğsü" }),
            ("Domates",          new[] { "cherry domates", "konserve domates" }),
        };

        foreach (var (name, aliases) in corpus)
        {
            var ing = new MyDietitianMobileApp.Domain.Entities.Ingredient(Guid.NewGuid(), name, isActive: true);
            foreach (var alias in aliases) ing.AddAlias(alias);
            db.Ingredients.Add(ing);
        }

        await db.SaveChangesAsync();

        var normSvc = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());
        var repo = new InMemoryIngredientRepository(db);
        var handler = new SearchIngredientsQueryHandler(repo, normSvc);

        return (db, handler);
    }

    private static async Task<System.Collections.Generic.List<IngredientDto>> SearchAsync(
        SearchIngredientsQueryHandler handler, string q, int maxResults = 20)
    {
        var result = await handler.Handle(
            new SearchIngredientsQuery(q, maxResults),
            CancellationToken.None);
        return result.Ingredients.ToList();
    }

    // ─── Part F.1 — Exact canonical search still works ──────────────────────────

    [Fact]
    public async Task Search_ExactCanonical_ReturnsFirstResult()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "Domates");

        _output.WriteLine($"Search 'Domates': {results.Count} results, first={results.FirstOrDefault()?.CanonicalName}");

        Assert.NotEmpty(results);
        Assert.Equal("Domates", results[0].CanonicalName);
    }

    // ─── Part F.2 — Exact alias search still works ──────────────────────────────

    [Fact]
    public async Task Search_ExactAlias_ReturnsCorrectIngredientFirst()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "inek sütü");

        _output.WriteLine($"Search 'inek sütü': {results.Count} results, first={results.FirstOrDefault()?.CanonicalName}");

        Assert.NotEmpty(results);
        Assert.Equal("Süt", results[0].CanonicalName);
    }

    // ─── Part F.3 — Fuzzy typo search through the real API search flow ──────────

    [Fact]
    public async Task Search_Typo_Yogurt_ReturnsBestFuzzyMatchFirst()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "yogrt");

        _output.WriteLine($"Search 'yogrt': {results.Count} results");
        foreach (var r in results.Take(3))
            _output.WriteLine($"  → {r.CanonicalName}");

        // Normalization should resolve "yogrt" → Yoğurt via fuzzy
        Assert.NotEmpty(results);
        Assert.Equal("Yoğurt", results[0].CanonicalName);
    }

    [Fact]
    public async Task Search_Typo_Karabiber_ReturnsBestFuzzyMatchFirst()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "karabibr");

        _output.WriteLine($"Search 'karabibr': {results.Count} results, first={results.FirstOrDefault()?.CanonicalName}");

        Assert.NotEmpty(results);
        Assert.Equal("Karabiber", results[0].CanonicalName);
    }

    // ─── Part F.4 — Missing Turkish diacritics through the real search flow ─────

    [Fact]
    public async Task Search_MissingDiacritics_ZeytinYagi_FindsZeytinyagi()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "zeytin yagi");

        _output.WriteLine($"Search 'zeytin yagi': {results.Count} results, first={results.FirstOrDefault()?.CanonicalName}");

        Assert.NotEmpty(results);
        Assert.Equal("Zeytinyağı", results[0].CanonicalName);
    }

    [Fact]
    public async Task Search_MissingDiacritics_SuzmeYogurt_FindsSuzmeYogurt()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "suzme yogurt");

        _output.WriteLine($"Search 'suzme yogurt': {results.Count} results, first={results.FirstOrDefault()?.CanonicalName}");

        Assert.NotEmpty(results);
        Assert.Equal("Süzme Yoğurt", results[0].CanonicalName);
    }

    [Fact]
    public async Task Search_MissingDiacritics_TonBalik_FindsTonBaligi()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "ton balik");

        _output.WriteLine($"Search 'ton balik': {results.Count} results, first={results.FirstOrDefault()?.CanonicalName}");

        Assert.NotEmpty(results);
        Assert.Equal("Ton Balığı", results[0].CanonicalName);
    }

    // ─── Part F.5 — Exact deterministic result is ranked ahead of fuzzy ─────────

    [Fact]
    public async Task Search_ExactMatch_IsRankedBeforeFuzzyAlternatives()
    {
        var (_, handler) = await CreateAsync();

        // "yogurt" is an exact alias of "Yoğurt" (alias confidence 0.95)
        // Fuzzy candidates (Meyveli Yoğurt, Süzme Yoğurt etc.) should come AFTER
        var results = await SearchAsync(handler, "yogurt");

        _output.WriteLine($"Search 'yogurt': first={results.FirstOrDefault()?.CanonicalName}");
        foreach (var r in results.Take(5))
            _output.WriteLine($"  → {r.CanonicalName}");

        Assert.NotEmpty(results);
        // Alias match "yogurt" → "Yoğurt"; must be #1
        Assert.Equal("Yoğurt", results[0].CanonicalName);
    }

    // ─── Part F.6 — Ambiguous normalization does not break search behavior ───────

    [Theory]
    [InlineData("yoga")]   // Completely unrelated — should produce repo results if any, not crash
    [InlineData("yog")]    // Very short — below short-input threshold, might be fuzzy ambiguous
    public async Task Search_AmbiguousOrNoisy_DoesNotThrow(string query)
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, query);

        _output.WriteLine($"Search '{query}': {results.Count} results");
        // Should not throw; may be empty or have repo substring results
        Assert.NotNull(results);
    }

    // ─── Part F.7 — Response contract (IngredientDto shape) is unchanged ─────────

    [Fact]
    public async Task Search_ResultShape_HasExpectedFields()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "Domates");

        Assert.NotEmpty(results);
        var first = results[0];

        // All three fields that the API exposes must be present
        Assert.NotEqual(Guid.Empty, first.Id);
        Assert.False(string.IsNullOrWhiteSpace(first.CanonicalName));
        Assert.NotNull(first.Aliases); // may be empty but must not be null
    }

    // ─── Part F.8 — Pagination still behaves correctly ───────────────────────────

    [Fact]
    public async Task Search_MaxResults_IsRespected()
    {
        var (_, handler) = await CreateAsync();

        // "a" is a substring of many ingredients (Yoğurt aliases have "a" etc.)
        // With full corpus, repo will find many. MaxResults should cap the output.
        var results = await SearchAsync(handler, "a", maxResults: 3);

        _output.WriteLine($"Search 'a' with maxResults=3: {results.Count} results");

        Assert.True(results.Count <= 3, $"Expected <= 3 results but got {results.Count}");
    }

    [Fact]
    public async Task Search_MaxResults_DefaultIsReasonable()
    {
        var (_, handler) = await CreateAsync();
        var results = await SearchAsync(handler, "yogurt", maxResults: 20);

        _output.WriteLine($"Search 'yogurt' maxResults=20: {results.Count} results");

        // Should return something, not exceed 20
        Assert.InRange(results.Count, 1, 20);
    }

    // ─── Deduplication ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Search_Deduplication_NormalizationResultNotDuplicated()
    {
        var (_, handler) = await CreateAsync();
        // "Domates" is exact canonical — both normalization and repo will find it
        var results = await SearchAsync(handler, "Domates");

        var domatesCount = results.Count(r => r.CanonicalName == "Domates");
        _output.WriteLine($"'Domates' appears {domatesCount} time(s) in results");

        Assert.Equal(1, domatesCount); // Should appear exactly once
    }

    // ─── Fallback to repo when normalization misses ───────────────────────────────

    [Fact]
    public async Task Search_NormalizationMiss_StillReturnsRepoResults()
    {
        var (_, handler) = await CreateAsync();
        // "cherry" matches "cherry domates" (an alias substring) — repo only
        var results = await SearchAsync(handler, "cherry");

        _output.WriteLine($"Search 'cherry': {results.Count} results");
        foreach (var r in results.Take(3))
            _output.WriteLine($"  → {r.CanonicalName}");

        // Should find "Domates" via repo alias substring search
        Assert.True(results.Any(r => r.CanonicalName == "Domates"),
            "Expected repo-level alias substring match for 'cherry'");
    }

    // ─── Normalization is now active in the real flow (confirming integration) ──

    [Fact]
    public async Task Search_NormalizationLogs_AreWrittenDuringRealSearch()
    {
        var (db, handler) = await CreateAsync();

        var logsBefore = await db.IngredientNormalizationLogs.CountAsync();
        await SearchAsync(handler, "yogrt");
        var logsAfter = await db.IngredientNormalizationLogs.CountAsync();

        _output.WriteLine($"Normalization logs: before={logsBefore}, after={logsAfter}");

        // Each search call produces exactly 1 normalization log entry
        Assert.Equal(logsBefore + 1, logsAfter);

        var log = await db.IngredientNormalizationLogs
            .OrderByDescending(l => l.CreatedAtUtc)
            .FirstOrDefaultAsync();

        Assert.NotNull(log);
        Assert.Equal("yogrt", log.RawInput);
        _output.WriteLine($"Log: RawInput={log.RawInput}, MatchedBy={log.MatchedBy}, Confidence={log.Confidence}");
    }

    [Fact]
    public async Task Search_FuzzyIsNowActiveInRealFlow()
    {
        var (db, handler) = await CreateAsync();

        await SearchAsync(handler, "yogrt");

        var latestLog = await db.IngredientNormalizationLogs
            .OrderByDescending(l => l.CreatedAtUtc)
            .FirstOrDefaultAsync();

        Assert.NotNull(latestLog);
        // Fuzzy must be the match mechanism used — confirming fuzzy is active in a real flow
        Assert.Equal("Fuzzy", latestLog.MatchedBy);
        _output.WriteLine($"✓ Fuzzy is now active in real search flow. Log: MatchedBy={latestLog.MatchedBy}, Confidence={latestLog.Confidence}");
    }
}
