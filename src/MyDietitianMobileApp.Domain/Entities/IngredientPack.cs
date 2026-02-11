namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Represents a pack of ingredients for quick-add functionality.
/// System packs are available to all users; dietitian packs are premium-only.
/// </summary>
public class IngredientPack
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public bool IsSystem { get; private set; }
    public Guid? DietitianId { get; private set; }
    public int SortOrder { get; private set; }

    public IReadOnlyCollection<IngredientPackItem> Items => _items.AsReadOnly();

    private readonly List<IngredientPackItem> _items = new();

    private IngredientPack() { } // EF Core

    public IngredientPack(Guid id, string name, bool isSystem, Guid? dietitianId = null, int sortOrder = 0)
    {
        Id = id;
        Name = name;
        IsSystem = isSystem;
        DietitianId = dietitianId;
        SortOrder = sortOrder;
    }

    public void AddItem(IngredientPackItem item)
    {
        if (_items.Any(i => i.IngredientId == item.IngredientId))
            return;
        _items.Add(item);
    }
}

public class IngredientPackItem
{
    public Guid PackId { get; private set; }
    public Guid IngredientId { get; private set; }

    // Navigation properties
    public IngredientPack Pack { get; private set; } = null!;
    public Ingredient Ingredient { get; private set; } = null!;

    private IngredientPackItem() { } // EF Core

    public IngredientPackItem(Guid packId, Guid ingredientId)
    {
        PackId = packId;
        IngredientId = ingredientId;
    }
}
