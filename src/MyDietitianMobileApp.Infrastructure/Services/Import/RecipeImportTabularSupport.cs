namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal static class RecipeImportTabularSupport
{
    public static (int HeaderRowIndex, Dictionary<int, string> ColumnMap, decimal Confidence) DetectHeaderRow(
        IReadOnlyList<IReadOnlyList<string>> rows,
        IReadOnlyDictionary<string, string> baseAliases,
        IReadOnlyDictionary<string, string>? templateHints = null,
        int maxRowsToInspect = 10)
    {
        var mergedAliases = new Dictionary<string, string>(baseAliases, StringComparer.OrdinalIgnoreCase);
        if (templateHints != null)
        {
            foreach (var hint in templateHints)
                mergedAliases[ImportNormalizer.NormalizeHeader(hint.Key)] = hint.Value;
        }

        var bestRow = -1;
        var bestScore = -1;
        Dictionary<int, string> bestMap = new();

        for (var rowIndex = 0; rowIndex < Math.Min(rows.Count, maxRowsToInspect); rowIndex++)
        {
            var row = rows[rowIndex];
            var map = new Dictionary<int, string>();
            var score = 0;

            for (var colIndex = 0; colIndex < row.Count; colIndex++)
            {
                var normalized = ImportNormalizer.NormalizeHeader(row[colIndex]);
                if (string.IsNullOrWhiteSpace(normalized))
                    continue;

                if (mergedAliases.TryGetValue(normalized, out var canonical))
                {
                    map[colIndex] = canonical;
                    score += canonical switch
                    {
                        "title" or "ingredient" => 4,
                        _ => 2
                    };
                }
            }

            if (!map.ContainsValue("title") && !map.ContainsValue("ingredient"))
                continue;

            if (score > bestScore)
            {
                bestRow = rowIndex;
                bestScore = score;
                bestMap = map;
            }
        }

        if (bestRow < 0)
            return (-1, new Dictionary<int, string>(), 0.1m);

        var confidence = Math.Clamp(bestScore / 12m, 0.25m, 0.98m);
        return (bestRow, bestMap, confidence);
    }

    public static string GetValue(IReadOnlyList<string> row, IReadOnlyDictionary<int, string> columnMap, string key)
    {
        foreach (var column in columnMap)
        {
            if (!string.Equals(column.Value, key, StringComparison.OrdinalIgnoreCase))
                continue;

            return column.Key < row.Count ? row[column.Key].Trim() : string.Empty;
        }

        return string.Empty;
    }

    public static string BuildBoundaryMode(string fileType, int headerRowIndex, IReadOnlyDictionary<int, string> columnMap)
    {
        var headers = string.Join(",", columnMap.OrderBy(item => item.Key).Select(item => item.Value));
        return $"{fileType}:header:{headerRowIndex + 1}:{headers}";
    }
}
