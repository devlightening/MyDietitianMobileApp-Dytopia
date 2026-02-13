using System;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using Xunit;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Api.SmokeTests.Auth;

public class AuthSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public AuthSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Client_Register_And_Login_Returns_Token_And_Cookie()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var client = _factory.CreateDefaultClient();

        var email = $"client.smoke.{Guid.NewGuid():N}@gmail.com";

        var registerPayload = new
        {
            email,
            password = "SmokeClient9!",
            fullName = "Smoke Test Client",
            gender = 0,
            birthDate = "1990-01-01"
        };

        var registerResponse = await client.PostAsJsonAsync("/api/client/register", registerPayload);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var registerJson = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        registerJson.TryGetProperty("token", out var tokenProp).Should().BeTrue();
        tokenProp.GetString().Should().NotBeNullOrWhiteSpace();

        registerResponse.Headers.TryGetValues("Set-Cookie", out var registerCookies).Should().BeTrue();
        registerCookies!.Any(c => c.Contains("access_token")).Should().BeTrue();

        var loginPayload = new
        {
            email,
            password = "SmokeClient9!"
        };

        var loginResponse = await client.PostAsJsonAsync("/api/client/login", loginPayload);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        loginJson.TryGetProperty("token", out var loginTokenProp).Should().BeTrue();
        loginTokenProp.GetString().Should().NotBeNullOrWhiteSpace();

        loginResponse.Headers.TryGetValues("Set-Cookie", out var loginCookies).Should().BeTrue();
        loginCookies!.Any(c => c.Contains("access_token")).Should().BeTrue();
    }

    [Fact]
    public async Task Dietitian_Register_And_Login_Returns_Cookie()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var client = _factory.CreateDefaultClient();

        var email = $"dietitian-smoke-{Guid.NewGuid():N}@example.com";

        var registerPayload = new
        {
            fullName = "Smoke Dietitian",
            clinicName = "Smoke Clinic",
            email,
            password = "SmokeDiet1!"
        };

        var registerResponse = await client.PostAsJsonAsync("/api/auth/dietitian/register", registerPayload);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginPayload = new
        {
            email,
            password = "SmokeDiet1!"
        };

        var loginResponse = await client.PostAsJsonAsync("/api/auth/dietitian/login", loginPayload);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        loginResponse.Headers.TryGetValues("Set-Cookie", out var loginCookies).Should().BeTrue();
        loginCookies!.Any(c => c.Contains("access_token")).Should().BeTrue();
    }

    [Fact]
    public async Task Protected_Endpoints_Return_401_Without_Auth()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var client = _factory.CreateDefaultClient();

        var clientPantry = await client.GetAsync("/api/client/pantry");
        clientPantry.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var dietitianClients = await client.GetAsync("/api/dietitian/clients");
        dietitianClients.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}

