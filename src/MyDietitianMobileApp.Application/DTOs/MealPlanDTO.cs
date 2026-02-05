namespace MyDietitianMobileApp.Application.DTOs;

/// <summary>
/// DTO for meal plan (dietitian view)
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
/// DTO for individual meal item
/// </summary>
public class MealItemDTO
{
    public Guid Id { get; set; }
    public string Time { get; set; } = string.Empty; // HH:mm format
    public string Title { get; set; } = string.Empty;
    public string? Note { get; set; }
    public int OrderIndex { get; set; }
    public int? Calories { get; set; }
    public MacrosDTO? Macros { get; set; }
    public bool IsCompleted { get; set; }
}

/// <summary>
/// DTO for macronutrients
/// </summary>
public class MacrosDTO
{
    public decimal? ProteinGrams { get; set; }
    public decimal? CarbsGrams { get; set; }
    public decimal? FatGrams { get; set; }
}
