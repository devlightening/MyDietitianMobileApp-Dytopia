using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using System;
using System.Linq;

namespace MyDietitianMobileApp.Infrastructure.Persistence
{
    public class IngredientRepository : IIngredientRepository
    {
        private readonly AppDbContext _context;
        public IngredientRepository(AppDbContext context)
        {
            _context = context;
        }
        public Ingredient? GetById(Guid id)
        {
            return _context.Ingredients.FirstOrDefault(i => i.Id == id);
        }

        public IEnumerable<Ingredient> Search(string searchTerm, int maxResults = 20)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return Enumerable.Empty<Ingredient>();

            var normalized = searchTerm.Trim().ToLower();

            // Load all active ingredients once. The alias branch already requires a full
            // in-memory scan, so consolidating to a single DB round-trip is net-neutral on
            // PostgreSQL and fixes SQLite compatibility (no provider-specific ILike/functions).
            var allActive = _context.Ingredients
                .Where(i => i.IsActive)
                .ToList();

            var matchingByName = allActive
                .Where(i => i.CanonicalName.Contains(normalized, StringComparison.OrdinalIgnoreCase))
                .ToList();

            var matchingByAlias = allActive
                .Where(i => i.Aliases.Any(alias => alias.Contains(normalized, StringComparison.OrdinalIgnoreCase)))
                .Where(i => !matchingByName.Any(m => m.Id == i.Id)); // Avoid duplicates

            return matchingByName.Concat(matchingByAlias)
                .OrderBy(i => i.CanonicalName)
                .Take(maxResults)
                .ToList();
        }

        public IEnumerable<Ingredient> GetAll()
        {
            return _context.Ingredients
                .OrderBy(i => i.CanonicalName)
                .ToList();
        }

        public bool ExistsByCanonicalName(string canonicalName, Guid? excludeId = null)
        {
            var normalized = canonicalName.Trim().ToLower();
            var query = _context.Ingredients.AsQueryable();

            if (excludeId.HasValue)
            {
                query = query.Where(i => i.Id != excludeId.Value);
            }

            return query.Any(i => i.CanonicalName.ToLower() == normalized);
        }
    }
}
