using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading.Tasks;
using MyDietitianMobileApp.Api.SmokeTests.Infrastructure;
using Xunit;

namespace MyDietitianMobileApp.Api.SmokeTests.Benchmark;

public class ThesisApiLatencyArtifactTests : IClassFixture<SmokeWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly SmokeWebApplicationFactory _factory;

    public ThesisApiLatencyArtifactTests(SmokeWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GenerateApiLatencyArtifacts()
    {
        await SmokeTestSeeder.EnsureSeededAsync(_factory.Services);

        var outputDir = new DirectoryInfo(Path.Combine(GetRepoRoot().FullName, "docs", "thesis-benchmark-results"));
        outputDir.Create();

        using var http = _factory.CreateDefaultClient();
        var endpoints = new[]
        {
            new EndpointCase("GET /api/dev/benchmark/normalization", "/api/dev/benchmark/normalization"),
            new EndpointCase("GET /api/dev/benchmark/recommendation", "/api/dev/benchmark/recommendation"),
            new EndpointCase("GET /api/dev/benchmark/acquisition", "/api/dev/benchmark/acquisition"),
            new EndpointCase("GET /api/dev/benchmark/hybrid-recipe", "/api/dev/benchmark/hybrid-recipe"),
        };

        var rows = new List<ApiLatencyRow>();
        foreach (var endpoint in endpoints)
        {
            await http.GetAsync(endpoint.Path);
            for (var i = 0; i < 30; i++)
            {
                var sw = Stopwatch.StartNew();
                string? error = null;
                int statusCode;
                try
                {
                    using var response = await http.GetAsync(endpoint.Path);
                    statusCode = (int)response.StatusCode;
                    if (!response.IsSuccessStatusCode)
                        error = response.StatusCode.ToString();
                    _ = await response.Content.ReadAsStringAsync();
                }
                catch (Exception ex)
                {
                    statusCode = 0;
                    error = ex.GetType().Name;
                }
                finally
                {
                    sw.Stop();
                }

                rows.Add(new ApiLatencyRow(endpoint.Operation, i + 1, statusCode, Math.Round(sw.Elapsed.TotalMilliseconds, 4), error));
            }
        }

        var summary = rows
            .GroupBy(r => r.Operation)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var values = g.Select(r => r.LatencyMs).OrderBy(v => v).ToArray();
                    return new ApiLatencySummary(
                        g.Count(),
                        values.Min(),
                        values.Max(),
                        Math.Round(values.Average(), 4),
                        Median(values),
                        P95(values),
                        g.Count(r => r.Error != null));
                });

        WriteCsv(Out(outputDir, "api-latency-results.csv"), ToCsv(rows));
        WriteJson(Out(outputDir, "api-latency-summary.json"), summary);
        WriteText(Out(outputDir, "api-latency-summary.md"), ToMarkdown(summary));

        Assert.All(rows, row => Assert.Null(row.Error));
    }

    private static IEnumerable<string> ToCsv(IEnumerable<ApiLatencyRow> rows)
    {
        yield return "operation,iteration,httpStatus,latencyMs,error";
        foreach (var row in rows)
            yield return Csv(row.Operation, row.Iteration, row.HttpStatus, row.LatencyMs, row.Error);
    }

    private static string ToMarkdown(IReadOnlyDictionary<string, ApiLatencySummary> summary)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# API Latency Summary");
        sb.AppendLine();
        sb.AppendLine("Measurements were executed through ASP.NET Core test-server HTTP requests. They include routing, controller execution and JSON serialization inside the test host, but do not include external internet or mobile network latency.");
        sb.AppendLine();
        sb.AppendLine("| Endpoint | Count | Min | Max | Average | Median | P95 | Errors |");
        sb.AppendLine("|---|---:|---:|---:|---:|---:|---:|---:|");
        foreach (var (operation, row) in summary.OrderBy(x => x.Key))
            sb.AppendLine($"| {operation} | {row.Count} | {row.MinMs:F4} | {row.MaxMs:F4} | {row.AverageMs:F4} | {row.MedianMs:F4} | {row.P95Ms:F4} | {row.ErrorCount} |");
        return sb.ToString();
    }

    private static FileInfo Out(DirectoryInfo outputDir, string fileName)
        => new(Path.Combine(outputDir.FullName, fileName));

    private static void WriteJson<T>(FileInfo path, T value)
        => File.WriteAllText(path.FullName, JsonSerializer.Serialize(value, JsonOptions), new UTF8Encoding(false));

    private static void WriteText(FileInfo path, string text)
        => File.WriteAllText(path.FullName, text, new UTF8Encoding(false));

    private static void WriteCsv(FileInfo path, IEnumerable<string> lines)
        => WriteText(path, string.Join(Environment.NewLine, lines) + Environment.NewLine);

    private static string Csv(params object?[] values)
        => string.Join(",", values.Select(value =>
        {
            var text = value switch
            {
                null => "",
                double d => d.ToString("0.####", CultureInfo.InvariantCulture),
                bool b => b ? "true" : "false",
                _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? ""
            };
            return "\"" + text.Replace("\"", "\"\"") + "\"";
        }));

    private static double Median(IReadOnlyList<double> values)
    {
        if (values.Count == 0) return 0;
        var mid = values.Count / 2;
        return Math.Round(values.Count % 2 == 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid], 4);
    }

    private static double P95(IReadOnlyList<double> values)
    {
        if (values.Count == 0) return 0;
        var index = Math.Max(0, (int)Math.Ceiling(values.Count * 0.95) - 1);
        return Math.Round(values[index], 4);
    }

    private static DirectoryInfo GetRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "MyDietitianMobileApp.sln")))
            dir = dir.Parent;

        return dir ?? throw new DirectoryNotFoundException("Repository root not found.");
    }

    private sealed record EndpointCase(string Operation, string Path);
    private sealed record ApiLatencyRow(string Operation, int Iteration, int HttpStatus, double LatencyMs, string? Error);
    private sealed record ApiLatencySummary(int Count, double MinMs, double MaxMs, double AverageMs, double MedianMs, double P95Ms, int ErrorCount);
}
