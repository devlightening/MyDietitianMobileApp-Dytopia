using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Xunit;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Api.SmokeTests.Dietitian;

public class DietitianClientAccessSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public DietitianClientAccessSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Dietitian_Can_List_And_View_Own_Clients_And_IDOR_Is_Prevented()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var client = _factory.CreateDefaultClient();

        // Login as dietitian1
        var d1LoginPayload = new
        {
            email = "dietitian1@smoke.local",
            password = "SmokeTest1!"
        };

        var d1LoginResponse = await client.PostAsJsonAsync("/api/auth/dietitian/login", d1LoginPayload);
        d1LoginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var d1Json = await d1LoginResponse.Content.ReadFromJsonAsync<JsonElement>();
        d1Json.TryGetProperty("token", out var d1TokenProp).Should().BeTrue("dietitian login must return JWT token");
        var d1Token = d1TokenProp.GetString();
        d1Token.Should().NotBeNullOrWhiteSpace("dietitian JWT token must not be empty");

        // Sanity-check JWT claims to make sure user id is present as 'sub'
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(d1Token);
        var subClaim = jwt.Claims.FirstOrDefault(c => c.Type == "sub");
        subClaim.Should().NotBeNull("dietitian JWT should contain 'sub' claim");

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", d1Token);

        var listResponse = await client.GetAsync("/api/dietitian/clients");
        if (listResponse.StatusCode != HttpStatusCode.OK)
        {
            var body = await listResponse.Content.ReadAsStringAsync();
            throw new Xunit.Sdk.XunitException($"Expected 200 OK but got {(int)listResponse.StatusCode} {listResponse.StatusCode}. Body: {body}");
        }

        var listJson = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        listJson.TryGetProperty("clients", out var clientsProp).Should().BeTrue();
        clientsProp.ValueKind.Should().Be(JsonValueKind.Array);
        clientsProp.GetArrayLength().Should().BeGreaterOrEqualTo(1);

        var firstClientId = clientsProp[0].GetProperty("id").GetGuid();

        var detailResponse = await client.GetAsync($"/api/dietitian/clients/{firstClientId}");
        detailResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Login as dietitian2 and attempt to access dietitian1's client
        var d2LoginPayload = new
        {
            email = "dietitian2@smoke.local",
            password = "SmokeTest2!"
        };

        var d2LoginResponse = await client.PostAsJsonAsync("/api/auth/dietitian/login", d2LoginPayload);
        d2LoginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var d2Json = await d2LoginResponse.Content.ReadFromJsonAsync<JsonElement>();
        d2Json.TryGetProperty("token", out var d2TokenProp).Should().BeTrue();
        var d2Token = d2TokenProp.GetString();
        d2Token.Should().NotBeNullOrWhiteSpace();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", d2Token);

        var idorResponse = await client.GetAsync($"/api/dietitian/clients/{firstClientId}");
        idorResponse.StatusCode.Should().BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.Forbidden);
    }
}

