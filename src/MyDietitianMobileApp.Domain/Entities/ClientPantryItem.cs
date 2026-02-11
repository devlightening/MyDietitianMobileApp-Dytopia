namespace MyDietitianMobileApp.Domain.Entities;

public class ClientPantryItem
{
    public Guid ClientId { get; private set; }
    public Guid IngredientId { get; private set; }
    public decimal? Quantity { get; private set; }
    public string? Unit { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation properties
    public Client Client { get; private set; } = null!;
    public Ingredient Ingredient { get; private set; } = null!;

    // EF
    private ClientPantryItem() { }

    public ClientPantryItem(Guid clientId, Guid ingredientId, decimal? quantity, string? unit)
    {
        ClientId = clientId;
        IngredientId = ingredientId;
        SetQuantity(quantity, unit);
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetQuantity(decimal? quantity, string? unit)
    {
        Quantity = quantity;
        Unit = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

