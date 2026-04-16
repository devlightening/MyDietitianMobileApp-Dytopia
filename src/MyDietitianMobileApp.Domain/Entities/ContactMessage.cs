namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Stores contact form submissions from the landing page.
/// </summary>
public class ContactMessage
{
    public Guid Id { get; private set; }

    /// <summary>Full name of the sender (max 150 chars).</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>Sender e-mail address (max 255 chars).</summary>
    public string Email { get; private set; } = string.Empty;

    /// <summary>Optional phone number (max 30 chars).</summary>
    public string? Phone { get; private set; }

    /// <summary>Message subject (max 200 chars).</summary>
    public string Subject { get; private set; } = string.Empty;

    /// <summary>Message body (max 4000 chars).</summary>
    public string Message { get; private set; } = string.Empty;

    /// <summary>UTC timestamp of submission.</summary>
    public DateTime CreatedAt { get; private set; }

    /// <summary>Whether the owner has opened and read this message.</summary>
    public bool IsRead { get; private set; }

    // Required by EF Core
    private ContactMessage() { }

    public ContactMessage(string name, string email, string? phone, string subject, string message)
    {
        Id        = Guid.NewGuid();
        Name      = name.Trim();
        Email     = email.Trim().ToLowerInvariant();
        Phone     = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        Subject   = subject.Trim();
        Message   = message.Trim();
        CreatedAt = DateTime.UtcNow;
        IsRead    = false;
    }

    public void MarkAsRead() => IsRead = true;
}
