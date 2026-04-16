using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Taxonomy;

/// <summary>
/// Integration tests for the thesis core chain:
///   IngredientCompatibilityRule (taxonomy DB)
///   → IIngredientTaxonomyService.GetCompatibleCandidatesAsync()
///   → SubstitutesByRecipeAndRequired (context bridge)
///   → RecipeRecommendationEngine.EvaluateRecipe()
///   → IsCookable / score / substitute metadata
///
/// These tests expose the gap: the production AlternativeMealDecisionService
/// does not yet populate SubstitutesByRecipeAndRequired ("no substitutes in
/// this first slice"). The chain is architecturally complete but the bridge
/// call is missing in the service layer. These tests prove the bridge works
/// end-to-end and serve as the contract for wiring it in.
/// </summary>
public class TaxonomyToEngineIntegrationTests
{
    // ── Helpers ────────────────────────────────────────────────────────────

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static IIngredientTaxonomyService CreateTaxonomyService(AppDbContext db)
        => new IngredientTaxonomyService(db);

    private static IRecipeRecommendationEngine CreateEngine()
        => new RecipeRecommendationEngine();

    /// <summary>
    /// Seeds the core taxonomy scenario used by most tests:
    ///
    ///   Family:  Süt Ürünleri Ailesi
    ///   Members: TamSüt (Base), Yoğurt (Variant)
    ///
    ///   CompatibilityRule: TamSüt → Yoğurt = <paramref name="ruleType"/>
    ///
    ///   Recipe:  "Smoothie" requiring TamSüt (mandatory) + Bal (optional)
    ///
    /// Returns the seeded objects so tests can reference their IDs.
    /// </summary>
    private static async Task<(
        AppDbContext db,
        Ingredient tamSut,
        Ingredient yogurt,
        Ingredient bal,
        Recipe recipe)>
        SeedScenarioAsync(CompatibilityType ruleType)
    {
        var db = CreateDbContext();

        // Ingredients
        var tamSut  = new Ingredient(Guid.NewGuid(), "Tam Yağlı Süt");
        var yogurt  = new Ingredient(Guid.NewGuid(), "Yoğurt");
        var bal     = new Ingredient(Guid.NewGuid(), "Bal");
        db.Ingredients.AddRange(tamSut, yogurt, bal);

        // Family membership (proves taxonomy layer is seeded, used by AreInSameFamily tests)
        var family = new IngredientFamily(Guid.NewGuid(), "Süt Ürünleri Ailesi");
        db.IngredientFamilies.Add(family);

        db.IngredientFamilyMembers.AddRange(
            new IngredientFamilyMember(family.Id, tamSut.Id, IngredientFamilyMemberRole.Base),
            new IngredientFamilyMember(family.Id, yogurt.Id, IngredientFamilyMemberRole.Variant));

        // Compatibility rule
        var rule = new IngredientCompatibilityRule(
            id: Guid.NewGuid(),
            requiredIngredientId: tamSut.Id,
            candidateIngredientId: yogurt.Id,
            compatibilityType: ruleType,
            reason: $"Yoğurt, Tam Yağlı Süt için {ruleType} ikame olarak kullanılabilir.");
        db.IngredientCompatibilityRules.Add(rule);

        // Recipe: mandatory = TamSüt, optional = Bal
        var recipe = new Recipe(Guid.NewGuid(), Guid.NewGuid(), "Smoothie", "Meyve smoothie tarifi", isPublic: false);
        recipe.AddMandatoryIngredient(tamSut);
        recipe.AddOptionalIngredient(bal);
        db.Recipes.Add(recipe);

        await db.SaveChangesAsync();
        return (db, tamSut, yogurt, bal, recipe);
    }

    // ── Tests ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Core thesis scenario.
    ///
    /// Recipe requires TamSüt (mandatory).
    /// DB has: TamSüt → Yoğurt = SubstituteAllowed.
    /// Client basket: [Yoğurt only].
    ///
    /// Chain:
    ///   taxonomy.GetCompatibleCandidatesAsync(TamSüt) → [Yoğurt]
    ///   → build SubstitutesByRecipeAndRequired[(recipe, TamSüt)] = {Yoğurt}
    ///   → engine.EvaluateRecipe(recipe, context)
    ///   → IsCookable = true, substitute Yoğurt recorded
    /// </summary>
    [Fact]
    public async Task SubstituteAllowed_Rule_Makes_Recipe_Cookable_When_Exact_Missing()
    {
        var (db, tamSut, yogurt, bal, recipe) = await SeedScenarioAsync(CompatibilityType.SubstituteAllowed);
        using (db)
        {
            var taxonomy = CreateTaxonomyService(db);
            var engine   = CreateEngine();

            // Step 1: query taxonomy for valid substitutes of TamSüt
            var candidates = await taxonomy.GetCompatibleCandidatesAsync(
                tamSut.Id,
                minimumCompatibility: CompatibilityType.SubstituteAllowed);

            candidates.Should().ContainSingle(c => c.Id == yogurt.Id,
                "taxonomy rule declares Yoğurt as SubstituteAllowed for Tam Yağlı Süt");

            // Step 2: bridge — build SubstitutesByRecipeAndRequired
            var substitutes = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>
            {
                { (recipe.Id, tamSut.Id), new HashSet<Guid>(candidates.Select(c => c.Id)) }
            };

            // Step 3: context — client has Yoğurt, not TamSüt
            var context = new RecipeEvaluationContext(
                availableIngredientIds: new[] { yogurt.Id },
                prohibitedIngredientIds: Array.Empty<Guid>(),
                substitutesByRecipeAndRequired: substitutes);

            // Step 4: engine evaluation
            var result = engine.EvaluateRecipe(recipe, context);

            // Assertions
            result.Rejected.Should().BeFalse();
            result.MissingMandatoryCount.Should().Be(0,
                "mandatory TamSüt is covered via Yoğurt substitute");
            result.Explanation.IsCookable.Should().BeTrue();
            result.Explanation.UsedSubstituteIngredientIds.Should().Contain(yogurt.Id,
                "engine must record which substitute was actually used");
            result.MatchPercentage.Should().BeGreaterThan(0m);
            result.Explanation.Reason.Should().NotBeNullOrWhiteSpace();
        }
    }

    /// <summary>
    /// FamilyCompatible is a valid substitute tier when minimumCompatibility = SubstituteAllowed.
    /// GetCompatibleCandidatesAsync includes FamilyCompatible in its valid types for that minimum.
    /// The engine should therefore also accept it as a substitute.
    /// </summary>
    [Fact]
    public async Task FamilyCompatible_Rule_Is_Returned_By_Taxonomy_And_Enables_Cooking()
    {
        var (db, tamSut, yogurt, bal, recipe) = await SeedScenarioAsync(CompatibilityType.FamilyCompatible);
        using (db)
        {
            var taxonomy = CreateTaxonomyService(db);
            var engine   = CreateEngine();

            var candidates = await taxonomy.GetCompatibleCandidatesAsync(
                tamSut.Id,
                minimumCompatibility: CompatibilityType.SubstituteAllowed);

            candidates.Should().ContainSingle(c => c.Id == yogurt.Id,
                "FamilyCompatible is included in valid tiers for minimumCompatibility=SubstituteAllowed");

            var substitutes = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>
            {
                { (recipe.Id, tamSut.Id), new HashSet<Guid>(candidates.Select(c => c.Id)) }
            };

            var context = new RecipeEvaluationContext(
                availableIngredientIds: new[] { yogurt.Id },
                prohibitedIngredientIds: Array.Empty<Guid>(),
                substitutesByRecipeAndRequired: substitutes,
                substituteCompatibilityByRecipeRequiredAndCandidate: new Dictionary<(Guid, Guid, Guid), CompatibilityType>
                {
                    [(recipe.Id, tamSut.Id, yogurt.Id)] = CompatibilityType.FamilyCompatible,
                });

            var result = engine.EvaluateRecipe(recipe, context);

            result.Explanation.IsCookable.Should().BeTrue();
            result.Explanation.UsedSubstituteIngredientIds.Should().Contain(yogurt.Id);
            result.MissingMandatoryCount.Should().Be(0);
        }
    }

    [Fact]
    public async Task Engine_Prefers_Stronger_Substitute_Tier_When_Multiple_Available()
    {
        var (db, tamSut, yogurt, _, recipe) = await SeedScenarioAsync(CompatibilityType.FamilyCompatible);
        using (db)
        {
            var engine = CreateEngine();

            var kefir = new Ingredient(Guid.NewGuid(), "Kefir");
            db.Ingredients.Add(kefir);

            db.IngredientCompatibilityRules.Add(new IngredientCompatibilityRule(
                id: Guid.NewGuid(),
                requiredIngredientId: tamSut.Id,
                candidateIngredientId: kefir.Id,
                compatibilityType: CompatibilityType.SubstituteAllowed,
                reason: "Kefir is a stronger direct substitute for full-fat milk."));

            await db.SaveChangesAsync();

            var substitutes = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>
            {
                [(recipe.Id, tamSut.Id)] = new HashSet<Guid> { yogurt.Id, kefir.Id }
            };

            var compatibility = new Dictionary<(Guid, Guid, Guid), CompatibilityType>
            {
                [(recipe.Id, tamSut.Id, yogurt.Id)] = CompatibilityType.FamilyCompatible,
                [(recipe.Id, tamSut.Id, kefir.Id)] = CompatibilityType.SubstituteAllowed,
            };

            var context = new RecipeEvaluationContext(
                availableIngredientIds: new[] { yogurt.Id, kefir.Id },
                prohibitedIngredientIds: Array.Empty<Guid>(),
                substitutesByRecipeAndRequired: substitutes,
                substituteCompatibilityByRecipeRequiredAndCandidate: compatibility);

            var result = engine.EvaluateRecipe(recipe, context);

            result.Explanation.IsCookable.Should().BeTrue();
            result.Explanation.UsedSubstituteIngredientIds.Should().ContainSingle()
                .Which.Should().Be(kefir.Id);
            result.Explanation.SubstituteMandatoryMatchedCount.Should().Be(1);
        }
    }

    /// <summary>
    /// NotCompatible rule must NOT surface as a substitute.
    /// GetCompatibleCandidatesAsync must return empty for NotCompatible rules,
    /// and the engine must correctly mark the recipe as non-cookable.
    /// </summary>
    [Fact]
    public async Task NotCompatible_Rule_Yields_No_Substitute_And_Recipe_Is_Not_Cookable()
    {
        var (db, tamSut, yogurt, _, recipe) = await SeedScenarioAsync(CompatibilityType.NotCompatible);
        using (db)
        {
            var taxonomy = CreateTaxonomyService(db);
            var engine   = CreateEngine();

            // Taxonomy must return empty — NotCompatible is never a valid substitute
            var candidates = await taxonomy.GetCompatibleCandidatesAsync(
                tamSut.Id,
                minimumCompatibility: CompatibilityType.SubstituteAllowed);

            candidates.Should().BeEmpty(
                "NotCompatible rules must not be returned as substitute candidates");

            // No substitutes dict → engine gets empty context
            var context = new RecipeEvaluationContext(
                availableIngredientIds: new[] { yogurt.Id },
                prohibitedIngredientIds: Array.Empty<Guid>());

            var result = engine.EvaluateRecipe(recipe, context);

            result.Explanation.IsCookable.Should().BeFalse(
                "without a substitute mapping, missing TamSüt is unresolved");
            result.MissingMandatoryCount.Should().Be(1);
            result.MissingMandatoryIngredientIds.Should().Contain(tamSut.Id);
        }
    }

    /// <summary>
    /// When the client basket contains the exact required ingredient,
    /// no substitution should be triggered and the score should reflect
    /// the optional ingredient coverage too.
    ///
    /// Scores: TamSüt (mandatory, present) + Bal (optional, present) → 100%
    ///         TamSüt (mandatory, present) + Bal (optional, absent)  → 50%
    /// </summary>
    [Fact]
    public async Task Exact_Ingredient_Available_Scores_Higher_Than_Substitute_Without_Optional()
    {
        var (db, tamSut, yogurt, bal, recipe) = await SeedScenarioAsync(CompatibilityType.SubstituteAllowed);
        using (db)
        {
            var taxonomy = CreateTaxonomyService(db);
            var engine   = CreateEngine();

            var candidates = await taxonomy.GetCompatibleCandidatesAsync(
                tamSut.Id,
                minimumCompatibility: CompatibilityType.SubstituteAllowed);

            var substitutes = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>
            {
                { (recipe.Id, tamSut.Id), new HashSet<Guid>(candidates.Select(c => c.Id)) }
            };

            // Basket A: only substitute (Yoğurt) — mandatory covered via sub, optional (Bal) missing → 50%
            var contextSubOnly = new RecipeEvaluationContext(
                availableIngredientIds: new[] { yogurt.Id },
                prohibitedIngredientIds: Array.Empty<Guid>(),
                substitutesByRecipeAndRequired: substitutes);

            // Basket B: exact ingredient + optional → 100%
            var contextFull = new RecipeEvaluationContext(
                availableIngredientIds: new[] { tamSut.Id, bal.Id },
                prohibitedIngredientIds: Array.Empty<Guid>());

            var resultSubOnly = engine.EvaluateRecipe(recipe, contextSubOnly);
            var resultFull    = engine.EvaluateRecipe(recipe, contextFull);

            resultSubOnly.Explanation.IsCookable.Should().BeTrue();
            resultFull.Explanation.IsCookable.Should().BeTrue();

            resultFull.MatchPercentage.Should().Be(100m,
                "all required (mandatory + optional) ingredients present");
            resultSubOnly.MatchPercentage.Should().Be(50m,
                "mandatory covered by substitute but optional Bal is absent → 1/2 covered");

            resultFull.MatchPercentage.Should().BeGreaterThan(resultSubOnly.MatchPercentage,
                "full basket with exact ingredients outscores substitute-only basket");
        }
    }

    /// <summary>
    /// Family membership query is independent of compatibility rules.
    /// TamSüt and Yoğurt both belong to Süt Ürünleri Ailesi.
    /// An unrelated ingredient does not share the family.
    /// </summary>
    [Fact]
    public async Task AreInSameFamily_Reflects_Seeded_Family_Membership()
    {
        var (db, tamSut, yogurt, _, _) = await SeedScenarioAsync(CompatibilityType.SubstituteAllowed);
        using (db)
        {
            var taxonomy = CreateTaxonomyService(db);

            var sameFamilyResult = await taxonomy.AreInSameFamilyAsync(tamSut.Id, yogurt.Id);
            sameFamilyResult.Should().BeTrue(
                "both are members of Süt Ürünleri Ailesi");

            var outsider = new Ingredient(Guid.NewGuid(), "Elma");
            db.Ingredients.Add(outsider);
            await db.SaveChangesAsync();

            var differentFamilyResult = await taxonomy.AreInSameFamilyAsync(tamSut.Id, outsider.Id);
            differentFamilyResult.Should().BeFalse(
                "Elma has no family membership");
        }
    }

    /// <summary>
    /// GetCompatibilityAsync returns the rule type stored in DB.
    /// This is the single-pair lookup used when building per-ingredient context.
    /// </summary>
    [Fact]
    public async Task GetCompatibilityAsync_Returns_Correct_CompatibilityType_From_DB()
    {
        var (db, tamSut, yogurt, _, _) = await SeedScenarioAsync(CompatibilityType.SubstituteAllowed);
        using (db)
        {
            var taxonomy = CreateTaxonomyService(db);

            var type = await taxonomy.GetCompatibilityAsync(tamSut.Id, yogurt.Id);
            type.Should().Be(CompatibilityType.SubstituteAllowed);

            // Self-lookup always returns ExactOnly regardless of rules
            var selfType = await taxonomy.GetCompatibilityAsync(tamSut.Id, tamSut.Id);
            selfType.Should().Be(CompatibilityType.ExactOnly);

            // No rule for reverse direction → NotCompatible
            var reverseType = await taxonomy.GetCompatibilityAsync(yogurt.Id, tamSut.Id);
            reverseType.Should().Be(CompatibilityType.NotCompatible);
        }
    }
}
