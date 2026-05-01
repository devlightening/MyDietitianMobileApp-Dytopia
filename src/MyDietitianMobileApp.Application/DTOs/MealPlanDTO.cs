namespace MyDietitianMobileApp.Application.DTOs;

public class MealPlanDTO
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public DateTime Date { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<MealItemDTO> Items { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

public class MealItemDTO
{
    public Guid Id { get; set; }

    /// <summary>HH:mm format, e.g. "08:00"</summary>
    public string Time { get; set; } = string.Empty;

    /// <summary>
    /// Meal category: "Breakfast","MidMorning","Lunch","Afternoon","Dinner","Evening","Snack"
    /// </summary>
    public string MealType { get; set; } = "Snack";

    /// <summary>Planned recipe ID</summary>
    public Guid? RecipeId { get; set; }

    /// <summary>Planned recipe name</summary>
    public string? RecipeName { get; set; }

    /// <summary>Recipe currently selected for this meal flow.</summary>
    public Guid? SelectedRecipeId { get; set; }
    public string? SelectedRecipeName { get; set; }
    public string SelectedRecipeSource { get; set; } = "Original";
    public int? SelectedCalories { get; set; }
    public MacrosDTO? SelectedMacros { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Note { get; set; }
    public int OrderIndex { get; set; }

    /// <summary>Planned recipe calories</summary>
    public int? Calories { get; set; }

    /// <summary>Planned recipe macros</summary>
    public MacrosDTO? Macros { get; set; }

    /// <summary>One of: "Planned" | "Done" | "Skipped" | "Alternative"</summary>
    public string CompletionStatus { get; set; } = "Planned";

    /// <summary>When CompletionStatus=Alternative, the recipe the client actually used</summary>
    public Guid? AlternativeRecipeId { get; set; }

    /// <summary>Name of the alternative recipe (populated when AlternativeRecipeId is set)</summary>
    public string? AlternativeRecipeName { get; set; }

    /// <summary>Calories of the alternative recipe (populated when AlternativeRecipeId is set)</summary>
    public int? AlternativeCalories { get; set; }

    /// <summary>Macros of the alternative recipe (populated when AlternativeRecipeId is set)</summary>
    public MacrosDTO? AlternativeMacros { get; set; }

    public bool IsActionableNow { get; set; }
    public string? ActionBlockedUntilDate { get; set; }
    public string? ActionBlockedUntilTime { get; set; }
    public string? FeedbackKey { get; set; }
}

public class MacrosDTO
{
    public decimal? ProteinGrams { get; set; }
    public decimal? CarbsGrams { get; set; }
    public decimal? FatGrams { get; set; }
}
