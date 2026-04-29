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
            var recipes = await _context.Recipes
                .Include(r => r.MandatoryIngredients)
                .Include(r => r.OptionalIngredients)
                .Include(r => r.ProhibitedIngredients)
                .ToListAsync(cancellationToken);

            if (recipes.Count == 0)
            {
                return recipes;
            }

            var recipeIds = recipes.Select(r => r.Id).ToList();
            var explicitIngredients = await _context.RecipeIngredients
                .AsNoTracking()
                .Where(ri => recipeIds.Contains(ri.RecipeId))
                .Include(ri => ri.Ingredient)
                .ToListAsync(cancellationToken);

            var groupedByRecipe = explicitIngredients
                .GroupBy(ri => ri.RecipeId)
                .ToDictionary(group => group.Key, group => group.ToList());

            foreach (var recipe in recipes)
            {
                if (!groupedByRecipe.TryGetValue(recipe.Id, out var explicitRows))
                {
                    continue;
                }

                var mandatory = explicitRows
                    .Where(ri => ri.Role == RecipeIngredient.MandatoryRole)
                    .Select(ri => ri.Ingredient)
                    .DistinctBy(ingredient => ingredient.Id)
                    .ToList();

                var optional = explicitRows
                    .Where(ri => ri.Role == RecipeIngredient.OptionalRole || ri.Role == RecipeIngredient.FlavoringRole)
                    .Select(ri => ri.Ingredient)
                    .DistinctBy(ingredient => ingredient.Id)
                    .ToList();

                var prohibited = explicitRows
                    .Where(ri => ri.Role == RecipeIngredient.ProhibitedRole)
                    .Select(ri => ri.Ingredient)
                    .DistinctBy(ingredient => ingredient.Id)
                    .ToList();

                recipe.HydrateFromExplicitIngredients(mandatory, optional, prohibited);
            }

            return recipes;
        }
    }
}
