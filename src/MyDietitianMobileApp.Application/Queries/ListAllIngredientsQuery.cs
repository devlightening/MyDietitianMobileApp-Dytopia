using MediatR;

namespace MyDietitianMobileApp.Application.Queries
{
    public class ListAllIngredientsQuery : IRequest<ListAllIngredientsResult>
    {
        // No parameters - list all ingredients for admin
    }

    // IngredientDto is defined in SearchIngredientsQuery.cs - reuse it
    // Extend it for admin use (IsActive field added in SearchIngredientsQuery)

    public class AdminIngredientDto
    {
        public Guid Id { get; set; }
        public string CanonicalName { get; set; } = string.Empty;
        public IReadOnlyCollection<string> Aliases { get; set; } = Array.Empty<string>();
        public bool IsActive { get; set; }
    }

    public class ListAllIngredientsResult
    {
        public IEnumerable<AdminIngredientDto> Ingredients { get; }

        public ListAllIngredientsResult(IEnumerable<AdminIngredientDto> ingredients)
        {
            Ingredients = ingredients;
        }
    }
}

