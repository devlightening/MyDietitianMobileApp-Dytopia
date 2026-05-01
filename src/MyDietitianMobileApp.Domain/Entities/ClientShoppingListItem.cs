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
    public string? SourceMealsJson { get; private set; }
    public string? IngredientRoleSummaryJson { get; private set; }
    public string? PrimaryMealTitle { get; private set; }
    public string? PrimaryMealTime { get; private set; }
    public bool GeneratedFromSelectedRecipe { get; private set; }
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
        string? note,
        string? sourceMealsJson = null,
        string? ingredientRoleSummaryJson = null,
        string? primaryMealTitle = null,
        string? primaryMealTime = null,
        bool generatedFromSelectedRecipe = false)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        IngredientId = ingredientId;
        CreatedAtUtc = DateTime.UtcNow;
        Update(
            title,
            quantity,
            unit,
            sourceType,
            sourceReferenceId,
            note,
            sourceMealsJson,
            ingredientRoleSummaryJson,
            primaryMealTitle,
            primaryMealTime,
            generatedFromSelectedRecipe);
        IsChecked = false;
    }

    public void Update(
        string title,
        decimal? quantity,
        string? unit,
        string sourceType,
        string? sourceReferenceId,
        string? note,
        string? sourceMealsJson = null,
        string? ingredientRoleSummaryJson = null,
        string? primaryMealTitle = null,
        string? primaryMealTime = null,
        bool generatedFromSelectedRecipe = false)
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Untitled item" : title.Trim();
        Quantity = quantity;
        Unit = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim();
        SourceType = string.IsNullOrWhiteSpace(sourceType) ? "Manual" : sourceType.Trim();
        SourceReferenceId = string.IsNullOrWhiteSpace(sourceReferenceId) ? null : sourceReferenceId.Trim();
        SourceMealsJson = string.IsNullOrWhiteSpace(sourceMealsJson) ? null : sourceMealsJson.Trim();
        IngredientRoleSummaryJson = string.IsNullOrWhiteSpace(ingredientRoleSummaryJson) ? null : ingredientRoleSummaryJson.Trim();
        PrimaryMealTitle = string.IsNullOrWhiteSpace(primaryMealTitle) ? null : primaryMealTitle.Trim();
        PrimaryMealTime = string.IsNullOrWhiteSpace(primaryMealTime) ? null : primaryMealTime.Trim();
        GeneratedFromSelectedRecipe = generatedFromSelectedRecipe;
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
        string? note,
        string? sourceMealsJson = null,
        string? ingredientRoleSummaryJson = null,
        string? primaryMealTitle = null,
        string? primaryMealTime = null,
        bool generatedFromSelectedRecipe = false)
    {
        Update(
            title,
            quantity,
            unit,
            sourceType,
            sourceReferenceId,
            note,
            sourceMealsJson,
            ingredientRoleSummaryJson,
            primaryMealTitle,
            primaryMealTime,
            generatedFromSelectedRecipe);
        IsChecked = false;
    }
}
