namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// A reusable meal plan template owned by a dietitian.
/// Templates contain a set of meal items (time, type, title, macros, optional recipe)
/// that can be applied to any client's plan on a target date.
/// </summary>
public class MealPlanTemplate
{
    public Guid Id { get; set; }

    /// <summary>Dietitian who owns this template.</summary>
    public Guid DietitianId { get; set; }

    /// <summary>Display name, e.g. "Standart Kahvaltı Seti".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional description shown in the template list.</summary>
    public string? Description { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    // Navigation
    public ICollection<MealPlanTemplateItem> Items { get; set; } = new List<MealPlanTemplateItem>();
}
