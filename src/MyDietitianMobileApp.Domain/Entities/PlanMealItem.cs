namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Represents a single meal/snack within a daily meal plan
/// Renamed from MealItem to avoid conflict with existing entity
/// </summary>
public class PlanMealItem
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Parent meal plan
    /// </summary>
    public Guid PlanId { get; set; }
    
    /// <summary>
    /// Time of day for this meal (e.g., 09:00, 12:30)
    /// </summary>
    public TimeSpan Time { get; set; }
    
    /// <summary>
    /// Meal title (e.g., "Omelette + greens", "Apple & Walnuts")
    /// </summary>
    public string Title { get; set; } = string.Empty;
    
    /// <summary>
    /// Optional note or instruction for the client
    /// </summary>
    public string? Note { get; set; }
    
    /// <summary>
    /// Display order within the plan (0-based)
    /// </summary>
    public int OrderIndex { get; set; }
    
    /// <summary>
    /// Optional calorie count
    /// </summary>
    public int? Calories { get; set; }
    
    /// <summary>
    /// Optional macronutrient: Protein in grams
    /// </summary>
    public decimal? ProteinGrams { get; set; }
    
    /// <summary>
    /// Optional macronutrient: Carbs in grams
    /// </summary>
    public decimal? CarbsGrams { get; set; }
    
    /// <summary>
    /// Optional macronutrient: Fat in grams
    /// </summary>
    public decimal? FatGrams { get; set; }
    
    public DateTime CreatedAt { get; set; }
    
    // Navigation properties
    public MealPlan Plan { get; set; } = null!;
    public MealCompletion? Completion { get; set; }
}
