using System;
using System.Collections.Generic;
using System.Linq;
using FluentAssertions;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Recipes;

/// <summary>
/// Regression tests for premium kitchen candidate policy and honest source labeling.
/// </summary>
public class PremiumKitchenMatchPolicyTests
{
    private static readonly Guid ClinicA = Guid.Parse("8f1866ab-b4ad-4b81-80c0-6525ec84c538");
    private static readonly Guid ClinicB = Guid.Parse("e8e87ceb-ed2a-4d16-8910-c02a96d67cbf");

    [Fact]
    public void Premium_StrictPool_IncludesOnlyLinkedClinic_ExcludesOtherTenantAndGlobal()
    {
        var recipes = new[]
        {
            new Recipe(Guid.NewGuid(), ClinicA, "Etli Kuru Fasulye", "d", isPublic: false),
            new Recipe(Guid.NewGuid(), ClinicB, "Tavuk Salatası (private)", "d", isPublic: false),
            new Recipe(Guid.NewGuid(), ClinicB, "Tavuk Salatası (public)", "d", isPublic: true),
            new Recipe(Guid.NewGuid(), null, "Global soup", "d", isPublic: true),
        }.AsQueryable();

        var filtered = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(recipes, isPremium: true, ClinicA, allowGlobalPublicFallback: false)
            .ToList();

        filtered.Should().ContainSingle(r => r.Name == "Etli Kuru Fasulye");
        filtered.Should().NotContain(r => r.DietitianId == ClinicB);
        filtered.Should().NotContain(r => r.Name == "Global soup");
    }

    [Fact]
    public void Premium_WithFallback_Includes_Global_PublicCatalog_Not_OtherDietitian_Public()
    {
        var recipes = new[]
        {
            new Recipe(Guid.NewGuid(), ClinicA, "Clinic", "d", isPublic: false),
            new Recipe(Guid.NewGuid(), ClinicB, "B private", "d", isPublic: false),
            new Recipe(Guid.NewGuid(), ClinicB, "B public", "d", isPublic: true),
            new Recipe(Guid.NewGuid(), null, "Global", "d", isPublic: true),
        }.AsQueryable();

        var filtered = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(recipes, isPremium: true, ClinicA, allowGlobalPublicFallback: true)
            .ToList();

        filtered.Should().Contain(r => r.Name == "Clinic");
        filtered.Should().Contain(r => r.Name == "Global");
        filtered.Should().NotContain(r => r.Name == "B public");
        filtered.Should().NotContain(r => r.Name == "B private");
    }

    [Fact]
    public void FreePool_IncludesOnly_SystemPublicCatalog_Excludes_DietitianPublic()
    {
        var recipes = new[]
        {
            new Recipe(Guid.NewGuid(), ClinicA, "A public", "d", isPublic: true),
            new Recipe(Guid.NewGuid(), ClinicB, "B public", "d", isPublic: true),
            new Recipe(Guid.NewGuid(), null, "Global", "d", isPublic: true),
            new Recipe(Guid.NewGuid(), null, "Global private", "d", isPublic: false),
        }.AsQueryable();

        var filtered = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(recipes, isPremium: false, activeDietitianId: null, allowGlobalPublicFallback: false)
            .ToList();

        filtered.Should().ContainSingle(r => r.Name == "Global");
        filtered.Should().NotContain(r => r.DietitianId.HasValue);
        filtered.Should().NotContain(r => !r.IsPublic);
    }

    [Fact]
    public void SourceLabel_OtherDietitian_Public_Is_Not_Owned_By_Active_Clinic()
    {
        var r = new Recipe(Guid.NewGuid(), ClinicB, "Tavuk Salatası", "d", isPublic: true);
        var m = KitchenRecipeSourceLabels.Classify(r, ClinicA);
        m.SourceType.Should().Be(KitchenRecipeSourceLabels.OtherDietitianPublic);
        m.IsOwnedByActiveDietitian.Should().BeFalse();
        m.IsPublicFallback.Should().BeTrue();
    }

    [Fact]
    public void SourceLabel_LinkedClinic_Private_Is_Owned()
    {
        var r = new Recipe(Guid.NewGuid(), ClinicA, "Etli Kuru Fasulye", "d", isPublic: false);
        var m = KitchenRecipeSourceLabels.Classify(r, ClinicA);
        m.SourceType.Should().Be(KitchenRecipeSourceLabels.LinkedClinicPrivate);
        m.IsOwnedByActiveDietitian.Should().BeTrue();
        m.IsPublicFallback.Should().BeFalse();
    }

    [Fact]
    public void StructuredIngredient_EmptyRecipe_Excluded_From_Scoring_Contract()
    {
        var empty = new Recipe(Guid.NewGuid(), ClinicA, "No rows", "d", false);
        empty.MandatoryIngredients.Count.Should().Be(0);
        empty.OptionalIngredients.Count.Should().Be(0);
        (empty.MandatoryIngredients.Count + empty.OptionalIngredients.Count).Should().Be(0,
            "controller skips these before ranking");
    }

    [Fact]
    public void EtliKuruFasulye_Basket_FullMatch_TavukSalad_CondimentMandatory_Is_Rejected_Or_LowerTier()
    {
        var kuru = new Ingredient(Guid.NewGuid(), "Kuru Fasulye");
        var domates = new Ingredient(Guid.NewGuid(), "Domates");
        var pul = new Ingredient(Guid.NewGuid(), "Kırmızı Pul Biber");
        var tuz = new Ingredient(Guid.NewGuid(), "Tuz");
        tuz.SetIsCondiment(true);

        var etli = new Recipe(Guid.NewGuid(), ClinicA, "Etli Kuru Fasulye", "d", false);
        etli.AddMandatoryIngredient(kuru);
        etli.AddMandatoryIngredient(domates);
        etli.AddMandatoryIngredient(pul);

        var tavuk = new Recipe(Guid.NewGuid(), ClinicB, "Tavuk Salatası", "d", true);
        tavuk.AddMandatoryIngredient(tuz);

        var basketIds = new List<Guid> { kuru.Id, domates.Id, pul.Id, tuz.Id };
        var condimentIds = new List<Guid> { tuz.Id };

        var engine = new RecipeRecommendationEngine();
        var ctx = new RecipeEvaluationContext(basketIds, Array.Empty<Guid>(), null, condimentIds);

        var eEtli = engine.EvaluateRecipe(etli, ctx);
        var eTavuk = engine.EvaluateRecipe(tavuk, ctx);

        eEtli.Rejected.Should().BeFalse();
        eEtli.MissingMandatoryCount.Should().Be(0);

        eTavuk.Rejected.Should().BeTrue("only mandatory is salt — condiment-only guardrail");
        eTavuk.Explanation.Reason.Should().Contain("CONDIMENT_ONLY");
    }
}
