using MediatR;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Application.Commands
{
    public class CreateRecipeCommandHandler : IRequestHandler<CreateRecipeCommand, CreateRecipeResult>
    {
        private readonly IRecipeRepository _recipeRepository;
        private readonly IIngredientRepository _ingredientRepository;

        public CreateRecipeCommandHandler(IRecipeRepository recipeRepository, IIngredientRepository ingredientRepository)
        {
            _recipeRepository = recipeRepository;
            _ingredientRepository = ingredientRepository;
        }

        public async Task<CreateRecipeResult> Handle(CreateRecipeCommand request, CancellationToken cancellationToken)
        {
            // Validate ingredients
            var allIngredientIds = request.Ingredients.Select(i => i.IngredientId).ToList();
            var ingredients = _ingredientRepository.GetAll()
                .Where(i => allIngredientIds.Contains(i.Id) && i.IsActive)
                .ToList();

            if (ingredients.Count != allIngredientIds.Distinct().Count())
            {
                throw new Exception("Invalid or duplicate ingredients detected.");
            }

            // Check for conflicting ingredient rules
            var mandatoryIds = request.Ingredients.Where(i => i.IsMandatory).Select(i => i.IngredientId).ToList();
            var prohibitedIds = request.Ingredients.Where(i => i.IsProhibited).Select(i => i.IngredientId).ToList();
            if (mandatoryIds.Intersect(prohibitedIds).Any())
            {
                throw new Exception("An ingredient cannot be both mandatory and prohibited.");
            }

            // Create recipe (not public - dietitian-specific)
            var recipe = new Recipe(Guid.NewGuid(), request.DietitianId, request.Name, request.Description, isPublic: false);
            
            foreach (var ing in request.Ingredients)
            {
                var ingredient = ingredients.First(i => i.Id == ing.IngredientId);
                
                if (ing.IsMandatory)
                {
                    recipe.AddMandatoryIngredient(ingredient);
                }
                else if (ing.IsProhibited)
                {
                    recipe.AddProhibitedIngredient(ingredient);
                }
                else
                {
                    recipe.AddOptionalIngredient(ingredient);
                }
            }

            // Save recipe
            await _recipeRepository.AddAsync(recipe, cancellationToken);
            return new CreateRecipeResult(recipe.Id);
        }
    }
}
