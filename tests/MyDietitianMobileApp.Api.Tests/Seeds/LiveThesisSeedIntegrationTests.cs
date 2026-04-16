using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace MyDietitianMobileApp.Api.Tests.Seeds;

public sealed class LiveThesisSeedIntegrationTests
{
    private readonly ITestOutputHelper _output;

    public LiveThesisSeedIntegrationTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    [Trait("Category", "LiveDb")]
    public async Task ThesisSeedScripts_Should_Apply_To_Live_Postgres_And_Produce_Report()
    {
        var repoRoot = FindRepoRoot(AppContext.BaseDirectory);
        var settingsPath = Path.Combine(repoRoot, "src", "MyDietitianMobileApp.Api", "appsettings.Development.json");

        Assert.True(File.Exists(settingsPath), $"Settings file not found: {settingsPath}");

        using var settings = JsonDocument.Parse(await File.ReadAllTextAsync(settingsPath));
        var connectionStrings = settings.RootElement.GetProperty("ConnectionStrings");
        var appDb = connectionStrings.GetProperty("AppDb").GetString();
        var authDb = connectionStrings.GetProperty("AuthDb").GetString();

        Assert.False(string.IsNullOrWhiteSpace(appDb), "AppDb connection string is missing.");
        Assert.False(string.IsNullOrWhiteSpace(authDb), "AuthDb connection string is missing.");

        var normalizedApp = NormalizeConnectionString(appDb!);
        var normalizedAuth = NormalizeConnectionString(authDb!);

        var scripts = new[]
        {
            Path.Combine(repoRoot, "scripts", "seed-part1-base.sql"),
            Path.Combine(repoRoot, "scripts", "seed-part2-users.sql"),
            Path.Combine(repoRoot, "scripts", "seed-part3-recipes.sql"),
            Path.Combine(repoRoot, "scripts", "seed-part4-canonical-ops.sql"),
            Path.Combine(repoRoot, "scripts", "seed-part5-thesis-tracking.sql")
        };

        foreach (var script in scripts)
        {
            Assert.True(File.Exists(script), $"Seed script not found: {script}");
        }

        await ExecuteSqlFileAsync(appDb!, scripts[0], "AppDb");

        if (normalizedApp == normalizedAuth)
        {
            await ExecuteSqlFileAsync(appDb!, scripts[1], "SharedDb");
        }
        else
        {
            var blocks = ExtractTransactionalBlocks(await File.ReadAllTextAsync(scripts[1]));
            Assert.True(blocks.Count >= 2, "seed-part2-users.sql must contain at least two BEGIN/COMMIT blocks.");
            await ExecuteSqlAsync(authDb!, blocks[0], "AuthDb:seed-part2-users.sql#block1");
            await ExecuteSqlAsync(appDb!, blocks[1], "AppDb:seed-part2-users.sql#block2");
        }

        await ExecuteSqlFileAsync(appDb!, scripts[2], "AppDb");
        await ExecuteSqlFileAsync(appDb!, scripts[3], "AppDb");
        await ExecuteSqlFileAsync(appDb!, scripts[4], "AppDb");

        await using var connection = new NpgsqlConnection(appDb);
        await connection.OpenAsync();

        var counts = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        foreach (var table in TablesToReport)
        {
            counts[table] = await GetCountAsync(connection, table);
        }

        var checks = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
        {
            ["client1_yogurt_prohibition"] = await ExistsAsync(connection,
                """
                SELECT 1
                FROM "ClientProhibitedIngredients"
                WHERE "ClientId" = 'cc000001-0000-0000-0000-000000000000'::uuid
                  AND "IngredientId" = 'ee000001-0000-0000-0000-000000000000'::uuid;
                """),
            ["recipe_yogurt_prohibition"] = await ExistsAsync(connection,
                """
                SELECT 1
                FROM "RecipeProhibitedIngredients"
                WHERE "RecipeId" = 'a1000004-0000-0000-0000-000000000004'::uuid
                  AND "IngredientId" = 'ee000001-0000-0000-0000-000000000000'::uuid;
                """),
            ["chicken_turkey_substitute"] = await ExistsAsync(connection,
                """
                SELECT 1
                FROM "RecipeIngredientSubstitutes"
                WHERE "RecipeId" = 'a1000002-0000-0000-0000-000000000002'::uuid
                  AND "RequiredIngredientId" = 'ee000022-0000-0000-0000-000000000000'::uuid
                  AND "SubstituteIngredientId" = 'ee000026-0000-0000-0000-000000000000'::uuid;
                """),
            ["client1_operational_plan"] = await ExistsAsync(connection,
                """
                SELECT 1
                FROM "MealPlans"
                WHERE "ClientId" = 'cc000001-0000-0000-0000-000000000000'::uuid
                  AND "Date"::date = DATE '2026-04-10';
                """),
            ["client1_compliance_snapshot"] = await ExistsAsync(connection,
                """
                SELECT 1
                FROM "DailyComplianceSnapshots"
                WHERE "ClientId" = 'cc000001-0000-0000-0000-000000000000'::uuid
                  AND "Date" = DATE '2026-04-10';
                """),
            ["client1_progress_history"] = await ExistsAsync(connection,
                """
                SELECT 1
                FROM "ClientWeightEntries"
                WHERE "ClientId" = 'cc000001-0000-0000-0000-000000000000'::uuid;
                """),
            ["client1_measurements_history"] = await ExistsAsync(connection,
                """
                SELECT 1
                FROM "ClientMeasurementEntries"
                WHERE "ClientId" = 'cc000001-0000-0000-0000-000000000000'::uuid;
                """),
            ["client1_shopping_list"] = await ExistsAsync(connection,
                """
                SELECT 1
                FROM "ClientShoppingListItems"
                WHERE "ClientId" = 'cc000001-0000-0000-0000-000000000000'::uuid;
                """)
        };

        var report = new
        {
            appliedAtUtc = DateTime.UtcNow,
            connection = new
            {
                appDb = HideSecret(appDb!),
                authDb = HideSecret(authDb!),
                sharedDatabase = normalizedApp == normalizedAuth
            },
            counts,
            thesisChecks = checks
        };

        var reportJson = JsonSerializer.Serialize(report, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        var reportDirectory = Path.Combine(repoRoot, ".tmp");
        Directory.CreateDirectory(reportDirectory);
        var reportPath = Path.Combine(reportDirectory, "live-thesis-seed-report.json");
        await File.WriteAllTextAsync(reportPath, reportJson);

        _output.WriteLine(reportJson);
        _output.WriteLine($"Report written to: {reportPath}");

        Assert.All(checks, entry => Assert.True(entry.Value, $"Thesis check failed: {entry.Key}"));
    }

    private static async Task ExecuteSqlFileAsync(string connectionString, string path, string label)
    {
        var sql = await File.ReadAllTextAsync(path);
        await ExecuteSqlAsync(connectionString, sql, $"{label}:{Path.GetFileName(path)}");
    }

    private static async Task ExecuteSqlAsync(string connectionString, string sql, string label)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection)
        {
            CommandTimeout = 180
        };

        await command.ExecuteNonQueryAsync();
    }

    private static async Task<long> GetCountAsync(NpgsqlConnection connection, string tableName)
    {
        await using var command = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{tableName}\";", connection);
        var value = await command.ExecuteScalarAsync();
        return Convert.ToInt64(value);
    }

    private static async Task<bool> ExistsAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        var value = await command.ExecuteScalarAsync();
        return value is not null;
    }

    private static string NormalizeConnectionString(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            Password = string.Empty
        };

        return builder.ConnectionString;
    }

    private static string HideSecret(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            Password = "***"
        };

        return builder.ConnectionString;
    }

    private static List<string> ExtractTransactionalBlocks(string sql)
    {
        var blocks = new List<string>();
        var remaining = sql;

        while (true)
        {
            var begin = remaining.IndexOf("BEGIN;", StringComparison.OrdinalIgnoreCase);
            if (begin < 0)
            {
                break;
            }

            var commit = remaining.IndexOf("COMMIT;", begin, StringComparison.OrdinalIgnoreCase);
            if (commit < 0)
            {
                break;
            }

            var block = remaining.Substring(begin, commit - begin + "COMMIT;".Length);
            blocks.Add(block);
            remaining = remaining[(commit + "COMMIT;".Length)..];
        }

        return blocks;
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

    private static readonly string[] TablesToReport =
    {
        "Ingredients",
        "IngredientFamilies",
        "IngredientFamilyMembers",
        "IngredientCompatibilityRules",
        "UserAccounts",
        "Dietitians",
        "Clients",
        "DietitianClientLinks",
        "AccessKeys",
        "Recipes",
        "RecipeMandatoryIngredients",
        "RecipeOptionalIngredients",
        "RecipeIngredients",
        "RecipeProhibitedIngredients",
        "RecipeIngredientSubstitutes",
        "ClientGoalPreferences",
        "ClientProhibitedIngredients",
        "ClientPantryItems",
        "ComplianceScoreConfigs",
        "DietPlans",
        "DietPlanDays",
        "DietPlanMeals",
        "MealItems",
        "MealPlans",
        "PlanMealItems",
        "MealCompletions",
        "MealCompliances",
        "MealItemCompliance",
        "DailyComplianceSnapshots",
        "ClientWeightEntries",
        "ClientMeasurementEntries",
        "ClientDailyTrackings",
        "ClientShoppingListItems"
    };
}
