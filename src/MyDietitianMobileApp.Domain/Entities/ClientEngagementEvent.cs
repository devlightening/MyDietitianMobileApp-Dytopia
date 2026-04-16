using System.Text.Json;

namespace MyDietitianMobileApp.Domain.Entities;

public class ClientEngagementEvent
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid? DietitianId { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public DateOnly EventDate { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }
    public string? MetaJson { get; private set; }

    public Client Client { get; private set; } = null!;
    public Dietitian? Dietitian { get; private set; }

    private ClientEngagementEvent() { }

    public ClientEngagementEvent(
        Guid clientId,
        Guid? dietitianId,
        string eventType,
        DateTime occurredAtUtc,
        object? metadata = null)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        DietitianId = dietitianId;
        EventType = string.IsNullOrWhiteSpace(eventType) ? "unknown" : eventType.Trim();
        OccurredAtUtc = occurredAtUtc;
        EventDate = DateOnly.FromDateTime(occurredAtUtc);
        MetaJson = metadata == null ? null : JsonSerializer.Serialize(metadata);
    }
}
