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
        public string Name { get; set; }
        public string Description { get; set; }
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
