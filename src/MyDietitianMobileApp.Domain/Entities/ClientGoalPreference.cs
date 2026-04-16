namespace MyDietitianMobileApp.Domain.Entities;

public class ClientGoalPreference
{
    public Guid ClientId { get; private set; }
    public string PrimaryGoal { get; private set; } = "Balance";
    public string DietStyle { get; private set; } = "Flexible";
    public string CookingTimePreference { get; private set; } = "Quick";
    public string ReminderTone { get; private set; } = "Supportive";
    public DateTime UpdatedAtUtc { get; private set; }

    public Client Client { get; private set; } = null!;

    private ClientGoalPreference() { }

    public ClientGoalPreference(
        Guid clientId,
        string primaryGoal = "Balance",
        string dietStyle = "Flexible",
        string cookingTimePreference = "Quick",
        string reminderTone = "Supportive")
    {
        ClientId = clientId;
        Update(primaryGoal, dietStyle, cookingTimePreference, reminderTone);
    }

    public void Update(
        string primaryGoal,
        string dietStyle,
        string cookingTimePreference,
        string reminderTone)
    {
        PrimaryGoal = Normalize(primaryGoal, "Balance");
        DietStyle = Normalize(dietStyle, "Flexible");
        CookingTimePreference = Normalize(cookingTimePreference, "Quick");
        ReminderTone = Normalize(reminderTone, "Supportive");
        UpdatedAtUtc = DateTime.UtcNow;
    }

    private static string Normalize(string? value, string fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
            return fallback;

        return value.Trim();
    }
}
