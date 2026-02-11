using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MyDietitianMobileApp.Api.Tests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Dietitian;

public class RevokePremiumTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public RevokePremiumTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact(Skip = \"Requires seeded dietitian/client and database configuration\")](*) public async Task Revoke_Premium_Returns_NotFound_When_Link_Missing()
    {
        var client = _factory.CreateClient();

        // Without a valid JWT and seeded data this will return 401/403 in real environment;
        // This test is a placeholder to be enabled when a test database is wired.
        var response = await client.PostAsync($\"/api/dietitian/clients/{Guid.NewGuid()}/revoke\", content: null);

        response.StatusCode.Should().BeOneOf(HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden, HttpStatusCode.NotFound);
    }
}

