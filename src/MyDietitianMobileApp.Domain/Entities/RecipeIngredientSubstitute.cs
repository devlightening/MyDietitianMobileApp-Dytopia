namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Represents a substitute ingredient for a mandatory ingredient in a recipe.
/// Example: Recipe requires "Domates" (mandatory), but "Çeri Domates" can be used as substitute.
/// </summary>
public class RecipeIngredientSubstitute
{
    public Guid RecipeId { get; private set; }
    public Guid RequiredIngredientId { get; private set; }
    public Guid SubstituteIngredientId { get; private set; }

    // Navigation properties
    public Recipe Recipe { get; private set; } = null!;
    public Ingredient RequiredIngredient { get; private set; } = null!;
    public Ingredient SubstituteIngredient { get; private set; } = null!;

    private RecipeIngredientSubstitute() { } // EF Core

    public RecipeIngredientSubstitute(Guid recipeId, Guid requiredIngredientId, Guid substituteIngredientId)
    {
        if (requiredIngredientId == substituteIngredientId)
            throw new ArgumentException("Substitute ingredient cannot be the same as required ingredient", nameof(substituteIngredientId));

        RecipeId = recipeId;
        RequiredIngredientId = requiredIngredientId;
        SubstituteIngredientId = substituteIngredientId;
    }
}
