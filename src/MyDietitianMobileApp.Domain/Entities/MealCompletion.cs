namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Tracks when a client completes a meal from their plan
/// </summary>
public class MealCompletion
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Client who completed the meal
    /// </summary>
    public Guid ClientId { get; set; }
    
    /// <summary>
    /// Meal item that was completed
    /// </summary>
    public Guid PlanMealItemId { get; set; }
    
    /// <summary>
    /// When the meal was marked as completed
    /// </summary>
    public DateTime CompletedAt { get; set; }
    
    /// <summary>
    /// Where the completion was recorded (Mobile or Web)
    /// </summary>
    public CompletionSource Source { get; set; }
    
    // Navigation properties
    public Client Client { get; set; } = null!;
    public PlanMealItem PlanMealItem { get; set; } = null!;
}

/// <summary>
/// Source of meal completion
/// </summary>
public enum CompletionSource
{
    /// <summary>
    /// Completed via mobile app
    /// </summary>
    Mobile = 0,
    
    /// <summary>
    /// Completed via web panel
    /// </summary>
    Web = 1
}
