using System;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Dietitian;

/// <summary>
/// TEZ-CORE / INTEGRATION-PROOF
/// E2E smoke test: Meal plan → completion → compliance chain.
/// Thesis defense checklist item: "Meal plan → completion → compliance E2E smoke test passes against real DB"
///
/// Covers:
/// 1. Dietitian creates a daily plan with a meal item and publishes it
/// 2. Premium client sees the plan with CompletionStatus = "Planned"
/// 3. Client completes the meal → CompletionStatus = "Done"
/// 4. Client undoes the completion → CompletionStatus = "Planned"
/// 5. Client skips a meal → CompletionStatus = "Skipped"
/// </summary>
public class MealPlanComplianceSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public MealPlanComplianceSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private async Task<string> LoginDietitianAsync(System.Net.Http.HttpClient http)
    {
        var resp = await http.PostAsJsonAsync("/api/auth/dietitian/login", new
        {
            email    = "dietitian1@smoke.local",
            password = "SmokeTest1!"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("token").GetString()!;
    }

    private async Task SetClientCookieAsync(System.Net.Http.HttpClient http, string email, string password)
    {
        http.DefaultRequestHeaders.Remove("Cookie");
        var resp = await http.PostAsJsonAsync("/api/client/login", new { email, password });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        resp.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        var raw = cookies!.First(c => c.Contains("access_token"));
        http.DefaultRequestHeaders.Add("Cookie", raw.Split(';')[0]);
    }

    /// <summary>
    /// Gets the domain clientId by logging in as the client and calling /api/client/me.
    /// Clears all auth headers before logging in; restores them to a clean state after.
    /// </summary>
    private async Task<Guid> GetClientDomainIdAsync(System.Net.Http.HttpClient http, string email, string password)
    {
        // Clear any existing auth state
        http.DefaultRequestHeaders.Authorization = null;
        http.DefaultRequestHeaders.Remove("Cookie");

        await SetClientCookieAsync(http, email, password);

        var resp = await http.GetAsync("/api/client/me");
        resp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: $"client {email} should be able to get their own profile");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var clientId = json.GetProperty("clientId").GetGuid();
        clientId.Should().NotBeEmpty();

        // Clean up cookie so caller can set dietitian Bearer token next
        http.DefaultRequestHeaders.Remove("Cookie");

        return clientId;
    }

    // ─── TEST 1: complete → verify Done → undo → verify Planned ─────────────

    [Fact]
    public async Task MealCompletion_Complete_And_Undo_Chain_Works_EndToEnd()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var http = _factory.CreateDefaultClient();

        // 1. Login as client1 first to get their domain clientId from /api/client/me
        var clientId = await GetClientDomainIdAsync(http, "client1@smoke.local", "SmokeClient1!");

        // 2. Switch to dietitian Bearer token
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // 3. Create a daily plan for today
        var createPlanResp = await http.PostAsJsonAsync(
            $"/api/dietitian/daily-plans/clients/{clientId}",
            new { date = today });
        createPlanResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "dietitian should be able to create a plan for today");

        var planJson = await createPlanResp.Content.ReadFromJsonAsync<JsonElement>();
        var planId = planJson.GetProperty("id").GetGuid();
        planId.Should().NotBeEmpty();

        // 4. Add a meal item (Breakfast)
        var addMealResp = await http.PostAsJsonAsync(
            $"/api/dietitian/daily-plans/{planId}/meals",
            new
            {
                time     = "08:00",
                mealType = "Breakfast",
                title    = "Smoke Test Kahvaltı",
                note     = (string?)null,
                calories = 400,
                proteinGrams = (decimal?)null,
                carbsGrams   = (decimal?)null,
                fatGrams     = (decimal?)null,
                recipeId     = (Guid?)null
            });
        addMealResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "dietitian should be able to add a meal item");

        var mealJson = await addMealResp.Content.ReadFromJsonAsync<JsonElement>();
        var mealItemId = mealJson.GetProperty("id").GetGuid();
        mealItemId.Should().NotBeEmpty();

        // 5. Publish the plan
        var publishResp = await http.PutAsync($"/api/dietitian/daily-plans/{planId}/publish", null);
        publishResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "plan must be publishable once it has at least one meal item");

        // 6. Client1 login (cookie-based)
        await SetClientCookieAsync(http, "client1@smoke.local", "SmokeClient1!");
        http.DefaultRequestHeaders.Authorization = null; // clear Bearer

        // 7. Client sees today's plan — meal status = "Planned"
        var todayPlanResp = await http.GetAsync("/api/client/plans/today");
        todayPlanResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "premium client1 should be able to fetch today's published plan");

        var planDto = await todayPlanResp.Content.ReadFromJsonAsync<JsonElement>();
        planDto.TryGetProperty("plan", out var planProp).Should().BeTrue();
        planProp.ValueKind.Should().NotBe(JsonValueKind.Null,
            because: "plan was published for today");

        var items = planProp.GetProperty("items");
        items.GetArrayLength().Should().Be(1);
        items[0].GetProperty("completionStatus").GetString().Should().Be("Planned");

        // 8. Client completes the meal
        var completeResp = await http.PostAsJsonAsync(
            $"/api/client/meals/{mealItemId}/complete",
            new { note = (string?)null });
        completeResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "client should be able to mark the meal as Done");

        // 9. Verify status changed to "Done"
        var afterCompleteResp = await http.GetAsync("/api/client/plans/today");
        afterCompleteResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var afterCompleteDto = await afterCompleteResp.Content.ReadFromJsonAsync<JsonElement>();
        var afterItems = afterCompleteDto.GetProperty("plan").GetProperty("items");
        afterItems[0].GetProperty("completionStatus").GetString().Should().Be("Done",
            because: "meal was just marked as Done");

        // 10. Undo the completion
        var undoResp = await http.DeleteAsync($"/api/client/meals/{mealItemId}/complete");
        undoResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "client should be able to undo a completion");

        // 11. Verify status reverted to "Planned"
        var afterUndoResp = await http.GetAsync("/api/client/plans/today");
        afterUndoResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var afterUndoDto = await afterUndoResp.Content.ReadFromJsonAsync<JsonElement>();
        var afterUndoItems = afterUndoDto.GetProperty("plan").GetProperty("items");
        afterUndoItems[0].GetProperty("completionStatus").GetString().Should().Be("Planned",
            because: "undo should revert status back to Planned");
    }

    // ─── TEST 2: skip meal → verify Skipped ──────────────────────────────────

    [Fact]
    public async Task MealCompletion_Skip_Sets_Status_To_Skipped()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var http = _factory.CreateDefaultClient();

        // 1. Login as client2 first to get their domain clientId from /api/client/me
        var clientId = await GetClientDomainIdAsync(http, "client2@smoke.local", "SmokeClient2!");

        // 2. Switch to dietitian Bearer token
        var token = await LoginDietitianAsync(http);
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // 3. Create plan for client2
        var createPlanResp = await http.PostAsJsonAsync(
            $"/api/dietitian/daily-plans/clients/{clientId}",
            new { date = today });
        createPlanResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "dietitian should be able to create a plan for client2");

        var planJson = await createPlanResp.Content.ReadFromJsonAsync<JsonElement>();
        var planId = planJson.GetProperty("id").GetGuid();

        // 4. Add meal item
        var addMealResp = await http.PostAsJsonAsync(
            $"/api/dietitian/daily-plans/{planId}/meals",
            new
            {
                time     = "12:30",
                mealType = "Lunch",
                title    = "Smoke Test Öğle",
                note     = (string?)null,
                calories = 600,
                proteinGrams = (decimal?)null,
                carbsGrams   = (decimal?)null,
                fatGrams     = (decimal?)null,
                recipeId     = (Guid?)null
            });
        addMealResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var mealJson = await addMealResp.Content.ReadFromJsonAsync<JsonElement>();
        var mealItemId = mealJson.GetProperty("id").GetGuid();

        // 5. Publish
        var publishResp = await http.PutAsync($"/api/dietitian/daily-plans/{planId}/publish", null);
        publishResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // 6. Client2 login
        await SetClientCookieAsync(http, "client2@smoke.local", "SmokeClient2!");
        http.DefaultRequestHeaders.Authorization = null;

        // 7. Verify initial status = "Planned"
        var todayPlanResp = await http.GetAsync("/api/client/plans/today");
        todayPlanResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var planDto = await todayPlanResp.Content.ReadFromJsonAsync<JsonElement>();
        planDto.GetProperty("plan").GetProperty("items")[0]
            .GetProperty("completionStatus").GetString().Should().Be("Planned");

        // 8. Client2 skips the meal
        var skipResp = await http.PostAsJsonAsync(
            $"/api/client/meals/{mealItemId}/skip",
            new { note = "Smoke test skip" });
        skipResp.StatusCode.Should().Be(HttpStatusCode.OK,
            because: "client should be able to skip a meal");

        // 9. Verify status = "Skipped"
        var afterSkipResp = await http.GetAsync("/api/client/plans/today");
        afterSkipResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var afterSkipDto = await afterSkipResp.Content.ReadFromJsonAsync<JsonElement>();
        afterSkipDto.GetProperty("plan").GetProperty("items")[0]
            .GetProperty("completionStatus").GetString().Should().Be("Skipped",
                because: "meal was marked as skipped");
    }
}
