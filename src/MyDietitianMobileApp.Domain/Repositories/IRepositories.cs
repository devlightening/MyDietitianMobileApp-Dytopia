using MyDietitianMobileApp.Domain.Entities;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Domain.Repositories
{
    public interface IClientRepository
    {
        Client? GetById(Guid id);
    }

    public interface IDietitianRepository
    {
        Dietitian? GetById(Guid id);
    }

    public interface IIngredientRepository
    {
        Ingredient? GetById(Guid id);
        IEnumerable<Ingredient> Search(string searchTerm, int maxResults = 20);
        IEnumerable<Ingredient> GetAll();
        bool ExistsByCanonicalName(string canonicalName, Guid? excludeId = null);
    }

    public interface IRecipeRepository
    {
        IEnumerable<Recipe> ListByDietitianId(Guid dietitianId);
        Task AddAsync(Recipe recipe, CancellationToken cancellationToken);
        Task<List<Recipe>> GetAllWithIngredientsAsync(CancellationToken cancellationToken);
    }
}
