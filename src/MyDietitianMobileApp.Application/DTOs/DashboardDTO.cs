namespace MyDietitianMobileApp.Application.DTOs;

/// <summary>
/// Dashboard data for mobile client
/// </summary>
public class DashboardDTO
{
    /// <summary>
    /// Current date (ISO format)
    /// </summary>
    public DateTime Date { get; set; }

    /// <summary>
    /// Clinic name (premium only)
    /// </summary>
    public string? ClinicName { get; set; }

    /// <summary>
    /// User's first name for greeting
    /// </summary>
    public string? GreetingName { get; set; }

    /// <summary>
    /// Compliance percentage (0-100)
    /// </summary>
    public int CompliancePercent { get; set; }

    /// <summary>
    /// Today's status: "on-track", "needs-attention", or "off-track"
    /// </summary>
    public string TodayStatus { get; set; } = "on-track";

    /// <summary>
    /// Next meal information (premium only)
    /// </summary>
    public NextMealDTO? NextMeal { get; set; }

    /// <summary>
    /// Dashboard summary stats (premium only)
    /// </summary>
    public DashboardSummaryDTO? Summary { get; set; }
}

/// <summary>
/// Next meal information
/// </summary>
public class NextMealDTO
{
    /// <summary>
    /// Meal time (HH:mm format, e.g., "14:30")
    /// </summary>
    public string? Time { get; set; }

    /// <summary>
    /// Meal title/name
    /// </summary>
    public string? Title { get; set; }

    /// <summary>
    /// Optional note or instruction
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Meal ID for navigation
    /// </summary>
    public int? MealId { get; set; }
}

/// <summary>
/// Dashboard summary statistics
/// </summary>
public class DashboardSummaryDTO
{
    /// <summary>
    /// Current streak (days)
    /// </summary>
    public int? Streak { get; set; }

    /// <summary>
    /// Calories consumed today
    /// </summary>
    public int? CaloriesToday { get; set; }

    /// <summary>
    /// Water glasses consumed
    /// </summary>
    public int? WaterGlasses { get; set; }

    /// <summary>
    /// Steps count
    /// </summary>
    public int? Steps { get; set; }
}
