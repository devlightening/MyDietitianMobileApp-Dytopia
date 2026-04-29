namespace MyDietitianMobileApp.Domain.Entities;

public class ClientCareMessage
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid? DietitianId { get; private set; }
    public string SenderRole { get; private set; } = "Client";
    public string Text { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ReadAtUtc { get; private set; }
    public Guid? ReplyToId { get; private set; }
    public string? ReplyToSnippet { get; private set; }

    public Client Client { get; private set; } = null!;
    public Dietitian? Dietitian { get; private set; }

    private ClientCareMessage() { }

    public ClientCareMessage(Guid clientId, Guid? dietitianId, string senderRole, string text,
        Guid? replyToId = null, string? replyToSnippet = null)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        DietitianId = dietitianId;
        SenderRole = string.IsNullOrWhiteSpace(senderRole) ? "Client" : senderRole.Trim();
        Text = string.IsNullOrWhiteSpace(text) ? string.Empty : text.Trim();
        CreatedAtUtc = DateTime.UtcNow;
        ReplyToId = replyToId;
        ReplyToSnippet = string.IsNullOrWhiteSpace(replyToSnippet) ? null
            : (replyToSnippet.Length > 100 ? replyToSnippet[..100] + "…" : replyToSnippet);
    }

    public void MarkRead()
    {
        ReadAtUtc = DateTime.UtcNow;
    }
}
