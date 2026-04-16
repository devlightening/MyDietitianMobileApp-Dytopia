using ClosedXML.Excel;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal sealed class RecipeImportExcelParser : IRecipeImportParser
{
    public bool CanHandle(string fileType) => string.Equals(fileType, "xlsx", StringComparison.OrdinalIgnoreCase);

    public Task<RecipeImportParseResult> ParseAsync(
        RecipeImportParserContext context,
        CancellationToken cancellationToken = default)
    {
        using var stream = new MemoryStream(context.FileBytes);
        using var workbook = new XLWorkbook(stream);
        var worksheet = workbook.Worksheets.FirstOrDefault();

        if (worksheet == null)
        {
            return Task.FromResult(new RecipeImportParseResult
            {
                DocumentKind = ImportDocumentKind.StructuredTable,
                ParserUsed = nameof(RecipeImportExcelParser),
                ConfidenceScore = 0.1m,
                BoundaryMode = "xlsx:empty",
                Issues = new List<ParsedImportIssueCandidate>
                {
                    new()
                    {
                        Severity = ImportIssueSeverity.Warning,
                        Code = "HEADER_UNMAPPED",
                        Message = "Excel dosyasında okunabilir çalışma sayfası bulunamadı.",
                        Hint = "İlk sayfada tarif başlıklarını ve malzemeleri içeren tablo kullanın."
                    }
                }
            });
        }

        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 0;
        var lastColumn = worksheet.LastColumnUsed()?.ColumnNumber() ?? 0;
        var rows = new List<IReadOnlyList<string>>();

        for (var rowIndex = 1; rowIndex <= lastRow; rowIndex++)
        {
            var cells = new List<string>();
            for (var columnIndex = 1; columnIndex <= lastColumn; columnIndex++)
                cells.Add(worksheet.Cell(rowIndex, columnIndex).GetString());
            rows.Add(cells);
        }

        var (headerRowIndex, columnMap, confidence) = RecipeImportTabularSupport.DetectHeaderRow(
            rows,
            ImportNormalizer.HeaderAliases,
            context.TemplateHeaderHints);

        if (headerRowIndex < 0 || !columnMap.ContainsValue("title") || !columnMap.ContainsValue("ingredient"))
        {
            return Task.FromResult(new RecipeImportParseResult
            {
                DocumentKind = ImportDocumentKind.StructuredTable,
                ParserUsed = nameof(RecipeImportExcelParser),
                ConfidenceScore = 0.22m,
                BoundaryMode = "xlsx:no-header",
                TemplateKey = ImportNormalizer.BuildTemplateKey("xlsx", rows.Take(5).SelectMany(row => row)),
                Issues = new List<ParsedImportIssueCandidate>
                {
                    new()
                    {
                        Severity = ImportIssueSeverity.Warning,
                        Code = "HEADER_UNMAPPED",
                        Message = "Excel sütun başlıkları eşleştirilemedi.",
                        Hint = "Tarif adı ve malzeme sütunlarını ilk 10 satır içinde görünür tutun."
                    }
                }
            });
        }

        var recipeMap = new Dictionary<string, ParsedRecipeCandidate>(StringComparer.OrdinalIgnoreCase);
        var order = new List<string>();
        var ingredientOrder = 0;

        for (var rowIndex = headerRowIndex + 1; rowIndex < rows.Count; rowIndex++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var row = rows[rowIndex];
            var title = RecipeImportTabularSupport.GetValue(row, columnMap, "title");
            if (string.IsNullOrWhiteSpace(title))
                continue;

            if (!recipeMap.TryGetValue(title, out var recipe))
            {
                recipe = new ParsedRecipeCandidate
                {
                    Title = title.Trim(),
                    Description = RecipeImportTabularSupport.GetValue(row, columnMap, "description").NullIfEmpty(),
                    IsPublic = IsPublic(RecipeImportTabularSupport.GetValue(row, columnMap, "visibility")),
                    DisplayOrder = recipeMap.Count,
                    Tags = ImportNormalizer.ParseTags(RecipeImportTabularSupport.GetValue(row, columnMap, "tags")),
                    Steps = ImportNormalizer.ParseSteps(RecipeImportTabularSupport.GetValue(row, columnMap, "steps")),
                    PrepTimeText = RecipeImportTabularSupport.GetValue(row, columnMap, "prepTime").NullIfEmpty(),
                    CookTimeText = RecipeImportTabularSupport.GetValue(row, columnMap, "cookTime").NullIfEmpty(),
                    ServingsText = RecipeImportTabularSupport.GetValue(row, columnMap, "servings").NullIfEmpty()
                };
                recipeMap[title] = recipe;
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
                ParseConfidence = 0.96m
            });
        }

        var warnings = new List<string>();
        if (headerRowIndex > 0)
            warnings.Add($"Başlık satırı {headerRowIndex + 1}. satırda bulundu.");

        return Task.FromResult(new RecipeImportParseResult
        {
            DocumentKind = ImportDocumentKind.StructuredTable,
            ParserUsed = nameof(RecipeImportExcelParser),
            ConfidenceScore = Math.Clamp(confidence + 0.08m, 0.35m, 0.98m),
            BoundaryMode = RecipeImportTabularSupport.BuildBoundaryMode("xlsx", headerRowIndex, columnMap),
            TemplateKey = ImportNormalizer.BuildTemplateKey("xlsx", columnMap.Values),
            TemplateHeaderHints = BuildHeaderHints(rows[headerRowIndex], columnMap),
            Warnings = warnings,
            Recipes = order.Select(title => recipeMap[title]).ToList()
        });
    }

    private static Dictionary<string, string> BuildHeaderHints(IReadOnlyList<string> headerRow, IReadOnlyDictionary<int, string> columnMap)
    {
        return columnMap.ToDictionary(
            item => headerRow[item.Key],
            item => item.Value,
            StringComparer.OrdinalIgnoreCase);
    }

    private static bool IsPublic(string visibility)
    {
        var folded = ImportNormalizer.FoldText(visibility);
        return folded is "public" or "genel" or "herkese_acik";
    }
}
