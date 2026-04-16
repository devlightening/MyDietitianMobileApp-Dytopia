using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Domain.Entities;

public class ImportTemplate
{
    public Guid Id { get; private set; }
    public Guid DietitianId { get; private set; }
    public string TemplateKey { get; private set; } = string.Empty;
    public string DisplayName { get; private set; } = string.Empty;
    public ImportDocumentKind DocumentKind { get; private set; }
    public string ParserUsed { get; private set; } = string.Empty;
    public string? HeaderHintsJson { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }
    public DateTime LastUsedAtUtc { get; private set; }

    private ImportTemplate() { }

    public ImportTemplate(
        Guid id,
        Guid dietitianId,
        string templateKey,
        string displayName,
        ImportDocumentKind documentKind,
        string parserUsed,
        string? headerHintsJson)
    {
        Id = id;
        DietitianId = dietitianId;
        TemplateKey = templateKey.Trim();
        DisplayName = string.IsNullOrWhiteSpace(displayName) ? "İçe aktarma şablonu" : displayName.Trim();
        DocumentKind = documentKind;
        ParserUsed = parserUsed.Trim();
        HeaderHintsJson = string.IsNullOrWhiteSpace(headerHintsJson) ? null : headerHintsJson;
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
        LastUsedAtUtc = DateTime.UtcNow;
    }

    public void UpdateHints(string? headerHintsJson, string? displayName = null)
    {
        HeaderHintsJson = string.IsNullOrWhiteSpace(headerHintsJson) ? null : headerHintsJson;
        if (!string.IsNullOrWhiteSpace(displayName))
            DisplayName = displayName.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkUsed()
    {
        LastUsedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
