using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Repositories;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Recipes;

public class RecipeRecommendationLoggingTests
{
    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static IRecipeRecommendationEngine CreateEngine()
        => new RecipeRecommendationEngine();

    private static IRecipeRepository CreateRepository(AppDbContext db)
        => new RecipeRepository(db);

    [Fact]
    public async Task AlternativeMealDecision_Logs_Cookable_Original_Decision()
    {
        await using var db = CreateDbContext();

        // Arrange recipe with all mandatory ingredients present
        var ingredient1 = new Ingredient(Guid.NewGuid(), "Ingredient1");
        db.Ingredients.Add(ingredient1);

        var recipe = new Recipe(Guid.NewGuid(), dietitianId: null, name: "Test Recipe", description: "Desc", isPublic: true);
        recipe.AddMandatoryIngredient(ingredient1);

        db.Recipes.Add(recipe);
        await db.SaveChangesAsync();

        var engine = CreateEngine();
        var repo = CreateRepository(db);
        var taxonomy = new IngredientTaxonomyService(db);
        var service = new AlternativeMealDecisionService(db, repo, engine, taxonomy);

        // Act
        var decision = await service.DecideForMealAsync(
            plannedRecipeId: recipe.Id,
            mealType: MealType.Breakfast,
            clientAvailableIngredients: new List<Guid> { ingredient1.Id },
            dietitianId: Guid.NewGuid(),
            CancellationToken.None);

        // Assert core behavior
        Assert.True(decision.CanCookOriginal);

        // Assert log persisted
        var log = await db.RecipeRecommendationLogs.SingleAsync();
        Assert.Equal("alternative_decision", log.Flow);
        Assert.Equal(recipe.Id, log.PlannedRecipeId);
        Assert.Equal(recipe.Id, log.SelectedRecipeId);
        Assert.True(log.OriginalCookable);
        Assert.True(log.MatchPercentage.HasValue);
        Assert.False(log.ProhibitedRejected);
    }

    /// <summary>
    /// Production wiring test: verifies that AlternativeMealDecisionService
    /// now automatically resolves taxonomy substitutes and passes them to the engine.
    ///
    /// Before the wiring: SubstitutesByRecipeAndRequired was always empty →
    ///   basket with only a substitute would yield CanCookOriginal=false (missing mandatory).
    ///
    /// After the wiring: taxonomy rule is queried → substitute populates context →
    ///   engine sees the substitute → CanCookOriginal=true.
    /// </summary>
    [Fact]
    public async Task AlternativeMealDecisionService_Uses_Taxonomy_Substitutes_Automatically()
    {
        await using var db = CreateDbContext();

        // Seed: TamSüt is required, Yoğurt is a SubstituteAllowed substitute
        var tamSut  = new Ingredient(Guid.NewGuid(), "Tam Yağlı Süt");
        var yogurt  = new Ingredient(Guid.NewGuid(), "Yoğurt");
        db.Ingredients.AddRange(tamSut, yogurt);

        var rule = new IngredientCompatibilityRule(
            id: Guid.NewGuid(),
            requiredIngredientId: tamSut.Id,
            candidateIngredientId: yogurt.Id,
            compatibilityType: CompatibilityType.SubstituteAllowed);
        db.IngredientCompatibilityRules.Add(rule);

        var dietitianId = Guid.NewGuid();
        var recipe = new Recipe(Guid.NewGuid(), dietitianId, "Smoothie", "Desc", isPublic: false);
        recipe.AddMandatoryIngredient(tamSut);
        db.Recipes.Add(recipe);

        await db.SaveChangesAsync();

        var service = new AlternativeMealDecisionService(
            db,
            CreateRepository(db),
            CreateEngine(),
            new IngredientTaxonomyService(db));

        // Client basket: only Yoğurt — no TamSüt
        var decision = await service.DecideForMealAsync(
            plannedRecipeId: recipe.Id,
            mealType: MealType.Breakfast,
            clientAvailableIngredients: new List<Guid> { yogurt.Id },
            dietitianId: dietitianId,
            CancellationToken.None);

        decision.CanCookOriginal.Should().BeTrue(
            "taxonomy rule declares Yoğurt as SubstituteAllowed for Tam Yağlı Süt; " +
            "service must now query taxonomy and wire the substitute into the engine context");

        var log = await db.RecipeRecommendationLogs.SingleAsync();
        log.UsedSubstitutes.Should().BeTrue(
            "engine must record that a substitute ingredient was used");
        log.OriginalCookable.Should().BeTrue();
    }
}

