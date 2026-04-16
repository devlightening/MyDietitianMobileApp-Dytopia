using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Taxonomy;

/// <summary>
/// GAP 7 — Taxonomy Seed Data Completeness.
///
/// These tests verify that the taxonomy tables are populated with enough data
/// for the rule-based alternative-meal engine to function.  Without at least
/// one IngredientFamily, one CompatibilityRule, and one SubstituteAllowed rule
/// the engine silently degrades to "no rules found" and the thesis demo breaks.
///
/// The tests seed their own minimal taxonomy data so they remain self-contained
/// and green against a fresh, empty in-memory database.
/// </summary>
public class TaxonomySeedVerificationSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public TaxonomySeedVerificationSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ── Seed helpers ──────────────────────────────────────────────────────────

    /// <summary>
    /// Seeds a minimal taxonomy with:
    /// - 2 ingredients (Tomato, Cucumber)
    /// - 1 IngredientFamily ("Nightshades")
    /// - 2 IngredientFamilyMembers
    /// - 2 IngredientCompatibilityRules (SubstituteAllowed bidirectional)
    ///
    /// Idempotent: skips if the "Nightshades" family already exists.
    /// </summary>
    private async Task SeedTaxonomyAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (await db.IngredientFamilies.AnyAsync(f => f.Name == "Nightshades"))
            return;

        // Ingredients
        var tomato   = new Ingredient(Guid.NewGuid(), "TaxTomato");
        var cucumber = new Ingredient(Guid.NewGuid(), "TaxCucumber");
        db.Ingredients.AddRange(tomato, cucumber);
        await db.SaveChangesAsync();

        // Family
        var family = new IngredientFamily(Guid.NewGuid(), "Nightshades", "Solanaceae vegetables");
        db.IngredientFamilies.Add(family);
        await db.SaveChangesAsync();

        // Members
        var member1 = new IngredientFamilyMember(family.Id, tomato.Id, IngredientFamilyMemberRole.Base);
        var member2 = new IngredientFamilyMember(family.Id, cucumber.Id, IngredientFamilyMemberRole.Variant);
        db.IngredientFamilyMembers.AddRange(member1, member2);
        await db.SaveChangesAsync();

        // Compatibility rules (bidirectional SubstituteAllowed)
        var rule1 = new IngredientCompatibilityRule(
            Guid.NewGuid(),
            tomato.Id,
            cucumber.Id,
            CompatibilityType.SubstituteAllowed,
            scorePenalty: 0.05m,
            reason: "Similar texture and moisture content");

        var rule2 = new IngredientCompatibilityRule(
            Guid.NewGuid(),
            cucumber.Id,
            tomato.Id,
            CompatibilityType.SubstituteAllowed,
            scorePenalty: 0.05m,
            reason: "Similar texture and moisture content");

        db.IngredientCompatibilityRules.AddRange(rule1, rule2);
        await db.SaveChangesAsync();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task TaxonomyFamily_MinimumCount_Satisfied()
    {
        await SeedTaxonomyAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var familyCount = await db.IngredientFamilies.CountAsync();

        familyCount.Should().BeGreaterThanOrEqualTo(1,
            "at least one IngredientFamily must exist — without it the taxonomy engine " +
            "has nothing to group ingredients by and alternative-meal matching degrades silently");
    }

    [Fact]
    public async Task TaxonomyCompatibilityRules_MinimumCount_Satisfied()
    {
        await SeedTaxonomyAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var ruleCount = await db.IngredientCompatibilityRules.CountAsync();

        ruleCount.Should().BeGreaterThanOrEqualTo(1,
            "at least one IngredientCompatibilityRule must exist — " +
            "the recipe recommendation engine reads these rules to find acceptable substitutes");
    }

    [Fact]
    public async Task TaxonomySubstituteAllowedRules_AtLeastOneExists()
    {
        await SeedTaxonomyAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var substituteCount = await db.IngredientCompatibilityRules
            .CountAsync(r => r.CompatibilityType == CompatibilityType.SubstituteAllowed);

        substituteCount.Should().BeGreaterThanOrEqualTo(1,
            "at least one SubstituteAllowed rule must exist — this is the minimum signal " +
            "required for IIngredientTaxonomyService.GetCompatibleCandidatesAsync() to return " +
            "a non-empty result and for AlternativeMealDecisionService to offer substitutes");
    }

    [Fact]
    public async Task TaxonomyFamilyMembers_LinkedToExistingIngredients()
    {
        await SeedTaxonomyAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var orphanedMembers = await db.IngredientFamilyMembers
            .Where(m => !db.Ingredients.Any(i => i.Id == m.IngredientId))
            .CountAsync();

        orphanedMembers.Should().Be(0,
            "every IngredientFamilyMember must reference a valid Ingredient — " +
            "orphaned members indicate broken seed data that would cause silent misses in taxonomy lookups");
    }

    [Fact]
    public async Task TaxonomyCompatibilityRules_LinkedToExistingIngredients()
    {
        await SeedTaxonomyAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var danglingRuleCount = await db.IngredientCompatibilityRules
            .Where(r =>
                !db.Ingredients.Any(i => i.Id == r.RequiredIngredientId) ||
                !db.Ingredients.Any(i => i.Id == r.CandidateIngredientId))
            .CountAsync();

        danglingRuleCount.Should().Be(0,
            "every IngredientCompatibilityRule must reference two valid Ingredients — " +
            "dangling rules indicate seed data corruption and would cause runtime exceptions " +
            "in GetCompatibleCandidatesAsync()");
    }

    [Fact]
    public async Task TaxonomyService_GetCompatibleCandidates_ReturnsSubstitutes()
    {
        await SeedTaxonomyAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Find the seeded tomato by canonical name used in this test's seed
        var tomato = await db.Ingredients.FirstOrDefaultAsync(i => i.CanonicalName == "TaxTomato");
        tomato.Should().NotBeNull("seed helper must have added TaxTomato");

        var taxonomyService = new MyDietitianMobileApp.Infrastructure.Services.IngredientTaxonomyService(db);
        var candidates = await taxonomyService.GetCompatibleCandidatesAsync(
            tomato!.Id,
            minimumCompatibility: CompatibilityType.SubstituteAllowed);

        candidates.Should().NotBeEmpty(
            "GetCompatibleCandidatesAsync must return at least the TaxCucumber substitute — " +
            "if this is empty the alternative-meal engine has no substitutes to offer during the thesis demo");
        candidates.Should().Contain(c => c.CanonicalName == "TaxCucumber",
            "TaxCucumber was seeded as a SubstituteAllowed for TaxTomato");
    }
}
