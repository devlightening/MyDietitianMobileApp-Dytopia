namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Represents a client's prohibited ingredient (allergy/forbidden).
/// </summary>
public class ClientProhibitedIngredient
{
    public Guid ClientId { get; private set; }
    public Guid IngredientId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    // Navigation properties
    public Client Client { get; private set; } = null!;
    public Ingredient Ingredient { get; private set; } = null!;

    private ClientProhibitedIngredient() { } // EF Core

    public ClientProhibitedIngredient(Guid clientId, Guid ingredientId)
    {
        ClientId = clientId;
        IngredientId = ingredientId;
        CreatedAtUtc = DateTime.UtcNow;
    }
}
