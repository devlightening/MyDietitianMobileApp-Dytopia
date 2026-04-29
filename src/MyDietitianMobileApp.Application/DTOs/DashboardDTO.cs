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

    /// <summary>
    /// Motivation and streak metadata (premium only)
    /// </summary>
    public DashboardMotivationDTO? Motivation { get; set; }

    /// <summary>
    /// Latest plain-text dietitian note for the dashboard.
    /// </summary>
    public string? DietitianNote { get; set; }

    /// <summary>
    /// Optional structured mini task from the dietitian.
    /// </summary>
    public DashboardCoachTaskDTO? CoachTask { get; set; }
}

public class DashboardCoachTaskDTO
{
    public string ActionKey { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Cta { get; set; } = string.Empty;
}

/// <summary>
/// Next meal information (used by Dashboard widget and /api/client/meals/next)
/// </summary>
public class NextMealDTO
{
    /// <summary>Card state: upcoming, all-complete, or no-plan.</summary>
    public string Kind { get; set; } = "upcoming";

    /// <summary>PlanMealItem Id — used for navigation and completion actions</summary>
    public Guid? MealItemId { get; set; }

    /// <summary>Meal time (HH:mm format, e.g., "14:30")</summary>
    public string? Time { get; set; }

    /// <summary>Meal category string: Breakfast, Lunch, Dinner, Snack, etc.</summary>
    public string? MealType { get; set; }

    /// <summary>Meal title/name</summary>
    public string? Title { get; set; }

    /// <summary>Optional note or instruction</summary>
    public string? Note { get; set; }

    /// <summary>Linked recipe (for Kitchen navigation)</summary>
    public Guid? RecipeId { get; set; }

    /// <summary>Minutes until this meal is scheduled (negative = already past)</summary>
    public int? MinutesUntil { get; set; }
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

    /// <summary>
    /// Earned badge count from current motivation model
    /// </summary>
    public int? BadgeCount { get; set; }
}

/// <summary>
/// Motivation payload for gamified daily adherence
/// </summary>
public class DashboardMotivationDTO
{
    /// <summary>
    /// Current active adherence streak
    /// </summary>
    public int CurrentStreak { get; set; }

    /// <summary>
    /// Best streak in the lookback window
    /// </summary>
    public int BestStreak { get; set; }

    /// <summary>
    /// Total earned badges from the defined achievement set
    /// </summary>
    public int EarnedBadgeCount { get; set; }

    /// <summary>
    /// Days left until the next streak milestone. 0 when no next milestone remains.
    /// </summary>
    public int NextMilestoneDays { get; set; }

    /// <summary>
    /// Achievement set used by the client for badge UI and notifications
    /// </summary>
    public List<DashboardAchievementDTO> Achievements { get; set; } = new();
}

/// <summary>
/// Individual achievement progress and unlock state
/// </summary>
public class DashboardAchievementDTO
{
    /// <summary>
    /// Stable client-facing achievement id
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Progress value toward the target
    /// </summary>
    public int ProgressCurrent { get; set; }

    /// <summary>
    /// Progress target value
    /// </summary>
    public int ProgressTarget { get; set; }

    /// <summary>
    /// Whether the achievement is currently unlocked
    /// </summary>
    public bool Unlocked { get; set; }
}
