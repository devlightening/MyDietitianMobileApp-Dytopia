using MediatR;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Application.Queries
{
    public class ListRecipesByActiveDietitianQueryHandler 
        : IRequestHandler<ListRecipesByActiveDietitianQuery, ListRecipesByActiveDietitianResult>
    {
        private readonly IRecipeRepository _recipeRepository;
        public ListRecipesByActiveDietitianQueryHandler(IRecipeRepository recipeRepository)
        {
            _recipeRepository = recipeRepository;
        }
        public async Task<ListRecipesByActiveDietitianResult> Handle(
            ListRecipesByActiveDietitianQuery query, 
            CancellationToken cancellationToken)
        {
            var recipes = _recipeRepository.ListByDietitianId(query.DietitianId);
            var result = new List<RecipeDto>();
            foreach (var recipe in recipes)
            {
                result.Add(new RecipeDto
                {
                    Id = recipe.Id,
                    Name = recipe.Name,
                    Description = recipe.Description
                });
            }
            return await Task.FromResult(new ListRecipesByActiveDietitianResult(result));
        }
    }
}
