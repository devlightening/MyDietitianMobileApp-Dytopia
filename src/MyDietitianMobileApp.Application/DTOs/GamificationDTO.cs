namespace MyDietitianMobileApp.Application.DTOs;

public class ClientGamificationSummaryDTO
{
    public string PrimaryTrack { get; set; } = "daily_rhythm";
    public int CurrentStreak { get; set; }
    public int BestStreak { get; set; }
    public int EarnedBadgeCount { get; set; }
    public int TotalBadgeCount { get; set; }
    public int NextMilestoneDays { get; set; }
    public bool StreakAtRisk { get; set; }
    public string? AtRiskReason { get; set; }
    public GamificationTodayDTO Today { get; set; } = new();
    public List<GamificationAchievementDTO> Achievements { get; set; } = new();
    public List<string> RecentUnlocks { get; set; } = new();
}

public class GamificationTodayDTO
{
    public decimal PrimaryScore { get; set; }
    public decimal AdherenceScore { get; set; }
    public decimal EngagementScore { get; set; }
    public bool QualifiedForStreak { get; set; }
    public bool PerfectDay { get; set; }
    public int PlannedMeals { get; set; }
    public int DoneMeals { get; set; }
    public int AlternativeMeals { get; set; }
    public int SkippedMeals { get; set; }
    public int WaterGlasses { get; set; }
    public bool WaterGoalHit { get; set; }
    public int KitchenEvents { get; set; }
    public bool MeasurementLogged { get; set; }
    public bool CareMessageSent { get; set; }
}

public class GamificationAchievementDTO
{
    public string Id { get; set; } = string.Empty;
    public int ProgressCurrent { get; set; }
    public int ProgressTarget { get; set; }
    public bool Unlocked { get; set; }
    public DateTime? UnlockedAtUtc { get; set; }
}

public class DietitianGamificationSummaryDTO
{
    public int ClientsAtRiskCount { get; set; }
    public int NewUnlocksCount { get; set; }
    public int ActiveStreaksCount { get; set; }
    public List<ClientMotivationPulseDTO> Clients { get; set; } = new();
}

public class ClientMotivationPulseDTO
{
    public Guid ClientId { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public int CurrentStreak { get; set; }
    public int BestStreak { get; set; }
    public bool StreakAtRisk { get; set; }
    public int EarnedBadgeCount { get; set; }
    public string PrimaryTrack { get; set; } = "daily_rhythm";
    public List<string> RecentBadgeIds { get; set; } = new();
    public DateTime? LastUnlockAtUtc { get; set; }
}
