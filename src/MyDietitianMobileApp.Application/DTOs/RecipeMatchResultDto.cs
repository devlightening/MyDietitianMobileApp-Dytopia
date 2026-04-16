namespace MyDietitianMobileApp.Application.DTOs
{
    public class RecipeMatchResultDto
    {
        public Guid RecipeId { get; set; }
        public string RecipeName { get; set; } = string.Empty;
        public int MatchPercentage { get; set; }
        public List<string> MatchedIngredients { get; set; } = new();
        public List<string> MissingMandatoryIngredients { get; set; } = new();
        public List<string> MissingOptionalIngredients { get; set; } = new();
        public bool IsFullyMatch { get; set; }
    }
}
