namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Meal type categories for a PlanMealItem
/// </summary>
public enum PlanMealItemType
{
    Breakfast   = 0,
    MidMorning  = 1,
    Lunch       = 2,
    Afternoon   = 3,
    Dinner      = 4,
    Evening     = 5,
    Snack       = 6
}

/// <summary>
/// Represents a single meal/snack within a daily meal plan.
/// Renamed from MealItem to avoid conflict with existing entity.
/// </summary>
public class PlanMealItem
{
    public Guid Id { get; set; }

    /// <summary>Parent meal plan</summary>
    public Guid PlanId { get; set; }

    /// <summary>Time of day for this meal (e.g., 09:00, 12:30)</summary>
    public TimeSpan Time { get; set; }

    /// <summary>Meal category (Breakfast, Lunch, Dinner, Snack, …)</summary>
    public PlanMealItemType MealType { get; set; } = PlanMealItemType.Snack;

    /// <summary>
    /// Optional link to a Recipe in the system.
    /// When set, mobile can navigate directly to kitchen matching for this meal.
    /// </summary>
    public Guid? RecipeId { get; set; }

    /// <summary>Meal title (e.g., "Yulaf Ezmesi", "Sebzeli Omlet")</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Optional note or instruction for the client</summary>
    public string? Note { get; set; }

    /// <summary>Display order within the plan (0-based)</summary>
    public int OrderIndex { get; set; }

    /// <summary>Optional calorie count</summary>
    public int? Calories { get; set; }

    public decimal? ProteinGrams { get; set; }
    public decimal? CarbsGrams  { get; set; }
    public decimal? FatGrams    { get; set; }

    public DateTime CreatedAt { get; set; }

    // Navigation
    public MealPlan Plan { get; set; } = null!;
    public Recipe?  Recipe { get; set; }
    public MealCompletion? Completion { get; set; }
}
