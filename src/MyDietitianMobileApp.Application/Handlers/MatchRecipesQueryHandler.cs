using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Application.Queries
{
    public record MatchRecipesQuery(
        List<Guid> ClientIngredientIds
    ) : IRequest<List<RecipeMatchResultDto>>;

    public class MatchRecipesQueryHandler : IRequestHandler<MatchRecipesQuery, List<RecipeMatchResultDto>>
    {
        private readonly IRecipeRepository _recipeRepository;

        public MatchRecipesQueryHandler(IRecipeRepository recipeRepository)
        {
            _recipeRepository = recipeRepository;
        }

        public async Task<List<RecipeMatchResultDto>> Handle(MatchRecipesQuery request, CancellationToken cancellationToken)
        {
            var recipes = await _recipeRepository.GetAllWithIngredientsAsync(cancellationToken);
            var results = new List<RecipeMatchResultDto>();

            foreach (var recipe in recipes)
            {
                // Check for prohibited ingredients
                if (recipe.ProhibitedIngredients.Any(ingredient => request.ClientIngredientIds.Contains(ingredient.Id)))
                {
                    continue; // Skip this recipe
                }

                // Check for mandatory ingredients
                var missingMandatory = recipe.MandatoryIngredients
                    .Where(ingredient => !request.ClientIngredientIds.Contains(ingredient.Id))
                    .Select(ingredient => ingredient.Name)
                    .ToList();

                if (missingMandatory.Any())
                {
                    continue; // Skip this recipe
                }

                // Calculate match percentage
                var matchedMandatory = recipe.MandatoryIngredients.Count(ingredient => request.ClientIngredientIds.Contains(ingredient.Id));
                var matchedOptional = recipe.OptionalIngredients.Count(ingredient => request.ClientIngredientIds.Contains(ingredient.Id));

                double matchPercentage = 0;
                if (recipe.MandatoryIngredients.Count > 0)
                {
                    matchPercentage += (matchedMandatory / (double)recipe.MandatoryIngredients.Count) * 70;
                }
                if (recipe.OptionalIngredients.Count > 0)
                {
                    matchPercentage += (matchedOptional / (double)recipe.OptionalIngredients.Count) * 30;
                }
                else if (recipe.MandatoryIngredients.Count > 0)
                {
                    // If no optional ingredients, mandatory match is 100% of score
                    matchPercentage = (matchedMandatory / (double)recipe.MandatoryIngredients.Count) * 100;
                }

                // Collect matched and missing ingredients
                var matchedIngredients = recipe.MandatoryIngredients
                    .Concat(recipe.OptionalIngredients)
                    .Where(ingredient => request.ClientIngredientIds.Contains(ingredient.Id))
                    .Select(ingredient => ingredient.Name)
                    .ToList();

                var missingOptional = recipe.OptionalIngredients
                    .Where(ingredient => !request.ClientIngredientIds.Contains(ingredient.Id))
                    .Select(ingredient => ingredient.Name)
                    .ToList();

                results.Add(new RecipeMatchResultDto
                {
                    RecipeId = recipe.Id,
                    RecipeName = recipe.Name,
                    MatchPercentage = (int)matchPercentage,
                    MatchedIngredients = matchedIngredients,
                    MissingMandatoryIngredients = missingMandatory,
                    MissingOptionalIngredients = missingOptional,
                    IsFullyMatch = !missingMandatory.Any() && !missingOptional.Any()
                });
            }

            return results.OrderByDescending(r => r.MatchPercentage).ToList();
        }
    }
}
