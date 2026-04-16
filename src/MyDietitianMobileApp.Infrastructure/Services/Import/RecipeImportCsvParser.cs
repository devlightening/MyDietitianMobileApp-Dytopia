using MyDietitianMobileApp.Domain.Enums;
using System.Text;

namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal sealed class RecipeImportCsvParser : IRecipeImportParser
{
    public bool CanHandle(string fileType) => string.Equals(fileType, "csv", StringComparison.OrdinalIgnoreCase);

    public Task<RecipeImportParseResult> ParseAsync(
        RecipeImportParserContext context,
        CancellationToken cancellationToken = default)
    {
        using var stream = new MemoryStream(context.FileBytes);
        using var reader = new StreamReader(stream, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var rows = ParseCsvRows(reader.ReadToEnd());

        if (rows.Count == 0)
        {
            return Task.FromResult(new RecipeImportParseResult
            {
                DocumentKind = ImportDocumentKind.StructuredTable,
                ParserUsed = nameof(RecipeImportCsvParser),
                ConfidenceScore = 0.1m,
                BoundaryMode = "csv:empty",
                Warnings = new List<string> { "Dosya boş görünüyor." },
                Issues = new List<ParsedImportIssueCandidate>
                {
                    new()
                    {
                        Severity = ImportIssueSeverity.Warning,
                        Code = "HEADER_UNMAPPED",
                        Message = "CSV dosyasında okunabilir başlık satırı bulunamadı.",
                        Hint = "İlk 10 satır içinde tarif adı ve malzeme başlıklarını içeren bir satır kullanın."
                    }
                }
            });
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
                ParserUsed = nameof(RecipeImportCsvParser),
                ConfidenceScore = 0.22m,
                BoundaryMode = "csv:no-header",
                TemplateKey = ImportNormalizer.BuildTemplateKey("csv", rows.Take(5).SelectMany(row => row)),
                Issues = new List<ParsedImportIssueCandidate>
                {
                    new()
                    {
                        Severity = ImportIssueSeverity.Warning,
                        Code = "HEADER_UNMAPPED",
                        Message = "CSV başlıkları mevcut şablonla eşleşmedi.",
                        Hint = "Tarif adı ve malzeme sütunlarını ilk 10 satır içinde belirtin veya serbest belge modunu deneyin."
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
            ParserUsed = nameof(RecipeImportCsvParser),
            ConfidenceScore = Math.Clamp(confidence + 0.08m, 0.35m, 0.98m),
            BoundaryMode = RecipeImportTabularSupport.BuildBoundaryMode("csv", headerRowIndex, columnMap),
            TemplateKey = ImportNormalizer.BuildTemplateKey("csv", columnMap.Values),
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

    private static List<IReadOnlyList<string>> ParseCsvRows(string content)
    {
        var rows = new List<IReadOnlyList<string>>();
        var currentRow = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < content.Length; i++)
        {
            var ch = content[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < content.Length && content[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }

                continue;
            }

            if (ch == ',' && !inQuotes)
            {
                currentRow.Add(current.ToString());
                current.Clear();
                continue;
            }

            if ((ch == '\r' || ch == '\n') && !inQuotes)
            {
                currentRow.Add(current.ToString());
                current.Clear();

                if (currentRow.Any(field => !string.IsNullOrWhiteSpace(field)))
                    rows.Add(currentRow);

                currentRow = new List<string>();

                if (ch == '\r' && i + 1 < content.Length && content[i + 1] == '\n')
                    i++;

                continue;
            }

            current.Append(ch);
        }

        if (current.Length > 0 || currentRow.Count > 0)
        {
            currentRow.Add(current.ToString());
            if (currentRow.Any(field => !string.IsNullOrWhiteSpace(field)))
                rows.Add(currentRow);
        }

        return rows;
    }
}
