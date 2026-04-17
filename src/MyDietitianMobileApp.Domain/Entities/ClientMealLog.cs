namespace MyDietitianMobileApp.Domain.Entities;

public class ClientMealLog
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public DateOnly Date { get; private set; }
    public string MealType { get; private set; } = null!;
    public string? Notes { get; private set; }
    public string? PhotoUrl { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;

    private ClientMealLog() { } // EF Core

    public ClientMealLog(Guid clientId, DateOnly date, string mealType, string? notes, string? photoUrl)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        Date = date;
        MealType = mealType.Trim();
        Notes = notes?.Trim();
        PhotoUrl = photoUrl?.Trim();
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(string? notes, string? photoUrl)
    {
        Notes = notes?.Trim();
        PhotoUrl = photoUrl?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
