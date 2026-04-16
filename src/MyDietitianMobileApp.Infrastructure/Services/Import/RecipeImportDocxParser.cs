using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal sealed class RecipeImportDocxParser : IRecipeImportParser
{
    public bool CanHandle(string fileType) => string.Equals(fileType, "docx", StringComparison.OrdinalIgnoreCase);

    public Task<RecipeImportParseResult> ParseAsync(
        RecipeImportParserContext context,
        CancellationToken cancellationToken = default)
    {
        using var stream = new MemoryStream(context.FileBytes);
        using var document = WordprocessingDocument.Open(stream, false);
        var body = document.MainDocumentPart?.Document?.Body;
        if (body == null)
        {
            return Task.FromResult(new RecipeImportParseResult
            {
                DocumentKind = ImportDocumentKind.Unsupported,
                ParserUsed = nameof(RecipeImportDocxParser),
                ConfidenceScore = 0.1m,
                BoundaryMode = "docx:invalid",
                Issues = new List<ParsedImportIssueCandidate>
                {
                    new()
                    {
                        Severity = ImportIssueSeverity.Warning,
                        Code = "NO_RECIPE_BOUNDARY_FOUND",
                        Message = "DOCX dosyası açıldı ancak içerik okunamadı.",
                        Hint = "Tablo ya da başlıklı metin blokları içeren bir Word dosyası kullanın."
                    }
                }
            });
        }

        var recipes = new List<ParsedRecipeCandidate>();
        var issues = new List<ParsedImportIssueCandidate>();
        var warnings = new List<string>();
        var headings = new List<string>();

        string? currentHeading = null;
        foreach (var element in body.ChildElements)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (element is Paragraph paragraph)
            {
                var heading = TryExtractHeading(paragraph);
                if (heading != null)
                {
                    currentHeading = heading;
                    headings.Add(heading);
                }
            }

            if (element is not Table table)
                continue;

            var parsedFromTable = ParseTable(table, currentHeading, context.TemplateHeaderHints);
            if (parsedFromTable.Count > 0)
                recipes.AddRange(parsedFromTable);
        }

        var paragraphLines = body.ChildElements
            .OfType<Paragraph>()
            .Select(GetParagraphText)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();

        var (freeformRecipes, freeformIssues, freeformConfidence, boundaryMode) =
            RecipeImportTextRecipeExtractor.ParseLines(paragraphLines, "docx");

        foreach (var recipe in freeformRecipes)
        {
            if (recipes.Any(existing => string.Equals(existing.Title, recipe.Title, StringComparison.OrdinalIgnoreCase)))
                continue;
            recipes.Add(recipe);
        }

        issues.AddRange(freeformIssues);
        if (recipes.Count == 0)
        {
            issues.Add(new ParsedImportIssueCandidate
            {
                Severity = ImportIssueSeverity.Warning,
                Code = "NO_RECIPE_BOUNDARY_FOUND",
                Message = "Belgedeki tablo veya metin bloklarından tarif çıkarılamadı.",
                Hint = "Her tarif için başlık, malzemeler ve yapılış adımlarını ayrı bloklarda kullanın."
            });
        }

        if (recipes.Count > 0 && headings.Count == 0)
            warnings.Add("Başlık stili bulunamadı; içerik paragraf yapısından çözümlendi.");

        var documentKind = recipes.Any(recipe => recipe.Ingredients.Count > 0 && recipe.Steps.Count > 0)
            ? ImportDocumentKind.SemiStructuredDoc
            : ImportDocumentKind.StructuredTable;

        var confidence = recipes.Count == 0
            ? freeformConfidence
            : Math.Clamp(0.42m + (recipes.Any(recipe => recipe.Steps.Count > 0) ? 0.16m : 0m) + (recipes.Any(recipe => recipe.Ingredients.Count > 0) ? 0.2m : 0m), 0.32m, 0.9m);

        return Task.FromResult(new RecipeImportParseResult
        {
            DocumentKind = documentKind,
            ParserUsed = nameof(RecipeImportDocxParser),
            ConfidenceScore = confidence,
            BoundaryMode = recipes.Any(recipe => recipe.Steps.Count > 0) ? boundaryMode : "docx:table",
            TemplateKey = ImportNormalizer.BuildTemplateKey("docx", headings.Count > 0 ? headings : paragraphLines.Take(10)),
            Warnings = warnings,
            Issues = issues,
            Recipes = recipes
                .OrderBy(recipe => recipe.DisplayOrder)
                .Select((recipe, index) =>
                {
                    recipe.DisplayOrder = index;
                    return recipe;
                })
                .ToList()
        });
    }

    private static List<ParsedRecipeCandidate> ParseTable(
        Table table,
        string? currentHeading,
        IReadOnlyDictionary<string, string> templateHints)
    {
        var rows = table.Elements<TableRow>()
            .Select(row => row.Elements<TableCell>()
                .Select(cell => string.Concat(cell.Descendants<Text>().Select(text => text.Text)))
                .ToList())
            .Where(row => row.Count > 0)
            .ToList();

        if (rows.Count < 2)
            return new List<ParsedRecipeCandidate>();

        var (headerRowIndex, columnMap, _) = RecipeImportTabularSupport.DetectHeaderRow(rows, ImportNormalizer.HeaderAliases, templateHints, 5);
        if (headerRowIndex < 0 || !columnMap.ContainsValue("ingredient"))
            return new List<ParsedRecipeCandidate>();

        var map = new Dictionary<string, ParsedRecipeCandidate>(StringComparer.OrdinalIgnoreCase);
        var order = new List<string>();
        var ingredientOrder = 0;

        for (var rowIndex = headerRowIndex + 1; rowIndex < rows.Count; rowIndex++)
        {
            var row = rows[rowIndex];
            var title = RecipeImportTabularSupport.GetValue(row, columnMap, "title");
            if (string.IsNullOrWhiteSpace(title))
                title = currentHeading ?? string.Empty;

            if (string.IsNullOrWhiteSpace(title))
                continue;

            if (!map.TryGetValue(title, out var recipe))
            {
                recipe = new ParsedRecipeCandidate
                {
                    Title = title.Trim(),
                    Description = RecipeImportTabularSupport.GetValue(row, columnMap, "description").NullIfEmpty(),
                    IsPublic = IsPublic(RecipeImportTabularSupport.GetValue(row, columnMap, "visibility")),
                    DisplayOrder = map.Count,
                    Tags = ImportNormalizer.ParseTags(RecipeImportTabularSupport.GetValue(row, columnMap, "tags")),
                    Steps = ImportNormalizer.ParseSteps(RecipeImportTabularSupport.GetValue(row, columnMap, "steps")),
                    PrepTimeText = RecipeImportTabularSupport.GetValue(row, columnMap, "prepTime").NullIfEmpty(),
                    CookTimeText = RecipeImportTabularSupport.GetValue(row, columnMap, "cookTime").NullIfEmpty(),
                    ServingsText = RecipeImportTabularSupport.GetValue(row, columnMap, "servings").NullIfEmpty()
                };
                map[title] = recipe;
                order.Add(title);
            }

            var ingredientName = RecipeImportTabularSupport.GetValue(row, columnMap, "ingredient");
            if (string.IsNullOrWhiteSpace(ingredientName))
                continue;

            var amountRaw = RecipeImportTabularSupport.GetValue(row, columnMap, "amount").NullIfEmpty();
            recipe.Ingredients.Add(new ParsedIngredientCandidate
            {
                RawName = ingredientName.Trim(),
                RawLineText = string.Join(" | ", row),
                AmountRaw = amountRaw,
                AmountValue = ImportNormalizer.ParseAmount(amountRaw),
                UnitNormalized = ImportNormalizer.NormalizeUnit(RecipeImportTabularSupport.GetValue(row, columnMap, "unit")),
                Role = ImportNormalizer.NormalizeRole(RecipeImportTabularSupport.GetValue(row, columnMap, "role")),
                DisplayOrder = ingredientOrder++,
                ParseConfidence = 0.93m
            });
        }

        return order.Select(title => map[title]).ToList();
    }

    private static string? TryExtractHeading(Paragraph paragraph)
    {
        var styleId = paragraph.ParagraphProperties?.ParagraphStyleId?.Val?.Value ?? string.Empty;
        var isHeading =
            styleId.StartsWith("Heading", StringComparison.OrdinalIgnoreCase) ||
            styleId.StartsWith("Balk", StringComparison.OrdinalIgnoreCase) ||
            styleId is "1" or "2" or "3";

        if (!isHeading)
            return null;

        var text = GetParagraphText(paragraph);
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }

    private static string GetParagraphText(Paragraph paragraph)
    {
        return string.Concat(paragraph.Descendants<Text>().Select(text => text.Text)).Trim();
    }

    private static bool IsPublic(string visibility)
    {
        var folded = ImportNormalizer.FoldText(visibility);
        return folded is "public" or "genel" or "herkese_acik";
    }
}
