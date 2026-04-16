using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal sealed class ParsedRecipeCandidate
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public int DisplayOrder { get; set; }
    public string? RawSourceBlock { get; set; }
    public List<string> Steps { get; set; } = new();
    public List<string> Tags { get; set; } = new();
    public string? PrepTimeText { get; set; }
    public string? CookTimeText { get; set; }
    public string? ServingsText { get; set; }
    public bool NeedsReview { get; set; }
    public List<ParsedIngredientCandidate> Ingredients { get; set; } = new();
}

internal sealed class ParsedIngredientCandidate
{
    public string RawName { get; set; } = string.Empty;
    public string? RawLineText { get; set; }
    public string? AmountRaw { get; set; }
    public decimal? AmountValue { get; set; }
    public string? UnitNormalized { get; set; }
    public string Role { get; set; } = "Mandatory";
    public int DisplayOrder { get; set; }
    public decimal ParseConfidence { get; set; } = 1.0m;
    public bool NeedsReview { get; set; }
    public List<string> IssueCodes { get; set; } = new();
}

internal sealed class ParsedImportIssueCandidate
{
    public ImportIssueSeverity Severity { get; init; } = ImportIssueSeverity.Warning;
    public string Code { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? Hint { get; init; }
    public int? RecipeDisplayOrder { get; init; }
    public int? IngredientDisplayOrder { get; init; }
}

internal sealed class RecipeImportParseResult
{
    public ImportDocumentKind DocumentKind { get; init; } = ImportDocumentKind.Unsupported;
    public string ParserUsed { get; init; } = string.Empty;
    public decimal ConfidenceScore { get; init; }
    public string? BoundaryMode { get; init; }
    public string? TemplateKey { get; init; }
    public Dictionary<string, string> TemplateHeaderHints { get; init; } = new(StringComparer.OrdinalIgnoreCase);
    public List<string> Warnings { get; init; } = new();
    public List<ParsedImportIssueCandidate> Issues { get; init; } = new();
    public List<ParsedRecipeCandidate> Recipes { get; init; } = new();
}

internal static class ImportNormalizer
{
    public static readonly IReadOnlyDictionary<string, string> HeaderAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["recipe_title"] = "title",
            ["title"] = "title",
            ["name"] = "title",
            ["tarif_adi"] = "title",
            ["tarif"] = "title",
            ["tarif adı"] = "title",
            ["başlık"] = "title",
            ["baslik"] = "title",
            ["recipe_description"] = "description",
            ["description"] = "description",
            ["aciklama"] = "description",
            ["açıklama"] = "description",
            ["not"] = "description",
            ["ingredient_name"] = "ingredient",
            ["ingredient"] = "ingredient",
            ["malzeme"] = "ingredient",
            ["malzeme_adi"] = "ingredient",
            ["malzeme adı"] = "ingredient",
            ["ürün"] = "ingredient",
            ["urun"] = "ingredient",
            ["içerik"] = "ingredient",
            ["icerik"] = "ingredient",
            ["amount"] = "amount",
            ["miktar"] = "amount",
            ["quantity"] = "amount",
            ["portion"] = "amount",
            ["unit"] = "unit",
            ["birim"] = "unit",
            ["ölçü"] = "unit",
            ["olcu"] = "unit",
            ["ölçü birimi"] = "unit",
            ["role"] = "role",
            ["rol"] = "role",
            ["kategori"] = "role",
            ["visibility"] = "visibility",
            ["görünürlük"] = "visibility",
            ["gorunurluk"] = "visibility",
            ["tags"] = "tags",
            ["etiket"] = "tags",
            ["etiketler"] = "tags",
            ["steps"] = "steps",
            ["instructions"] = "steps",
            ["hazırlanış"] = "steps",
            ["hazirlanis"] = "steps",
            ["yapılış"] = "steps",
            ["yapilis"] = "steps",
            ["prep_time"] = "prepTime",
            ["hazırlık_süresi"] = "prepTime",
            ["hazirlik suresi"] = "prepTime",
            ["cook_time"] = "cookTime",
            ["pişirme_süresi"] = "cookTime",
            ["pisirme suresi"] = "cookTime",
            ["servings"] = "servings",
            ["porsiyon"] = "servings"
        };

    private static readonly Dictionary<string, string> RoleAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["mandatory"] = "Mandatory",
        ["zorunlu"] = "Mandatory",
        ["gerekli"] = "Mandatory",
        ["optional"] = "Optional",
        ["opsiyonel"] = "Optional",
        ["isteğe bağlı"] = "Optional",
        ["istege bagli"] = "Optional",
        ["substitute"] = "Substitute",
        ["alternatif"] = "Substitute",
        ["ikame"] = "Substitute",
        ["prohibited"] = "Prohibited",
        ["yasak"] = "Prohibited",
        ["yasaklı"] = "Prohibited",
        ["yasakli"] = "Prohibited"
    };

    private static readonly Dictionary<string, string> UnitAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["gr"] = "g",
        ["g"] = "g",
        ["gram"] = "g",
        ["grams"] = "g",
        ["kg"] = "kg",
        ["kilogram"] = "kg",
        ["ml"] = "ml",
        ["mililitre"] = "ml",
        ["lt"] = "L",
        ["l"] = "L",
        ["litre"] = "L",
        ["liter"] = "L",
        ["adet"] = "adet",
        ["ad"] = "adet",
        ["pcs"] = "adet",
        ["piece"] = "adet",
        ["tbsp"] = "yemek kaşığı",
        ["yemek kaşığı"] = "yemek kaşığı",
        ["yemek kasigi"] = "yemek kaşığı",
        ["yk"] = "yemek kaşığı",
        ["tsp"] = "tatlı kaşığı",
        ["tatlı kaşığı"] = "tatlı kaşığı",
        ["tatli kasigi"] = "tatlı kaşığı",
        ["tk"] = "tatlı kaşığı",
        ["cup"] = "su bardağı",
        ["bardak"] = "su bardağı",
        ["su bardağı"] = "su bardağı",
        ["su bardagi"] = "su bardağı",
        ["dilim"] = "dilim",
        ["demet"] = "demet",
        ["paket"] = "paket",
        ["kutu"] = "kutu",
        ["diş"] = "diş",
        ["dis"] = "diş",
        ["tutam"] = "tutam"
    };

    public static string NormalizeHeader(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return string.Empty;

        return FoldText(raw)
            .Replace("-", "_")
            .Replace(" ", "_");
    }

    public static string NormalizeRole(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return "Mandatory";

        var normalized = FoldText(raw);
        return RoleAliases.TryGetValue(normalized, out var role)
            ? role
            : "Mandatory";
    }

    public static string? NormalizeUnit(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var normalized = FoldText(raw);
        return UnitAliases.TryGetValue(normalized, out var unit)
            ? unit
            : raw.Trim();
    }

    public static decimal? ParseAmount(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var text = raw.Trim().Replace(",", ".", StringComparison.Ordinal);
        if (TryExtractNumber(text, out var numeric))
            return numeric;

        var lowered = FoldText(text);
        return lowered switch
        {
            "yarim" => 0.5m,
            "ceyrek" => 0.25m,
            "ucte_bir" => 0.3333m,
            "bir" => 1m,
            "iki" => 2m,
            "uc" => 3m,
            _ => null
        };
    }

    public static bool TrySplitAmountAndUnit(string rawLine, out string? amountRaw, out decimal? amountValue, out string? unit)
    {
        amountRaw = null;
        amountValue = null;
        unit = null;

        if (string.IsNullOrWhiteSpace(rawLine))
            return false;

        var match = Regex.Match(rawLine.Trim(), @"^(?<amount>(\d+[.,]?\d*|\d+/\d+|yarım|ceyrek|çeyrek))\s*(?<unit>[\p{L}\.]+)?", RegexOptions.IgnoreCase);
        if (!match.Success)
            return false;

        amountRaw = match.Groups["amount"].Value.NullIfEmpty();
        amountValue = ParseAmount(amountRaw);
        unit = NormalizeUnit(match.Groups["unit"].Value.NullIfEmpty());
        return amountRaw != null;
    }

    public static List<string> ParseSteps(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return new();

        return raw
            .Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
            .Select(line => Regex.Replace(line.Trim(), @"^(\d+[\.\)]\s*|[-*]\s*)", string.Empty))
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();
    }

    public static List<string> ParseTags(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return new();

        return raw
            .Split(new[] { ",", ";", "\n" }, StringSplitOptions.RemoveEmptyEntries)
            .Select(tag => tag.Trim())
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static string FoldText(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        return input.Trim()
            .ToLowerInvariant()
            .Replace('ş', 's')
            .Replace('ğ', 'g')
            .Replace('ı', 'i')
            .Replace('ü', 'u')
            .Replace('ö', 'o')
            .Replace('ç', 'c')
            .Replace('İ', 'i')
            .Replace('Ş', 's')
            .Replace('Ğ', 'g')
            .Replace('Ü', 'u')
            .Replace('Ö', 'o')
            .Replace('Ç', 'c');
    }

    public static string? NullIfEmpty(this string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    public static string BuildTemplateKey(string fileType, IEnumerable<string> tokens)
    {
        var normalized = string.Join("|", tokens
            .Select(FoldText)
            .Where(token => !string.IsNullOrWhiteSpace(token))
            .Take(20));

        return $"{fileType}:{normalized}";
    }

    public static string SerializeWarnings(IEnumerable<string> warnings)
    {
        var items = warnings
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return items.Count == 0 ? string.Empty : JsonSerializer.Serialize(items);
    }

    private static bool TryExtractNumber(string value, out decimal parsed)
    {
        parsed = 0;

        if (value.Contains('/'))
        {
            var parts = value.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 2 &&
                decimal.TryParse(parts[0], NumberStyles.Any, CultureInfo.InvariantCulture, out var numerator) &&
                decimal.TryParse(parts[1], NumberStyles.Any, CultureInfo.InvariantCulture, out var denominator) &&
                denominator != 0)
            {
                parsed = numerator / denominator;
                return true;
            }
        }

        return decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out parsed);
    }
}
