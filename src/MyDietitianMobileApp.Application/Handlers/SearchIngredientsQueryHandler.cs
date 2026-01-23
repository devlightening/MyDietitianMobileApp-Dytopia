using MediatR;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Repositories;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class SearchIngredientsQueryHandler 
        : IRequestHandler<SearchIngredientsQuery, SearchIngredientsResult>
    {
        private readonly IIngredientRepository _ingredientRepository;

        public SearchIngredientsQueryHandler(IIngredientRepository ingredientRepository)
        {
            _ingredientRepository = ingredientRepository;
        }

        public async Task<SearchIngredientsResult> Handle(
            SearchIngredientsQuery query, 
            CancellationToken cancellationToken)
        {
            var ingredients = _ingredientRepository.Search(query.SearchTerm, query.MaxResults);

            var dtos = ingredients.Select(i => new IngredientDto
            {
                Id = i.Id,
                CanonicalName = i.CanonicalName,
                Aliases = i.Aliases
            });

            return await Task.FromResult(new SearchIngredientsResult(dtos));
        }
    }
}

