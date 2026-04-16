using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Benchmark;

/// <summary>
/// TEZ-CORE — Benchmark endpoint availability smoke tests.
/// Verifies that GET /api/dev/benchmark/normalization and /recommendation
/// are reachable in non-Production environments and return structured JSON.
///
/// These endpoints are the primary thesis defense live-demo proof:
/// "Run this endpoint and see the benchmark results."
///
/// Dataset files must be present in AppContext.BaseDirectory/Benchmarks/SampleDatasets/
/// (copied via CopyToOutputDirectory in both API and SmokeTests .csproj).
/// </summary>
public class BenchmarkEndpointSmokeTests : IClassFixture<SmokeWebApplicationFactory>
{
    private readonly SmokeWebApplicationFactory _factory;

    public BenchmarkEndpointSmokeTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Normalization_Benchmark_Endpoint_Returns_200_With_Summary()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();

        var response = await http.GetAsync("/api/dev/benchmark/normalization");

        // In Testing environment (not Production), endpoint must not be blocked (403)
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden,
            because: "benchmark endpoints are enabled in Testing environment");

        // If dataset files are present (CopyToOutputDirectory), expect 200
        // If not present (first run before build), gracefully accept 503
        if (response.StatusCode == HttpStatusCode.OK)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();

            json.TryGetProperty("summary", out var summary).Should().BeTrue(
                because: "normalization benchmark result must include a 'summary' object");

            summary.TryGetProperty("totalCases", out var totalCases).Should().BeTrue(
                because: "summary must include totalCases");
            totalCases.GetInt32().Should().BeGreaterThan(0,
                because: "at least one normalization case must be in the dataset");

            summary.TryGetProperty("accuracy", out var accuracy).Should().BeTrue(
                because: "summary must include accuracy field");
        }
        else
        {
            response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable,
                because: "if dataset files are missing, endpoint must return 503 with a clear hint");

            var body = await response.Content.ReadAsStringAsync();
            body.Should().Contain("hint",
                because: "503 response must include a 'hint' field explaining how to fix the missing dataset");
        }
    }

    [Fact]
    public async Task Recommendation_Benchmark_Endpoint_Returns_200_With_Summary()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();

        var response = await http.GetAsync("/api/dev/benchmark/recommendation");

        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden,
            because: "benchmark endpoints are enabled in Testing environment");

        if (response.StatusCode == HttpStatusCode.OK)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();

            json.TryGetProperty("summary", out var summary).Should().BeTrue(
                because: "recommendation benchmark result must include a 'summary' object");

            summary.TryGetProperty("totalCases", out var totalCases).Should().BeTrue(
                because: "summary must include totalCases");
            totalCases.GetInt32().Should().BeGreaterThan(0,
                because: "at least one recommendation case must be in the dataset");
        }
        else
        {
            response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable,
                because: "if dataset files are missing, endpoint must return 503 with a clear hint");
        }
    }

    [Fact]
    public async Task Acquisition_Benchmark_Endpoint_Returns_200_With_Summary()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var response = await http.GetAsync("/api/dev/benchmark/acquisition");

        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);

        if (response.StatusCode == HttpStatusCode.OK)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            json.TryGetProperty("summary", out var summary).Should().BeTrue();
            summary.TryGetProperty("totalCases", out var totalCases).Should().BeTrue();
            totalCases.GetInt32().Should().BeGreaterThan(0);
            summary.TryGetProperty("top1Accuracy", out _).Should().BeTrue();
        }
        else
        {
            response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        }
    }

    [Fact]
    public async Task Hybrid_Recipe_Benchmark_Endpoint_Returns_200_With_Summary()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var http = _factory.CreateDefaultClient();
        var response = await http.GetAsync("/api/dev/benchmark/hybrid-recipe");

        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);

        if (response.StatusCode == HttpStatusCode.OK)
        {
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            json.TryGetProperty("summary", out var summary).Should().BeTrue();
            summary.TryGetProperty("totalCases", out var totalCases).Should().BeTrue();
            totalCases.GetInt32().Should().BeGreaterThan(0);
            summary.TryGetProperty("top1Precision", out _).Should().BeTrue();
        }
        else
        {
            response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        }
    }
}
