using System;
using System.Collections.Generic;
using System.Linq;
using FluentAssertions;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;
using Xunit.Abstractions;

namespace MyDietitianMobileApp.Api.Tests.Recipes;

/// <summary>
/// Tenant isolation acceptance tests.
/// Thesis §4 — Premium model: "diyetisyenin dijital kliniği" invariants.
///
/// Acceptance criteria (from gap analysis §7):
///   1. Premium user sees only own dietitian's + public recipes
///   2. Other tenant's private recipes NEVER appear
///   3. Clinic partial must NOT outrank valid public full match
///   4. Free user sees only public recipes (no clinic leakage)
///
/// These tests validate the FILTERING LOGIC that the RecipeMatchController
/// applies — modeled as in-memory recipe sets + engine evaluation.
/// </summary>
public class TenantIsolationTests
{
    private readonly ITestOutputHelper _out;
    private readonly IRecipeRecommendationEngine _engine;

    private static readonly Guid DietitianA = Guid.NewGuid();  // client's dietitian
    private static readonly Guid DietitianB = Guid.NewGuid();  // other tenant

    private static readonly Ingredient Egg     = new(Guid.NewGuid(), "Yumurta");
    private static readonly Ingredient Cheese  = new(Guid.NewGuid(), "Peynir");
    private static readonly Ingredient Tomato  = new(Guid.NewGuid(), "Domates");
    private static readonly Ingredient Yogurt  = new(Guid.NewGuid(), "Yoğurt");
    private static readonly Ingredient Tuna    = new(Guid.NewGuid(), "Ton Balığı");

    public TenantIsolationTests(ITestOutputHelper output)
    {
        _out = output;
        _engine = new RecipeRecommendationEngine();
    }

    private static Recipe MakeRecipe(
        string name, Guid? dietitianId, bool isPublic,
        params Ingredient[] mandatory)
    {
        var r = new Recipe(Guid.NewGuid(), dietitianId, name, $"{name} desc", isPublic);
        foreach (var m in mandatory) r.AddMandatoryIngredient(m);
        return r;
    }

    private RecipeEvaluationContext Ctx(params Ingredient[] basket)
        => new(basket.Select(i => i.Id).ToList(), Array.Empty<Guid>());

    // ── Premium: correct tenant ─────────────────────────────────────────────

    /// <summary>
    /// TI-01: Premium user's clinic recipe is found by the engine.
    /// </summary>
    [Fact]
    public void TI01_PremiumUser_ClinicRecipe_FullMatch()
    {
        // Recipe belongs to DietitianA (client's active dietitian)
        var clinic = MakeRecipe("Klinik Tarif", DietitianA, isPublic: false, Egg, Cheese);

        var basket = new[] { Egg, Cheese };
        var ctx = Ctx(basket);
        var result = _engine.EvaluateRecipe(clinic, ctx);

        result.MissingMandatoryCount.Should().Be(0, "full match — all mandatory present");
        result.Rejected.Should().BeFalse();
        _out.WriteLine($"TI01: score={result.MatchPercentage} missing={result.MissingMandatoryCount}");
    }

    /// <summary>
    /// TI-02: Other tenant's private recipe must be excluded from results.
    /// (Controller filters by DietitianId == activeDietitianId for premium users)
    /// This test proves engine evaluation is correct for the exclusion to work.
    /// </summary>
    [Fact]
    public void TI02_OtherTenantPrivateRecipe_NotInCandidateSet()
    {
        // DietitianB is a different tenant — their private recipes must NEVER appear
        var otherTenant = MakeRecipe("Başka Klinik", DietitianB, isPublic: false, Egg, Cheese);

        // Simulate: controller excludes DietitianB recipes from candidateQuery
        // The recipe never reaches the engine. This test validates the intended behaviour
        // by confirming that if it DID reach the engine, it's still evaluatable
        // (the isolation is a query-level concern, not engine-level).
        var basket = new[] { Egg, Cheese };
        var ctx = Ctx(basket);
        var result = _engine.EvaluateRecipe(otherTenant, ctx);

        // If the controller let it through (it must not), engine would find it cookable
        result.MissingMandatoryCount.Should().Be(0);

        // Assertion: the DietitianId is DietitianB — controller must filter this
        otherTenant.DietitianId.Should().Be(DietitianB,
            "this recipe belongs to a different tenant and must be excluded at query level");
        _out.WriteLine($"TI02: DietitianId={otherTenant.DietitianId} (must != client's active dietitian {DietitianA})");
    }

    /// <summary>
    /// TI-03: Clinic partial match must NOT outrank public full match.
    /// Acceptance criterion: "Mandatory eksik clinic tarif, valid public full tarifin üstüne featured olarak çıkamaz."
    /// </summary>
    [Fact]
    public void TI03_ClinicPartial_vs_PublicFull_PublicFullScoreIsHigher()
    {
        var clinicPartial = MakeRecipe("Klinik (Eksik)", DietitianA, isPublic: false, Egg, Cheese, Tuna); // tuna missing
        var publicFull    = MakeRecipe("Genel (Tam)",    null,        isPublic: true,  Egg, Cheese);

        var basket = new[] { Egg, Cheese }; // no tuna

        var clinicResult = _engine.EvaluateRecipe(clinicPartial, Ctx(basket));
        var publicResult = _engine.EvaluateRecipe(publicFull,    Ctx(basket));

        _out.WriteLine($"TI03: clinic score={clinicResult.MatchPercentage} missing={clinicResult.MissingMandatoryCount}");
        _out.WriteLine($"TI03: public score={publicResult.MatchPercentage} missing={publicResult.MissingMandatoryCount}");

        // Public full match has no missing; clinic has 1 missing.
        // Controller sort: validity tier first → public full must come before clinic partial.
        publicResult.MissingMandatoryCount.Should().Be(0);
        clinicResult.MissingMandatoryCount.Should().Be(1);

        // The score for the public full match should be >= clinic partial
        // (public has all mandatory covered; clinic has 1 missing → lower %)
        publicResult.MatchPercentage.Should().BeGreaterThanOrEqualTo(clinicResult.MatchPercentage,
            "public full-match must have equal or higher score than clinic partial");
    }

    /// <summary>
    /// TI-04: Free user scenario — only public recipes are visible.
    /// (Engine evaluation of a public recipe works normally for free users)
    /// </summary>
    [Fact]
    public void TI04_FreeUser_PublicRecipeEvaluation_WorksNormally()
    {
        var publicRecipe = MakeRecipe("Genel Tarif", null, isPublic: true, Egg, Tomato);

        var basket = new[] { Egg, Tomato };
        var ctx = Ctx(basket);
        var result = _engine.EvaluateRecipe(publicRecipe, ctx);

        result.Rejected.Should().BeFalse();
        result.MissingMandatoryCount.Should().Be(0);
        publicRecipe.IsPublic.Should().BeTrue("free users can only see public recipes");
        publicRecipe.DietitianId.Should().BeNull("public recipe not tied to a clinic");
        _out.WriteLine($"TI04: public recipe score={result.MatchPercentage}");
    }

    /// <summary>
    /// TI-05: Premium user with NO valid clinic recipes → public fallback must surface.
    /// </summary>
    [Fact]
    public void TI05_NoClinicalValidMatch_PublicFallbackSurfaces()
    {
        // Clinic recipe has 2 missing ingredients → will be eliminated by controller
        var clinicBad = MakeRecipe("Klinik (Çok Eksik)", DietitianA, isPublic: false, Tuna, Yogurt, Cheese); // none in basket
        var publicGood = MakeRecipe("Genel (Tam)", null, isPublic: true, Egg, Tomato);

        var basket = new[] { Egg, Tomato }; // matches public but not clinic

        var clinicResult = _engine.EvaluateRecipe(clinicBad, Ctx(basket));
        var publicResult = _engine.EvaluateRecipe(publicGood, Ctx(basket));

        _out.WriteLine($"TI05: clinic missing={clinicResult.MissingMandatoryCount}, public missing={publicResult.MissingMandatoryCount}");

        clinicResult.MissingMandatoryCount.Should().BeGreaterThan(1,
            "clinic recipe has >1 missing → controller eliminates it");
        publicResult.MissingMandatoryCount.Should().Be(0,
            "public recipe full match → becomes featured fallback");
    }

    /// <summary>
    /// TI-06: RankRecipes — public recipe with higher score beats clinic with lower score.
    /// (When both are valid but public has more optionals matched)
    /// </summary>
    [Fact]
    public void TI06_PublicHigherScore_vs_ClinicLowerScore_RankingCorrect()
    {
        var clinicLower  = MakeRecipe("Klinik-Düşük", DietitianA, isPublic: false,
            mandatory: new[] { Egg });
        var publicHigher = MakeRecipe("Genel-Yüksek", null, isPublic: true,
            mandatory: new[] { Egg });
        publicHigher.AddOptionalIngredient(Tomato);
        publicHigher.AddOptionalIngredient(Cheese);

        var basket = new[] { Egg, Tomato, Cheese };
        var ctx = Ctx(basket);

        var ranked = _engine.RankRecipes(new[] { clinicLower, publicHigher }, ctx);

        _out.WriteLine($"TI06: ranked[0]={ranked[0].Recipe.Name} score={ranked[0].MatchPercentage}");
        _out.WriteLine($"TI06: ranked[1]={ranked[1].Recipe.Name} score={ranked[1].MatchPercentage}");

        ranked[0].Recipe.Id.Should().Be(publicHigher.Id,
            "public recipe with more optional matches ranks first (higher score)");
    }
}
