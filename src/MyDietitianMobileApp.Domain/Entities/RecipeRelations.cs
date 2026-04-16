namespace MyDietitianMobileApp.Domain.Entities;

public class RecipeIngredient
{
    public const string MandatoryRole = "Mandatory";
    public const string OptionalRole = "Optional";
    public const string FlavoringRole = "Flavoring";
    public const string ProhibitedRole = "Prohibited";

    public Guid Id { get; private set; }
    public Guid RecipeId { get; private set; }
    public Guid IngredientId { get; private set; }
    public string Role { get; private set; } // Mandatory | Optional | Flavoring | Prohibited
    public decimal? Quantity { get; private set; }
    public string? Unit { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    // Navigation
    public Recipe Recipe { get; private set; } = null!;
    public Ingredient Ingredient { get; private set; } = null!;

    private RecipeIngredient() { } // EF Core

    public RecipeIngredient(
        Guid recipeId,
        Guid ingredientId,
        string role,
        decimal? quantity = null,
        string? unit = null)
    {
        if (role != MandatoryRole &&
            role != OptionalRole &&
            role != FlavoringRole &&
            role != ProhibitedRole)
        {
            throw new ArgumentException("Role must be Mandatory, Optional, Flavoring, or Prohibited", nameof(role));
        }

        Id = Guid.NewGuid();
        RecipeId = recipeId;
        IngredientId = ingredientId;
        Role = role;
        Quantity = quantity;
        Unit = unit;
        CreatedAtUtc = DateTime.UtcNow;
    }
}

public class RecipeSubstitute
{
    public Guid Id { get; private set; }
    public Guid RecipeId { get; private set; }
    public Guid RequiredIngredientId { get; private set; }
    public Guid SubstituteIngredientId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    // Navigation
    public Recipe Recipe { get; private set; } = null!;
    public Ingredient RequiredIngredient { get; private set; } = null!;
    public Ingredient SubstituteIngredient { get; private set; } = null!;

    private RecipeSubstitute() { } // EF Core

    public RecipeSubstitute(
        Guid recipeId,
        Guid requiredIngredientId,
        Guid substituteIngredientId)
    {
        Id = Guid.NewGuid();
        RecipeId = recipeId;
        RequiredIngredientId = requiredIngredientId;
        SubstituteIngredientId = substituteIngredientId;
        CreatedAtUtc = DateTime.UtcNow;
    }
}

public class RecipeProhibition
{
    public Guid Id { get; private set; }
    public Guid RecipeId { get; private set; }
    public Guid IngredientId { get; private set; }
    public string? Reason { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    // Navigation
    public Recipe Recipe { get; private set; } = null!;
    public Ingredient Ingredient { get; private set; } = null!;

    private RecipeProhibition() { } // EF Core

    public RecipeProhibition(
        Guid recipeId,
        Guid ingredientId,
        string? reason = null)
    {
        Id = Guid.NewGuid();
        RecipeId = recipeId;
        IngredientId = ingredientId;
        Reason = reason;
        CreatedAtUtc = DateTime.UtcNow;
    }
}
