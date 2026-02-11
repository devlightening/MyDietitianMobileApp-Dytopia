using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MyDietitianMobileApp.Api.Tests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Auth;

public class ClientAuthAliasTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public ClientAuthAliasTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact(Skip = "Requires test database and seed data configuration")]
    public async Task Register_And_Login_Work_On_Auth_And_Client_Aliases()
    {
        var client = _factory.CreateClient(new()
        {
            AllowAutoRedirect = false
        });

        var registerPayload = new
        {
            email = "alias-test@example.com",
            password = "Test123!",
            fullName = "Alias Test"
        };

        // Primary route
        var registerResponse = await client.PostAsJsonAsync("/api/auth/client/register", registerPayload);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var primaryJson = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        primaryJson.TryGetProperty("token", out var tokenProp).Should().BeTrue();
        var primaryToken = tokenProp.GetString();
        primaryToken.Should().NotBeNullOrWhiteSpace();

        registerResponse.Headers.TryGetValues("Set-Cookie", out var primaryCookies).Should().BeTrue();
        primaryCookies!.Any(c => c.Contains("access_token")).Should().BeTrue();

        // Alias route should behave identically
        var aliasResponse = await client.PostAsJsonAsync("/api/client/register", registerPayload);
        aliasResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var aliasJson = await aliasResponse.Content.ReadFromJsonAsync<JsonElement>();
        aliasJson.TryGetProperty("token", out var aliasTokenProp).Should().BeTrue();
        var aliasToken = aliasTokenProp.GetString();
        aliasToken.Should().NotBeNullOrWhiteSpace();

        aliasResponse.Headers.TryGetValues("Set-Cookie", out var aliasCookies).Should().BeTrue();
        aliasCookies!.Any(c => c.Contains("access_token")).Should().BeTrue();
    }
}

