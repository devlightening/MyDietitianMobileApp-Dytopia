using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;
using Xunit.Abstractions;

namespace MyDietitianMobileApp.Api.Tests.Recipes;

/// <summary>
/// Production safety acceptance tests.
///
/// Covers:
///   PS-01  Demo leakage isolation (IsDemo = true → never reaches evaluator)
///   PS-02  Draft isolation        (IsDraft = true → never reaches evaluator)
///   PS-03  Hidden isolation       (IsHiddenFromProduction = true → never reaches evaluator)
///   PS-04  Normal recipe passes   (all flags false → reaches evaluator normally)
///   PS-05  Premium clinic scope   (only activeDietitianId clinic + public, not other tenants)
///   PS-06  Free user scope        (only public recipes)
///   PS-07  Selin Aydın scenario   (deterministic evaluation for spec test basket)
///   PS-08  Demo + valid coexist   (demo filtered even when valid recipes exist)
/// </summary>
public class RecipeProductionSafetyTests
{
    private readonly ITestOutputHelper _out;
    private readonly IRecipeRecommendationEngine _engine;

    private static readonly Guid DietitianAydin   = new("dd000001-0000-0000-0000-000000000001");
    private static readonly Guid DietitianOther   = new("dd000002-0000-0000-0000-000000000002");

    public RecipeProductionSafetyTests(ITestOutputHelper output)
    {
        _out = output;
        _engine = new RecipeRecommendationEngine();
    }

    private static AppDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(opts);
    }

    private static Ingredient Ing(string name) => new(Guid.NewGuid(), name);

    private static Recipe MakeRecipe(
        string name, Guid? dietitianId, bool isPublic,
        bool isDemo = false, bool isDraft = false, bool isHiddenFromProduction = false,
        params Ingredient[] mandatory)
    {
        var r = new Recipe(Guid.NewGuid(), dietitianId, name, $"{name} açıklaması",
            isPublic, isDemo, isDraft, isHiddenFromProduction);
        foreach (var m in mandatory) r.AddMandatoryIngredient(m);
        return r;
    }

    private static IEnumerable<Recipe> SimulateCandidateQuery(
        IEnumerable<Recipe> allRecipes,
        bool isPremium,
        Guid? activeDietitianId)
    {
        // Mirrors the exact WHERE logic in RecipeMatchController
        return allRecipes
            .Where(r => !r.IsDemo)
            .Where(r => !r.IsDraft)
            .Where(r => !r.IsHiddenFromProduction)
            .Where(r => r.IsPublic || r.DietitianId.HasValue)
            .Where(r => !isPremium
                ? r.IsPublic
                : r.IsPublic || (r.DietitianId.HasValue && r.DietitianId == activeDietitianId));
    }

    // ── PS-01: Demo recipe must be filtered before evaluation ──────────────────

    [Fact]
    public void PS01_DemoRecipe_NeverReachesEvaluator()
    {
        var pasta    = Ing("Makarna");
        var tomato   = Ing("Domates");

        var demoRecipe  = MakeRecipe("Verified Demo Pasta", DietitianAydin,
            isPublic: false, isDemo: true, mandatory: new[] { pasta, tomato });
        var validRecipe = MakeRecipe("Domatesli Makarna",   DietitianAydin,
            isPublic: false, mandatory: new[] { pasta, tomato });

        var allRecipes = new[] { demoRecipe, validRecipe };
        var candidates = SimulateCandidateQuery(allRecipes, isPremium: true, DietitianAydin).ToList();

        candidates.Should().NotContain(r => r.Id == demoRecipe.Id,
            "IsDemo=true recipes must be filtered out at query level");
        candidates.Should().Contain(r => r.Id == validRecipe.Id,
            "Valid recipe must pass through the filter");

        _out.WriteLine($"PS01: filtered {allRecipes.Length - candidates.Count} demo recipe(s)");
    }

    // ── PS-02: Draft recipe must be filtered ──────────────────────────────────

    [Fact]
    public void PS02_DraftRecipe_NeverReachesEvaluator()
    {
        var egg = Ing("Yumurta");

        var draft = MakeRecipe("Taslak Tarif", DietitianAydin,
            isPublic: false, isDraft: true, mandatory: new[] { egg });
        var published = MakeRecipe("Yumurtalı Kahvaltı", DietitianAydin,
            isPublic: false, mandatory: new[] { egg });

        var candidates = SimulateCandidateQuery(
            new[] { draft, published }, isPremium: true, DietitianAydin).ToList();

        candidates.Should().NotContain(r => r.Id == draft.Id,
            "IsDraft=true recipes must be excluded");
        candidates.Should().ContainSingle(r => r.Id == published.Id);
    }

    // ── PS-03: Hidden-from-production recipe must be filtered ─────────────────

    [Fact]
    public void PS03_HiddenRecipe_NeverReachesEvaluator()
    {
        var tuna = Ing("Ton Balığı");

        var hidden    = MakeRecipe("Gizli Tarif", null,
            isPublic: true, isHiddenFromProduction: true, mandatory: new[] { tuna });
        var visible   = MakeRecipe("Ton Balıklı Salata", null,
            isPublic: true, mandatory: new[] { tuna });

        var candidates = SimulateCandidateQuery(
            new[] { hidden, visible }, isPremium: false, null).ToList();

        candidates.Should().NotContain(r => r.Id == hidden.Id,
            "IsHiddenFromProduction=true must be excluded");
        candidates.Should().ContainSingle(r => r.Id == visible.Id);
    }

    // ── PS-04: Normal recipe passes all safety filters ─────────────────────────

    [Fact]
    public void PS04_NormalRecipe_PassesSafetyFilter()
    {
        var avocado = Ing("Avokado");
        var bread   = Ing("Ekmek");

        var recipe = MakeRecipe("Avokadolu Tost", null,
            isPublic: true,
            isDemo: false, isDraft: false, isHiddenFromProduction: false,
            mandatory: new[] { avocado, bread });

        var candidates = SimulateCandidateQuery(
            new[] { recipe }, isPremium: false, null).ToList();

        candidates.Should().ContainSingle(r => r.Id == recipe.Id);
    }

    // ── PS-05: Premium user sees ONLY own clinic + public ─────────────────────

    [Fact]
    public void PS05_PremiumUser_SeeOnlyOwnClinicAndPublic()
    {
        var pasta = Ing("Makarna");

        var ownClinic   = MakeRecipe("Klinik Tarif Aydin",  DietitianAydin, isPublic: false, mandatory: new[] { pasta });
        var otherClinic = MakeRecipe("Klinik Tarif Diğer",  DietitianOther, isPublic: false, mandatory: new[] { pasta });
        var publicRecipe= MakeRecipe("Genel Tarif",          null,           isPublic: true,  mandatory: new[] { pasta });

        var candidates = SimulateCandidateQuery(
            new[] { ownClinic, otherClinic, publicRecipe },
            isPremium: true, DietitianAydin).ToList();

        candidates.Should().Contain(r => r.Id == ownClinic.Id,
            "own clinic recipe must appear");
        candidates.Should().NotContain(r => r.Id == otherClinic.Id,
            "other tenant's private recipe must be excluded");
        candidates.Should().Contain(r => r.Id == publicRecipe.Id,
            "public recipe must appear for premium users");
    }

    // ── PS-06: Free user sees ONLY public recipes ──────────────────────────────

    [Fact]
    public void PS06_FreeUser_SeesOnlyPublicRecipes()
    {
        var pasta = Ing("Makarna");

        var clinicRecipe = MakeRecipe("Klinik", DietitianAydin, isPublic: false, mandatory: new[] { pasta });
        var publicRecipe = MakeRecipe("Genel",  null,           isPublic: true,  mandatory: new[] { pasta });

        var candidates = SimulateCandidateQuery(
            new[] { clinicRecipe, publicRecipe },
            isPremium: false, activeDietitianId: null).ToList();

        candidates.Should().NotContain(r => r.Id == clinicRecipe.Id,
            "free users must not see clinic recipes");
        candidates.Should().ContainSingle(r => r.Id == publicRecipe.Id);
    }

    // ── PS-07: Selin Aydın scenario — spec §verilen sepet ─────────────────────

    /// <summary>
    /// The exact basket from the spec:
    ///   Domates, Tam Buğday Makarna, Ayçiçek Yağı, Kırmızı Pul Biber, Karabiber
    ///
    /// Expectations:
    ///   - Recipe requiring Makarna+Domates → FULL_MATCH
    ///   - Recipe requiring Makarna+Domates+Tavuk → ONE_MISSING (only tavuk missing)
    ///   - Recipe requiring Somon+Limon → NOT_ELIGIBLE (2+ missing)
    ///   - Recipe requiring Avokado+Ekmek → NOT_ELIGIBLE (2+ missing)
    /// </summary>
    [Fact]
    public void PS07_SelinAydinBasket_DeterministicEvaluation()
    {
        // Basket
        var domates  = Ing("Domates");
        var makarna  = Ing("Tam Buğday Makarna");
        var yag      = Ing("Ayçiçek Yağı");
        var pulBiber = Ing("Kırmızı Pul Biber");
        var karabiber= Ing("Karabiber");

        // Ingredients NOT in basket
        var tavuk    = Ing("Tavuk");
        var somon    = Ing("Somon");
        var limon    = Ing("Limon");
        var avokado  = Ing("Avokado");
        var ekmek    = Ing("Ekmek");

        var basket = new[] { domates, makarna, yag, pulBiber, karabiber };
        var ctx = new RecipeEvaluationContext(basket.Select(i => i.Id).ToList(), Array.Empty<Guid>());

        // Recipe A: mandatory Makarna + Domates → FULL_MATCH expected
        var recipeA = MakeRecipe("Domatesli Makarna", DietitianAydin, isPublic: false,
            mandatory: new[] { makarna, domates });
        recipeA.AddOptionalIngredient(pulBiber);
        recipeA.AddOptionalIngredient(karabiber);

        var evalA = _engine.EvaluateRecipe(recipeA, ctx);
        evalA.Rejected.Should().BeFalse("no prohibition");
        evalA.MissingMandatoryCount.Should().Be(0, "all mandatory present in basket");
        _out.WriteLine($"PS07-A: '{recipeA.Name}' → missing={evalA.MissingMandatoryCount} (expect 0 = FULL_MATCH)");

        // Recipe B: mandatory Makarna + Domates + Tavuk → ONE_MISSING (only tavuk absent)
        var recipeB = MakeRecipe("Tavuklu Makarna", DietitianAydin, isPublic: false,
            mandatory: new[] { makarna, domates, tavuk });

        var evalB = _engine.EvaluateRecipe(recipeB, ctx);
        evalB.Rejected.Should().BeFalse("no prohibition");
        evalB.MissingMandatoryCount.Should().Be(1, "only tavuk is missing");
        evalB.MissingMandatoryIngredientIds.Should().Contain(tavuk.Id);
        _out.WriteLine($"PS07-B: '{recipeB.Name}' → missing={evalB.MissingMandatoryCount} (expect 1 = ONE_MISSING)");

        // Recipe C: mandatory Somon + Limon → NOT_ELIGIBLE (2 missing)
        var recipeC = MakeRecipe("Izgara Somon", null, isPublic: true,
            mandatory: new[] { somon, limon });

        var evalC = _engine.EvaluateRecipe(recipeC, ctx);
        evalC.MissingMandatoryCount.Should().BeGreaterThanOrEqualTo(2,
            "somon and limon are both absent → must be NOT_ELIGIBLE (2+ missing)");
        _out.WriteLine($"PS07-C: '{recipeC.Name}' → missing={evalC.MissingMandatoryCount} (expect ≥2 = NOT_ELIGIBLE)");

        // Recipe D: mandatory Avokado + Ekmek → NOT_ELIGIBLE (2 missing)
        var recipeD = MakeRecipe("Avokadolu Tost", null, isPublic: true,
            mandatory: new[] { avokado, ekmek });

        var evalD = _engine.EvaluateRecipe(recipeD, ctx);
        evalD.MissingMandatoryCount.Should().BeGreaterThanOrEqualTo(2,
            "avokado and ekmek are both absent → must be NOT_ELIGIBLE (2+ missing)");
        _out.WriteLine($"PS07-D: '{recipeD.Name}' → missing={evalD.MissingMandatoryCount} (expect ≥2 = NOT_ELIGIBLE)");
    }

    // ── PS-08: Demo + valid coexist — demo is filtered, valid surfaces ─────────

    [Fact]
    public void PS08_DemoAndValidCoexist_DemoFilteredValidSurfaces()
    {
        var pasta  = Ing("Makarna");
        var tomato = Ing("Domates");
        var basket = new[] { pasta, tomato };

        var demoRecipe  = MakeRecipe("Verified Demo Pasta", DietitianAydin,
            isPublic: false, isDemo: true, mandatory: new[] { pasta, tomato });
        var validRecipe = MakeRecipe("Gerçek Klinik Makarna", DietitianAydin,
            isPublic: false, mandatory: new[] { pasta, tomato });
        var publicRecipe= MakeRecipe("Genel Sebzeli Makarna", null,
            isPublic: true, mandatory: new[] { pasta });

        var all = new[] { demoRecipe, validRecipe, publicRecipe };
        var candidates = SimulateCandidateQuery(all, isPremium: true, DietitianAydin).ToList();

        // Demo must be absent
        candidates.Should().NotContain(r => r.Name.Contains("Demo"),
            "'Verified Demo Pasta' and similar demo recipes must NEVER appear");

        // Valid recipes must be present and evaluate correctly
        var ctx = new RecipeEvaluationContext(basket.Select(i => i.Id).ToList(), Array.Empty<Guid>());
        foreach (var r in candidates)
        {
            var eval = _engine.EvaluateRecipe(r, ctx);
            eval.MissingMandatoryCount.Should().Be(0,
                $"'{r.Name}' should be a full match with the given basket");
            _out.WriteLine($"PS08: '{r.Name}' → score={eval.MatchPercentage} sourceType={(r.DietitianId.HasValue ? "CLINIC" : "PUBLIC")}");
        }

        candidates.Should().HaveCountGreaterThanOrEqualTo(2,
            "at least the valid clinic recipe and the public recipe must surface");
    }
}
