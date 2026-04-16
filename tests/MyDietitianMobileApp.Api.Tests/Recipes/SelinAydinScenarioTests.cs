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
/// Regression test suite for the "Avokadolu Yumurta Tostu" runtime fix.
///
/// Spec: docs/avokadolu-yumurta-tostu-match-fix-spec.md
///
/// Root cause that was fixed:
///   1. DB schema: IsDemo/IsDraft/IsHiddenFromProduction columns missing → endpoint crash
///   2. Recipe data: mandatory set included Tam Buğday Ekmeği (no Ekmek substitute),
///      Kapya Biber, Limon → 3 missing mandatories → NOT_ELIGIBLE
///
/// This test suite verifies deterministic evaluator behavior for the Selin Aydın scenario
/// and the general production-safety filter contract.
/// </summary>
public class SelinAydinScenarioTests
{
    private readonly ITestOutputHelper _out;
    private readonly IRecipeRecommendationEngine _engine;

    private static readonly Guid DietitianSelinAydin = new("8f1866ab-b4ad-4b81-80c0-6525ec84c538");

    public SelinAydinScenarioTests(ITestOutputHelper output)
    {
        _out = output;
        _engine = new RecipeRecommendationEngine();
    }

    private static Ingredient Ing(string name, Guid? id = null)
        => new(id ?? Guid.NewGuid(), name);

    // ── SA-01: Avokadolu Yumurta Tostu — Ekmek + Yumurta + Avokado → FULL_MATCH via substitute ──

    /// <summary>
    /// After the data fix:
    ///   Mandatory: Yumurta, Avokado, Tam Buğday Ekmeği (with Ekmek as substitute)
    ///   Optional:  Kapya Biber, Limon
    ///   Basket:    Ekmek, Yumurta, Avokado
    ///
    /// Expected: FULL_MATCH via substitute (0 missing mandatory after substitute resolution)
    /// </summary>
    [Fact]
    public void SA01_EkmekYumurtaAvokado_WithSubstituteMapping_IsFullMatch()
    {
        // Ingredient IDs mirroring the real DB seed data
        var ekmek          = Ing("Ekmek",          new Guid("ee00002c-0000-0000-0000-000000000000"));
        var yumurta        = Ing("Yumurta",         new Guid("4d4b69f8-ee5b-4ada-a9d3-a3ec5e05eef1"));
        var avokado        = Ing("Avokado",         new Guid("ee00001e-0000-0000-0000-000000000000"));
        var tamBugdayEkmek = Ing("Tam Buğday Ekmeği", new Guid("f679a0cd-7f1b-49d2-b3bd-3c37c8e8fa1b"));
        var kapyaBiber     = Ing("Kapya Biber",      new Guid("0356b1f4-da25-4916-82b2-067411f1cd87"));
        var limon          = Ing("Limon",            new Guid("ee00001f-0000-0000-0000-000000000000"));

        var recipeId = new Guid("aa275392-6474-4bda-8afa-e515ab540c1a");

        var recipe = new Recipe(recipeId, DietitianSelinAydin,
            "Avokadolu Yumurta Tostu",
            "Tam buğday ekmeği veya ekmek üzerine avokado ve yumurta ile hazırlanan tarif.",
            isPublic: false);

        recipe.AddMandatoryIngredient(yumurta);
        recipe.AddMandatoryIngredient(avokado);
        recipe.AddMandatoryIngredient(tamBugdayEkmek);
        recipe.AddOptionalIngredient(kapyaBiber);
        recipe.AddOptionalIngredient(limon);

        // Basket: Ekmek + Yumurta + Avokado (exactly what Selin selects)
        var basket = new[] { ekmek, yumurta, avokado };

        // Substitute: Ekmek covers Tam Buğday Ekmeği
        var substitutes = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>
        {
            [(recipeId, tamBugdayEkmek.Id)] = new HashSet<Guid> { ekmek.Id }
        };

        var ctx = new RecipeEvaluationContext(
            availableIngredientIds: basket.Select(i => i.Id).ToList(),
            prohibitedIngredientIds: Array.Empty<Guid>(),
            substitutesByRecipeAndRequired: substitutes);

        var result = _engine.EvaluateRecipe(recipe, ctx);

        result.Rejected.Should().BeFalse("no prohibited ingredient conflict");
        result.MissingMandatoryCount.Should().Be(0,
            "Ekmek substitutes Tam Buğday Ekmeği; all 3 mandatory ingredients are covered");
        result.Explanation.UsedSubstituteIngredientIds.Should().Contain(ekmek.Id,
            "Ekmek was used as a substitute for Tam Buğday Ekmeği");

        _out.WriteLine($"SA01: missing={result.MissingMandatoryCount} usedSub=Ekmek score={result.MatchPercentage:F1}");
    }

    // ── SA-02: Without substitute mapping, recipe is NOT_ELIGIBLE ─────────────

    /// <summary>
    /// Confirms the pre-fix state: if no substitute mapping exists, the recipe drops to
    /// NOT_ELIGIBLE (3 missing: Tam Buğday Ekmeği, Kapya Biber moved to mandatory for test,
    /// Limon moved to mandatory for test).
    ///
    /// This test documents the "before" state for regression clarity.
    /// </summary>
    [Fact]
    public void SA02_WithoutSubstituteMapping_ThreeMissingMandatory_IsNotEligible()
    {
        var yumurta        = Ing("Yumurta",          new Guid("4d4b69f8-ee5b-4ada-a9d3-a3ec5e05eef1"));
        var avokado        = Ing("Avokado",           new Guid("ee00001e-0000-0000-0000-000000000000"));
        var tamBugdayEkmek = Ing("Tam Buğday Ekmeği", new Guid("f679a0cd-7f1b-49d2-b3bd-3c37c8e8fa1b"));
        var kapyaBiber     = Ing("Kapya Biber",       new Guid("0356b1f4-da25-4916-82b2-067411f1cd87"));
        var limon          = Ing("Limon",             new Guid("ee00001f-0000-0000-0000-000000000000"));
        var ekmek          = Ing("Ekmek",             new Guid("ee00002c-0000-0000-0000-000000000000"));

        // Original recipe with ALL 5 as mandatory and NO substitute
        var recipe = new Recipe(Guid.NewGuid(), DietitianSelinAydin,
            "Avokadolu Yumurta Tostu (before fix)",
            "desc", isPublic: false);
        recipe.AddMandatoryIngredient(yumurta);
        recipe.AddMandatoryIngredient(avokado);
        recipe.AddMandatoryIngredient(tamBugdayEkmek);
        recipe.AddMandatoryIngredient(kapyaBiber);
        recipe.AddMandatoryIngredient(limon);

        // Basket: Ekmek + Yumurta + Avokado — no substitutes configured
        var ctx = new RecipeEvaluationContext(
            availableIngredientIds: new[] { ekmek.Id, yumurta.Id, avokado.Id },
            prohibitedIngredientIds: Array.Empty<Guid>());

        var result = _engine.EvaluateRecipe(recipe, ctx);

        result.MissingMandatoryCount.Should().BeGreaterThanOrEqualTo(3,
            "Tam Buğday Ekmeği (Ekmek≠), Kapya Biber, Limon are all mandatory and absent — NOT_ELIGIBLE");
        result.Rejected.Should().BeFalse("no prohibited conflict");

        _out.WriteLine($"SA02 (before-fix state): missing={result.MissingMandatoryCount}");
    }

    // ── SA-03: Production safety filter — IsDemo=true never reaches evaluator ──

    [Fact]
    public void SA03_DemoRecipe_IsFilteredByProductionFlag()
    {
        // Mirrors the RecipeMatchController WHERE clause
        var yumurta = Ing("Yumurta");
        var demoRecipe = new Recipe(Guid.NewGuid(), DietitianSelinAydin,
            "Demo Tarif", "desc", isPublic: false, isDemo: true);
        demoRecipe.AddMandatoryIngredient(yumurta);

        var validRecipe = new Recipe(Guid.NewGuid(), DietitianSelinAydin,
            "Gerçek Tarif", "desc", isPublic: false, isDemo: false);
        validRecipe.AddMandatoryIngredient(yumurta);

        var allRecipes = new[] { demoRecipe, validRecipe };
        var filtered = allRecipes.Where(r => !r.IsDemo && !r.IsDraft && !r.IsHiddenFromProduction).ToList();

        filtered.Should().NotContain(r => r.IsDemo, "IsDemo=true must be excluded at query level");
        filtered.Should().ContainSingle(r => !r.IsDemo, "only the valid recipe must pass");

        _out.WriteLine($"SA03: filtered {allRecipes.Length - filtered.Count} demo recipe(s)");
    }

    // ── SA-04: Premium scope — strict clinic-only vs optional global fallback ──

    [Fact]
    public void SA04_PremiumScope_OwnClinicAndPublicVisible_OtherClinicHidden()
    {
        var otherDietitian = Guid.NewGuid();

        var ownClinic    = new Recipe(Guid.NewGuid(), DietitianSelinAydin, "Klinik",   "d", isPublic: false);
        var otherClinic  = new Recipe(Guid.NewGuid(), otherDietitian,      "Başkası",  "d", isPublic: false);
        var publicRecipe = new Recipe(Guid.NewGuid(), null,                 "Genel",    "d", isPublic: true);

        var baseQ = new[] { ownClinic, otherClinic, publicRecipe }.AsQueryable();

        var strict = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(baseQ, isPremium: true, DietitianSelinAydin, allowGlobalPublicFallback: false)
            .ToList();

        strict.Should().ContainSingle(r => r.Id == ownClinic.Id);
        strict.Should().NotContain(r => r.Id == otherClinic.Id,
            "another dietitian's private recipe must not be accessible");
        strict.Should().NotContain(r => r.Id == publicRecipe.Id,
            "global public fallback is disabled by default — clinic-only pool");

        var withFallback = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(baseQ, isPremium: true, DietitianSelinAydin, allowGlobalPublicFallback: true)
            .ToList();

        withFallback.Should().Contain(r => r.Id == publicRecipe.Id);

        _out.WriteLine($"SA04: strict={strict.Count}, withFallback={withFallback.Count}");
    }

    // ── SA-05: Ranking — FULL_MATCH (substitute) outranks ONE_MISSING ─────────

    [Fact]
    public void SA05_SubstituteFullMatch_OutranksOneMissing()
    {
        var ekmek          = Ing("Ekmek");
        var yumurta        = Ing("Yumurta");
        var avokado        = Ing("Avokado");
        var tamBugdayEkmek = Ing("Tam Buğday Ekmeği");
        var limon          = Ing("Limon");

        // Recipe A: full match via substitute
        var recipeA = new Recipe(Guid.NewGuid(), DietitianSelinAydin,
            "Avokadolu Yumurta Tostu", "d", isPublic: false);
        recipeA.AddMandatoryIngredient(yumurta);
        recipeA.AddMandatoryIngredient(avokado);
        recipeA.AddMandatoryIngredient(tamBugdayEkmek);

        // Recipe B: one missing (limon absent)
        var recipeB = new Recipe(Guid.NewGuid(), DietitianSelinAydin,
            "Limonlu Yumurta", "d", isPublic: false);
        recipeB.AddMandatoryIngredient(yumurta);
        recipeB.AddMandatoryIngredient(limon);

        var substitutes = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>
        {
            [(recipeA.Id, tamBugdayEkmek.Id)] = new HashSet<Guid> { ekmek.Id }
        };

        var ctx = new RecipeEvaluationContext(
            availableIngredientIds: new[] { ekmek.Id, yumurta.Id, avokado.Id },
            prohibitedIngredientIds: Array.Empty<Guid>(),
            substitutesByRecipeAndRequired: substitutes);

        var ranked = _engine.RankRecipes(new[] { recipeB, recipeA }, ctx);

        ranked.Should().HaveCountGreaterThanOrEqualTo(1);
        ranked[0].Recipe.Id.Should().Be(recipeA.Id,
            "FULL_MATCH via substitute must rank above ONE_MISSING");
        ranked[0].MissingMandatoryCount.Should().Be(0);

        _out.WriteLine($"SA05: ranked[0]={ranked[0].Recipe.Name} missing={ranked[0].MissingMandatoryCount}");
    }
}
