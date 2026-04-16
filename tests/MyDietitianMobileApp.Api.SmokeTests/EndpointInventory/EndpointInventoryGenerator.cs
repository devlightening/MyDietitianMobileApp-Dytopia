using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Api.SmokeTests.EndpointInventory;

public static class EndpointInventoryGenerator
{
    private record DebugEndpoint(
        string? pattern,
        string[] methods,
        string? name,
        bool requiresAuth,
        string? roles,
        string? policy,
        string? rateLimitPolicy);

    private record DebugEndpointResponse(
        int count,
        IReadOnlyList<DebugEndpoint> allEndpoints);

    public static async Task GenerateAsync(HttpClient client, string outputPath)
    {
        var response = await client.GetAsync("/debug/endpoints");
        response.EnsureSuccessStatusCode();

        var data = await response.Content.ReadFromJsonAsync<DebugEndpointResponse>();
        if (data == null)
            throw new InvalidOperationException("Failed to deserialize /debug/endpoints response");

        Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);

        var sb = new StringBuilder();
        sb.AppendLine("# Endpoint Inventory");
        sb.AppendLine();
        sb.AppendLine($"Generated at: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
        sb.AppendLine();
        sb.AppendLine("| Method | Route | Auth Required | Roles / Policy | RateLimitPolicy |");
        sb.AppendLine("|--------|-------|---------------|----------------|-----------------|");

        foreach (var ep in data.allEndpoints
                     .Where(e => !string.IsNullOrWhiteSpace(e.pattern))
                     .OrderBy(e => e.pattern)
                     .ThenBy(e => string.Join(",", e.methods)))
        {
            var methods = string.Join(",", ep.methods);
            var auth = ep.requiresAuth ? "Yes" : "No";

            var roleInfo = new List<string>();
            if (!string.IsNullOrWhiteSpace(ep.roles))
                roleInfo.Add($"Roles: {ep.roles}");
            if (!string.IsNullOrWhiteSpace(ep.policy))
                roleInfo.Add($"Policy: {ep.policy}");

            var roleCell = roleInfo.Count == 0 ? "-" : string.Join("; ", roleInfo);
            var rateLimitCell = string.IsNullOrWhiteSpace(ep.rateLimitPolicy) ? "-" : ep.rateLimitPolicy;

            sb.AppendLine($"| {methods} | `{ep.pattern}` | {auth} | {roleCell} | {rateLimitCell} |");
        }

        await File.WriteAllTextAsync(outputPath, sb.ToString(), Encoding.UTF8);
    }
}

