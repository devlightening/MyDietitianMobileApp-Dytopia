using MediatR;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Repositories;
using System.Linq;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class ListAllIngredientsQueryHandler 
        : IRequestHandler<ListAllIngredientsQuery, ListAllIngredientsResult>
    {
        private readonly IIngredientRepository _ingredientRepository;

        public ListAllIngredientsQueryHandler(IIngredientRepository ingredientRepository)
        {
            _ingredientRepository = ingredientRepository;
        }

        public async Task<ListAllIngredientsResult> Handle(
            ListAllIngredientsQuery query, 
            CancellationToken cancellationToken)
        {
            var ingredients = _ingredientRepository.GetAll();

            var dtos = ingredients.Select(i => new AdminIngredientDto
            {
                Id = i.Id,
                CanonicalName = i.CanonicalName,
                Aliases = i.Aliases,
                IsActive = i.IsActive
            });

            return await Task.FromResult(new ListAllIngredientsResult(dtos));
        }
    }
}
