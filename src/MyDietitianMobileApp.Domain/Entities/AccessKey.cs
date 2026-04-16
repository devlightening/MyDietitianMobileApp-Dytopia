namespace MyDietitianMobileApp.Domain.Entities;

public class AccessKey
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid DietitianId { get; private set; }
    public string KeyValue { get; private set; } // GUID-based key (internal)
    public string? Code { get; private set; } // 6-8 digit user-facing code (external)
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public bool IsActive { get; private set; }

    // EF Core constructor
    private AccessKey() { }

    public AccessKey(
        Guid id,
        string keyValue,
        Guid dietitianId,
        Guid clientId,
        DateTime createdAtUtc,
        DateTime expiresAtUtc,
        bool isActive = true,
        string? code = null)
    {
        Id = id;
        KeyValue = keyValue;
        Code = code;
        DietitianId = dietitianId;
        ClientId = clientId;
        CreatedAtUtc = createdAtUtc;
        ExpiresAtUtc = expiresAtUtc;
        IsActive = isActive;
    }

    public bool IsValid(DateTime now)
    {
        return IsActive && now >= CreatedAtUtc && now <= ExpiresAtUtc;
    }

    public void Deactivate() => IsActive = false;

    public void MarkAsActivated()
    {
        // Mark key as used/activated
        Deactivate();
    }

    public void Extend(DateTime newExpiresAtUtc)
    {
        if (newExpiresAtUtc <= ExpiresAtUtc)
            throw new ArgumentException("New expiration date must be after current expiration date", nameof(newExpiresAtUtc));
        
        ExpiresAtUtc = newExpiresAtUtc;
    }

    public void SetCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Code cannot be null or empty", nameof(code));
        
        Code = code;
    }

    public override bool Equals(object obj)
    {
        if (obj is not AccessKey other) return false;
        return Id == other.Id;
    }
    
    public override int GetHashCode() => Id.GetHashCode();
}
