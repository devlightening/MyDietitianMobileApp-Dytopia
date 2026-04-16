using System.Text.RegularExpressions;

namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal static class RecipeImportTextRecipeExtractor
{
    private static readonly string[] IngredientSectionLabels =
    {
        "malzemeler",
        "malzemeler:",
        "ingredients",
        "ingredients:"
    };

    private static readonly string[] StepSectionLabels =
    {
        "hazırlanışı",
        "hazırlanışı:",
        "hazirlanisi",
        "hazirlanisi:",
        "yapılışı",
        "yapılışı:",
        "yapilisi",
        "yapilisi:",
        "instructions",
        "instructions:"
    };

    private static readonly string[] MetadataLabels =
    {
        "aciklama",
        "açıklama",
        "description",
        "hazirlik",
        "hazırlık",
        "prep time",
        "pisirme",
        "pişirme",
        "cook time",
        "porsiyon",
        "servings",
        "etiket",
        "tags"
    };

    public static (List<ParsedRecipeCandidate> Recipes, List<ParsedImportIssueCandidate> Issues, decimal Confidence, string BoundaryMode)
        ParseLines(IEnumerable<string> lines, string parserName)
    {
        var normalizedLines = lines
            .Select(line => line?.Trim() ?? string.Empty)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();

        var issues = new List<ParsedImportIssueCandidate>();
        if (normalizedLines.Count == 0)
        {
            issues.Add(new ParsedImportIssueCandidate
            {
                Severity = MyDietitianMobileApp.Domain.Enums.ImportIssueSeverity.Warning,
                Code = "NO_RECIPE_BOUNDARY_FOUND",
                Message = "Belgede tarif çıkarımı için yeterli metin bulunamadı.",
                Hint = "Başlık, malzeme ve yapılış adımlarını içeren metin içeren bir belge yükleyin."
            });
            return (new List<ParsedRecipeCandidate>(), issues, 0.15m, $"{parserName}:empty");
        }

        var recipes = new List<ParsedRecipeCandidate>();
        ParsedRecipeCandidate? currentRecipe = null;
        var section = "description";
        var recipeIndex = 0;
        var ingredientOrder = 0;

        void FlushRecipe()
        {
            if (currentRecipe == null)
                return;

            if (!string.IsNullOrWhiteSpace(currentRecipe.Title) &&
                (currentRecipe.Ingredients.Count > 0 || currentRecipe.Steps.Count > 0 || !string.IsNullOrWhiteSpace(currentRecipe.Description)))
            {
                currentRecipe.DisplayOrder = recipes.Count;
                recipes.Add(currentRecipe);
            }

            currentRecipe = null;
            section = "description";
        }

        for (var i = 0; i < normalizedLines.Count; i++)
        {
            var line = normalizedLines[i];
            var folded = ImportNormalizer.FoldText(line.TrimEnd(':'));

            if (IsLikelyRecipeTitle(line, normalizedLines, i))
            {
                FlushRecipe();
                currentRecipe = new ParsedRecipeCandidate
                {
                    Title = line.Trim(),
                    RawSourceBlock = line.Trim()
                };
                recipeIndex++;
                continue;
            }

            if (currentRecipe == null)
                continue;

            currentRecipe.RawSourceBlock = string.Join(Environment.NewLine, new[]
            {
                currentRecipe.RawSourceBlock,
                line
            }.Where(part => !string.IsNullOrWhiteSpace(part)));

            if (IngredientSectionLabels.Contains(folded, StringComparer.OrdinalIgnoreCase))
            {
                section = "ingredients";
                continue;
            }

            if (StepSectionLabels.Contains(folded, StringComparer.OrdinalIgnoreCase))
            {
                section = "steps";
                continue;
            }

            if (folded.StartsWith("aciklama") || folded.StartsWith("açıklama") || folded.StartsWith("description"))
            {
                var description = ExtractValueAfterLabel(line);
                currentRecipe.Description = string.Join(" ", new[] { currentRecipe.Description, description }.Where(part => !string.IsNullOrWhiteSpace(part)));
                section = "description";
                continue;
            }

            if (TryParseMetadataLine(line, currentRecipe))
                continue;

            if (section == "ingredients")
            {
                var ingredient = ParseIngredientLine(line, ingredientOrder++);
                currentRecipe.Ingredients.Add(ingredient);
                continue;
            }

            if (section == "steps")
            {
                currentRecipe.Steps.Add(CleanBullet(line));
                continue;
            }

            if (LooksLikeIngredientLine(line))
            {
                currentRecipe.Ingredients.Add(ParseIngredientLine(line, ingredientOrder++));
                section = "ingredients";
                continue;
            }

            currentRecipe.Description = string.Join(" ", new[] { currentRecipe.Description, CleanBullet(line) }.Where(part => !string.IsNullOrWhiteSpace(part)));
        }

        FlushRecipe();

        if (recipes.Count == 0)
        {
            issues.Add(new ParsedImportIssueCandidate
            {
                Severity = MyDietitianMobileApp.Domain.Enums.ImportIssueSeverity.Warning,
                Code = "NO_RECIPE_BOUNDARY_FOUND",
                Message = "Belgedeki metin bloklarından tarif sınırları çıkarılamadı.",
                Hint = "Her tarif için başlık, malzemeler ve yapılış adımlarını ayrı bloklarda tutan bir belge tercih edin."
            });
        }

        var confidence = recipes.Count == 0
            ? 0.2m
            : Math.Clamp(0.45m + (recipes.Count > 0 ? 0.2m : 0m) + (recipes.Sum(item => item.Ingredients.Count) > 0 ? 0.15m : 0m), 0.35m, 0.88m);

        return (recipes, issues, confidence, $"{parserName}:freeform");
    }

    private static bool IsLikelyRecipeTitle(string line, IReadOnlyList<string> lines, int index)
    {
        if (string.IsNullOrWhiteSpace(line))
            return false;

        var cleaned = line.Trim().Trim(':');
        var folded = ImportNormalizer.FoldText(cleaned);
        if (cleaned.Length < 3 || cleaned.Length > 80)
            return false;

        if (IsReservedSectionOrMetadataLabel(folded))
            return false;

        if (cleaned.Contains(':'))
            return false;

        if (cleaned.Contains('.') || cleaned.Contains(','))
            return false;

        var nextWindow = lines.Skip(index + 1).Take(4).Select(ImportNormalizer.FoldText).ToList();
        if (nextWindow.Any(IsIngredientSectionLabel))
            return true;

        return Regex.IsMatch(cleaned, @"^[\p{L}\d\s\-\(\)]+$") &&
               char.IsUpper(cleaned[0]);
    }

    private static bool IsIngredientSectionLabel(string candidate)
    {
        var normalized = NormalizeLabel(candidate);
        return IngredientSectionLabels
            .Select(NormalizeLabel)
            .Contains(normalized, StringComparer.OrdinalIgnoreCase);
    }

    private static bool IsReservedSectionOrMetadataLabel(string candidate)
    {
        var normalized = NormalizeLabel(candidate);
        return IngredientSectionLabels
            .Concat(StepSectionLabels)
            .Concat(MetadataLabels)
            .Select(NormalizeLabel)
            .Any(label =>
                string.Equals(normalized, label, StringComparison.OrdinalIgnoreCase) ||
                normalized.StartsWith(label + ":", StringComparison.OrdinalIgnoreCase) ||
                normalized.StartsWith(label + " ", StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizeLabel(string value)
    {
        return ImportNormalizer.FoldText(value.Trim().TrimEnd(':'));
    }

    private static bool LooksLikeIngredientLine(string line)
    {
        var cleaned = CleanBullet(line);
        return Regex.IsMatch(cleaned, @"^(\d+[.,]?\d*|\d+/\d+|yarım|ceyrek|çeyrek)\s+", RegexOptions.IgnoreCase) ||
               cleaned.Contains("adet ", StringComparison.OrdinalIgnoreCase) ||
               cleaned.Contains("gram ", StringComparison.OrdinalIgnoreCase);
    }

    private static ParsedIngredientCandidate ParseIngredientLine(string line, int displayOrder)
    {
        var cleaned = CleanBullet(line);
        ImportNormalizer.TrySplitAmountAndUnit(cleaned, out var amountRaw, out var amountValue, out var unit);

        var rawName = cleaned;
        if (!string.IsNullOrWhiteSpace(amountRaw))
            rawName = cleaned[(amountRaw!.Length)..].Trim();
        if (!string.IsNullOrWhiteSpace(unit) && rawName.StartsWith(unit, StringComparison.OrdinalIgnoreCase))
            rawName = rawName[unit.Length..].Trim();

        return new ParsedIngredientCandidate
        {
            RawName = rawName.Trim(',', ';', ' '),
            RawLineText = line,
            AmountRaw = amountRaw,
            AmountValue = amountValue,
            UnitNormalized = unit,
            Role = "Mandatory",
            DisplayOrder = displayOrder,
            ParseConfidence = amountValue.HasValue || !string.IsNullOrWhiteSpace(unit) ? 0.82m : 0.64m,
            NeedsReview = string.IsNullOrWhiteSpace(rawName),
            IssueCodes = string.IsNullOrWhiteSpace(rawName)
                ? new List<string> { "INGREDIENT_UNRESOLVED" }
                : new List<string>()
        };
    }

    private static bool TryParseMetadataLine(string line, ParsedRecipeCandidate recipe)
    {
        var folded = ImportNormalizer.FoldText(line);
        if (folded.StartsWith("hazirlik"))
        {
            recipe.PrepTimeText = ExtractValueAfterLabel(line);
            return true;
        }

        if (folded.StartsWith("pisirme") || folded.StartsWith("pişirme") || folded.StartsWith("cook time"))
        {
            recipe.CookTimeText = ExtractValueAfterLabel(line);
            return true;
        }

        if (folded.StartsWith("porsiyon") || folded.StartsWith("servings"))
        {
            recipe.ServingsText = ExtractValueAfterLabel(line);
            return true;
        }

        if (folded.StartsWith("etiket") || folded.StartsWith("tags"))
        {
            recipe.Tags = ImportNormalizer.ParseTags(ExtractValueAfterLabel(line));
            return true;
        }

        return false;
    }

    private static string CleanBullet(string line)
    {
        return Regex.Replace(line.Trim(), @"^(\d+[\.\)]\s*|[-*•]\s*)", string.Empty).Trim();
    }

    private static string ExtractValueAfterLabel(string line)
    {
        var idx = line.IndexOf(':');
        return idx >= 0 ? line[(idx + 1)..].Trim() : line.Trim();
    }
}
