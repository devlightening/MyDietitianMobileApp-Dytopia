namespace MyDietitianMobileApp.Domain.Entities;

public class DailyComplianceSnapshot
{
    public Guid ClientId { get; private set; }
    public DateOnly Date { get; private set; }
    public int PlannedCount { get; private set; }
    public int CompletedCount { get; private set; }
    public int SkippedCount { get; private set; }
    public int Score0_100 { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;

    private DailyComplianceSnapshot() { } // EF Core

    public DailyComplianceSnapshot(Guid clientId, DateOnly date, int plannedCount, int completedCount, int skippedCount, int score0_100)
    {
        ClientId = clientId;
        Date = date;
        PlannedCount = plannedCount;
        CompletedCount = completedCount;
        SkippedCount = skippedCount;
        Score0_100 = score0_100;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(int plannedCount, int completedCount, int skippedCount, int score0_100)
    {
        PlannedCount = plannedCount;
        CompletedCount = completedCount;
        SkippedCount = skippedCount;
        Score0_100 = score0_100;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
