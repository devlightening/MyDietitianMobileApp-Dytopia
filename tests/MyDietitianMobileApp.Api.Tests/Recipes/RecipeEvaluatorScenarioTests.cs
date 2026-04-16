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
/// Spec test plan §9 — deterministic evaluator scenarios.
///
/// RE-01  Full match (all mandatory present)
/// RE-02  One missing (exactly 1 mandatory absent)
/// RE-03  Not eligible (2+ missing)
/// RE-04  Prohibited rejection
/// RE-05  Substitute covers missing mandatory
/// RE-06  Optional does not affect hard decision
/// RE-07  Clinic source bonus does not elevate partial above public full
/// RE-08  Ranking: FULL_MATCH before ONE_MISSING
/// RE-09  Ranking: within FULL_MATCH, higher optional score wins
/// RE-10  Empty basket — all recipes with mandatory are NOT_ELIGIBLE
/// </summary>
public class RecipeEvaluatorScenarioTests
{
    private readonly ITestOutputHelper _out;
    private readonly IRecipeRecommendationEngine _engine;

    public RecipeEvaluatorScenarioTests(ITestOutputHelper output)
    {
        _out = output;
        _engine = new RecipeRecommendationEngine();
    }

    private static Ingredient Ing(string name) => new(Guid.NewGuid(), name);

    private static Recipe Rec(string name, params Ingredient[] mandatory)
    {
        var r = new Recipe(Guid.NewGuid(), null, name, $"{name} desc", isPublic: true);
        foreach (var m in mandatory) r.AddMandatoryIngredient(m);
        return r;
    }

    private static RecipeEvaluationContext Ctx(params Ingredient[] basket)
        => new(basket.Select(i => i.Id).ToList(), Array.Empty<Guid>());

    private static RecipeEvaluationContext CtxWithProhibited(
        IEnumerable<Ingredient> basket, IEnumerable<Ingredient> prohibited)
        => new(basket.Select(i => i.Id).ToList(),
               prohibited.Select(i => i.Id).ToList());

    // ── RE-01: Full match ─────────────────────────────────────────────────────

    [Fact]
    public void RE01_AllMandatoryPresent_IsFullMatch()
    {
        var makarna  = Ing("Makarna");
        var domates  = Ing("Domates");

        var recipe = Rec("Domatesli Makarna", makarna, domates);
        var result = _engine.EvaluateRecipe(recipe, Ctx(makarna, domates));

        result.Rejected.Should().BeFalse();
        result.MissingMandatoryCount.Should().Be(0);
        _out.WriteLine($"RE01: missing={result.MissingMandatoryCount} score={result.MatchPercentage}");
    }

    // ── RE-02: One missing ────────────────────────────────────────────────────

    [Fact]
    public void RE02_ExactlyOneMandatoryAbsent_IsOneMissing()
    {
        var makarna  = Ing("Makarna");
        var domates  = Ing("Domates");
        var tavuk    = Ing("Tavuk");

        var recipe = Rec("Tavuklu Makarna", makarna, domates, tavuk);
        // basket: makarna + domates but NOT tavuk
        var result = _engine.EvaluateRecipe(recipe, Ctx(makarna, domates));

        result.Rejected.Should().BeFalse();
        result.MissingMandatoryCount.Should().Be(1);
        result.MissingMandatoryIngredientIds.Should().Contain(tavuk.Id);
        _out.WriteLine($"RE02: missing={result.MissingMandatoryCount} missingId={tavuk.Id}");
    }

    // ── RE-03: Not eligible (2+ missing) ─────────────────────────────────────

    [Fact]
    public void RE03_TwoOrMoreMandatoryAbsent_NotEligible()
    {
        var somon    = Ing("Somon");
        var limon    = Ing("Limon");
        var recipe   = Rec("Izgara Somon", somon, limon);
        var basket   = Array.Empty<Ingredient>();

        var result = _engine.EvaluateRecipe(recipe, Ctx(basket));

        result.MissingMandatoryCount.Should().BeGreaterThanOrEqualTo(2,
            "both somon and limon are absent — 2 missing → NOT_ELIGIBLE");
        _out.WriteLine($"RE03: missing={result.MissingMandatoryCount}");
    }

    // ── RE-04: Prohibited rejection ───────────────────────────────────────────

    [Fact]
    public void RE04_ProhibitedIngredientInBasket_Rejected()
    {
        var pasta      = Ing("Makarna");
        var peanut     = Ing("Fıstık");   // prohibited (allergy)

        var r = new Recipe(Guid.NewGuid(), null, "Fıstıklı Salata", "desc", isPublic: true);
        r.AddMandatoryIngredient(pasta);
        r.AddProhibitedIngredient(peanut);

        // basket contains the prohibited ingredient
        var ctx = CtxWithProhibited(
            basket: new[] { pasta, peanut },
            prohibited: new[] { peanut });

        var result = _engine.EvaluateRecipe(r, ctx);

        result.Rejected.Should().BeTrue("prohibited ingredient is in basket → hard reject");
        result.Explanation.RejectedBecauseProhibited.Should().BeTrue();
        _out.WriteLine($"RE04: rejected={result.Rejected}");
    }

    // ── RE-05: Substitute covers the missing mandatory ────────────────────────

    [Fact]
    public void RE05_SubstituteCoversMissingMandatory_FullMatch()
    {
        var tamSut   = Ing("Tam Yağlı Süt");
        var yogurt   = Ing("Yoğurt");   // substitute for tamSut

        var recipe = Rec("Smoothie", tamSut);

        var substitutes = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>
        {
            [(recipe.Id, tamSut.Id)] = new HashSet<Guid> { yogurt.Id }
        };

        var ctx = new RecipeEvaluationContext(
            availableIngredientIds: new[] { yogurt.Id },
            prohibitedIngredientIds: Array.Empty<Guid>(),
            substitutesByRecipeAndRequired: substitutes);

        var result = _engine.EvaluateRecipe(recipe, ctx);

        result.Rejected.Should().BeFalse();
        result.MissingMandatoryCount.Should().Be(0,
            "yogurt is a configured substitute for Tam Yağlı Süt → covered");
        result.Explanation.UsedSubstituteIngredientIds.Should().Contain(yogurt.Id);
        _out.WriteLine($"RE05: missing={result.MissingMandatoryCount} usedSub=yogurt");
    }

    // ── RE-06: Optional ingredients do NOT affect hard decision ───────────────

    [Fact]
    public void RE06_ManyOptionalsPresent_DoNotOverrideMissingMandatory()
    {
        var makarna    = Ing("Makarna");
        var tavuk      = Ing("Tavuk");       // mandatory, absent
        var pulBiber   = Ing("Kırmızı Pul Biber");  // optional, present
        var karabiber  = Ing("Karabiber");   // optional, present
        var tuz        = Ing("Tuz");         // optional, present

        var r = new Recipe(Guid.NewGuid(), null, "Tavuklu Makarna", "desc", isPublic: true);
        r.AddMandatoryIngredient(makarna);
        r.AddMandatoryIngredient(tavuk);
        r.AddOptionalIngredient(pulBiber);
        r.AddOptionalIngredient(karabiber);
        r.AddOptionalIngredient(tuz);

        // basket: makarna + all optionals, but NOT tavuk
        var ctx = Ctx(makarna, pulBiber, karabiber, tuz);
        var result = _engine.EvaluateRecipe(r, ctx);

        result.MissingMandatoryCount.Should().Be(1,
            "tavuk is mandatory and absent; optionals cannot compensate");
        result.Rejected.Should().BeFalse();
        _out.WriteLine($"RE06: missing={result.MissingMandatoryCount} optionalMatched={result.MatchedOptionalCount}");
    }

    // ── RE-07: Clinic partial must NOT outrank public full match ──────────────

    [Fact]
    public void RE07_ClinicPartial_DoesNotOutrankPublicFull()
    {
        var egg    = Ing("Yumurta");
        var cheese = Ing("Peynir");
        var tuna   = Ing("Ton Balığı"); // extra mandatory in clinic, absent

        var clinicPartial = new Recipe(
            Guid.NewGuid(), Guid.NewGuid(), "Klinik (Eksik)", "desc", isPublic: false);
        clinicPartial.AddMandatoryIngredient(egg);
        clinicPartial.AddMandatoryIngredient(cheese);
        clinicPartial.AddMandatoryIngredient(tuna); // tuna not in basket

        var publicFull = new Recipe(
            Guid.NewGuid(), null, "Genel (Tam)", "desc", isPublic: true);
        publicFull.AddMandatoryIngredient(egg);
        publicFull.AddMandatoryIngredient(cheese);

        var ctx = Ctx(egg, cheese);
        var clinicResult = _engine.EvaluateRecipe(clinicPartial, ctx);
        var publicResult = _engine.EvaluateRecipe(publicFull,    ctx);

        clinicResult.MissingMandatoryCount.Should().Be(1);
        publicResult.MissingMandatoryCount.Should().Be(0);
        publicResult.MatchPercentage.Should().BeGreaterThanOrEqualTo(clinicResult.MatchPercentage,
            "public full match must have equal-or-higher score than clinic partial");

        _out.WriteLine($"RE07: clinic%={clinicResult.MatchPercentage} public%={publicResult.MatchPercentage}");
    }

    // ── RE-08: Ranking — FULL_MATCH before ONE_MISSING ───────────────────────

    [Fact]
    public void RE08_Ranking_FullMatchBeforeOneMissing()
    {
        var pasta  = Ing("Makarna");
        var tomato = Ing("Domates");
        var chicken= Ing("Tavuk");

        var full    = Rec("Domatesli Makarna",    pasta, tomato);          // 0 missing
        var partial = Rec("Domatesli Tavuk Makarna", pasta, tomato, chicken); // 1 missing

        var ctx     = Ctx(pasta, tomato); // no chicken
        var ranked  = _engine.RankRecipes(new[] { partial, full }, ctx);

        ranked[0].Recipe.Id.Should().Be(full.Id,
            "FULL_MATCH must rank before ONE_MISSING");
        ranked[1].Recipe.Id.Should().Be(partial.Id);
        _out.WriteLine($"RE08: ranked[0]={ranked[0].Recipe.Name} score={ranked[0].MatchPercentage}");
    }

    // ── RE-09: Ranking — higher optional score wins within FULL_MATCH ─────────

    [Fact]
    public void RE09_Ranking_HigherOptionalScoreWinsWithinFullMatch()
    {
        var pasta      = Ing("Makarna");
        var tomato     = Ing("Domates");
        var blackPepper= Ing("Karabiber");
        var flakes     = Ing("Pul Biber");

        var basicPasta = new Recipe(Guid.NewGuid(), null, "Sade Makarna",  "desc", isPublic: true);
        basicPasta.AddMandatoryIngredient(pasta);
        // no optionals

        var richPasta = new Recipe(Guid.NewGuid(), null, "Domatesli Makarna", "desc", isPublic: true);
        richPasta.AddMandatoryIngredient(pasta);
        richPasta.AddOptionalIngredient(tomato);
        richPasta.AddOptionalIngredient(blackPepper);
        richPasta.AddOptionalIngredient(flakes);

        // basket has pasta + all three optionals
        var ctx    = Ctx(pasta, tomato, blackPepper, flakes);
        var ranked = _engine.RankRecipes(new[] { basicPasta, richPasta }, ctx);

        ranked[0].Recipe.Id.Should().Be(richPasta.Id,
            "richPasta has 3 optional matches → higher score → must rank first");
        _out.WriteLine($"RE09: basic%={ranked.First(r => r.Recipe.Id == basicPasta.Id).MatchPercentage} " +
                       $"rich%={ranked.First(r => r.Recipe.Id == richPasta.Id).MatchPercentage}");
    }

    // ── RE-10: Empty basket — all recipes with mandatory are NOT_ELIGIBLE ─────

    [Fact]
    public void RE10_EmptyBasket_AllWithMandatoryAreNotEligible()
    {
        var milk = Ing("Süt");
        var egg  = Ing("Yumurta");

        var recipeA = Rec("Süt Çorbası",  milk);
        var recipeB = Rec("Sahanda Yumurta", egg);

        var ctx = Ctx(); // empty basket

        var evalA = _engine.EvaluateRecipe(recipeA, ctx);
        var evalB = _engine.EvaluateRecipe(recipeB, ctx);

        evalA.MissingMandatoryCount.Should().BeGreaterThan(0);
        evalB.MissingMandatoryCount.Should().BeGreaterThan(0);
        _out.WriteLine($"RE10: A missing={evalA.MissingMandatoryCount} B missing={evalB.MissingMandatoryCount}");
    }
}
