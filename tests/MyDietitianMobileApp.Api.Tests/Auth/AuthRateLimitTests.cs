using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MyDietitianMobileApp.Api.Tests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Auth;

public class AuthRateLimitTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AuthRateLimitTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact(Skip = "Requires stable test user data; enable when integration test environment is ready")]
    public async Task Exceeding_Auth_Rate_Limit_Results_In_429()
    {
        var client = _factory.CreateClient();

        var payload = new
        {
            email = "nonexistent@example.com",
            password = "wrong"
        };

        HttpStatusCode lastStatus = HttpStatusCode.OK;

        // Hit the endpoint more times than the limit to trigger 429
        for (var i = 0; i < 15; i++)
        {
            var response = await client.PostAsJsonAsync("/api/auth/client/login", payload);
            lastStatus = response.StatusCode;
        }

        lastStatus.Should().Be(HttpStatusCode.TooManyRequests);
    }
}

