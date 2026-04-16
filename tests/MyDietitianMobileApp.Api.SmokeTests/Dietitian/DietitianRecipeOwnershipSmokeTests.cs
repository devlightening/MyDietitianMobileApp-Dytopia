using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Dietitian;

public class DietitianRecipeOwnershipSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public DietitianRecipeOwnershipSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<string> LoginDietitianAsync(HttpClient http)
    {
        var resp = await http.PostAsJsonAsync("/api/auth/dietitian/login", new
        {
            email = "dietitian1@smoke.local",
            password = "SmokeTest1!"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("token").GetString()!;
    }

    private async Task<(Guid ClientId, Guid MandatoryIngredientId, Guid ProhibitedIngredientId)> SeedRestrictionFixturesAsync()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

        var clientUser = await authDb.UserAccounts
            .AsNoTracking()
            .FirstAsync(u => u.Email == "client1@smoke.local");

        var clientId = clientUser.LinkedClientId!.Value;

        var mandatoryIngredient = new Ingredient(Guid.NewGuid(), $"Smoke Mandatory {Guid.NewGuid():N}");
        var prohibitedIngredient = new Ingredient(Guid.NewGuid(), $"Smoke Prohibited {Guid.NewGuid():N}");

        appDb.Ingredients.AddRange(mandatoryIngredient, prohibitedIngredient);
        appDb.ClientProhibitedIngredients.Add(new ClientProhibitedIngredient(clientId, prohibitedIngredient.Id));

        await appDb.SaveChangesAsync();

        return (clientId, mandatoryIngredient.Id, prohibitedIngredient.Id);
    }

    private static object CreateRecipePayload(
        string name,
        Guid mandatoryIngredientId,
        params Guid[] prohibitedIngredientIds)
    {
        return new
        {
            name,
            description = "Smoke ownership test recipe",
            isPublic = false,
            mandatoryIngredients = new[] { mandatoryIngredientId },
            optionalIngredients = Array.Empty<Guid>(),
            prohibitions = prohibitedIngredientIds,
            tags = Array.Empty<string>(),
            instructions = Array.Empty<string>(),
            prepTimeMinutes = 5,
            cookTimeMinutes = 5,
            servings = 1
        };
    }

    [Fact]
    public async Task CreateRecipe_Writes_Canonical_Prohibited_Ingredients_Without_Legacy_RecipeProhibitions()
    {
        var (clientId, mandatoryIngredientId, prohibitedIngredientId) = await SeedRestrictionFixturesAsync();

        var http = _factory.CreateDefaultClient();
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var createResp = await http.PostAsJsonAsync(
            "/api/dietitian/recipes",
            CreateRecipePayload($"Smoke Canonical Recipe {Guid.NewGuid():N}", mandatoryIngredientId, prohibitedIngredientId));

        createResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var createJson = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var recipeId = createJson.GetProperty("id").GetGuid();

        using var scope = _factory.Services.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var recipe = await appDb.Recipes
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.ProhibitedIngredients)
            .SingleAsync(r => r.Id == recipeId);

        recipe.MandatoryIngredients.Select(i => i.Id).Should().Contain(mandatoryIngredientId);
        recipe.ProhibitedIngredients.Select(i => i.Id).Should().Contain(prohibitedIngredientId);

        (await appDb.RecipeIngredients.CountAsync(ri => ri.RecipeId == recipeId && ri.IngredientId == mandatoryIngredientId && ri.Role == "Mandatory"))
            .Should().Be(1, "legacy explicit mandatory ingredient rows are still needed for compatibility");

        (await appDb.RecipeProhibitions.CountAsync())
            .Should().Be(0, "new recipe writes must not create legacy RecipeProhibitions rows");

        // Keep clientId referenced so the seed is meaningful in this test as well.
        clientId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task DietitianMatch_Uses_Canonical_Client_And_Recipe_Prohibition_Models()
    {
        var (clientId, mandatoryIngredientId, prohibitedIngredientId) = await SeedRestrictionFixturesAsync();

        var http = _factory.CreateDefaultClient();
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var blockedResp = await http.PostAsJsonAsync(
            "/api/dietitian/recipes",
            CreateRecipePayload($"Smoke Blocked Recipe {Guid.NewGuid():N}", mandatoryIngredientId, prohibitedIngredientId));
        blockedResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var blockedId = (await blockedResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var safeResp = await http.PostAsJsonAsync(
            "/api/dietitian/recipes",
            CreateRecipePayload($"Smoke Safe Recipe {Guid.NewGuid():N}", mandatoryIngredientId));
        safeResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var safeId = (await safeResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var matchResp = await http.PostAsJsonAsync("/api/dietitian/recipes/match", new
        {
            clientId,
            basketIngredientIds = new[] { mandatoryIngredientId }
        });

        matchResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var matchJson = await matchResp.Content.ReadFromJsonAsync<JsonElement>();
        var matches = matchJson.GetProperty("matches").EnumerateArray().ToList();

        matches.Select(x => x.GetProperty("recipeId").GetGuid()).Should().Contain(safeId);
        matches.Select(x => x.GetProperty("recipeId").GetGuid()).Should().NotContain(blockedId);

        using var scope = _factory.Services.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        (await appDb.RecipeProhibitions.CountAsync())
            .Should().Be(0, "dietitian create and match flows should now rely on canonical prohibition joins");
    }
}
