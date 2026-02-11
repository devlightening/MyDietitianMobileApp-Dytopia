namespace MyDietitianMobileApp.Domain.Entities;

public class PremiumAuditLog
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid? DietitianId { get; private set; }
    public string Action { get; private set; } = string.Empty; // Activated / Revoke / Expired / KeyGenerated
    public DateTime AtUtc { get; private set; }
    public string? MetaJson { get; private set; }

    // EF
    private PremiumAuditLog() { }

    public PremiumAuditLog(Guid id, Guid clientId, Guid? dietitianId, string action, DateTime atUtc, string? metaJson)
    {
        Id = id;
        ClientId = clientId;
        DietitianId = dietitianId;
        Action = action;
        AtUtc = DateTime.SpecifyKind(atUtc, DateTimeKind.Utc);
        MetaJson = metaJson;
    }
}

