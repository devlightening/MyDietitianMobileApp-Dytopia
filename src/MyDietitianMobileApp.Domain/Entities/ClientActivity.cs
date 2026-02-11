using System.Text.Json;

namespace MyDietitianMobileApp.Domain.Entities;

public class ClientActivity
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid? DietitianId { get; private set; }
    public string Type { get; private set; }
    public DateTime AtUtc { get; private set; }
    public string? MetaJson { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;
    public Dietitian? Dietitian { get; private set; }

    private ClientActivity() { } // EF Core

    public ClientActivity(Guid clientId, Guid? dietitianId, string type, object? metadata = null)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        DietitianId = dietitianId;
        Type = type;
        AtUtc = DateTime.UtcNow;
        MetaJson = metadata != null ? JsonSerializer.Serialize(metadata) : null;
    }
}
