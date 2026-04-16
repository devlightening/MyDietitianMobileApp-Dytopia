namespace MyDietitianMobileApp.Domain.Entities;

public class ClientAchievementUnlock
{
    public Guid ClientId { get; private set; }
    public string BadgeId { get; private set; } = string.Empty;
    public int CurrentLevel { get; private set; }
    public DateTime UnlockedAtUtc { get; private set; }
    public DateTime? LastSeenAtUtc { get; private set; }
    public DateTime? LastNotifiedAtUtc { get; private set; }

    public Client Client { get; private set; } = null!;

    private ClientAchievementUnlock() { }

    public ClientAchievementUnlock(Guid clientId, string badgeId, int currentLevel = 1)
    {
        ClientId = clientId;
        BadgeId = badgeId.Trim();
        CurrentLevel = Math.Max(1, currentLevel);
        UnlockedAtUtc = DateTime.UtcNow;
    }

    public void MarkSeen()
    {
        LastSeenAtUtc = DateTime.UtcNow;
    }

    public void MarkNotified()
    {
        LastNotifiedAtUtc = DateTime.UtcNow;
    }

    public void SetLevel(int level)
    {
        CurrentLevel = Math.Max(CurrentLevel, Math.Max(1, level));
    }
}
