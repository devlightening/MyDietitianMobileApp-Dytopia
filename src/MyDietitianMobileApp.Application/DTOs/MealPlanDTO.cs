namespace MyDietitianMobileApp.Application.DTOs;

/// <summary>
/// DTO for a daily meal plan returned to the client
/// </summary>
public class MealPlanDTO
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public DateTime Date { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<MealItemDTO> Items { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// DTO for a single meal item within a plan.
/// MealType and CompletionStatus are the key fields for mobile meal cards.
/// </summary>
public class MealItemDTO
{
    public Guid Id { get; set; }

    /// <summary>HH:mm format, e.g. "08:00"</summary>
    public string Time { get; set; } = string.Empty;

    /// <summary>
    /// Meal category as string: "Breakfast","MidMorning","Lunch","Afternoon","Dinner","Evening","Snack"
    /// Mobile uses this to pick the right emoji and label.
    /// </summary>
    public string MealType { get; set; } = "Snack";

    /// <summary>Optional recipe linked to this meal (for Kitchen integration)</summary>
    public Guid? RecipeId { get; set; }

    /// <summary>Recipe name when RecipeId is set</summary>
    public string? RecipeName { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Note { get; set; }
    public int OrderIndex { get; set; }
    public int? Calories { get; set; }
    public MacrosDTO? Macros { get; set; }

    /// <summary>
    /// One of: "Planned" | "Done" | "Skipped" | "Alternative"
    /// Replaces the old boolean IsCompleted.
    /// </summary>
    public string CompletionStatus { get; set; } = "Planned";

    /// <summary>When CompletionStatus=Alternative, the recipe the client actually used</summary>
    public Guid? AlternativeRecipeId { get; set; }

    /// <summary>
    /// True when the client can act on this meal right now according to local day/time rules.
    /// </summary>
    public bool IsActionableNow { get; set; }

    /// <summary>
    /// Local date key (yyyy-MM-dd) for when the meal becomes actionable.
    /// </summary>
    public string? ActionBlockedUntilDate { get; set; }

    /// <summary>
    /// Local time key (HH:mm) for when the meal becomes actionable.
    /// </summary>
    public string? ActionBlockedUntilTime { get; set; }
}

public class MacrosDTO
{
    public decimal? ProteinGrams { get; set; }
    public decimal? CarbsGrams { get; set; }
    public decimal? FatGrams { get; set; }
}
