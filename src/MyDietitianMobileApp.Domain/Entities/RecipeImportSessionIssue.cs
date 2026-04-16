using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

public class RecipeImportSessionIssue
{
    public Guid Id { get; private set; }
    public Guid SessionId { get; private set; }
    public Guid? SessionRecipeId { get; private set; }
    public Guid? SessionIngredientId { get; private set; }
    public ImportIssueSeverity Severity { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public string? Hint { get; private set; }
    public bool IsResolved { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    private RecipeImportSessionIssue() { }

    public RecipeImportSessionIssue(Guid id, Guid sessionId,
        Guid? sessionRecipeId, Guid? sessionIngredientId,
        ImportIssueSeverity severity, string code, string message, string? hint = null)
    {
        Id = id;
        SessionId = sessionId;
        SessionRecipeId = sessionRecipeId;
        SessionIngredientId = sessionIngredientId;
        Severity = severity;
        Code = code;
        Message = message;
        Hint = string.IsNullOrWhiteSpace(hint) ? null : hint.Trim();
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void Resolve() => IsResolved = true;
}
