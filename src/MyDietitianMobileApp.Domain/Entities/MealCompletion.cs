namespace MyDietitianMobileApp.Domain.Entities;

public enum MealCompletionStatus
{
    Done = 1,
    Skipped = 2
}

public class MealCompletion
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid DietitianId { get; private set; }
    public Guid DietPlanMealId { get; private set; }
    public MealCompletionStatus Status { get; private set; }
    public DateTime AtUtc { get; private set; }
    public string? Note { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;
    public Dietitian Dietitian { get; private set; } = null!;

    private MealCompletion() { } // EF Core

    public MealCompletion(Guid clientId, Guid dietitianId, Guid dietPlanMealId, MealCompletionStatus status, string? note = null)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        DietitianId = dietitianId;
        DietPlanMealId = dietPlanMealId;
        Status = status;
        AtUtc = DateTime.UtcNow;
        Note = note?.Trim();
    }

    public void Update(MealCompletionStatus status, string? note)
    {
        Status = status;
        Note = note?.Trim();
        AtUtc = DateTime.UtcNow;
    }
}
