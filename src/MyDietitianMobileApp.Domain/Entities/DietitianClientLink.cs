namespace MyDietitianMobileApp.Domain.Entities;

public class DietitianClientLink
{
    public Guid Id { get; private set; }
    
    public Guid DietitianId { get; private set; }
    public Guid ClientId { get; private set; }
    
    /// <summary>
    /// Public identifier for the client (MD-XXXX-XXXX-XX format)
    /// Used for UI display and API responses - NEVER expose GUID
    /// </summary>
    public string PublicUserId { get; private set; } = string.Empty;
    
    public DateTime LinkedAt { get; private set; }
    public DateTime? UnlinkedAt { get; private set; }

    /// <summary>
    /// Backwards-compatible alias for <see cref="LinkedAt"/> to satisfy older usages.
    /// Not mapped as a separate column by EF Core (getter-only).
    /// </summary>
    public DateTime LinkCreatedAtUtc => LinkedAt;
    
    public bool IsActive { get; private set; }

    // Navigation properties
    public Client Client { get; set; } = null!;

    private DietitianClientLink() { } // EF Core

    public DietitianClientLink(
        Guid dietitianId,
        Guid clientId,
        string publicUserId)
    {
        Id = Guid.NewGuid();
        DietitianId = dietitianId;
        ClientId = clientId;
        PublicUserId = publicUserId;
        LinkedAt = DateTime.UtcNow;
        IsActive = true;
    }

    public void SetPublicUserIdIfEmpty(string publicUserId)
    {
        if (!string.IsNullOrEmpty(PublicUserId))
            throw new InvalidOperationException("PublicUserId is already set for this link");
        PublicUserId = publicUserId;
    }

    public void Deactivate()
    {
        if (!IsActive)
            throw new InvalidOperationException("Link is already inactive");
            
        IsActive = false;
        UnlinkedAt = DateTime.UtcNow;
    }

    public void Reactivate()
    {
        if (IsActive)
            throw new InvalidOperationException("Link is already active");
            
        IsActive = true;
        UnlinkedAt = null;
    }
}
