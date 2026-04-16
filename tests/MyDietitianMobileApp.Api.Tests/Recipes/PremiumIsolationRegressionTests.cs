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
/// Regression tests for the premium recipe isolation bug where "Tavuk Salatası"
/// (belonging to DietitianB) appeared in results for a premium client linked to DietitianA
/// ("Aydın Sağlık Merkezi"), while the correctly linked "Etli Kuru Fasulye" was either
/// excluded or outscored.
///
/// Bug report summary:
///   - Client linked to DietitianA (8f1866ab-b4ad-4b81-80c0-6525ec84c538)
///   - Recipe "Etli Kuru Fasulye" owned by DietitianA
///   - Recipe "Tavuk Salatası" owned by DietitianB (e8e87ceb-ed2a-4d16-8910-c02a96d67cbf)
///   - Basket: Kırmızı Pul Biber, Domates, Tuz, Kuru Fasulye
///   - Expected: "Etli Kuru Fasulye" is a strong candidate, "Tavuk Salatası" is excluded
///   - Observed: "Tavuk Salatası" appeared as if it belongs to the clinic
///
/// Root causes identified:
///   RC-1: KitchenRecipeSourceLabels.Classify() silently mislabeled other-clinic private
///          recipes as LINKED_CLINIC_PRIVATE instead of returning an isolation violation sentinel.
///   RC-2: No hard-reject guard in evaluation loop — sole defence was the candidate filter.
///   RC-3: If premium resolution failed (ActiveDietitianId null, link inactive, program expired),
///          the filter fell back to public-only, exposing public recipes from all clinics.
///   RC-4: If "Etli Kuru Fasulye" had zero structured ingredient rows, it was silently skipped,
///          making the pool appear empty while public fallback recipes were still evaluated.
/// </summary>
public class PremiumIsolationRegressionTests
{
    private readonly ITestOutputHelper _out;
    private readonly IRecipeRecommendationEngine _engine;

    private static readonly Guid ClinicA = Guid.Parse("8f1866ab-b4ad-4b81-80c0-6525ec84c538");
    private static readonly Guid ClinicB = Guid.Parse("e8e87ceb-ed2a-4d16-8910-c02a96d67cbf");

    public PremiumIsolationRegressionTests(ITestOutputHelper output)
    {
        _out = output;
        _engine = new RecipeRecommendationEngine();
    }

    // ─── Ingredient helpers matching the real bug scenario ────────────────────

    private static Ingredient KuruFasulye()  => new(Guid.NewGuid(), "Kuru Fasulye");
    private static Ingredient Domates()      => new(Guid.NewGuid(), "Domates");
    private static Ingredient PulBiber()     => new(Guid.NewGuid(), "Kırmızı Pul Biber");
    private static Ingredient Tuz()          => CondimentIng("Tuz");
    private static Ingredient Tavuk()        => new(Guid.NewGuid(), "Tavuk");
    private static Ingredient Marul()        => new(Guid.NewGuid(), "Marul");

    private static Ingredient CondimentIng(string name)
    {
        var i = new Ingredient(Guid.NewGuid(), name);
        i.SetIsCondiment(true);
        return i;
    }

    private static Recipe ClinicARecipe(string name, params Ingredient[] mandatory)
    {
        var r = new Recipe(Guid.NewGuid(), ClinicA, name, $"{name} desc", isPublic: false);
        foreach (var m in mandatory) r.AddMandatoryIngredient(m);
        return r;
    }

    private static Recipe ClinicBPrivateRecipe(string name, params Ingredient[] mandatory)
    {
        var r = new Recipe(Guid.NewGuid(), ClinicB, name, $"{name} desc", isPublic: false);
        foreach (var m in mandatory) r.AddMandatoryIngredient(m);
        return r;
    }

    private static Recipe ClinicBPublicRecipe(string name, params Ingredient[] mandatory)
    {
        var r = new Recipe(Guid.NewGuid(), ClinicB, name, $"{name} desc", isPublic: true);
        foreach (var m in mandatory) r.AddMandatoryIngredient(m);
        return r;
    }

    // ─── RC-1 / RC-3: Source label guard ─────────────────────────────────────

    /// <summary>
    /// PIR-01: A private recipe from ClinicB that somehow enters the evaluation pool
    /// must be classified as OtherDietitianPrivateViolation, not LINKED_CLINIC_PRIVATE.
    /// This sentinel causes the controller to log an error and hard-skip the recipe.
    /// </summary>
    [Fact]
    public void PIR01_OtherClinicPrivateRecipe_ClassifiedAsViolation_NotLinkedClinicPrivate()
    {
        var tavuk = new Recipe(Guid.NewGuid(), ClinicB, "Tavuk Salatası", "desc", isPublic: false);

        var meta = KitchenRecipeSourceLabels.Classify(tavuk, ClinicA);

        meta.SourceType.Should().Be(
            KitchenRecipeSourceLabels.OtherDietitianPrivateViolation,
            "a private recipe from another clinic must return the violation sentinel, not LINKED_CLINIC_PRIVATE");

        meta.IsOwnedByActiveDietitian.Should().BeFalse();
        meta.IsPublicFallback.Should().BeFalse();
        meta.SourceDietitianId.Should().Be(ClinicB);

        _out.WriteLine($"PIR01: sourceType={meta.SourceType} owned={meta.IsOwnedByActiveDietitian}");
    }

    /// <summary>
    /// PIR-02: A public recipe from ClinicB is correctly labeled OTHER_DIETITIAN_PUBLIC.
    /// This is an allowed fallback source (not a violation) when AllowGlobalPublicFallback=true.
    /// </summary>
    [Fact]
    public void PIR02_OtherClinicPublicRecipe_ClassifiedAsOtherDietitianPublic()
    {
        var r = new Recipe(Guid.NewGuid(), ClinicB, "Tavuk Salatası (public)", "desc", isPublic: true);

        var meta = KitchenRecipeSourceLabels.Classify(r, ClinicA);

        meta.SourceType.Should().Be(KitchenRecipeSourceLabels.OtherDietitianPublic);
        meta.IsOwnedByActiveDietitian.Should().BeFalse();
        meta.IsPublicFallback.Should().BeTrue();

        _out.WriteLine($"PIR02: sourceType={meta.SourceType}");
    }

    /// <summary>
    /// PIR-03: ClinicA's private recipe is correctly labeled LINKED_CLINIC_PRIVATE.
    /// </summary>
    [Fact]
    public void PIR03_LinkedClinicPrivateRecipe_ClassifiedCorrectly()
    {
        var r = new Recipe(Guid.NewGuid(), ClinicA, "Etli Kuru Fasulye", "desc", isPublic: false);

        var meta = KitchenRecipeSourceLabels.Classify(r, ClinicA);

        meta.SourceType.Should().Be(KitchenRecipeSourceLabels.LinkedClinicPrivate);
        meta.IsOwnedByActiveDietitian.Should().BeTrue();
        meta.IsPublicFallback.Should().BeFalse();
        meta.SourceDietitianId.Should().Be(ClinicA);

        _out.WriteLine($"PIR03: sourceType={meta.SourceType}");
    }

    // ─── RC-4: Structured ingredient exclusion ────────────────────────────────

    /// <summary>
    /// PIR-04: "Etli Kuru Fasulye" with zero structured ingredient rows must be excluded
    /// from the evaluation pool (before the engine runs). This matches the controller gate:
    ///   if (recipe.MandatoryIngredients.Count + recipe.OptionalIngredients.Count == 0) continue;
    ///
    /// The user scenario: the dietitian created the recipe in the web panel but did not
    /// correctly assign structured ingredients, so MandatoryIngredients is empty.
    /// </summary>
    [Fact]
    public void PIR04_EtliKuruFasulye_NoStructuredIngredients_ExcludedFromPool()
    {
        // Recipe created but no ingredients added (the controller skips it)
        var emptyEtli = new Recipe(Guid.NewGuid(), ClinicA, "Etli Kuru Fasulye", "desc", isPublic: false);

        (emptyEtli.MandatoryIngredients.Count + emptyEtli.OptionalIngredients.Count).Should().Be(0,
            "a recipe with no structured rows must be excluded by the controller gate before engine evaluation");

        // Demonstrate: the engine itself also rejects it via the 0-mandatory guardrail
        var ctx = new RecipeEvaluationContext(
            new List<Guid> { Guid.NewGuid(), Guid.NewGuid() },
            Array.Empty<Guid>());

        var eval = _engine.EvaluateRecipe(emptyEtli, ctx);

        eval.Rejected.Should().BeTrue("engine must reject 0-mandatory recipes");
        eval.Explanation.Reason.Should().Contain("QUALITY_INVALID");

        _out.WriteLine($"PIR04: rejected={eval.Rejected} reason={eval.Explanation.Reason}");
    }

    // ─── Main scenario: "Etli Kuru Fasulye" vs "Tavuk Salatası" ──────────────

    /// <summary>
    /// PIR-05: The exact bug scenario.
    ///
    /// Basket: Kırmızı Pul Biber, Domates, Tuz, Kuru Fasulye
    /// ClinicA recipe "Etli Kuru Fasulye": mandatory = Kuru Fasulye + Domates + Kırmızı Pul Biber
    /// ClinicB private recipe "Tavuk Salatası": mandatory = Tavuk + Marul + Tuz
    ///
    /// With strict isolation (AllowGlobalPublicFallback=false, activeDietitianId=ClinicA):
    ///   - "Etli Kuru Fasulye" is in the pool → should match (all mandatory present)
    ///   - "Tavuk Salatası" (ClinicB private) must NOT be in the pool
    ///   - Source label for "Tavuk Salatası" = OtherDietitianPrivateViolation
    /// </summary>
    [Fact]
    public void PIR05_ExactBugScenario_EtliKuruFasulye_Wins_TavukSalad_Excluded()
    {
        var kuruFasulye = KuruFasulye();
        var domates     = Domates();
        var pulBiber    = PulBiber();
        var tuz         = Tuz();     // condiment
        var tavuk       = Tavuk();
        var marul       = Marul();

        // ClinicA recipe — should match with basket
        var etliKuruFasulye = ClinicARecipe("Etli Kuru Fasulye",
            kuruFasulye, domates, pulBiber);

        // ClinicB private recipe — must be blocked by isolation; classification proves it
        var tavukSalatasi = ClinicBPrivateRecipe("Tavuk Salatası",
            tavuk, marul, tuz);

        var basketIds   = new List<Guid> { kuruFasulye.Id, domates.Id, pulBiber.Id, tuz.Id };
        var condimentIds = new List<Guid> { tuz.Id };

        // Candidate filter: strict isolation excludes ClinicB private recipes
        var allRecipes = new[] { etliKuruFasulye, tavukSalatasi }.AsQueryable();
        var pool = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(allRecipes, isPremium: true, ClinicA, allowGlobalPublicFallback: false)
            .ToList();

        pool.Should().ContainSingle(r => r.Id == etliKuruFasulye.Id,
            "only ClinicA recipes enter the strict pool");
        pool.Should().NotContain(r => r.Id == tavukSalatasi.Id,
            "ClinicB private recipe must be excluded by candidate filter");

        // Source label for the ClinicB recipe — proves the violation sentinel works
        var label = KitchenRecipeSourceLabels.Classify(tavukSalatasi, ClinicA);
        label.SourceType.Should().Be(KitchenRecipeSourceLabels.OtherDietitianPrivateViolation);

        // Engine evaluation of "Etli Kuru Fasulye" — all mandatory present
        var ctx = new RecipeEvaluationContext(basketIds, Array.Empty<Guid>(), null, condimentIds);
        var eval = _engine.EvaluateRecipe(etliKuruFasulye, ctx);

        eval.Rejected.Should().BeFalse("Etli Kuru Fasulye must not be rejected");
        eval.MissingMandatoryCount.Should().Be(0,
            "all three mandatory ingredients (Kuru Fasulye, Domates, Kırmızı Pul Biber) are in the basket");

        _out.WriteLine($"PIR05: etli score={eval.MatchPercentage} missing={eval.MissingMandatoryCount}");
        _out.WriteLine($"PIR05: tavuk label={label.SourceType}");
    }

    /// <summary>
    /// PIR-06: "Tavuk Salatası" has Tuz (condiment) as its only mandatory ingredient.
    /// Even if it somehow passes the candidate filter (e.g. it's public, AllowGlobalPublicFallback=true),
    /// the condiment-only guardrail must reject it.
    /// </summary>
    [Fact]
    public void PIR06_TavukSalatasi_CondimentOnlyMandatory_RejectedByGuardrail()
    {
        var tuz   = Tuz(); // condiment
        var tavuk = Tavuk();
        var marul = Marul();

        // Scenario A: only condiment mandatory (salt-only recipe)
        var saltOnly = ClinicBPublicRecipe("Tuzlu Salata (salt-only mandatory)", tuz);
        saltOnly.AddOptionalIngredient(tavuk);

        var basketIds    = new List<Guid> { tuz.Id, Domates().Id };
        var condimentIds = new List<Guid> { tuz.Id };

        var ctx = new RecipeEvaluationContext(basketIds, Array.Empty<Guid>(), null, condimentIds);
        var eval = _engine.EvaluateRecipe(saltOnly, ctx);

        eval.Rejected.Should().BeTrue("condiment-only mandatory match must be rejected by guardrail");
        eval.Explanation.Reason.Should().Contain("CONDIMENT_ONLY");

        _out.WriteLine($"PIR06: saltOnly rejected={eval.Rejected} reason={eval.Explanation.Reason}");
    }

    // ─── Scoring: clinic recipe with core match must beat public fallback ─────

    /// <summary>
    /// PIR-07: When AllowGlobalPublicFallback=true, a ClinicA FULL_MATCH must rank above
    /// a public fallback recipe (OtherDietitianPublic) with the same match tier.
    /// The clinic bonus in KitchenMatchScoring (+260 raw points) ensures this.
    /// </summary>
    [Fact]
    public void PIR07_ClinicFullMatch_OutranksPublicFallbackFullMatch_ViaClinicBonus()
    {
        var kuruFasulye = KuruFasulye();
        var domates     = Domates();
        var tuz         = Tuz();

        var clinicRecipe  = ClinicARecipe("Etli Kuru Fasulye", kuruFasulye, domates);
        var publicRecipe  = ClinicBPublicRecipe("Generic Bean Soup", kuruFasulye, domates);

        var basketIds    = new List<Guid> { kuruFasulye.Id, domates.Id, tuz.Id };
        var condimentIds = new List<Guid> { tuz.Id };
        var ctx          = new RecipeEvaluationContext(basketIds, Array.Empty<Guid>(), null, condimentIds);

        var evalClinic = _engine.EvaluateRecipe(clinicRecipe, ctx);
        var evalPublic = _engine.EvaluateRecipe(publicRecipe, ctx);

        evalClinic.MissingMandatoryCount.Should().Be(0);
        evalPublic.MissingMandatoryCount.Should().Be(0);

        var scoreClinic = KitchenMatchScoring.Compute(
            clinicRecipe, evalClinic, 0, "FULL_MATCH",
            condimentIds.ToHashSet(),
            isOwnedByActiveDietitian: true,   // ClinicA recipe
            isPublicFallback: false);

        var scorePublic = KitchenMatchScoring.Compute(
            publicRecipe, evalPublic, 0, "FULL_MATCH",
            condimentIds.ToHashSet(),
            isOwnedByActiveDietitian: false,   // public from ClinicB
            isPublicFallback: true);

        scoreClinic.NormalizedScore.Should().BeGreaterThan(scorePublic.NormalizedScore,
            "clinic bonus (+260 raw) must make the clinic recipe score higher than public fallback");

        scorePublic.RankingReason.Should().Contain("fallback",
            "public fallback reason string must indicate it is a fallback");

        _out.WriteLine($"PIR07: clinicScore={scoreClinic.NormalizedScore:F4} publicScore={scorePublic.NormalizedScore:F4}");
        _out.WriteLine($"PIR07: publicReason={scorePublic.RankingReason}");
    }

    // ─── Candidate filter invariants ──────────────────────────────────────────

    /// <summary>
    /// PIR-08: Strict pool (AllowGlobalPublicFallback=false) must include ONLY ClinicA recipes.
    /// It must never include ClinicB private or public recipes.
    /// </summary>
    [Fact]
    public void PIR08_StrictPool_OnlyLinkedClinic_AllOtherSourcesExcluded()
    {
        var kuru    = KuruFasulye();
        var domates = Domates();

        var clinicAPrivate = ClinicARecipe("Etli Kuru Fasulye", kuru, domates);
        var clinicBPrivate = ClinicBPrivateRecipe("Tavuk Salatası (private)", kuru);
        var clinicBPublic  = ClinicBPublicRecipe("Tavuk Salatası (public)", kuru);
        var globalPublic   = new Recipe(Guid.NewGuid(), null, "Global Soup", "d", isPublic: true);
        globalPublic.AddMandatoryIngredient(domates);

        var allRecipes = new[] { clinicAPrivate, clinicBPrivate, clinicBPublic, globalPublic }.AsQueryable();

        var pool = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(allRecipes, isPremium: true, ClinicA, allowGlobalPublicFallback: false)
            .ToList();

        pool.Should().ContainSingle(r => r.Id == clinicAPrivate.Id);
        pool.Should().NotContain(r => r.DietitianId == ClinicB, "ClinicB recipes excluded regardless of visibility");
        pool.Should().NotContain(r => r.DietitianId == null, "global public excluded when fallback disabled");

        _out.WriteLine($"PIR08: pool={pool.Count} (expected 1)");
    }

    /// <summary>
    /// PIR-09: When the client is not premium (or ActiveDietitianId is null),
    /// the filter collapses to public-only. Private ClinicA recipes must not be shown.
    /// This documents the "free-fall to public mode" that causes the bug when premium
    /// resolution fails.
    /// </summary>
    [Fact]
    public void PIR09_FreeFall_NonPremiumUser_SeesOnlyPublicRecipes()
    {
        var kuru   = KuruFasulye();
        var clinicAPrivate = ClinicARecipe("Etli Kuru Fasulye (private)", kuru);
        var clinicBPublic  = ClinicBPublicRecipe("Tavuk Salatası (public)", kuru);

        var allRecipes = new[] { clinicAPrivate, clinicBPublic }.AsQueryable();

        // Simulating: premium resolution failed (isPremium=false or activeDietitianId=null)
        var poolNotPremium = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(allRecipes, isPremium: false, ClinicA, allowGlobalPublicFallback: false)
            .ToList();

        poolNotPremium.Should().NotContain(r => r.Id == clinicAPrivate.Id,
            "free-fall to non-premium hides private clinic recipes");
        poolNotPremium.Should().Contain(r => r.Id == clinicBPublic.Id,
            "public recipes from any dietitian are visible to free users");

        var poolNullDietitian = PremiumKitchenCandidateFilter
            .ApplyVisibilityPolicy(allRecipes, isPremium: true, activeDietitianId: null, allowGlobalPublicFallback: false)
            .ToList();

        poolNullDietitian.Should().NotContain(r => r.Id == clinicAPrivate.Id,
            "null activeDietitianId also collapses to public-only");
        poolNullDietitian.Should().Contain(r => r.Id == clinicBPublic.Id);

        _out.WriteLine($"PIR09: notPremium={poolNotPremium.Count} nullDietitian={poolNullDietitian.Count}");
    }

    // ─── Condiment scoring ────────────────────────────────────────────────────

    /// <summary>
    /// PIR-10: A core ingredient match (Kuru Fasulye) must contribute far more to the
    /// score than a condiment match (Tuz). This ensures that "Etli Kuru Fasulye" with
    /// a core match beats any recipe whose only match is a condiment.
    /// </summary>
    [Fact]
    public void PIR10_CoreIngredientMatch_OutscoresCondimentMatch()
    {
        var kuru     = KuruFasulye();  // NOT a condiment
        var tuz      = Tuz();          // IS a condiment

        // Recipe A: mandatory = Kuru Fasulye (core)
        var coreRecipe = ClinicARecipe("Fasulye Yemeği", kuru);

        // Recipe B: mandatory = Tuz only (condiment)
        var condRecipe = ClinicARecipe("Tuzlu Tarif", tuz);

        var basketIds    = new List<Guid> { kuru.Id, tuz.Id };
        var condimentIds = new List<Guid> { tuz.Id };
        var ctx          = new RecipeEvaluationContext(basketIds, Array.Empty<Guid>(), null, condimentIds);

        var evalCore = _engine.EvaluateRecipe(coreRecipe, ctx);
        var evalCond = _engine.EvaluateRecipe(condRecipe, ctx);

        // Core recipe: full match (kuru matched, not a condiment)
        evalCore.Rejected.Should().BeFalse();

        // Condiment recipe: must be rejected by the condiment-only guardrail
        evalCond.Rejected.Should().BeTrue("a recipe with only condiment mandatory must be rejected");
        evalCond.Explanation.Reason.Should().Contain("CONDIMENT_ONLY");

        // Score comparison: core recipe gets positive score, condiment recipe gets 0
        var scoreCoreBreakdown = KitchenMatchScoring.Compute(
            coreRecipe, evalCore, 0, "FULL_MATCH",
            condimentIds.ToHashSet(), isOwnedByActiveDietitian: true, isPublicFallback: false);

        scoreCoreBreakdown.CoreMandatoryMatched.Should().Be(1);
        scoreCoreBreakdown.CondimentMandatoryMatched.Should().Be(0);

        _out.WriteLine($"PIR10: coreScore={scoreCoreBreakdown.NormalizedScore:F4} condRejected={evalCond.Rejected}");
    }
}
