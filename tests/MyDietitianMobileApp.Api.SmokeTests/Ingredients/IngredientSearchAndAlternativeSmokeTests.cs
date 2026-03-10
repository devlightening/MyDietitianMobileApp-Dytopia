using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Ingredients;

public class IngredientSearchAndAlternativeSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public IngredientSearchAndAlternativeSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task SeedIngredientsAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (await appDb.Ingredients.AnyAsync())
            return;

        var tomato = new Ingredient(Guid.NewGuid(), "Tomato");
        tomato.AddAlias("Domates");

        var cucumber = new Ingredient(Guid.NewGuid(), "Cucumber");

        appDb.Ingredients.AddRange(tomato, cucumber);
        await appDb.SaveChangesAsync();
    }

    [Fact]
    public async Task Ingredient_Search_Works_With_q_Parameter()
    {
        await SeedIngredientsAsync();

        var client = _factory.CreateDefaultClient();

        var response = await client.GetAsync("/api/ingredients/search?q=Tom");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("total").GetInt32().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Ingredient_Search_Works_With_query_Parameter()
    {
        await SeedIngredientsAsync();

        var client = _factory.CreateDefaultClient();

        var response = await client.GetAsync("/api/ingredients/search?query=Tom");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("total").GetInt32().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Ingredient_Search_Prefers_q_When_Both_Provided()
    {
        await SeedIngredientsAsync();

        var client = _factory.CreateDefaultClient();

        // q=Tom should match, query=DoesNotExist should be ignored
        var response = await client.GetAsync("/api/ingredients/search?q=Tom&query=DoesNotExist");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("total").GetInt32().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Ingredient_Search_With_Empty_Query_Returns_Empty_Result()
    {
        await SeedIngredientsAsync();

        var client = _factory.CreateDefaultClient();

        var response = await client.GetAsync("/api/ingredients/search");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("total").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task Ingredient_Search_Finds_By_Alias()
    {
        await SeedIngredientsAsync();

        var client = _factory.CreateDefaultClient();

        var response = await client.GetAsync("/api/ingredients/search?q=domat");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var ingredients = json.GetProperty("ingredients").EnumerateArray().ToList();
        ingredients.Should().NotBeEmpty();
    }

    private async Task<(string token, Guid clientId, Guid dietitianId, Guid plannedRecipeId, Guid altRecipeId, Guid sharedIngredientId, Guid altOnlyIngredientId)> SeedAlternativeScenarioAsync()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

        // Use client1 and its linked dietitian from the seeder
        var clientUser = await authDb.UserAccounts.FirstAsync(u => u.Email == "client1@smoke.local");
        var clientId = clientUser.LinkedClientId!.Value;

        var link = await appDb.DietitianClientLinks.FirstAsync(l => l.ClientId == clientId);
        var dietitianId = link.DietitianId;

        // Seed ingredients
        var sharedIngredient = new Ingredient(Guid.NewGuid(), "SharedIngredient");
        var altOnlyIngredient = new Ingredient(Guid.NewGuid(), "AltOnlyIngredient");
        var missingIngredient = new Ingredient(Guid.NewGuid(), "MissingIngredient");

        appDb.Ingredients.AddRange(sharedIngredient, altOnlyIngredient, missingIngredient);

        // Seed recipes: planned (requires shared + missing), alternative (requires shared + altOnly)
        var plannedRecipe = new Recipe(Guid.NewGuid(), dietitianId, "Planned Recipe", "Planned description", isPublic: false);
        plannedRecipe.AddMandatoryIngredient(sharedIngredient);
        plannedRecipe.AddMandatoryIngredient(missingIngredient);

        var alternativeRecipe = new Recipe(Guid.NewGuid(), dietitianId, "Alternative Recipe", "Alternative description", isPublic: false);
        alternativeRecipe.AddMandatoryIngredient(sharedIngredient);
        alternativeRecipe.AddMandatoryIngredient(altOnlyIngredient);

        appDb.Recipes.AddRange(plannedRecipe, alternativeRecipe);
        await appDb.SaveChangesAsync();

        // Login as client1 to get token
        var client = _factory.CreateDefaultClient();
        var loginPayload = new
        {
            email = "client1@smoke.local",
            password = "SmokeClient1!"
        };

        var loginResponse = await client.PostAsJsonAsync("/api/client/login", loginPayload);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        var token = loginJson.GetProperty("token").GetString()!;

        return (token, clientId, dietitianId, plannedRecipe.Id, alternativeRecipe.Id, sharedIngredient.Id, altOnlyIngredient.Id);
    }

    [Fact]
    public async Task Alternative_Decision_Returns_NeedsAlternative_When_Recipe_Missing()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var client = _factory.CreateDefaultClient();

        // Login as existing smoke client
        var loginPayload = new
        {
            email = "client1@smoke.local",
            password = "SmokeClient1!"
        };

        var loginResponse = await client.PostAsJsonAsync("/api/client/login", loginPayload);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        var token = loginJson.GetProperty("token").GetString()!;

        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var request = new
        {
            plannedRecipeId = Guid.NewGuid(),
            mealType = (int)MealType.Breakfast,
            clientAvailableIngredients = Array.Empty<Guid>()
        };

        var response = await client.PostAsJsonAsync("/api/alternative/decide", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("canCookOriginal").GetBoolean().Should().BeFalse();
        var explanation = json.GetProperty("explanation").GetString() ?? string.Empty;
        explanation.IndexOf("Planned recipe not found", StringComparison.OrdinalIgnoreCase).Should().BeGreaterThanOrEqualTo(0);
    }

    private async Task<(string token, Guid plannedRecipeId, Guid mandatoryIngredientId)> SeedCookableScenarioAsync()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

        var clientUser = await authDb.UserAccounts.FirstAsync(u => u.Email == "client1@smoke.local");
        var clientId = clientUser.LinkedClientId!.Value;

        var link = await appDb.DietitianClientLinks.FirstAsync(l => l.ClientId == clientId);
        var dietitianId = link.DietitianId;

        var ingredient = new Ingredient(Guid.NewGuid(), "CookableIngredient");
        appDb.Ingredients.Add(ingredient);

        var plannedRecipe = new Recipe(Guid.NewGuid(), dietitianId, "Cookable Recipe", "Can be cooked", isPublic: false);
        plannedRecipe.AddMandatoryIngredient(ingredient);

        appDb.Recipes.Add(plannedRecipe);
        await appDb.SaveChangesAsync();

        var client = _factory.CreateDefaultClient();
        var loginPayload = new
        {
            email = "client1@smoke.local",
            password = "SmokeClient1!"
        };

        var loginResponse = await client.PostAsJsonAsync("/api/client/login", loginPayload);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        var token = loginJson.GetProperty("token").GetString()!;

        return (token, plannedRecipe.Id, ingredient.Id);
    }

    [Fact]
    public async Task Alternative_Decision_Allows_Cooking_Original_When_All_Mandatory_Ingredients_Available()
    {
        var (token, plannedRecipeId, mandatoryIngredientId) = await SeedCookableScenarioAsync();

        var client = _factory.CreateDefaultClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var request = new
        {
            plannedRecipeId,
            mealType = (int)MealType.Breakfast,
            clientAvailableIngredients = new[] { mandatoryIngredientId }
        };

        var response = await client.PostAsJsonAsync("/api/alternative/decide", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("canCookOriginal").GetBoolean().Should().BeTrue();
        json.TryGetProperty("alternativeRecommendation", out var altProp).Should().BeTrue();
        altProp.ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Alternative_Decision_Finds_Alternative_When_Mandatory_Missing()
    {
        var (token, _, _, plannedRecipeId, altRecipeId, sharedIngredientId, altOnlyIngredientId) =
            await SeedAlternativeScenarioAsync();

        var client = _factory.CreateDefaultClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // Client has ingredients for alternative recipe but not all for planned recipe
        var request = new
        {
            plannedRecipeId,
            mealType = (int)MealType.Breakfast,
            clientAvailableIngredients = new[] { sharedIngredientId, altOnlyIngredientId }
        };

        var response = await client.PostAsJsonAsync("/api/alternative/decide", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("canCookOriginal").GetBoolean().Should().BeFalse();

        var alt = json.GetProperty("alternativeRecommendation");
        alt.GetProperty("recipeId").GetGuid().Should().Be(altRecipeId);
    }

    [Fact]
    public async Task Alternative_Decision_Requires_Authentication()
    {
        var client = _factory.CreateDefaultClient();

        var request = new
        {
            plannedRecipeId = Guid.NewGuid(),
            mealType = (int)MealType.Breakfast,
            clientAvailableIngredients = Array.Empty<Guid>()
        };

        var response = await client.PostAsJsonAsync("/api/alternative/decide", request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}

