using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using FluentAssertions;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Seeds;

public class SeedScriptSanityTests
{
    private static readonly Regex GuidRegex = new(
        @"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [Fact]
    public void ThesisSeedScripts_Should_Use_Valid_Guids_And_Canonical_Tables()
    {
        var repoRoot = FindRepoRoot(AppContext.BaseDirectory);

        var scripts = new Dictionary<string, string>
        {
            ["part3"] = Path.Combine(repoRoot, "scripts", "seed-part3-recipes.sql"),
            ["part4"] = Path.Combine(repoRoot, "scripts", "seed-part4-canonical-ops.sql"),
            ["part5"] = Path.Combine(repoRoot, "scripts", "seed-part5-thesis-tracking.sql")
        };

        foreach (var scriptPath in scripts.Values)
        {
            File.Exists(scriptPath).Should().BeTrue($"missing expected seed script: {scriptPath}");
        }

        var part3 = File.ReadAllText(scripts["part3"]);
        var part4 = File.ReadAllText(scripts["part4"]);
        var part5 = File.ReadAllText(scripts["part5"]);

        part3.Should().NotContain("rr0000", "legacy invalid recipe identifiers should not remain");
        part3.Should().Contain("\"RecipeProhibitedIngredients\"");
        part3.Should().Contain("\"RecipeIngredientSubstitutes\"");
        part3.Should().Contain("\"RecipeIngredients\"");

        part4.Should().Contain("\"DietitianClientLinks\"");
        part4.Should().Contain("\"AccessKeys\"");
        part4.Should().Contain("\"ClientProhibitedIngredients\"");
        part4.Should().Contain("\"ClientPantryItems\"");

        part5.Should().Contain("\"ComplianceScoreConfigs\"");
        part5.Should().Contain("\"MealCompliances\"");
        part5.Should().Contain("\"MealItemCompliance\"");
        part5.Should().Contain("\"DailyComplianceSnapshots\"");
        part5.Should().Contain("\"ClientWeightEntries\"");
        part5.Should().Contain("\"ClientMeasurementEntries\"");

        foreach (var (name, content) in new[] { ("part3", part3), ("part4", part4), ("part5", part5) })
        {
            var matches = GuidRegex.Matches(content).Select(m => m.Value).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            matches.Should().NotBeEmpty($"{name} should contain deterministic GUID seeds");
            var parseResults = matches.Select(guidText => Guid.TryParse(guidText, out _)).ToList();
            parseResults.Should().OnlyContain(result => result, $"{name} should only contain parseable GUID literals");
        }
    }

    [Fact]
    public void ThesisSeedReadme_Should_Reference_New_Run_Order()
    {
        var repoRoot = FindRepoRoot(AppContext.BaseDirectory);
        var readmePath = Path.Combine(repoRoot, "scripts", "README-thesis-seed.md");

        File.Exists(readmePath).Should().BeTrue();

        var readme = File.ReadAllText(readmePath);
        readme.Should().Contain("seed-part3-recipes.sql");
        readme.Should().Contain("seed-part4-canonical-ops.sql");
        readme.Should().Contain("seed-part5-thesis-tracking.sql");
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

        throw new DirectoryNotFoundException("Could not locate MyDietitianMobileApp.sln from test base directory.");
    }
}
