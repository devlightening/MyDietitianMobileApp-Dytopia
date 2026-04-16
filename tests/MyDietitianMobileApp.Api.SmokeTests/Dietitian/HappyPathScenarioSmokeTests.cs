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
/// Full end-to-end happy path scenario:
/// - 2 dietitians + 2 linked clients + 1 free client (seeded by SmokeTestSeeder)
/// - DietitianA sees both clients and can view own client detail
/// - FreeClient cannot access premium-only plan endpoint
/// - Client1 can access a free client endpoint
/// </summary>
public class HappyPathScenarioSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public HappyPathScenarioSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Happy_Path_Scenario_Works_EndToEnd()
    {
        // Arrange
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var client = _factory.CreateDefaultClient();

        //
        // 1) DietitianA login and list clients
        //
        var dietitianLoginPayload = new
        {
            email = "dietitian1@smoke.local",
            password = "SmokeTest1!"
        };

        var dLogin = await client.PostAsJsonAsync("/api/auth/dietitian/login", dietitianLoginPayload);
        dLogin.StatusCode.Should().Be(HttpStatusCode.OK);

        var dJson = await dLogin.Content.ReadFromJsonAsync<JsonElement>();
        dJson.TryGetProperty("token", out var dTokenProp).Should().BeTrue();
        var dToken = dTokenProp.GetString();
        dToken.Should().NotBeNullOrWhiteSpace();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", dToken);

        var listResponse = await client.GetAsync("/api/dietitian/clients");
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var listJson = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        listJson.TryGetProperty("items", out var clientsProp).Should().BeTrue();
        clientsProp.ValueKind.Should().Be(JsonValueKind.Array);
        clientsProp.GetArrayLength().Should().BeGreaterOrEqualTo(2); // DietitianA sees 2 clients

        var firstClientId = clientsProp[0].GetProperty("clientId").GetGuid();

        // DietitianA can view own client detail
        var detailResponse = await client.GetAsync($"/api/dietitian/clients/{firstClientId}");
        detailResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        //
        // 2) FreeClient login → premium endpoint forbidden
        //
        client.DefaultRequestHeaders.Remove("Cookie");

        var freeLoginPayload = new
        {
            email = "freeclient@smoke.local",
            password = "SmokeFree1!"
        };

        var freeLogin = await client.PostAsJsonAsync("/api/client/login", freeLoginPayload);
        freeLogin.StatusCode.Should().Be(HttpStatusCode.OK);
        freeLogin.Headers.TryGetValues("Set-Cookie", out var freeCookies).Should().BeTrue();
        var freeRawCookie = freeCookies!.First(c => c.Contains("access_token"));
        var freeCookieHeader = freeRawCookie.Split(';')[0];
        client.DefaultRequestHeaders.Add("Cookie", freeCookieHeader);

        var premiumPlanResponse = await client.GetAsync("/api/client/plans/today");
        premiumPlanResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        //
        // 3) Client1 login → free endpoint is accessible
        //
        client.DefaultRequestHeaders.Remove("Cookie");

        var client1LoginPayload = new
        {
            email = "client1@smoke.local",
            password = "SmokeClient1!"
        };

        var client1Login = await client.PostAsJsonAsync("/api/client/login", client1LoginPayload);
        client1Login.StatusCode.Should().Be(HttpStatusCode.OK);

        client1Login.Headers.TryGetValues("Set-Cookie", out var c1Cookies).Should().BeTrue();
        var c1RawCookie = c1Cookies!.First(c => c.Contains("access_token"));
        var c1CookieHeader = c1RawCookie.Split(';')[0];
        client.DefaultRequestHeaders.Add("Cookie", c1CookieHeader);

        // Use pantry endpoint as representative "free" client API
        var pantryResponse = await client.GetAsync("/api/client/pantry");
        pantryResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}

