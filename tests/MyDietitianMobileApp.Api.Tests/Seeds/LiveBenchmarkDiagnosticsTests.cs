using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace MyDietitianMobileApp.Api.Tests.Seeds;

public sealed class LiveBenchmarkDiagnosticsTests
{
    private readonly ITestOutputHelper _output;

    public LiveBenchmarkDiagnosticsTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    [Trait("Category", "LiveDb")]
    public async Task LiveBenchmarkDiagnostics_Should_Report_Current_Data_Collisions()
    {
        var repoRoot = FindRepoRoot(AppContext.BaseDirectory);
        var settingsPath = Path.Combine(repoRoot, "src", "MyDietitianMobileApp.Api", "appsettings.Development.json");

        Assert.True(File.Exists(settingsPath), $"Settings file not found: {settingsPath}");

        using var settings = JsonDocument.Parse(await File.ReadAllTextAsync(settingsPath));
        var appDb = settings.RootElement
            .GetProperty("ConnectionStrings")
            .GetProperty("AppDb")
            .GetString();

        Assert.False(string.IsNullOrWhiteSpace(appDb), "AppDb connection string is missing.");

        await using var connection = new NpgsqlConnection(appDb);
        await connection.OpenAsync();

        var report = new
        {
            generatedAtUtc = DateTime.UtcNow,
            duplicateRecipeNames = await QueryRowsAsync(connection,
                """
                SELECT "Name", COUNT(*) AS "Count"
                FROM "Recipes"
                GROUP BY "Name"
                HAVING COUNT(*) > 1
                ORDER BY COUNT(*) DESC, "Name";
                """),
            duplicateCanonicalIngredientNames = await QueryRowsAsync(connection,
                """
                SELECT lower("CanonicalName") AS "CanonicalKey", COUNT(*) AS "Count"
                FROM "Ingredients"
                WHERE "IsActive" = TRUE
                GROUP BY lower("CanonicalName")
                HAVING COUNT(*) > 1
                ORDER BY COUNT(*) DESC, lower("CanonicalName");
                """),
            duplicateIngredientAliases = await QueryRowsAsync(connection,
                """
                SELECT lower(alias.value) AS "AliasKey", COUNT(*) AS "Count"
                FROM "Ingredients" i,
                     jsonb_array_elements_text(COALESCE(i."Aliases", '[]'::jsonb)) AS alias(value)
                WHERE i."IsActive" = TRUE
                GROUP BY lower(alias.value)
                HAVING COUNT(*) > 1
                ORDER BY COUNT(*) DESC, lower(alias.value)
                LIMIT 50;
                """),
            focusedIngredientMatches = await QueryRowsAsync(connection,
                """
                SELECT
                    "Id",
                    "CanonicalName",
                    COALESCE("Aliases"::text, '[]') AS "AliasesJson"
                FROM "Ingredients"
                WHERE "IsActive" = TRUE
                  AND (
                        lower("CanonicalName") LIKE '%domat%' OR
                        lower("CanonicalName") LIKE '%yog%' OR
                        lower("CanonicalName") LIKE '%yoğ%' OR
                        lower("CanonicalName") LIKE '%onion%' OR
                        lower("CanonicalName") LIKE '%soğan%' OR
                        lower("CanonicalName") LIKE '%garlic%' OR
                        lower("CanonicalName") LIKE '%sarımsak%' OR
                        lower(COALESCE("Aliases"::text, '')) LIKE '%domat%' OR
                        lower(COALESCE("Aliases"::text, '')) LIKE '%yog%' OR
                        lower(COALESCE("Aliases"::text, '')) LIKE '%yoğ%' OR
                        lower(COALESCE("Aliases"::text, '')) LIKE '%onion%' OR
                        lower(COALESCE("Aliases"::text, '')) LIKE '%soğan%' OR
                        lower(COALESCE("Aliases"::text, '')) LIKE '%garlic%' OR
                        lower(COALESCE("Aliases"::text, '')) LIKE '%sarımsak%'
                      )
                ORDER BY "CanonicalName";
                """)
        };

        var json = JsonSerializer.Serialize(report, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        var reportDirectory = Path.Combine(repoRoot, ".tmp");
        Directory.CreateDirectory(reportDirectory);
        var reportPath = Path.Combine(reportDirectory, "live-benchmark-diagnostics.json");
        await File.WriteAllTextAsync(reportPath, json);

        _output.WriteLine(json);
        _output.WriteLine($"Report written to: {reportPath}");

        Assert.True(true);
    }

    private static async Task<List<Dictionary<string, object?>>> QueryRowsAsync(NpgsqlConnection connection, string sql)
    {
        var rows = new List<Dictionary<string, object?>>();
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
            }

            rows.Add(row);
        }

        return rows;
    }

    private static string FindRepoRoot(string startPath)
    {
        var directory = new DirectoryInfo(startPath);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "MyDietitianMobileApp.sln")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Repository root could not be found.");
    }
}
