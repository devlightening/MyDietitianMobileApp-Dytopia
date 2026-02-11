namespace MyDietitianMobileApp.Domain.Entities;

public class DietitianNote
{
    public Guid Id { get; private set; }
    public Guid DietitianId { get; private set; }
    public Guid ClientId { get; private set; }
    public string Text { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    // Navigation
    public Dietitian Dietitian { get; private set; } = null!;
    public Client Client { get; private set; } = null!;

    private DietitianNote() { } // EF Core

    public DietitianNote(Guid dietitianId, Guid clientId, string text)
    {
        Id = Guid.NewGuid();
        DietitianId = dietitianId;
        ClientId = clientId;
        Text = text.Trim();
        CreatedAtUtc = DateTime.UtcNow;
    }
}
