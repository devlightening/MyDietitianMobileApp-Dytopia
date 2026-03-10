using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Ingredients;

public class IngredientNormalizationServiceTests
{
    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static IIngredientNormalizationService CreateService(AppDbContext db)
        => new IngredientNormalizationService(
               db,
               new NullIngredientLlmClient(),
               new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
               new LlmNormalizationOptions());

    private static async Task SeedBasicIngredientsAsync(AppDbContext db)
    {
        var tomato = new Ingredient(Guid.NewGuid(), "Tomato");
        tomato.AddAlias("Domates");
        tomato.AddAlias("TOMATO"); // duplicate alias in different casing

        var yogurt = new Ingredient(Guid.NewGuid(), "Yoğurt");
        yogurt.AddAlias("Yogurt");

        var inactive = new Ingredient(Guid.NewGuid(), "Inactive");
        inactive.SetIsActive(false);

        db.Ingredients.AddRange(tomato, yogurt, inactive);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Exact_Canonical_Match_Returns_Matched_With_Confidence_One()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);
        var service = CreateService(db);

        var result = await service.NormalizeAsync("Tomato");

        result.Status.Should().Be(IngredientMatchStatus.Matched);
        result.MatchedBy.Should().Be(IngredientMatchedBy.Canonical);
        result.Confidence.Should().Be(1.0);
        result.MatchedCanonicalName.Should().Be("Tomato");

        // Logging assertion
        var logs = await db.IngredientNormalizationLogs.ToListAsync();
        logs.Should().HaveCount(1);
        logs[0].RawInput.Should().Be("Tomato");
        logs[0].NormalizedInput.Should().Be("tomato");
        logs[0].Status.Should().Be(result.Status.ToString());
        logs[0].MatchedBy.Should().Be(result.MatchedBy.ToString());
        logs[0].MatchedIngredientId.Should().Be(result.MatchedIngredientId);
    }

    [Fact]
    public async Task Exact_Alias_Match_Returns_Matched_With_Confidence_Less_Than_One()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);
        var service = CreateService(db);

        var result = await service.NormalizeAsync("Domates");

        result.Status.Should().Be(IngredientMatchStatus.Matched);
        result.MatchedBy.Should().Be(IngredientMatchedBy.Alias);
        result.Confidence.Should().Be(0.95);
        result.MatchedCanonicalName.Should().Be("Tomato");

        var logs = await db.IngredientNormalizationLogs.ToListAsync();
        logs.Should().HaveCount(1);
        logs[0].NormalizedInput.Should().Be("domates");
        logs[0].MatchedBy.Should().Be(result.MatchedBy.ToString());
    }

    [Fact]
    public async Task Canonical_Match_Is_Case_Insensitive()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);
        var service = CreateService(db);

        var result = await service.NormalizeAsync("  tOmAtO  ");

        result.NormalizedInput.Should().Be("tomato");
    }

    [Fact]
    public async Task Alias_Match_Is_Case_Insensitive()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);
        var service = CreateService(db);

        var result = await service.NormalizeAsync("yOgUrT");

        result.Status.Should().Be(IngredientMatchStatus.Matched);
        result.MatchedBy.Should().Be(IngredientMatchedBy.Alias);
        result.MatchedCanonicalName.Should().Be("Yoğurt");
    }

    [Fact]
    public async Task Whitespace_Is_Normalized_Before_Matching()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);
        var service = CreateService(db);

        var result = await service.NormalizeAsync("   Tomato   ");

        result.NormalizedInput.Should().Be("tomato");
    }

    [Fact]
    public async Task Simple_Punctuation_Is_Ignored_At_Ends()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);
        var service = CreateService(db);

        var result = await service.NormalizeAsync("\"Tomato,\"");

        result.Status.Should().Be(IngredientMatchStatus.Matched);
        result.MatchedCanonicalName.Should().Be("Tomato");
    }

    [Fact]
    public async Task Unmatched_Input_Returns_Unmatched_Status()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);
        var service = CreateService(db);

        var result = await service.NormalizeAsync("UnknownIngredient");

        result.Status.Should().Be(IngredientMatchStatus.Unmatched);
        result.Confidence.Should().Be(0);
        result.MatchedIngredientId.Should().BeNull();

        var logs = await db.IngredientNormalizationLogs.ToListAsync();
        logs.Should().HaveCount(1);
        logs[0].Status.Should().Be(result.Status.ToString());
        logs[0].MatchedBy.Should().Be(result.MatchedBy.ToString());
    }

    [Fact]
    public async Task Inactive_Ingredients_Are_Not_Matched()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);
        var service = CreateService(db);

        var result = await service.NormalizeAsync("Inactive");

        result.Status.Should().Be(IngredientMatchStatus.Unmatched);
        result.MatchedIngredientId.Should().BeNull();
    }

    [Fact]
    public async Task Duplicate_Alias_Across_Ingredients_Produces_Ambiguous_Result()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);

        // Add another ingredient sharing an alias with existing one
        var secondTomato = new Ingredient(Guid.NewGuid(), "Second Tomato");
        secondTomato.AddAlias("Domates");
        db.Ingredients.Add(secondTomato);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var result = await service.NormalizeAsync("Domates");

        result.Status.Should().Be(IngredientMatchStatus.Ambiguous);
        result.MatchedBy.Should().Be(IngredientMatchedBy.Alias);
        result.Candidates.Should().HaveCount(2);
    }

    [Fact]
    public async Task Canonical_Match_Takes_Precedence_Over_Alias_Match()
    {
        using var db = CreateDbContext();
        await SeedBasicIngredientsAsync(db);

        // Create ingredient whose alias equals another ingredient's canonical name
        var baseIngredient = new Ingredient(Guid.NewGuid(), "Base");
        baseIngredient.AddAlias("Tomato");
        db.Ingredients.Add(baseIngredient);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var result = await service.NormalizeAsync("Tomato");

        result.Status.Should().Be(IngredientMatchStatus.Matched);
        result.MatchedBy.Should().Be(IngredientMatchedBy.Canonical);
        result.MatchedCanonicalName.Should().Be("Tomato");
    }
}

