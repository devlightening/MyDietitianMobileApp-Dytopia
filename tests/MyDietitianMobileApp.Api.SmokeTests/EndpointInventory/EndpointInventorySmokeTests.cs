using System.Net;
using System.IO;
using System.Threading.Tasks;
using FluentAssertions;
using MyDietitianMobileApp.Api.SmokeTests.EndpointInventory;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.EndpointInventoryTests;

public class EndpointInventorySmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public EndpointInventorySmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Can_Generate_Endpoint_Inventory_Markdown()
    {
        var client = _factory.CreateDefaultClient();

        var debugResponse = await client.GetAsync("/debug/endpoints");
        debugResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var outputPath = Path.GetFullPath(
            Path.Combine("..", "..", "..", "..", "docs", "endpoint-inventory.md"));

        await EndpointInventoryGenerator.GenerateAsync(client, outputPath);

        File.Exists(outputPath).Should().BeTrue();

        var contents = await File.ReadAllTextAsync(outputPath);
        contents.Should().Contain("Endpoint Inventory");
    }
}

