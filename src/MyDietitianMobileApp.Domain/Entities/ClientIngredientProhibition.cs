namespace MyDietitianMobileApp.Domain.Entities;

public class ClientIngredientProhibition
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid IngredientId { get; private set; }
    public string? Reason { get; private set; } // e.g., "Allergy", "Dietary Restriction", "Personal Preference"
    public bool IsActive { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;
    public Ingredient Ingredient { get; private set; } = null!;

    private ClientIngredientProhibition() { } // EF Core

    public ClientIngredientProhibition(
        Guid clientId,
        Guid ingredientId,
        string? reason = null)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        IngredientId = ingredientId;
        Reason = reason;
        IsActive = true;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    public void Reactivate()
    {
        IsActive = true;
    }
}
