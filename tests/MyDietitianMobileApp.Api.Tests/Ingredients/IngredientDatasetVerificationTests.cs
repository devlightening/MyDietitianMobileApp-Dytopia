using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Xunit;
using Xunit.Abstractions;

namespace MyDietitianMobileApp.Api.Tests.Ingredients;

/// <summary>
/// Live DB verification test for the operational ingredient dataset.
/// Requires the local dev DB to be running.
/// </summary>
[Trait("Category", "LiveDb")]
public class IngredientDatasetVerificationTests
{
    private readonly ITestOutputHelper _output;

    public IngredientDatasetVerificationTests(ITestOutputHelper output)
    {
        _output = output;
    }

    private static AppDbContext CreateContext()
    {
        var connStr = "Host=localhost;Port=5433;Database=mydietitian_dev;Username=postgres;Password=postgres;Timeout=30;Command Timeout=30";
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connStr)
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task VerifyIngredientCounts_AfterSeed()
    {
        using var db = CreateContext();

        var ingredientCount = await db.Ingredients.CountAsync();
        var familyCount = await db.IngredientFamilies.CountAsync();
        var memberCount = await db.IngredientFamilyMembers.CountAsync();
        var ruleCount = await db.IngredientCompatibilityRules.CountAsync();
        var packCount = await db.IngredientPacks.CountAsync();
        var packItemCount = await db.IngredientPackItems.CountAsync();

        _output.WriteLine($"Ingredients:              {ingredientCount}");
        _output.WriteLine($"IngredientFamilies:       {familyCount}");
        _output.WriteLine($"IngredientFamilyMembers:  {memberCount}");
        _output.WriteLine($"IngredientCompatibility:  {ruleCount}");
        _output.WriteLine($"IngredientPacks:          {packCount}");
        _output.WriteLine($"IngredientPackItems:      {packItemCount}");

        // --- Assert minimums ---
        Assert.True(ingredientCount >= 90, $"Expected >= 90 ingredients, got {ingredientCount}");
        Assert.True(familyCount >= 15, $"Expected >= 15 families, got {familyCount}");
        Assert.True(memberCount >= 80, $"Expected >= 80 family members, got {memberCount}");
        Assert.True(ruleCount >= 20, $"Expected >= 20 compat rules, got {ruleCount}");
        Assert.True(packCount >= 4, $"Expected >= 4 packs, got {packCount}");
    }

    [Fact]
    public async Task VerifyYogurtFamily_Members()
    {
        using var db = CreateContext();

        var yogurtFamily = await db.IngredientFamilies.FirstOrDefaultAsync(f => f.Name == "Yoğurt Ailesi");
        Assert.NotNull(yogurtFamily);

        var members = await db.IngredientFamilyMembers
            .Include(m => m.Ingredient)
            .Where(m => m.FamilyId == yogurtFamily.Id)
            .ToListAsync();

        foreach (var m in members)
            _output.WriteLine($"  [{m.Role}] {m.Ingredient.CanonicalName}");

        var names = members.Select(m => m.Ingredient.CanonicalName).ToHashSet();
        Assert.Contains("Yoğurt", names);
        Assert.Contains("Süzme Yoğurt", names);
        Assert.Contains("Laktozsuz Yoğurt", names);
        Assert.Contains("Meyveli Yoğurt", names);
        Assert.Equal(4, members.Count);
    }

    [Fact]
    public async Task VerifySutFamily_Members()
    {
        using var db = CreateContext();

        var sutFamily = await db.IngredientFamilies.FirstOrDefaultAsync(f => f.Name == "Süt Ailesi");
        Assert.NotNull(sutFamily);

        var members = await db.IngredientFamilyMembers
            .Include(m => m.Ingredient)
            .Where(m => m.FamilyId == sutFamily.Id)
            .ToListAsync();

        foreach (var m in members)
            _output.WriteLine($"  [{m.Role}] {m.Ingredient.CanonicalName}");

        var names = members.Select(m => m.Ingredient.CanonicalName).ToHashSet();
        Assert.Contains("Süt", names);
        Assert.Contains("Laktozsuz Süt", names);
        Assert.Contains("Badem Sütü", names);
        Assert.Contains("Yulaf Sütü", names);
        Assert.True(members.Count >= 4);
    }

    [Fact]
    public async Task VerifyYogurtCompatibilityRules()
    {
        using var db = CreateContext();

        var yogurt = await db.Ingredients.FirstOrDefaultAsync(i => i.CanonicalName == "Yoğurt");
        Assert.NotNull(yogurt);

        var rules = await db.IngredientCompatibilityRules
            .Include(r => r.CandidateIngredient)
            .Where(r => r.RequiredIngredientId == yogurt.Id)
            .ToListAsync();

        foreach (var r in rules)
            _output.WriteLine($"  Yoğurt -> {r.CandidateIngredient.CanonicalName}: {r.CompatibilityType}");

        Assert.True(rules.Count >= 3, $"Expected >= 3 compat rules for Yoğurt, got {rules.Count}");

        var ruleDict = rules.ToDictionary(r => r.CandidateIngredient.CanonicalName, r => r.CompatibilityType);
        Assert.Equal(MyDietitianMobileApp.Domain.Enums.CompatibilityType.SubstituteAllowed, ruleDict["Süzme Yoğurt"]);
        Assert.Equal(MyDietitianMobileApp.Domain.Enums.CompatibilityType.SubstituteAllowed, ruleDict["Laktozsuz Yoğurt"]);
        Assert.Equal(MyDietitianMobileApp.Domain.Enums.CompatibilityType.NotCompatible, ruleDict["Meyveli Yoğurt"]);
    }
}
