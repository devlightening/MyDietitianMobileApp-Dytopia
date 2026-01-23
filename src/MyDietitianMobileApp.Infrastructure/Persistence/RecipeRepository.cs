using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;

namespace MyDietitianMobileApp.Infrastructure.Persistence
{
    public class RecipeRepository : IRecipeRepository
    {
        private readonly AppDbContext _context;
        public RecipeRepository(AppDbContext context)
        {
            _context = context;
        }
        public IEnumerable<Recipe> ListByDietitianId(Guid dietitianId)
        {
            return _context.Recipes
                .Where(r => r.DietitianId == dietitianId)
                .ToList();
        }

        public async Task AddAsync(Recipe recipe, CancellationToken cancellationToken)
        {
            await _context.Recipes.AddAsync(recipe, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task<List<Recipe>> GetAllWithIngredientsAsync(CancellationToken cancellationToken)
        {
            return await _context.Recipes
                .Include(r => r.MandatoryIngredients)
                .Include(r => r.OptionalIngredients)
                .Include(r => r.ProhibitedIngredients)
                .ToListAsync(cancellationToken);
        }
    }
}
