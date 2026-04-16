using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

public class IngredientTaxonomyService : IIngredientTaxonomyService
{
    private readonly AppDbContext _dbContext;

    public IngredientTaxonomyService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<IngredientFamily>> GetFamiliesForIngredientAsync(Guid ingredientId, CancellationToken cancellationToken = default)
    {
        var families = await _dbContext.IngredientFamilyMembers
            .AsNoTracking()
            .Include(m => m.Family)
            .Where(m => m.IngredientId == ingredientId && m.Family.IsActive)
            .Select(m => m.Family)
            .ToListAsync(cancellationToken);

        return families;
    }

    public async Task<bool> AreInSameFamilyAsync(Guid ingredientAId, Guid ingredientBId, CancellationToken cancellationToken = default)
    {
        var familiesA = await _dbContext.IngredientFamilyMembers
            .AsNoTracking()
            .Where(m => m.IngredientId == ingredientAId)
            .Select(m => m.FamilyId)
            .ToListAsync(cancellationToken);

        if (!familiesA.Any())
            return false;

        var sharesFamily = await _dbContext.IngredientFamilyMembers
            .AsNoTracking()
            .AnyAsync(m => m.IngredientId == ingredientBId && familiesA.Contains(m.FamilyId), cancellationToken);

        return sharesFamily;
    }

    public async Task<CompatibilityType> GetCompatibilityAsync(Guid requiredIngredientId, Guid candidateIngredientId, CancellationToken cancellationToken = default)
    {
        if (requiredIngredientId == candidateIngredientId)
            return CompatibilityType.ExactOnly;

        var rule = await _dbContext.IngredientCompatibilityRules
            .AsNoTracking()
            .Where(r => r.RequiredIngredientId == requiredIngredientId && 
                        r.CandidateIngredientId == candidateIngredientId &&
                        r.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (rule != null)
        {
            return rule.CompatibilityType;
        }

        // Default if no rule exists, but they are in the same family: NotCompatible by default (as per professional requirement)
        // A rule must explicitly allow family members.
        return CompatibilityType.NotCompatible;
    }

    public async Task<IReadOnlyList<Ingredient>> GetCompatibleCandidatesAsync(
        Guid requiredIngredientId, 
        CompatibilityType minimumCompatibility = CompatibilityType.SubstituteAllowed, 
        CancellationToken cancellationToken = default)
    {
        // For now, this just queries explicit compatibility rules that meet or exceed the minimum requested compatibility.
        // E.g., if minimum is SubstituteAllowed, we match SubstituteAllowed or FamilyCompatible (if considered "higher").
        // We'll just look for SubstituteAllowed or FamilyCompatible explicitly.
        
        var validTypes = new List<CompatibilityType>();
        
        if (minimumCompatibility == CompatibilityType.SubstituteAllowed)
        {
            validTypes.Add(CompatibilityType.SubstituteAllowed);
            validTypes.Add(CompatibilityType.FamilyCompatible);
            validTypes.Add(CompatibilityType.ExactOnly);
        }
        else if (minimumCompatibility == CompatibilityType.FamilyCompatible)
        {
            validTypes.Add(CompatibilityType.FamilyCompatible);
            validTypes.Add(CompatibilityType.ExactOnly);
        }
        else if (minimumCompatibility == CompatibilityType.ExactOnly)
        {
            validTypes.Add(CompatibilityType.ExactOnly);
        }

        var candidateIds = await _dbContext.IngredientCompatibilityRules
            .AsNoTracking()
            .Where(r => r.RequiredIngredientId == requiredIngredientId &&
                        r.IsActive &&
                        validTypes.Contains(r.CompatibilityType))
            .Select(r => r.CandidateIngredientId)
            .ToListAsync(cancellationToken);

        if (!candidateIds.Any())
            return Array.Empty<Ingredient>();

        var candidates = await _dbContext.Ingredients
            .AsNoTracking()
            .Where(i => candidateIds.Contains(i.Id) && i.IsActive)
            .ToListAsync(cancellationToken);

        return candidates;
    }
}
