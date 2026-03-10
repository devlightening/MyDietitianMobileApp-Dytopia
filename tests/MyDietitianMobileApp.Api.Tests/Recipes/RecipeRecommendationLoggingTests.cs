using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
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
        var service = new AlternativeMealDecisionService(db, repo, engine);

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
}

