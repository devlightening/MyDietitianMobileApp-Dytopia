using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Text.Json;
using FluentAssertions;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Database;

public class DatabaseAuditSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public DatabaseAuditSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Consolidation_Report_Returns_Catalog_And_Conflict_Families()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var response = await http.GetAsync("/api/dev/database/consolidation-report");

        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden,
            because: "database audit endpoint must stay enabled outside Production");

        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();

        json.TryGetProperty("summary", out var summary).Should().BeTrue();
        summary.GetProperty("catalogTableCount").GetInt32().Should().Be(59);
        summary.GetProperty("conflictFamilyCount").GetInt32().Should().BeGreaterThanOrEqualTo(5);

        var tables = json.GetProperty("tables");
        tables.GetArrayLength().Should().Be(59);

        tables.EnumerateArray()
            .Any(x => x.GetProperty("tableName").GetString() == "ClientProhibitedIngredients"
                   && x.GetProperty("decisionCode").GetString() == "ReviewForMerge")
            .Should().BeTrue();

        tables.EnumerateArray()
            .Any(x => x.GetProperty("tableName").GetString() == "__EFMigrationsHistory")
            .Should().BeTrue();
    }

    [Fact]
    public async Task Consolidation_Report_Includes_Row_Counts_For_Seeded_Core_Tables()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var response = await http.GetAsync("/api/dev/database/consolidation-report");

        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var tables = json.GetProperty("tables")
            .EnumerateArray()
            .ToDictionary(
                x => x.GetProperty("tableName").GetString()!,
                x => x);

        tables["Dietitians"].GetProperty("rowCount").GetInt64().Should().Be(2);
        tables["Clients"].GetProperty("rowCount").GetInt64().Should().Be(3);
        tables["DietitianClientLinks"].GetProperty("rowCount").GetInt64().Should().Be(2);
        tables["UserAccounts"].GetProperty("database").GetString().Should().Be("AuthDb");
        tables["UserAccounts"].GetProperty("rowCount").GetInt64().Should().Be(5);
    }
}
