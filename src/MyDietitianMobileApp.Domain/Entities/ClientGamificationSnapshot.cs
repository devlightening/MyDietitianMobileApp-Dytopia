namespace MyDietitianMobileApp.Domain.Entities;

public class ClientGamificationSnapshot
{
    public Guid ClientId { get; private set; }
    public DateOnly Date { get; private set; }
    public string PrimaryTrack { get; private set; } = "daily_rhythm";
    public decimal PrimaryScore { get; private set; }
    public decimal AdherenceScore { get; private set; }
    public decimal EngagementScore { get; private set; }
    public bool QualifiedForStreak { get; private set; }
    public int CurrentStreak { get; private set; }
    public int BestStreak { get; private set; }
    public int PlannedMeals { get; private set; }
    public int DoneMeals { get; private set; }
    public int AlternativeMeals { get; private set; }
    public int SkippedMeals { get; private set; }
    public int WaterGlasses { get; private set; }
    public bool WaterGoalHit { get; private set; }
    public int KitchenEvents { get; private set; }
    public bool MeasurementLogged { get; private set; }
    public bool CareMessageSent { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public Client Client { get; private set; } = null!;

    private ClientGamificationSnapshot() { }

    public ClientGamificationSnapshot(Guid clientId, DateOnly date)
    {
        ClientId = clientId;
        Date = date;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(
        string primaryTrack,
        decimal primaryScore,
        decimal adherenceScore,
        decimal engagementScore,
        bool qualifiedForStreak,
        int currentStreak,
        int bestStreak,
        int plannedMeals,
        int doneMeals,
        int alternativeMeals,
        int skippedMeals,
        int waterGlasses,
        bool waterGoalHit,
        int kitchenEvents,
        bool measurementLogged,
        bool careMessageSent)
    {
        PrimaryTrack = string.IsNullOrWhiteSpace(primaryTrack) ? "daily_rhythm" : primaryTrack.Trim();
        PrimaryScore = primaryScore;
        AdherenceScore = adherenceScore;
        EngagementScore = engagementScore;
        QualifiedForStreak = qualifiedForStreak;
        CurrentStreak = currentStreak;
        BestStreak = bestStreak;
        PlannedMeals = plannedMeals;
        DoneMeals = doneMeals;
        AlternativeMeals = alternativeMeals;
        SkippedMeals = skippedMeals;
        WaterGlasses = waterGlasses;
        WaterGoalHit = waterGoalHit;
        KitchenEvents = kitchenEvents;
        MeasurementLogged = measurementLogged;
        CareMessageSent = careMessageSent;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
