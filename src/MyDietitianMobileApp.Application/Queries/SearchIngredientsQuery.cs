using MediatR;
using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Application.Queries
{
    public class SearchIngredientsQuery : IRequest<SearchIngredientsResult>
    {
        public string SearchTerm { get; }
        public int MaxResults { get; }

        public SearchIngredientsQuery(string searchTerm, int maxResults = 20)
        {
            SearchTerm = searchTerm ?? string.Empty;
            MaxResults = maxResults;
        }
    }

    public class IngredientDto
    {
        public Guid Id { get; set; }
        public string CanonicalName { get; set; } = string.Empty;
        public IReadOnlyCollection<string> Aliases { get; set; } = Array.Empty<string>();
    }

    public class SearchIngredientsResult
    {
        public IEnumerable<IngredientDto> Ingredients { get; }

        public SearchIngredientsResult(IEnumerable<IngredientDto> ingredients)
        {
            Ingredients = ingredients;
        }
    }
}

