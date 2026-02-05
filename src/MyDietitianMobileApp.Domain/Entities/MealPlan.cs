namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Represents a daily meal plan created by a dietitian for a client
/// </summary>
public class MealPlan
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Client this plan belongs to
    /// </summary>
    public Guid ClientId { get; set; }
    
    /// <summary>
    /// Date this plan is for (date only, no time)
    /// </summary>
    public DateTime Date { get; set; }
    
    /// <summary>
    /// Plan status: Draft or Published
    /// Only published plans are visible to clients
    /// </summary>
    public MealPlanStatus Status { get; set; }
    
    /// <summary>
    /// Dietitian who created this plan
    /// </summary>
    public Guid CreatedBy { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // Navigation properties
    public Client Client { get; set; } = null!;
    public Dietitian Creator { get; set; } = null!;
    public ICollection<PlanMealItem> Items { get; set; } = new List<PlanMealItem>();
}

/// <summary>
/// Meal plan status
/// </summary>
public enum MealPlanStatus
{
    /// <summary>
    /// Draft - not visible to client, can be edited freely
    /// </summary>
    Draft = 0,
    
    /// <summary>
    /// Published - visible to client, should not be deleted
    /// </summary>
    Published = 1
}
