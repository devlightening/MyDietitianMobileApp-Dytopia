using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Ingredients;

public class IngredientTaxonomyServiceTests
{
    private AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetFamiliesForIngredientAsync_ReturnsCorrectFamilies()
    {
        // Arrange
        using var context = CreateContext();
        var service = new IngredientTaxonomyService(context);

        var family = new IngredientFamily(Guid.NewGuid(), "Test Family", "Description", 1);
        var ingredient = new Ingredient(Guid.NewGuid(), "Test Ingredient");
        var member = new IngredientFamilyMember(family.Id, ingredient.Id, IngredientFamilyMemberRole.Base);

        context.IngredientFamilies.Add(family);
        context.Ingredients.Add(ingredient);
        context.IngredientFamilyMembers.Add(member);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetFamiliesForIngredientAsync(ingredient.Id);

        // Assert
        Assert.Single(result);
        Assert.Equal(family.Id, result.First().Id);
    }

    [Fact]
    public async Task AreInSameFamilyAsync_ReturnsTrue_WhenInSameFamily()
    {
        // Arrange
        using var context = CreateContext();
        var service = new IngredientTaxonomyService(context);

        var family = new IngredientFamily(Guid.NewGuid(), "Test Family", "Description", 1);
        var ing1 = new Ingredient(Guid.NewGuid(), "Ing 1");
        var ing2 = new Ingredient(Guid.NewGuid(), "Ing 2");

        context.IngredientFamilies.Add(family);
        context.Ingredients.AddRange(ing1, ing2);
        context.IngredientFamilyMembers.AddRange(
            new IngredientFamilyMember(family.Id, ing1.Id, IngredientFamilyMemberRole.Base),
            new IngredientFamilyMember(family.Id, ing2.Id, IngredientFamilyMemberRole.Variant)
        );
        await context.SaveChangesAsync();

        // Act
        var result = await service.AreInSameFamilyAsync(ing1.Id, ing2.Id);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task IntegrationCheck_YogurtVsMeyveliYogurt_CompatibilityIsHandledProperly()
    {
        // Arrange
        using var context = CreateContext();
        var service = new IngredientTaxonomyService(context);

        var family = new IngredientFamily(Guid.NewGuid(), "Yogurt Family");
        var plainYogurt = new Ingredient(Guid.NewGuid(), "Yoğurt");
        var meyveliYogurt = new Ingredient(Guid.NewGuid(), "Meyveli Yoğurt");
        var suzmeYogurt = new Ingredient(Guid.NewGuid(), "Süzme Yoğurt");

        context.IngredientFamilies.Add(family);
        context.Ingredients.AddRange(plainYogurt, meyveliYogurt, suzmeYogurt);
        
        context.IngredientFamilyMembers.AddRange(
            new IngredientFamilyMember(family.Id, plainYogurt.Id, IngredientFamilyMemberRole.Base),
            new IngredientFamilyMember(family.Id, meyveliYogurt.Id, IngredientFamilyMemberRole.Variant),
            new IngredientFamilyMember(family.Id, suzmeYogurt.Id, IngredientFamilyMemberRole.Variant)
        );

        // Rule: Meyveli Yogurt is NOT compatible when plain Yogurt is required
        context.IngredientCompatibilityRules.Add(new IngredientCompatibilityRule(
            Guid.NewGuid(), plainYogurt.Id, meyveliYogurt.Id, CompatibilityType.NotCompatible
        ));

        // Rule: Suzme Yogurt is ALLOWED when plain Yogurt is required
        context.IngredientCompatibilityRules.Add(new IngredientCompatibilityRule(
            Guid.NewGuid(), plainYogurt.Id, suzmeYogurt.Id, CompatibilityType.SubstituteAllowed
        ));

        await context.SaveChangesAsync();

        // Act
        var meyveliCompat = await service.GetCompatibilityAsync(plainYogurt.Id, meyveliYogurt.Id);
        var suzmeCompat = await service.GetCompatibilityAsync(plainYogurt.Id, suzmeYogurt.Id);
        
        // Also check if they are in same family
        var sameFamilyMeyveli = await service.AreInSameFamilyAsync(plainYogurt.Id, meyveliYogurt.Id);

        // Assert
        Assert.True(sameFamilyMeyveli, "Should be in the same family");
        Assert.Equal(CompatibilityType.NotCompatible, meyveliCompat);
        Assert.Equal(CompatibilityType.SubstituteAllowed, suzmeCompat);
    }
}
