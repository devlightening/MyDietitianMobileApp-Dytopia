namespace MyDietitianMobileApp.Domain.Entities;

public class DietitianRecipeFavorite
{
    public Guid DietitianId { get; private set; }
    public Guid RecipeId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public Dietitian Dietitian { get; private set; } = null!;
    public Recipe Recipe { get; private set; } = null!;

    private DietitianRecipeFavorite() { }

    public DietitianRecipeFavorite(Guid dietitianId, Guid recipeId)
    {
        DietitianId = dietitianId;
        RecipeId = recipeId;
        CreatedAtUtc = DateTime.UtcNow;
    }
}
