namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal interface IRecipeImportParser
{
    bool CanHandle(string fileType);

    Task<RecipeImportParseResult> ParseAsync(
        RecipeImportParserContext context,
        CancellationToken cancellationToken = default);
}

internal sealed class RecipeImportParserContext
{
    public required string OriginalFileName { get; init; }
    public required string FileType { get; init; }
    public required byte[] FileBytes { get; init; }
    public required string Mode { get; init; }
    public Dictionary<string, string> TemplateHeaderHints { get; init; } = new(StringComparer.OrdinalIgnoreCase);
}
