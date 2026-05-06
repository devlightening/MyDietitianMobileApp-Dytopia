namespace MyDietitianMobileApp.Domain.Entities;

public class ClientAnnouncement
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid DietitianId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public DateTime StartsAt { get; private set; }
    public DateTime EndsAt { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public bool IsActive => DateTime.UtcNow >= StartsAt && DateTime.UtcNow <= EndsAt;

    public Client Client { get; private set; } = null!;
    public Dietitian Dietitian { get; private set; } = null!;

    private ClientAnnouncement() { }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    public ClientAnnouncement(Guid clientId, Guid dietitianId, string title, string body, DateTime startsAt, DateTime endsAt)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        DietitianId = dietitianId;
        Title = title.Trim();
        Body = body.Trim();
        StartsAt = NormalizeUtc(startsAt);
        EndsAt = NormalizeUtc(endsAt);
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(string title, string body, DateTime startsAt, DateTime endsAt)
    {
        Title = title.Trim();
        Body = body.Trim();
        StartsAt = NormalizeUtc(startsAt);
        EndsAt = NormalizeUtc(endsAt);
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
