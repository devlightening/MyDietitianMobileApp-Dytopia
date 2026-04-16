using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
// DatabaseSeeder was removed — these tests are disabled until the seeder is replaced.
// using MyDietitianMobileApp.Api.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Ingredients;

/// <summary>
/// Tests that the operational ingredient dataset seeder is idempotent.
/// Uses an in-memory DB for full isolation.
///
/// NOTE: DatabaseSeeder was removed from the project.
///       These tests are skipped until the seeder is replaced with seed SQL / migration seeding.
/// </summary>
public class TaxonomySeederTests
{
    // Stub type to keep file compilable while DatabaseSeeder is absent.
    private sealed class DatabaseSeeder
    {
#pragma warning disable IDE0060
        public DatabaseSeeder(IServiceProvider sp, object logger, object env) { }
#pragma warning restore IDE0060
        public Task SeedAsync() => Task.CompletedTask;
    }

    private static (AppDbContext, AuthDbContext, DatabaseSeeder) CreateTestEnvironment()
    {
        var appOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var authOptions = new DbContextOptionsBuilder<AuthDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var appDbContext = new AppDbContext(appOptions);
        var authDbContext = new AuthDbContext(authOptions);

        var services = new ServiceCollection();
        services.AddSingleton(appDbContext);
        services.AddSingleton(authDbContext);
        // Register a real PasswordHasherService to avoid mock issues
        services.AddSingleton<PasswordHasherService>();

        var serviceProvider = services.BuildServiceProvider();
        var mockLogger = new Mock<ILogger<DatabaseSeeder>>();
        var mockEnv = new Mock<IHostEnvironment>();
        mockEnv.Setup(e => e.EnvironmentName).Returns("Development");

        var seeder = new DatabaseSeeder(serviceProvider, mockLogger.Object, mockEnv.Object);
        return (appDbContext, authDbContext, seeder);
    }

    [Fact(Skip = "DatabaseSeeder removed — pending replacement with seed SQL")]
    public async Task SeedAsync_ShouldPopulateIngredients_AtLeastMinimumCount()
    {
        var (db, _, seeder) = CreateTestEnvironment();

        await seeder.SeedAsync();

        var ingredientCount = await db.Ingredients.CountAsync();
        var familyCount = await db.IngredientFamilies.CountAsync();
        var memberCount = await db.IngredientFamilyMembers.CountAsync();
        var ruleCount = await db.IngredientCompatibilityRules.CountAsync();

        Assert.True(ingredientCount >= 90, $"Expected >= 90 ingredients, got {ingredientCount}");
        Assert.True(familyCount >= 15, $"Expected >= 15 families, got {familyCount}");
        Assert.True(memberCount >= 80, $"Expected >= 80 members, got {memberCount}");
        Assert.True(ruleCount >= 20, $"Expected >= 20 compat rules, got {ruleCount}");
    }

    [Fact(Skip = "DatabaseSeeder removed — pending replacement with seed SQL")]
    public async Task SeedAsync_WhenRunMultipleTimes_ShouldBeIdempotent()
    {
        var (db, _, seeder) = CreateTestEnvironment();

        // First run
        await seeder.SeedAsync();
        var ingredientCount1 = await db.Ingredients.CountAsync();
        var familyCount1 = await db.IngredientFamilies.CountAsync();
        var memberCount1 = await db.IngredientFamilyMembers.CountAsync();
        var ruleCount1 = await db.IngredientCompatibilityRules.CountAsync();

        // Second run — must be idempotent
        await seeder.SeedAsync();
        var ingredientCount2 = await db.Ingredients.CountAsync();
        var familyCount2 = await db.IngredientFamilies.CountAsync();
        var memberCount2 = await db.IngredientFamilyMembers.CountAsync();
        var ruleCount2 = await db.IngredientCompatibilityRules.CountAsync();

        Assert.Equal(ingredientCount1, ingredientCount2);
        Assert.Equal(familyCount1, familyCount2);
        Assert.Equal(memberCount1, memberCount2);
        Assert.Equal(ruleCount1, ruleCount2);
    }

    [Fact(Skip = "DatabaseSeeder removed — pending replacement with seed SQL")]
    public async Task SeedAsync_ShouldCreateYogurtFamilyWithAllRequiredMembers()
    {
        var (db, _, seeder) = CreateTestEnvironment();
        await seeder.SeedAsync();

        var family = await db.IngredientFamilies.FirstOrDefaultAsync(f => f.Name == "Yoğurt Ailesi");
        Assert.NotNull(family);

        var members = await db.IngredientFamilyMembers
            .Where(m => m.FamilyId == family.Id)
            .Include(m => m.Ingredient)
            .ToListAsync();

        var names = System.Linq.Enumerable.ToHashSet(
            System.Linq.Enumerable.Select(members, m => m.Ingredient.CanonicalName)
        );
        Assert.Contains("Yoğurt", names);
        Assert.Contains("Süzme Yoğurt", names);
        Assert.Contains("Laktozsuz Yoğurt", names);
        Assert.Contains("Meyveli Yoğurt", names);
    }

    [Fact(Skip = "DatabaseSeeder removed — pending replacement with seed SQL")]
    public async Task SeedAsync_ShouldCreateCompatibilityRulesForYogurt()
    {
        var (db, _, seeder) = CreateTestEnvironment();
        await seeder.SeedAsync();

        var yogurt = await db.Ingredients.FirstOrDefaultAsync(i => i.CanonicalName == "Yoğurt");
        Assert.NotNull(yogurt);

        var rules = await db.IngredientCompatibilityRules
            .Where(r => r.RequiredIngredientId == yogurt.Id)
            .Include(r => r.CandidateIngredient)
            .ToListAsync();

        Assert.True(rules.Count >= 3, $"Expected >= 3 compat rules for Yoğurt, got {rules.Count}");

        var ruleDict = System.Linq.Enumerable.ToDictionary(
            rules,
            r => r.CandidateIngredient.CanonicalName,
            r => r.CompatibilityType
        );

        Assert.Equal(MyDietitianMobileApp.Domain.Enums.CompatibilityType.SubstituteAllowed, ruleDict["Süzme Yoğurt"]);
        Assert.Equal(MyDietitianMobileApp.Domain.Enums.CompatibilityType.SubstituteAllowed, ruleDict["Laktozsuz Yoğurt"]);
        Assert.Equal(MyDietitianMobileApp.Domain.Enums.CompatibilityType.NotCompatible, ruleDict["Meyveli Yoğurt"]);
    }
}
