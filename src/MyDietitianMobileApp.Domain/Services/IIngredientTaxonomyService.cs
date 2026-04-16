using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Services;

public interface IIngredientTaxonomyService
{
    Task<IReadOnlyList<IngredientFamily>> GetFamiliesForIngredientAsync(Guid ingredientId, CancellationToken cancellationToken = default);
    
    Task<bool> AreInSameFamilyAsync(Guid ingredientAId, Guid ingredientBId, CancellationToken cancellationToken = default);
    
    Task<CompatibilityType> GetCompatibilityAsync(Guid requiredIngredientId, Guid candidateIngredientId, CancellationToken cancellationToken = default);
    
    Task<IReadOnlyList<Ingredient>> GetCompatibleCandidatesAsync(Guid requiredIngredientId, CompatibilityType minimumCompatibility = CompatibilityType.SubstituteAllowed, CancellationToken cancellationToken = default);
}
