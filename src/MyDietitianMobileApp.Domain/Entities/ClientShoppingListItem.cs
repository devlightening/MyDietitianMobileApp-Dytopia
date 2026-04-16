namespace MyDietitianMobileApp.Domain.Entities;

public class ClientShoppingListItem
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid? IngredientId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public decimal? Quantity { get; private set; }
    public string? Unit { get; private set; }
    public bool IsChecked { get; private set; }
    public string SourceType { get; private set; } = "Manual";
    public string? SourceReferenceId { get; private set; }
    public string? Note { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public Client Client { get; private set; } = null!;
    public Ingredient? Ingredient { get; private set; }

    private ClientShoppingListItem() { }

    public ClientShoppingListItem(
        Guid clientId,
        Guid? ingredientId,
        string title,
        decimal? quantity,
        string? unit,
        string sourceType,
        string? sourceReferenceId,
        string? note)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        IngredientId = ingredientId;
        CreatedAtUtc = DateTime.UtcNow;
        Update(title, quantity, unit, sourceType, sourceReferenceId, note);
        IsChecked = false;
    }

    public void Update(
        string title,
        decimal? quantity,
        string? unit,
        string sourceType,
        string? sourceReferenceId,
        string? note)
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Untitled item" : title.Trim();
        Quantity = quantity;
        Unit = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim();
        SourceType = string.IsNullOrWhiteSpace(sourceType) ? "Manual" : sourceType.Trim();
        SourceReferenceId = string.IsNullOrWhiteSpace(sourceReferenceId) ? null : sourceReferenceId.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetChecked(bool isChecked)
    {
        IsChecked = isChecked;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RefreshFromSuggestion(
        string title,
        decimal? quantity,
        string? unit,
        string sourceType,
        string? sourceReferenceId,
        string? note)
    {
        Update(title, quantity, unit, sourceType, sourceReferenceId, note);
        IsChecked = false;
    }
}
