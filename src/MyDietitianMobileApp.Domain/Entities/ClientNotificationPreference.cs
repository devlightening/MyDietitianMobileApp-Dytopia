namespace MyDietitianMobileApp.Domain.Entities;

public class ClientNotificationPreference
{
    private ClientNotificationPreference()
    {
    }

    public ClientNotificationPreference(Guid clientId)
    {
        ClientId = clientId;
        UpdatedAtUtc = DateTime.UtcNow;
        LastAppOpenAtUtc = DateTime.UtcNow;
    }

    public Guid ClientId { get; private set; }

    public bool NotificationsEnabled { get; private set; } = true;
    public bool InAppCoachNotificationsEnabled { get; private set; } = true;
    public bool AchievementNotificationsEnabled { get; private set; } = true;
    public bool PantryActivityNotificationsEnabled { get; private set; } = true;

    public bool HydrationRemindersEnabled { get; private set; } = true;
    public int HydrationIntervalMinutes { get; private set; } = 120;
    public TimeOnly HydrationStartLocalTime { get; private set; } = new(9, 0);
    public TimeOnly HydrationEndLocalTime { get; private set; } = new(21, 0);

    public bool MealPlanRemindersEnabled { get; private set; } = true;
    public int MealReminderLeadMinutes { get; private set; } = 20;

    public bool MeasurementRemindersEnabled { get; private set; } = true;
    public int MeasurementReminderDayOfWeek { get; private set; } = 1;
    public TimeOnly MeasurementReminderLocalTime { get; private set; } = new(20, 0);

    public bool ReengagementRemindersEnabled { get; private set; } = true;
    public int ReengagementDelayHours { get; private set; } = 48;

    public string TimeZoneId { get; private set; } = "Europe/Istanbul";

    public DateTime UpdatedAtUtc { get; private set; }
    public DateTime LastAppOpenAtUtc { get; private set; }
    public DateTime? LastNotificationSyncAtUtc { get; private set; }

    public void Update(
        bool notificationsEnabled,
        bool inAppCoachNotificationsEnabled,
        bool achievementNotificationsEnabled,
        bool pantryActivityNotificationsEnabled,
        bool hydrationRemindersEnabled,
        int hydrationIntervalMinutes,
        TimeOnly hydrationStartLocalTime,
        TimeOnly hydrationEndLocalTime,
        bool mealPlanRemindersEnabled,
        int mealReminderLeadMinutes,
        bool measurementRemindersEnabled,
        int measurementReminderDayOfWeek,
        TimeOnly measurementReminderLocalTime,
        bool reengagementRemindersEnabled,
        int reengagementDelayHours,
        string? timeZoneId)
    {
        NotificationsEnabled = notificationsEnabled;
        InAppCoachNotificationsEnabled = inAppCoachNotificationsEnabled;
        AchievementNotificationsEnabled = achievementNotificationsEnabled;
        PantryActivityNotificationsEnabled = pantryActivityNotificationsEnabled;
        HydrationRemindersEnabled = hydrationRemindersEnabled;
        HydrationIntervalMinutes = hydrationIntervalMinutes;
        HydrationStartLocalTime = hydrationStartLocalTime;
        HydrationEndLocalTime = hydrationEndLocalTime;
        MealPlanRemindersEnabled = mealPlanRemindersEnabled;
        MealReminderLeadMinutes = mealReminderLeadMinutes;
        MeasurementRemindersEnabled = measurementRemindersEnabled;
        MeasurementReminderDayOfWeek = measurementReminderDayOfWeek;
        MeasurementReminderLocalTime = measurementReminderLocalTime;
        ReengagementRemindersEnabled = reengagementRemindersEnabled;
        ReengagementDelayHours = reengagementDelayHours;
        TimeZoneId = string.IsNullOrWhiteSpace(timeZoneId) ? "Europe/Istanbul" : timeZoneId.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkAppOpened()
    {
        LastAppOpenAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkNotificationSync()
    {
        LastNotificationSyncAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
