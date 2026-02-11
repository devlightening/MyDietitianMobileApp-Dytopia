namespace MyDietitianMobileApp.Domain.Entities;

public class ClientDailyTracking
{
    public Guid ClientId { get; private set; }
    public DateOnly Date { get; private set; }
    public int WaterGlasses { get; private set; }
    public int Steps { get; private set; }
    public string? Notes { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;

    private ClientDailyTracking() { } // EF Core

    public ClientDailyTracking(Guid clientId, DateOnly date)
    {
        ClientId = clientId;
        Date = date;
        WaterGlasses = 0;
        Steps = 0;
        Notes = null;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(int waterGlasses, int steps, string? notes)
    {
        WaterGlasses = waterGlasses;
        Steps = steps;
        Notes = notes?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
