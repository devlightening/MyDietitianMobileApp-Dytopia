using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Recipes;

public class RecipeRecommendationEngineTests
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

    private static (Recipe recipe, Ingredient mandatory, Ingredient optional, Ingredient prohibited) SeedRecipe(AppDbContext db)
    {
        var mandatory = new Ingredient(Guid.NewGuid(), "Mandatory");
        var optional = new Ingredient(Guid.NewGuid(), "Optional");
        var prohibited = new Ingredient(Guid.NewGuid(), "Prohibited");

        db.Ingredients.AddRange(mandatory, optional, prohibited);

        var recipe = new Recipe(Guid.NewGuid(), dietitianId: Guid.NewGuid(), name: "Test Recipe", description: "Desc", isPublic: false);
        recipe.AddMandatoryIngredient(mandatory);
        recipe.AddOptionalIngredient(optional);
        recipe.AddProhibitedIngredient(prohibited);

        db.Recipes.Add(recipe);
        db.SaveChanges();

        return (recipe, mandatory, optional, prohibited);
    }

    [Fact]
    public void Recipe_With_Prohibited_Ingredient_Is_Rejected()
    {
        using var db = CreateDbContext();
        var (recipe, _, _, prohibited) = SeedRecipe(db);
        var engine = CreateEngine();

        var context = new RecipeEvaluationContext(
            availableIngredientIds: new[] { prohibited.Id },
            prohibitedIngredientIds: new[] { prohibited.Id });

        var result = engine.EvaluateRecipe(recipe, context);

        result.Rejected.Should().BeTrue();
        result.Explanation.RejectedBecauseProhibited.Should().BeTrue();
        result.Explanation.IsCookable.Should().BeFalse();
    }

    [Fact]
    public void Recipe_Is_Cookable_When_All_Mandatory_Available()
    {
        using var db = CreateDbContext();
        var (recipe, mandatory, optional, _) = SeedRecipe(db);
        var engine = CreateEngine();

        var context = new RecipeEvaluationContext(
            availableIngredientIds: new[] { mandatory.Id, optional.Id },
            prohibitedIngredientIds: Array.Empty<Guid>());

        var result = engine.EvaluateRecipe(recipe, context);

        result.Rejected.Should().BeFalse();
        result.MissingMandatoryCount.Should().Be(0);
        result.Explanation.IsCookable.Should().BeTrue();
        result.MatchPercentage.Should().Be(100m);
        result.MatchedOptionalCount.Should().Be(1);
    }

    [Fact]
    public void Recipe_Not_Cookable_When_Mandatory_Missing()
    {
        using var db = CreateDbContext();
        var (recipe, mandatory, _, _) = SeedRecipe(db);
        var engine = CreateEngine();

        var context = new RecipeEvaluationContext(
            availableIngredientIds: Array.Empty<Guid>(),
            prohibitedIngredientIds: Array.Empty<Guid>());

        var result = engine.EvaluateRecipe(recipe, context);

        result.Rejected.Should().BeFalse();
        result.MissingMandatoryCount.Should().Be(1);
        result.MissingMandatoryIngredientIds.Should().Contain(mandatory.Id);
        result.Explanation.IsCookable.Should().BeFalse();
    }

    [Fact]
    public void Substitute_Can_Satisfy_Mandatory_Ingredient_When_Configured()
    {
        using var db = CreateDbContext();
        var (recipe, mandatory, _, _) = SeedRecipe(db);
        var engine = CreateEngine();

        var substitute = new Ingredient(Guid.NewGuid(), "Substitute");
        db.Ingredients.Add(substitute);
        db.SaveChanges();

        var substitutes = new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>
        {
            { (recipe.Id, mandatory.Id), new HashSet<Guid> { substitute.Id } }
        };

        var context = new RecipeEvaluationContext(
            availableIngredientIds: new[] { substitute.Id },
            prohibitedIngredientIds: Array.Empty<Guid>(),
            substitutesByRecipeAndRequired: substitutes);

        var result = engine.EvaluateRecipe(recipe, context);

        result.MissingMandatoryCount.Should().Be(0);
        result.Explanation.IsCookable.Should().BeTrue();
        result.Explanation.UsedSubstituteIngredientIds.Should().Contain(substitute.Id);
        result.MatchPercentage.Should().BeGreaterThan(0m);
    }

    [Fact]
    public void Optional_Ingredients_Improve_Score()
    {
        using var db = CreateDbContext();
        var (recipe, mandatory, optional, _) = SeedRecipe(db);
        var engine = CreateEngine();

        var contextWithoutOptional = new RecipeEvaluationContext(
            availableIngredientIds: new[] { mandatory.Id },
            prohibitedIngredientIds: Array.Empty<Guid>());

        var contextWithOptional = new RecipeEvaluationContext(
            availableIngredientIds: new[] { mandatory.Id, optional.Id },
            prohibitedIngredientIds: Array.Empty<Guid>());

        var baseResult = engine.EvaluateRecipe(recipe, contextWithoutOptional);
        var improvedResult = engine.EvaluateRecipe(recipe, contextWithOptional);

        improvedResult.MatchPercentage.Should().BeGreaterThan(baseResult.MatchPercentage);
        improvedResult.MatchedOptionalCount.Should().Be(1);
    }

    [Fact]
    public void Best_Alternative_Is_Ranked_Highest_By_Percentage()
    {
        using var db = CreateDbContext();
        var mandatory = new Ingredient(Guid.NewGuid(), "Mandatory");
        var optionalStrong = new Ingredient(Guid.NewGuid(), "OptStrong");
        var optionalWeak = new Ingredient(Guid.NewGuid(), "OptWeak");

        db.Ingredients.AddRange(mandatory, optionalStrong, optionalWeak);

        var recipeStrong = new Recipe(Guid.NewGuid(), null, "Strong", "desc", isPublic: false);
        recipeStrong.AddMandatoryIngredient(mandatory);
        recipeStrong.AddOptionalIngredient(optionalStrong);
        recipeStrong.AddOptionalIngredient(optionalWeak);

        var recipeWeak = new Recipe(Guid.NewGuid(), null, "Weak", "desc", isPublic: false);
        recipeWeak.AddMandatoryIngredient(mandatory);
        recipeWeak.AddOptionalIngredient(optionalStrong);

        db.Recipes.AddRange(recipeStrong, recipeWeak);
        db.SaveChanges();

        var engine = CreateEngine();

        var context = new RecipeEvaluationContext(
            availableIngredientIds: new[] { mandatory.Id, optionalStrong.Id, optionalWeak.Id },
            prohibitedIngredientIds: Array.Empty<Guid>());

        var ranked = engine.RankRecipes(new[] { recipeWeak, recipeStrong }, context);

        ranked.Should().HaveCount(2);
        ranked[0].Recipe.Name.Should().Be("Strong");
        ranked[1].Recipe.Name.Should().Be("Weak");
    }

    [Fact]
    public void Explanation_Metadata_Is_Populated_For_Cookable_Recipe()
    {
        using var db = CreateDbContext();
        var (recipe, mandatory, optional, _) = SeedRecipe(db);
        var engine = CreateEngine();

        var context = new RecipeEvaluationContext(
            availableIngredientIds: new[] { mandatory.Id, optional.Id },
            prohibitedIngredientIds: Array.Empty<Guid>());

        var result = engine.EvaluateRecipe(recipe, context);

        result.Explanation.IsCookable.Should().BeTrue();
        result.Explanation.MissingMandatoryCount.Should().Be(0);
        result.Explanation.MatchedOptionalCount.Should().Be(1);
        result.Explanation.RejectedBecauseProhibited.Should().BeFalse();
        result.Explanation.Reason.Should().NotBeNullOrWhiteSpace();
    }
}

