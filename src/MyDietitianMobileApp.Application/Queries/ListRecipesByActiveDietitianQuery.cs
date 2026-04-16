using MediatR;

namespace MyDietitianMobileApp.Application.Queries
{
    public class ListRecipesByActiveDietitianQuery : IRequest<ListRecipesByActiveDietitianResult>
    {
        public Guid DietitianId { get; }
        public ListRecipesByActiveDietitianQuery(Guid dietitianId)
        {
            DietitianId = dietitianId;
        }
    }
    public class RecipeDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
    }
    public class ListRecipesByActiveDietitianResult
    {
        public IEnumerable<RecipeDto> Recipes { get; }
        public ListRecipesByActiveDietitianResult(IEnumerable<RecipeDto> recipes)
        {
            Recipes = recipes;
        }
    }
}
