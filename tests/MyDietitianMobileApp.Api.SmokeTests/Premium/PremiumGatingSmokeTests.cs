using System;
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
using System.Threading.Tasks;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Premium;

public class PremiumGatingSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public PremiumGatingSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Free_Client_Cannot_Access_Premium_ClientPlan()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        using var scope = _factory.Services.CreateScope();
        var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

        var freeUser = await authDb.UserAccounts.FirstAsync(u => u.Email == "freeclient@smoke.local");

        var client = _factory.CreateDefaultClient();

        var loginPayload = new
        {
            email = freeUser.Email,
            password = "SmokeFree1!"
        };

        var loginResponse = await client.PostAsJsonAsync("/api/client/login", loginPayload);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        loginResponse.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        var rawCookie = cookies!.First(c => c.Contains("access_token"));
        var cookieHeader = rawCookie.Split(';')[0];
        client.DefaultRequestHeaders.Add("Cookie", cookieHeader);

        var planResponse = await client.GetAsync("/api/client/plans/today");
        planResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}

