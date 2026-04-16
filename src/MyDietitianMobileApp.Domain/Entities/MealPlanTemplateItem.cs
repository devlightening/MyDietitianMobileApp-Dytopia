namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// One meal entry within a MealPlanTemplate.
/// Mirrors PlanMealItem but belongs to a template rather than a live plan.
/// </summary>
public class MealPlanTemplateItem
{
    public Guid Id { get; set; }

    /// <summary>Parent template.</summary>
    public Guid TemplateId { get; set; }

    /// <summary>Time of day for this meal (e.g., 08:00, 12:30).</summary>
    public TimeSpan Time { get; set; }

    /// <summary>Meal category matching PlanMealItemType enum.</summary>
    public PlanMealItemType MealType { get; set; } = PlanMealItemType.Snack;

    /// <summary>Meal title (max 200 chars).</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Optional instruction for the client (max 1000 chars).</summary>
    public string? Note { get; set; }

    public int? Calories { get; set; }
    public decimal? ProteinGrams { get; set; }
    public decimal? CarbsGrams { get; set; }
    public decimal? FatGrams { get; set; }

    /// <summary>Optional link to a Recipe for kitchen matching.</summary>
    public Guid? RecipeId { get; set; }

    /// <summary>Display order within the template (0-based).</summary>
    public int OrderIndex { get; set; }

    // Navigation
    public MealPlanTemplate Template { get; set; } = null!;
}
