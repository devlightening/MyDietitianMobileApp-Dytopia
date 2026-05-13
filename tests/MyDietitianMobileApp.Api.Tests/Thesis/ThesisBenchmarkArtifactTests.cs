using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Thesis;

public class ThesisBenchmarkArtifactTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    [Fact]
    public async Task GenerateThesisBenchmarkArtifacts()
    {
        var outputDir = new DirectoryInfo(System.IO.Path.Combine(
            GetRepoRoot().FullName,
            "docs",
            "thesis-benchmark-results"));
        outputDir.Create();

        using var db = CreateDbContext();
        var ingredients = SeedIngredients(db);
        await db.SaveChangesAsync();

        var normalizationService = new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());

        var normalizationCases = BuildNormalizationCases();
        var normalizationResults = await RunNormalizationBenchmark(normalizationService, normalizationCases);
        var normalizationSummary = SummarizeNormalization(normalizationResults);
        WriteJson(Out(outputDir, "normalization-cases.json"), normalizationResults);
        WriteCsv(Out(outputDir, "normalization-results.csv"), NormalizationCsv(normalizationResults));
        WriteJson(Out(outputDir, "normalization-summary.json"), normalizationSummary);
        WriteText(Out(outputDir, "normalization-summary.md"), NormalizationMarkdown(normalizationSummary));

        var ablationRows = RunNormalizationAblation(ingredients.Values.ToList(), normalizationCases, normalizationResults);
        WriteCsv(Out(outputDir, "normalization-ablation.csv"), AblationCsv(ablationRows));
        WriteText(Out(outputDir, "normalization-ablation.md"), AblationMarkdown(ablationRows));

        var recipeScenarios = BuildRecipeScenarios(ingredients);
        var recipeResults = RunRecipeBenchmark(recipeScenarios, ingredients);
        var recipeSummary = SummarizeRecipe(recipeResults);
        WriteJson(Out(outputDir, "recipe-engine-cases.json"), recipeResults);
        WriteCsv(Out(outputDir, "recipe-engine-results.csv"), RecipeCsv(recipeResults));
        WriteJson(Out(outputDir, "recipe-engine-summary.json"), recipeSummary);
        WriteText(Out(outputDir, "recipe-engine-summary.md"), RecipeMarkdown(recipeSummary));

        var premiumResults = RunPremiumGuardBenchmark(ingredients);
        var premiumSummary = SummarizePremium(premiumResults);
        WriteCsv(Out(outputDir, "premium-guard-results.csv"), PremiumCsv(premiumResults));
        WriteJson(Out(outputDir, "premium-guard-summary.json"), premiumSummary);
        WriteText(Out(outputDir, "premium-guard-summary.md"), PremiumMarkdown(premiumSummary));

        var apiLatencyRows = await RunInProcessLatencyBenchmark(normalizationService, ingredients);
        var apiLatencySummary = SummarizeLatency(apiLatencyRows);
        WriteCsv(Out(outputDir, "operation-latency-results.csv"), LatencyCsv(apiLatencyRows));
        WriteJson(Out(outputDir, "operation-latency-summary.json"), apiLatencySummary);
        WriteText(Out(outputDir, "operation-latency-summary.md"), LatencyMarkdown(apiLatencySummary));

        var openAiConfigured = IsOpenAiConfigured();
        var openAiSummary = new
        {
            openAiConfigured,
            status = openAiConfigured
                ? "OpenAI key configured; this artifact test intentionally did not call external APIs."
                : "OpenAI key not configured; OpenAI fallback tests skipped.",
            fallbackCalls = 0,
            correct = 0,
            unresolved = 0,
            averageLatencyMs = (double?)null,
            tokenOrCost = "not measured"
        };
        WriteJson(Out(outputDir, "openai-fallback-summary.json"), openAiSummary);
        WriteText(Out(outputDir, "openai-fallback-summary.md"), OpenAiMarkdown(openAiConfigured));
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static Dictionary<string, Ingredient> SeedIngredients(AppDbContext db)
    {
        Ingredient Add(string name, params string[] aliases)
        {
            var ingredient = new Ingredient(Guid.NewGuid(), name);
            foreach (var alias in aliases)
                ingredient.AddAlias(alias);
            db.Ingredients.Add(ingredient);
            return ingredient;
        }

        var ingredients = new Dictionary<string, Ingredient>(StringComparer.OrdinalIgnoreCase)
        {
            ["Domates"] = Add("Domates", "çeri domates", "cherry domates", "salkım domates", "konserve domates"),
            ["Salatalık"] = Add("Salatalık", "salatalik", "hıyar", "kornişon"),
            ["Ton Balığı"] = Add("Ton Balığı", "ton baligi", "light ton", "konserve ton balığı", "suda ton balığı"),
            ["Yoğurt"] = Add("Yoğurt", "yogurt", "sade yogurt", "ev yoğurdu"),
            ["Süzme Yoğurt"] = Add("Süzme Yoğurt", "suzme yogurt", "krem yoğurt"),
            ["Laktozsuz Yoğurt"] = Add("Laktozsuz Yoğurt", "laktozsuz yogurt", "laktosuz yoğurt"),
            ["Kefir"] = Add("Kefir", "sade kefir", "probiyotik kefir"),
            ["Yulaf"] = Add("Yulaf", "yulaf ezmesi", "oat"),
            ["Yumurta"] = Add("Yumurta", "yumurta akı", "organik yumurta"),
            ["Tavuk Göğsü"] = Add("Tavuk Göğsü", "tavuk gogsu", "ızgara tavuk göğsü", "haşlanmış tavuk"),
            ["Marul"] = Add("Marul", "göbek marul", "kıvırcık"),
            ["Limon"] = Add("Limon", "limon suyu", "lime"),
            ["Kırmızı Kapya Biber"] = Add("Kırmızı Kapya Biber", "kapya biber", "kirmizi kapya biber"),
            ["Zeytinyağı"] = Add("Zeytinyağı", "zeytin yağı", "zeytin yagi", "sızma zeytinyağı"),
            ["Tuz"] = Add("Tuz", "sofra tuzu", "deniz tuzu"),
            ["Karabiber"] = Add("Karabiber", "kara biber", "siyah biber"),
            ["Kuru Fasulye"] = Add("Kuru Fasulye", "fasulye", "beyaz fasulye"),
            ["Pirinç"] = Add("Pirinç", "pirinc", "baldo pirinç"),
            ["Elma"] = Add("Elma", "kırmızı elma", "yeşil elma"),
            ["Havuç"] = Add("Havuç", "havuc", "taze havuç"),
            ["Süt"] = Add("Süt", "sut", "inek sütü", "tam yağlı süt"),
            ["Laktozsuz Süt"] = Add("Laktozsuz Süt", "laktozsuz sut", "laktozsuz süt"),
            ["Muz"] = Add("Muz", "banana", "yerli muz"),
            ["Mercimek"] = Add("Mercimek", "kırmızı mercimek", "yesil mercimek"),
            ["Bulgur"] = Add("Bulgur", "pilavlık bulgur", "ince bulgur"),
            ["Peynir"] = Add("Peynir", "beyaz peynir", "lor peyniri"),
        };

        ingredients["Tuz"].SetIsCondiment(true);
        ingredients["Karabiber"].SetIsCondiment(true);
        ingredients["Zeytinyağı"].SetIsCondiment(true);
        return ingredients;
    }

    private static List<NormalizationCase> BuildNormalizationCases()
    {
        var cases = new List<NormalizationCase>();
        void Add(string input, string? expected, string layer, string group)
            => cases.Add(new($"N{cases.Count + 1:000}", input, expected, layer, group));

        foreach (var name in new[]
        {
            "Domates", "Salatalık", "Ton Balığı", "Yoğurt", "Süzme Yoğurt", "Laktozsuz Yoğurt",
            "Kefir", "Yulaf", "Yumurta", "Tavuk Göğsü", "Marul", "Limon", "Kırmızı Kapya Biber",
            "Zeytinyağı", "Tuz", "Karabiber", "Kuru Fasulye", "Pirinç", "Elma", "Havuç", "Süt",
            "Laktozsuz Süt", "Muz", "Mercimek", "Bulgur", "Peynir"
        })
        {
            Add(name, name, "Canonical", "canonical");
        }

        foreach (var item in new (string Input, string Expected)[]
        {
            ("çeri domates", "Domates"), ("salkım domates", "Domates"), ("salatalik", "Salatalık"),
            ("hıyar", "Salatalık"), ("ton baligi", "Ton Balığı"), ("light ton", "Ton Balığı"),
            ("sade yogurt", "Yoğurt"), ("suzme yogurt", "Süzme Yoğurt"), ("laktozsuz yogurt", "Laktozsuz Yoğurt"),
            ("probiyotik kefir", "Kefir"), ("yulaf ezmesi", "Yulaf"), ("tavuk gogsu", "Tavuk Göğsü"),
            ("kapya biber", "Kırmızı Kapya Biber"), ("zeytin yagi", "Zeytinyağı"), ("sofra tuzu", "Tuz"),
            ("siyah biber", "Karabiber"), ("fasulye", "Kuru Fasulye"), ("pirinc", "Pirinç"),
            ("havuc", "Havuç"), ("sut", "Süt"), ("laktozsuz sut", "Laktozsuz Süt"), ("banana", "Muz")
        })
        {
            Add(item.Input, item.Expected, "Alias", "alias");
        }

        foreach (var item in new (string Input, string Expected)[]
        {
            ("domtes", "Domates"), ("salatalk", "Salatalık"), ("ton balik", "Ton Balığı"),
            ("yogrt", "Yoğurt"), ("laktosuz yogurt", "Laktozsuz Yoğurt"), ("yulaff", "Yulaf"),
            ("yumrta", "Yumurta"), ("tavuk gogs", "Tavuk Göğsü"), ("kefrr", "Kefir"),
            ("karabibr", "Karabiber"), ("pirinc pilav", "Pirinç"), ("mercimk", "Mercimek"),
            ("bulgr", "Bulgur"), ("peynr", "Peynir"), ("havvuc", "Havuç")
        })
        {
            Add(item.Input, item.Expected, "Fuzzy", "fuzzy");
        }

        foreach (var input in new[]
        {
            "abcxyz123", "telefon kablosu", "mutfak masası", "şekerli gazoz belirsiz", "unknown ingredient",
            "xqzplwvkj", "pilates topu", "mavi kalem", "1234567890", "rastgele anlamsız girdi"
        })
        {
            Add(input, null, "Unresolved", "negative");
        }

        return cases;
    }

    private static async Task<List<NormalizationResultRow>> RunNormalizationBenchmark(
        IIngredientNormalizationService service,
        IReadOnlyList<NormalizationCase> cases)
    {
        var rows = new List<NormalizationResultRow>();
        _ = await service.NormalizeAsync("domates");

        foreach (var testCase in cases)
        {
            var sw = Stopwatch.StartNew();
            var actual = await service.NormalizeAsync(testCase.Input);
            sw.Stop();

            var actualLayer = actual.Status == IngredientMatchStatus.Unmatched
                ? "Unresolved"
                : actual.MatchedBy.ToString();

            var isUnresolved = actual.Status == IngredientMatchStatus.Unmatched;
            var isCorrect = testCase.ExpectedCanonicalName == null
                ? isUnresolved
                : actual.Status == IngredientMatchStatus.Matched
                  && string.Equals(actual.MatchedCanonicalName, testCase.ExpectedCanonicalName, StringComparison.OrdinalIgnoreCase);

            rows.Add(new NormalizationResultRow(
                testCase.CaseId,
                testCase.Input,
                testCase.ExpectedCanonicalName,
                actual.MatchedCanonicalName,
                testCase.ExpectedLayer,
                actualLayer,
                Math.Round(actual.Confidence, 4),
                isCorrect,
                isUnresolved,
                Math.Round(sw.Elapsed.TotalMilliseconds, 4),
                testCase.Group,
                isCorrect ? "" : actual.Explanation));
        }

        return rows;
    }

    private static NormalizationSummary SummarizeNormalization(IReadOnlyList<NormalizationResultRow> rows)
    {
        var total = rows.Count;
        var correct = rows.Count(r => r.IsCorrect);
        var unresolved = rows.Count(r => r.IsUnresolved);
        var falseMatch = rows.Count(r => r.ExpectedCanonicalName != null && r.ActualCanonicalName != null && !r.IsCorrect);
        var latencies = rows.Select(r => r.LatencyMs).ToArray();
        var layerCounts = rows
            .GroupBy(r => r.ActualLayer)
            .OrderBy(g => g.Key)
            .ToDictionary(g => g.Key, g => new LayerDistribution(g.Count(), Percent(g.Count(), total)));

        return new NormalizationSummary(
            total,
            correct,
            total - correct,
            unresolved,
            falseMatch,
            Percent(correct, total),
            Percent(unresolved, total),
            Percent(falseMatch, total),
            Average(latencies),
            Median(latencies),
            P95(latencies),
            layerCounts);
    }

    private static List<AblationRow> RunNormalizationAblation(
        IReadOnlyList<Ingredient> ingredients,
        IReadOnlyList<NormalizationCase> cases,
        IReadOnlyList<NormalizationResultRow> fullPipelineRows)
    {
        var rows = new List<AblationRow>();
        foreach (var mode in new[] { "Canonical only", "Canonical + Alias", "Canonical + Alias + Fuzzy", "Full pipeline" })
        {
            var latencies = new List<double>();
            var correct = 0;
            var unresolved = 0;
            var falseMatch = 0;

            foreach (var testCase in cases)
            {
                string? actual;
                if (mode == "Full pipeline")
                {
                    var fullRow = fullPipelineRows.First(r => r.CaseId == testCase.CaseId);
                    actual = fullRow.ActualCanonicalName;
                    latencies.Add(fullRow.LatencyMs);
                }
                else
                {
                    var sw = Stopwatch.StartNew();
                    actual = ResolveAblation(ingredients, testCase.Input, mode);
                    sw.Stop();
                    latencies.Add(sw.Elapsed.TotalMilliseconds);
                }

                var isUnresolved = actual == null;
                if (isUnresolved) unresolved++;

                var isCorrect = testCase.ExpectedCanonicalName == null
                    ? isUnresolved
                    : string.Equals(actual, testCase.ExpectedCanonicalName, StringComparison.OrdinalIgnoreCase);

                if (isCorrect)
                    correct++;
                else if (testCase.ExpectedCanonicalName != null && actual != null)
                    falseMatch++;
            }

            rows.Add(new AblationRow(
                mode,
                cases.Count,
                Percent(correct, cases.Count),
                Percent(cases.Count - unresolved, cases.Count),
                Percent(unresolved, cases.Count),
                Percent(falseMatch, cases.Count),
                Average(latencies)));
        }

        rows.Add(new AblationRow("Full pipeline + LLM fallback", cases.Count, null, null, null, null, null, "skipped: OpenAI key not configured"));
        return rows;
    }

    private static string? ResolveAblation(IReadOnlyList<Ingredient> ingredients, string input, string mode)
    {
        var canonicalInput = NormalizeCanonical(input);
        var canonical = ingredients.FirstOrDefault(i => NormalizeCanonical(i.CanonicalName) == canonicalInput);
        if (canonical != null || mode == "Canonical only")
            return canonical?.CanonicalName;

        var aliasInput = NormalizeFolded(input);
        var alias = ingredients.FirstOrDefault(i => i.Aliases.Any(a => NormalizeFolded(a) == aliasInput));
        if (alias != null || mode == "Canonical + Alias")
            return alias?.CanonicalName;

        var fuzzy = FuzzyIngredientMatcher.Match(aliasInput, ingredients).FirstOrDefault();
        return fuzzy?.Ingredient.CanonicalName;
    }

    private static string NormalizeCanonical(string input)
        => string.Join(' ', input.Trim().Trim(',', '.', ';', ':', '!', '?', '"', '\'').ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));

    private static string NormalizeFolded(string input)
        => FuzzyIngredientMatcher.TurkishFold(NormalizeCanonical(input));

    private static List<RecipeScenario> BuildRecipeScenarios(IReadOnlyDictionary<string, Ingredient> ingredients)
    {
        var scenarios = new List<RecipeScenario>();
        void Add(
            string name,
            string[] basket,
            string[] mandatory,
            string[] optional,
            string[] prohibited,
            string[] substitutes,
            string expected,
            string type)
        {
            scenarios.Add(new RecipeScenario($"R{scenarios.Count + 1:000}", name, basket, mandatory, optional, prohibited, substitutes, expected, type));
        }

        Add("Ton Balıklı Salata", ["Ton Balığı", "Marul", "Limon"], ["Ton Balığı"], ["Marul", "Limon"], [], [], "Tam Uyum", "full");
        Add("Yoğurtlu Yulaf", ["Yoğurt", "Yulaf", "Muz"], ["Yoğurt", "Yulaf"], ["Muz"], [], [], "Tam Uyum", "full");
        Add("Kefirli Yulaf", ["Kefir", "Yulaf"], ["Yoğurt", "Yulaf"], [], [], ["Kefir=>Yoğurt"], "Tam Uyum (Alternatifli)", "substitute");
        Add("Domatesli Yumurta", ["Yumurta", "Domates"], ["Yumurta", "Domates"], ["Karabiber"], [], [], "Tam Uyum", "full");
        Add("Tavuk Salata", ["Tavuk Göğsü", "Marul"], ["Tavuk Göğsü", "Marul"], ["Limon"], [], [], "Tam Uyum", "full");
        Add("Kuru Fasulye", ["Kuru Fasulye", "Domates"], ["Kuru Fasulye", "Domates"], ["Tuz"], [], [], "Tam Uyum", "full");
        Add("Bulgur Pilavı", ["Bulgur", "Domates"], ["Bulgur", "Domates"], ["Zeytinyağı"], [], [], "Tam Uyum", "full");
        Add("Mercimek Çorbası", ["Mercimek", "Havuç"], ["Mercimek", "Havuç"], ["Karabiber"], [], [], "Tam Uyum", "full");
        Add("Peynirli Salata", ["Peynir", "Marul", "Domates"], ["Peynir", "Marul"], ["Domates"], [], [], "Tam Uyum", "full");
        Add("Muzlu Süt", ["Laktozsuz Süt", "Muz"], ["Süt", "Muz"], [], [], ["Laktozsuz Süt=>Süt"], "Tam Uyum (Alternatifli)", "substitute");
        Add("Eksik Ton Salata", ["Marul", "Limon"], ["Ton Balığı", "Marul"], ["Limon"], [], [], "1 Eksikle Olur", "one_missing");
        Add("Eksik Tavuk Salata", ["Marul", "Limon"], ["Tavuk Göğsü", "Marul"], [], [], [], "1 Eksikle Olur", "one_missing");
        Add("Eksik Yulaf Bowl", ["Yoğurt", "Muz"], ["Yoğurt", "Yulaf"], ["Muz"], [], [], "1 Eksikle Olur", "one_missing");
        Add("Eksik Fasulye", ["Domates"], ["Kuru Fasulye", "Domates"], [], [], [], "1 Eksikle Olur", "one_missing");
        Add("Eksik Pilav", ["Domates"], ["Bulgur", "Domates"], [], [], [], "1 Eksikle Olur", "one_missing");
        Add("Laktoz Yasaklı Yoğurt", ["Yoğurt", "Yulaf"], ["Yoğurt"], [], ["Yoğurt"], [], "Yasak nedeniyle elendi", "prohibited");
        Add("Tuz Yasaklı Tarif", ["Domates"], ["Domates"], [], ["Tuz"], [], "Yasak nedeniyle elendi", "prohibited");
        Add("Ton Yasaklı Tarif", ["Marul"], ["Marul"], [], ["Ton Balığı"], [], "Yasak nedeniyle elendi", "prohibited");
        Add("Süt Yasaklı Tarif", ["Muz"], ["Muz"], [], ["Süt"], [], "Yasak nedeniyle elendi", "prohibited");
        Add("Yumurta Yasaklı Tarif", ["Domates"], ["Domates"], [], ["Yumurta"], [], "Yasak nedeniyle elendi", "prohibited");
        Add("Çok Eksik Bowl", ["Muz"], ["Yoğurt", "Yulaf", "Süt"], [], [], [], "Uygun Değil", "not_eligible");
        Add("Çok Eksik Salata", ["Limon"], ["Ton Balığı", "Marul", "Domates"], [], [], [], "Uygun Değil", "not_eligible");
        Add("Çok Eksik Tavuk", ["Karabiber"], ["Tavuk Göğsü", "Marul"], [], [], [], "Uygun Değil", "not_eligible");
        Add("Çok Eksik Bakliyat", ["Tuz"], ["Kuru Fasulye", "Domates"], [], [], [], "Uygun Değil", "not_eligible");
        Add("Çok Eksik Kahvaltı", ["Elma"], ["Yumurta", "Peynir"], [], [], [], "Uygun Değil", "not_eligible");
        Add("Sadece Tuz", ["Tuz"], ["Tuz"], [], [], [], "Düşük skor / önerilmemeli", "condiment_guard");
        Add("Sadece Zeytinyağı", ["Zeytinyağı"], ["Zeytinyağı"], [], [], [], "Düşük skor / önerilmemeli", "condiment_guard");
        Add("Sadece Karabiber", ["Karabiber"], ["Karabiber"], [], [], [], "Düşük skor / önerilmemeli", "condiment_guard");
        Add("Boş Zorunlu Tarif", ["Domates"], [], ["Domates"], [], [], "Düşük skor / önerilmemeli", "quality_guard");
        Add("Alternatif Laktozsuz Yoğurt", ["Laktozsuz Yoğurt", "Yulaf"], ["Yoğurt", "Yulaf"], [], [], ["Laktozsuz Yoğurt=>Yoğurt"], "Tam Uyum (Alternatifli)", "substitute");
        Add("Alternatif Laktozsuz Süt", ["Laktozsuz Süt", "Muz"], ["Süt", "Muz"], [], [], ["Laktozsuz Süt=>Süt"], "Tam Uyum (Alternatifli)", "substitute");
        Add("Alternatif Kefir", ["Kefir", "Muz"], ["Yoğurt", "Muz"], [], [], ["Kefir=>Yoğurt"], "Tam Uyum (Alternatifli)", "substitute");
        Add("Opsiyonel Eksik Tam", ["Ton Balığı"], ["Ton Balığı"], ["Marul", "Limon"], [], [], "Tam Uyum", "optional_missing");
        Add("Opsiyonel Eksik Yulaf", ["Yoğurt", "Yulaf"], ["Yoğurt", "Yulaf"], ["Muz"], [], [], "Tam Uyum", "optional_missing");
        Add("Opsiyonel Eksik Tavuk", ["Tavuk Göğsü"], ["Tavuk Göğsü"], ["Marul", "Limon"], [], [], "Tam Uyum", "optional_missing");
        Add("Opsiyonel Eksik Domates", ["Yumurta"], ["Yumurta"], ["Domates"], [], [], "Tam Uyum", "optional_missing");

        return scenarios;
    }

    private static List<RecipeResultRow> RunRecipeBenchmark(
        IReadOnlyList<RecipeScenario> scenarios,
        IReadOnlyDictionary<string, Ingredient> ingredients)
    {
        var engine = new RecipeRecommendationEngine();
        var rows = new List<RecipeResultRow>();
        var condimentIds = ingredients.Values.Where(i => i.IsCondiment).Select(i => i.Id).ToArray();

        foreach (var scenario in scenarios)
        {
            var recipe = new Recipe(Guid.NewGuid(), Guid.NewGuid(), scenario.RecipeName, "Benchmark recipe", isPublic: false);
            foreach (var name in scenario.Mandatory)
                recipe.AddMandatoryIngredient(ingredients[name]);
            foreach (var name in scenario.Optional)
                recipe.AddOptionalIngredient(ingredients[name]);
            foreach (var name in scenario.Prohibited)
                recipe.AddProhibitedIngredient(ingredients[name]);

            var substitutes = new Dictionary<(Guid RecipeId, Guid RequiredIngredientId), IReadOnlySet<Guid>>();
            var compatibility = new Dictionary<(Guid RecipeId, Guid RequiredIngredientId, Guid CandidateIngredientId), CompatibilityType>();
            foreach (var pair in scenario.Substitutes)
            {
                var split = pair.Split("=>", StringSplitOptions.TrimEntries);
                var candidate = ingredients[split[0]];
                var required = ingredients[split[1]];
                substitutes[(recipe.Id, required.Id)] = new HashSet<Guid> { candidate.Id };
                compatibility[(recipe.Id, required.Id, candidate.Id)] = CompatibilityType.SubstituteAllowed;
            }

            var availableIds = scenario.Basket.Select(name => ingredients[name].Id).ToArray();
            var prohibitedIds = scenario.Prohibited.Select(name => ingredients[name].Id).ToArray();

            var sw = Stopwatch.StartNew();
            var result = engine.EvaluateRecipe(
                recipe,
                new RecipeEvaluationContext(availableIds, prohibitedIds, substitutes, condimentIds, compatibility));
            sw.Stop();

            var actual = ClassifyRecipeDecision(result);
            rows.Add(new RecipeResultRow(
                scenario.ScenarioId,
                scenario.RecipeName,
                scenario.Basket,
                scenario.Mandatory,
                scenario.Optional,
                scenario.Prohibited,
                scenario.Substitutes,
                scenario.ExpectedDecision,
                actual,
                Math.Round((double)result.MatchPercentage / 100, 4),
                string.Equals(scenario.ExpectedDecision, actual, StringComparison.OrdinalIgnoreCase),
                result.Explanation.MissingMandatoryCount > 0 || result.Explanation.Reason.Contains("missing", StringComparison.OrdinalIgnoreCase),
                result.Explanation.RejectedBecauseProhibited,
                Math.Round(sw.Elapsed.TotalMilliseconds, 4),
                scenario.Type,
                result.Explanation.Reason));
        }

        return rows;
    }

    private static string ClassifyRecipeDecision(RecipeEvaluationResult result)
    {
        if (result.Rejected && result.Explanation.RejectedBecauseProhibited)
            return "Yasak nedeniyle elendi";
        if (result.Rejected)
            return "Düşük skor / önerilmemeli";
        if (result.MissingMandatoryCount == 0 && result.Explanation.UsedSubstituteIngredientIds.Count > 0)
            return "Tam Uyum (Alternatifli)";
        if (result.MissingMandatoryCount == 0)
            return "Tam Uyum";
        if (result.MissingMandatoryCount == 1)
            return "1 Eksikle Olur";
        return "Uygun Değil";
    }

    private static RecipeSummary SummarizeRecipe(IReadOnlyList<RecipeResultRow> rows)
    {
        var total = rows.Count;
        var correct = rows.Count(r => r.IsCorrect);
        var prohibitedRows = rows.Where(r => r.Type == "prohibited").ToList();
        var substituteRows = rows.Where(r => r.Type == "substitute").ToList();
        var condimentRows = rows.Where(r => r.Type == "condiment_guard").ToList();
        var latencies = rows.Select(r => r.LatencyMs).ToArray();
        return new RecipeSummary(
            total,
            correct,
            Percent(correct, total),
            Percent(prohibitedRows.Count(r => r.IsCorrect), prohibitedRows.Count),
            Percent(substituteRows.Count(r => r.IsCorrect), substituteRows.Count),
            Percent(condimentRows.Count(r => r.IsCorrect), condimentRows.Count),
            Average(latencies),
            Median(latencies),
            P95(latencies));
    }

    private static List<PremiumGuardRow> RunPremiumGuardBenchmark(IReadOnlyDictionary<string, Ingredient> ingredients)
    {
        var dietitianA = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var dietitianB = Guid.Parse("22222222-2222-2222-2222-222222222222");

        Recipe Recipe(string name, Guid? dietitianId, bool isPublic)
        {
            var recipe = new Recipe(Guid.NewGuid(), dietitianId, name, "Benchmark recipe", isPublic);
            recipe.AddMandatoryIngredient(ingredients["Domates"]);
            return recipe;
        }

        var ownPrivate = Recipe("Dietitian A Private", dietitianA, false);
        var otherPrivate = Recipe("Dietitian B Private", dietitianB, false);
        var publicRecipe = Recipe("Public Recipe", null, true);
        var cases = new List<PremiumGuardCase>
        {
            new("P001", "FreeClient", "private recipe match", false, null, false, ownPrivate, "Blocked", "Free user cannot access private recipes."),
            new("P002", "FreeClient", "public recipe match", false, null, true, publicRecipe, "Allowed", "Free user can access public recipes."),
            new("P003", "PremiumClientA", "own dietitian private recipe", true, dietitianA, false, ownPrivate, "Allowed", "Premium user can access own dietitian recipe."),
            new("P004", "PremiumClientA", "dietitian B private recipe", true, dietitianA, false, otherPrivate, "Blocked", "Premium user cannot access another dietitian private recipe."),
            new("P005", "PremiumClientA", "public fallback enabled", true, dietitianA, true, publicRecipe, "Allowed", "Public fallback is allowed when configured."),
            new("P006", "PremiumClientA", "public fallback disabled", true, dietitianA, false, publicRecipe, "Blocked", "Strict premium mode blocks fallback."),
            new("P007", "ExpiredAccessKeyClient", "expired key private recipe", false, null, false, ownPrivate, "Blocked", "Expired key is represented as non-premium."),
            new("P008", "RevokedPremiumClient", "revoked premium private recipe", false, null, false, ownPrivate, "Blocked", "Revoked premium is represented as non-premium."),
            new("P009", "ActiveAccessKeyClient", "active key own private recipe", true, dietitianA, false, ownPrivate, "Allowed", "Active key grants own dietitian access."),
            new("P010", "PremiumClientB", "dietitian A private recipe", true, dietitianB, false, ownPrivate, "Blocked", "Tenant isolation blocks cross-dietitian access."),
        };

        var rows = new List<PremiumGuardRow>();
        foreach (var testCase in cases)
        {
            var visible = PremiumKitchenCandidateFilter
                .ApplyVisibilityPolicy(
                    new[] { testCase.Recipe }.AsQueryable(),
                    testCase.IsPremium,
                    testCase.ActiveDietitianId,
                    testCase.AllowGlobalPublicFallback)
                .Any();
            var actual = visible ? "Allowed" : "Blocked";
            rows.Add(new PremiumGuardRow(
                testCase.CaseId,
                testCase.Actor,
                testCase.Operation,
                testCase.Expected,
                actual,
                visible ? 200 : 403,
                string.Equals(testCase.Expected, actual, StringComparison.OrdinalIgnoreCase),
                testCase.Notes));
        }

        return rows;
    }

    private static PremiumSummary SummarizePremium(IReadOnlyList<PremiumGuardRow> rows)
    {
        var total = rows.Count;
        var correct = rows.Count(r => r.IsCorrect);
        var tenantCases = rows.Where(r => r.EndpointOrOperation.Contains("dietitian", StringComparison.OrdinalIgnoreCase)
                                          || r.Notes.Contains("Tenant", StringComparison.OrdinalIgnoreCase)
                                          || r.Notes.Contains("cross", StringComparison.OrdinalIgnoreCase)).ToList();
        return new PremiumSummary(
            total,
            correct,
            Percent(correct, total),
            Percent(tenantCases.Count(r => r.IsCorrect), tenantCases.Count),
            rows.Where(r => !r.IsCorrect).Select(r => r.CaseId).ToArray());
    }

    private static async Task<List<LatencyRow>> RunInProcessLatencyBenchmark(
        IIngredientNormalizationService normalizationService,
        IReadOnlyDictionary<string, Ingredient> ingredients)
    {
        var rows = new List<LatencyRow>();
        var engine = new RecipeRecommendationEngine();
        var recipe = new Recipe(Guid.NewGuid(), Guid.NewGuid(), "Latency Ton Salad", "Benchmark", isPublic: false);
        recipe.AddMandatoryIngredient(ingredients["Ton Balığı"]);
        recipe.AddOptionalIngredient(ingredients["Marul"]);

        async Task MeasureAsync(string operation, int count, Func<Task> action)
        {
            for (var i = 0; i < count; i++)
            {
                var sw = Stopwatch.StartNew();
                string? error = null;
                try
                {
                    await action();
                }
                catch (Exception ex)
                {
                    error = ex.GetType().Name;
                }
                finally
                {
                    sw.Stop();
                }

                rows.Add(new LatencyRow(operation, i + 1, Math.Round(sw.Elapsed.TotalMilliseconds, 4), error));
            }
        }

        await MeasureAsync("Ingredient normalization", 100, async () => await normalizationService.NormalizeAsync("çeri domates"));
        await MeasureAsync("Kitchen recipe match", 100, () =>
        {
            engine.EvaluateRecipe(
                recipe,
                new RecipeEvaluationContext(
                    new[] { ingredients["Ton Balığı"].Id, ingredients["Marul"].Id },
                    Array.Empty<Guid>()));
            return Task.CompletedTask;
        });
        await MeasureAsync("Premium visibility filter", 100, () =>
        {
            _ = PremiumKitchenCandidateFilter.ApplyVisibilityPolicy(
                new[] { recipe }.AsQueryable(),
                isPremium: true,
                activeDietitianId: recipe.DietitianId,
                allowGlobalPublicFallback: false).ToList();
            return Task.CompletedTask;
        });
        await MeasureAsync("Public recipes filter", 100, () =>
        {
            _ = PremiumKitchenCandidateFilter.ApplyVisibilityPolicy(
                new[] { recipe }.AsQueryable(),
                isPremium: false,
                activeDietitianId: null,
                allowGlobalPublicFallback: true).ToList();
            return Task.CompletedTask;
        });

        return rows;
    }

    private static Dictionary<string, LatencySummary> SummarizeLatency(IReadOnlyList<LatencyRow> rows)
        => rows
            .GroupBy(r => r.Operation)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var values = g.Select(r => r.LatencyMs).ToArray();
                    return new LatencySummary(
                        g.Count(),
                        values.Min(),
                        values.Max(),
                        Average(values),
                        Median(values),
                        P95(values),
                        g.Count(r => r.Error != null));
                });

    private static FileInfo Out(DirectoryInfo outputDir, string fileName)
        => new(System.IO.Path.Combine(outputDir.FullName, fileName));

    private static void WriteJson<T>(FileInfo path, T value)
        => File.WriteAllText(path.FullName, JsonSerializer.Serialize(value, JsonOptions), new UTF8Encoding(false));

    private static void WriteText(FileInfo path, string text)
        => File.WriteAllText(path.FullName, text, new UTF8Encoding(false));

    private static void WriteCsv(FileInfo path, IEnumerable<string> lines)
        => WriteText(path, string.Join(Environment.NewLine, lines) + Environment.NewLine);

    private static IEnumerable<string> NormalizationCsv(IEnumerable<NormalizationResultRow> rows)
    {
        yield return "caseId,input,expectedCanonicalName,actualCanonicalName,expectedLayer,actualLayer,confidence,isCorrect,isUnresolved,latencyMs,group,notes";
        foreach (var row in rows)
            yield return Csv(row.CaseId, row.Input, row.ExpectedCanonicalName, row.ActualCanonicalName, row.ExpectedLayer, row.ActualLayer, row.Confidence, row.IsCorrect, row.IsUnresolved, row.LatencyMs, row.Group, row.Notes);
    }

    private static IEnumerable<string> AblationCsv(IEnumerable<AblationRow> rows)
    {
        yield return "mode,totalCases,accuracyPct,coveragePct,unresolvedRatePct,falseMatchRatePct,averageLatencyMs,notes";
        foreach (var row in rows)
            yield return Csv(row.Mode, row.TotalCases, row.AccuracyPct, row.CoveragePct, row.UnresolvedRatePct, row.FalseMatchRatePct, row.AverageLatencyMs, row.Notes);
    }

    private static IEnumerable<string> RecipeCsv(IEnumerable<RecipeResultRow> rows)
    {
        yield return "scenarioId,basket,recipeName,mandatory,optional,prohibited,substitutes,expectedDecision,actualDecision,score,isCorrect,explanationContainsMissingIngredient,explanationContainsProhibitedReason,latencyMs,type,notes";
        foreach (var row in rows)
            yield return Csv(row.ScenarioId, string.Join("; ", row.Basket), row.RecipeName, string.Join("; ", row.Mandatory), string.Join("; ", row.Optional), string.Join("; ", row.Prohibited), string.Join("; ", row.Substitutes), row.ExpectedDecision, row.ActualDecision, row.Score, row.IsCorrect, row.ExplanationContainsMissingIngredient, row.ExplanationContainsProhibitedReason, row.LatencyMs, row.Type, row.Notes);
    }

    private static IEnumerable<string> PremiumCsv(IEnumerable<PremiumGuardRow> rows)
    {
        yield return "caseId,actor,endpointOrOperation,expected,actual,httpStatus,isCorrect,notes";
        foreach (var row in rows)
            yield return Csv(row.CaseId, row.Actor, row.EndpointOrOperation, row.Expected, row.Actual, row.HttpStatus, row.IsCorrect, row.Notes);
    }

    private static IEnumerable<string> LatencyCsv(IEnumerable<LatencyRow> rows)
    {
        yield return "operation,iteration,latencyMs,error";
        foreach (var row in rows)
            yield return Csv(row.Operation, row.Iteration, row.LatencyMs, row.Error);
    }

    private static string NormalizationMarkdown(NormalizationSummary summary)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Normalization Summary");
        sb.AppendLine();
        sb.AppendLine($"- Total cases: {summary.TotalCases}");
        sb.AppendLine($"- Correct count: {summary.CorrectCount}");
        sb.AppendLine($"- Incorrect count: {summary.IncorrectCount}");
        sb.AppendLine($"- Unresolved count: {summary.UnresolvedCount}");
        sb.AppendLine($"- False match count: {summary.FalseMatchCount}");
        sb.AppendLine($"- Accuracy: {summary.AccuracyPct:F2}%");
        sb.AppendLine($"- Unresolved rate: {summary.UnresolvedRatePct:F2}%");
        sb.AppendLine($"- False match rate: {summary.FalseMatchRatePct:F2}%");
        sb.AppendLine($"- Average latency: {summary.AverageLatencyMs:F4} ms");
        sb.AppendLine($"- Median latency: {summary.MedianLatencyMs:F4} ms");
        sb.AppendLine($"- P95 latency: {summary.P95LatencyMs:F4} ms");
        sb.AppendLine();
        sb.AppendLine("| Layer | Count | Percent |");
        sb.AppendLine("|---|---:|---:|");
        foreach (var (layer, dist) in summary.ResolverLayerDistribution)
            sb.AppendLine($"| {layer} | {dist.Count} | {dist.Percent:F2}% |");
        return sb.ToString();
    }

    private static string AblationMarkdown(IEnumerable<AblationRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Normalization Ablation");
        sb.AppendLine();
        sb.AppendLine("| Mode | Accuracy | Coverage | Unresolved | False Match | Avg Latency | Notes |");
        sb.AppendLine("|---|---:|---:|---:|---:|---:|---|");
        foreach (var row in rows)
            sb.AppendLine($"| {row.Mode} | {FmtPct(row.AccuracyPct)} | {FmtPct(row.CoveragePct)} | {FmtPct(row.UnresolvedRatePct)} | {FmtPct(row.FalseMatchRatePct)} | {FmtMs(row.AverageLatencyMs)} | {row.Notes} |");
        return sb.ToString();
    }

    private static string RecipeMarkdown(RecipeSummary summary)
        => $"""
           # Recipe Engine Summary

           - Total scenarios: {summary.TotalScenarios}
           - Correct decision count: {summary.CorrectDecisionCount}
           - Recipe Match Accuracy: {summary.RecipeMatchAccuracyPct:F2}%
           - Prohibited Filter Success: {summary.ProhibitedFilterSuccessPct:F2}%
           - Substitute Handling Success: {summary.SubstituteHandlingSuccessPct:F2}%
           - Condiment-only Guard Success: {summary.CondimentOnlyGuardSuccessPct:F2}%
           - Average latency: {summary.AverageLatencyMs:F4} ms
           - Median latency: {summary.MedianLatencyMs:F4} ms
           - P95 latency: {summary.P95LatencyMs:F4} ms
           """;

    private static string PremiumMarkdown(PremiumSummary summary)
        => $"""
           # Premium Guard and Tenant Isolation Summary

           - Total cases: {summary.TotalCases}
           - Correct cases: {summary.CorrectCases}
           - Premium Guard Success: {summary.PremiumGuardSuccessPct:F2}%
           - Tenant Isolation Success: {summary.TenantIsolationSuccessPct:F2}%
           - Failed cases: {(summary.FailedCases.Length == 0 ? "none" : string.Join(", ", summary.FailedCases))}
           """;

    private static string LatencyMarkdown(IReadOnlyDictionary<string, LatencySummary> summary)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# API / Operation Latency Summary");
        sb.AppendLine();
        sb.AppendLine("These values are measured in-process against the same service and policy components used by the API layer; they do not include external network latency.");
        sb.AppendLine();
        sb.AppendLine("| Operation | Count | Min | Max | Average | Median | P95 | Errors |");
        sb.AppendLine("|---|---:|---:|---:|---:|---:|---:|---:|");
        foreach (var (operation, row) in summary.OrderBy(x => x.Key))
            sb.AppendLine($"| {operation} | {row.Count} | {row.MinMs:F4} | {row.MaxMs:F4} | {row.AverageMs:F4} | {row.MedianMs:F4} | {row.P95Ms:F4} | {row.ErrorCount} |");
        return sb.ToString();
    }

    private static string OpenAiMarkdown(bool openAiConfigured)
        => openAiConfigured
            ? """
              # OpenAI Fallback Summary

              - OpenAI key configured: true
              - External OpenAI calls were not executed by this artifact test to avoid non-deterministic thesis numbers.
              - Token/cost: not measured
              """
            : """
              # OpenAI Fallback Summary

              - OpenAI key configured: false
              - OpenAI tests skipped.
              - Deterministic normalization, fuzzy matching and rule-based recipe engine results are reported in the other benchmark files.
              - Token/cost: not measured
              """;

    private static string Csv(params object?[] values)
        => string.Join(",", values.Select(value =>
        {
            var text = value switch
            {
                null => "",
                double d => d.ToString("0.####", CultureInfo.InvariantCulture),
                bool b => b ? "true" : "false",
                _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? ""
            };
            return "\"" + text.Replace("\"", "\"\"") + "\"";
        }));

    private static double Percent(int numerator, int denominator)
        => denominator == 0 ? 0 : Math.Round((double)numerator / denominator * 100, 4);

    private static double Average(IEnumerable<double> values)
    {
        var arr = values.ToArray();
        return arr.Length == 0 ? 0 : Math.Round(arr.Average(), 4);
    }

    private static double Median(IEnumerable<double> values)
    {
        var arr = values.OrderBy(v => v).ToArray();
        if (arr.Length == 0) return 0;
        var mid = arr.Length / 2;
        return Math.Round(arr.Length % 2 == 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid], 4);
    }

    private static double P95(IEnumerable<double> values)
    {
        var arr = values.OrderBy(v => v).ToArray();
        if (arr.Length == 0) return 0;
        var index = Math.Max(0, (int)Math.Ceiling(arr.Length * 0.95) - 1);
        return Math.Round(arr[index], 4);
    }

    private static string FmtPct(double? value) => value.HasValue ? $"{value.Value:F2}%" : "-";
    private static string FmtMs(double? value) => value.HasValue ? $"{value.Value:F4} ms" : "-";

    private static bool IsOpenAiConfigured()
        => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OPENAI_API_KEY"))
           || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OpenAI__ApiKey"))
           || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OPENAI__APIKEY"));

    private static DirectoryInfo GetRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(System.IO.Path.Combine(dir.FullName, "MyDietitianMobileApp.sln")))
            dir = dir.Parent;

        return dir ?? throw new DirectoryNotFoundException("Repository root not found.");
    }

    private sealed record NormalizationCase(string CaseId, string Input, string? ExpectedCanonicalName, string ExpectedLayer, string Group);
    private sealed record NormalizationResultRow(string CaseId, string Input, string? ExpectedCanonicalName, string? ActualCanonicalName, string ExpectedLayer, string ActualLayer, double Confidence, bool IsCorrect, bool IsUnresolved, double LatencyMs, string Group, string Notes);
    private sealed record LayerDistribution(int Count, double Percent);
    private sealed record NormalizationSummary(int TotalCases, int CorrectCount, int IncorrectCount, int UnresolvedCount, int FalseMatchCount, double AccuracyPct, double UnresolvedRatePct, double FalseMatchRatePct, double AverageLatencyMs, double MedianLatencyMs, double P95LatencyMs, Dictionary<string, LayerDistribution> ResolverLayerDistribution);
    private sealed record AblationRow(string Mode, int TotalCases, double? AccuracyPct, double? CoveragePct, double? UnresolvedRatePct, double? FalseMatchRatePct, double? AverageLatencyMs, string Notes = "");
    private sealed record RecipeScenario(string ScenarioId, string RecipeName, string[] Basket, string[] Mandatory, string[] Optional, string[] Prohibited, string[] Substitutes, string ExpectedDecision, string Type);
    private sealed record RecipeResultRow(string ScenarioId, string RecipeName, string[] Basket, string[] Mandatory, string[] Optional, string[] Prohibited, string[] Substitutes, string ExpectedDecision, string ActualDecision, double Score, bool IsCorrect, bool ExplanationContainsMissingIngredient, bool ExplanationContainsProhibitedReason, double LatencyMs, string Type, string Notes);
    private sealed record RecipeSummary(int TotalScenarios, int CorrectDecisionCount, double RecipeMatchAccuracyPct, double ProhibitedFilterSuccessPct, double SubstituteHandlingSuccessPct, double CondimentOnlyGuardSuccessPct, double AverageLatencyMs, double MedianLatencyMs, double P95LatencyMs);
    private sealed record PremiumGuardCase(string CaseId, string Actor, string Operation, bool IsPremium, Guid? ActiveDietitianId, bool AllowGlobalPublicFallback, Recipe Recipe, string Expected, string Notes);
    private sealed record PremiumGuardRow(string CaseId, string Actor, string EndpointOrOperation, string Expected, string Actual, int HttpStatus, bool IsCorrect, string Notes);
    private sealed record PremiumSummary(int TotalCases, int CorrectCases, double PremiumGuardSuccessPct, double TenantIsolationSuccessPct, string[] FailedCases);
    private sealed record LatencyRow(string Operation, int Iteration, double LatencyMs, string? Error);
    private sealed record LatencySummary(int Count, double MinMs, double MaxMs, double AverageMs, double MedianMs, double P95Ms, int ErrorCount);
}
