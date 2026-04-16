using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services.Import;

internal sealed class RecipeImportIngredientMatcher
{
    private const double FuzzyThreshold = 0.72;
    private const double AmbiguousDelta = 0.04;
    private readonly AppDbContext _db;

    public RecipeImportIngredientMatcher(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ImportIngredientMatchResult> MatchAsync(string rawName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawName))
        {
            return ImportIngredientMatchResult.Unresolved(
                code: "INGREDIENT_UNRESOLVED",
                message: "Malzeme adı boş olduğu için eşleştirme yapılamadı.",
                hint: "Ham satırı inceleyip malzeme adını girin.");
        }

        var normalized = rawName.Trim();
        var folded = ImportNormalizer.FoldText(rawName);

        var ingredients = await _db.Ingredients
            .AsNoTracking()
            .Where(ingredient => ingredient.IsActive)
            .Select(ingredient => new IngredientCandidate(
                ingredient.Id,
                ingredient.CanonicalName,
                ingredient.Aliases == null ? null : ingredient.Aliases.ToString()))
            .ToListAsync(cancellationToken);

        foreach (var ingredient in ingredients)
        {
            if (string.Equals(ingredient.CanonicalName, normalized, StringComparison.OrdinalIgnoreCase))
            {
                return ImportIngredientMatchResult.Matched(
                    ingredient.Id,
                    ingredient.CanonicalName,
                    ImportIngredientMatchType.Exact,
                    1.0);
            }
        }

        foreach (var ingredient in ingredients)
        {
            if (ingredient.Aliases.Count == 0)
                continue;

            if (ingredient.Aliases.Any(alias => string.Equals(alias, normalized, StringComparison.OrdinalIgnoreCase)))
            {
                return ImportIngredientMatchResult.Matched(
                    ingredient.Id,
                    ingredient.CanonicalName,
                    ImportIngredientMatchType.Alias,
                    0.95);
            }
        }

        foreach (var ingredient in ingredients)
        {
            if (ImportNormalizer.FoldText(ingredient.CanonicalName) == folded ||
                ingredient.Aliases.Any(alias => ImportNormalizer.FoldText(alias) == folded))
            {
                return ImportIngredientMatchResult.Matched(
                    ingredient.Id,
                    ingredient.CanonicalName,
                    ImportIngredientMatchType.Normalized,
                    0.9);
            }
        }

        var ranked = ingredients
            .Select(ingredient => new
            {
                ingredient.Id,
                ingredient.CanonicalName,
                Score = JaroWinkler(folded, ImportNormalizer.FoldText(ingredient.CanonicalName))
            })
            .OrderByDescending(item => item.Score)
            .Take(3)
            .ToList();

        var best = ranked.FirstOrDefault();
        if (best == null || best.Score < FuzzyThreshold)
        {
            return ImportIngredientMatchResult.Unresolved(
                code: "INGREDIENT_UNRESOLVED",
                message: $"'{rawName}' malzemesi sözlükte bulunamadı.",
                hint: "Manuel eşleştirme yapabilir veya malzeme sözlüğünü genişletebilirsiniz.");
        }

        var second = ranked.Skip(1).FirstOrDefault();
        if (second != null && best.Score - second.Score < AmbiguousDelta)
        {
            return ImportIngredientMatchResult.Ambiguous(
                best.Score,
                ranked.Select(item => item.CanonicalName).ToList(),
                $"'{rawName}' için birden fazla benzer malzeme bulundu.",
                "Doğru malzemeyi manuel seçin.");
        }

        return ImportIngredientMatchResult.Matched(
            best.Id,
            best.CanonicalName,
            ImportIngredientMatchType.Fuzzy,
            best.Score);
    }

    private sealed record IngredientCandidate(Guid Id, string CanonicalName, string? RawAliases)
    {
        public IReadOnlyList<string> Aliases =>
            string.IsNullOrWhiteSpace(RawAliases)
                ? Array.Empty<string>()
                : System.Text.Json.JsonSerializer.Deserialize<List<string>>(RawAliases) ?? new List<string>();
    }

    private static double JaroWinkler(string left, string right)
    {
        if (left == right)
            return 1.0;

        var leftLength = left.Length;
        var rightLength = right.Length;
        if (leftLength == 0 || rightLength == 0)
            return 0;

        var matchDistance = Math.Max(Math.Max(leftLength, rightLength) / 2 - 1, 0);
        var leftMatched = new bool[leftLength];
        var rightMatched = new bool[rightLength];
        var matches = 0;
        var transpositions = 0;

        for (var i = 0; i < leftLength; i++)
        {
            var start = Math.Max(0, i - matchDistance);
            var end = Math.Min(i + matchDistance + 1, rightLength);
            for (var j = start; j < end; j++)
            {
                if (rightMatched[j] || left[i] != right[j])
                    continue;

                leftMatched[i] = true;
                rightMatched[j] = true;
                matches++;
                break;
            }
        }

        if (matches == 0)
            return 0;

        var position = 0;
        for (var i = 0; i < leftLength; i++)
        {
            if (!leftMatched[i])
                continue;

            while (!rightMatched[position])
                position++;

            if (left[i] != right[position])
                transpositions++;

            position++;
        }

        var jaro = ((double)matches / leftLength +
                    (double)matches / rightLength +
                    (matches - transpositions / 2.0) / matches) / 3.0;

        var prefix = 0;
        for (var i = 0; i < Math.Min(4, Math.Min(leftLength, rightLength)); i++)
        {
            if (left[i] != right[i])
                break;

            prefix++;
        }

        return jaro + prefix * 0.1 * (1 - jaro);
    }
}

internal sealed class ImportIngredientMatchResult
{
    public Guid? IngredientId { get; private init; }
    public string? CanonicalName { get; private init; }
    public ImportIngredientMatchType MatchType { get; private init; }
    public double Confidence { get; private init; }
    public bool IsResolved => IngredientId.HasValue && MatchType != ImportIngredientMatchType.Ambiguous;
    public List<string> CandidateNames { get; private init; } = new();
    public string? IssueCode { get; private init; }
    public string? IssueMessage { get; private init; }
    public string? Hint { get; private init; }

    public static ImportIngredientMatchResult Matched(
        Guid ingredientId,
        string canonicalName,
        ImportIngredientMatchType matchType,
        double confidence) =>
        new()
        {
            IngredientId = ingredientId,
            CanonicalName = canonicalName,
            MatchType = matchType,
            Confidence = confidence
        };

    public static ImportIngredientMatchResult Ambiguous(
        double confidence,
        List<string> candidates,
        string message,
        string hint) =>
        new()
        {
            MatchType = ImportIngredientMatchType.Ambiguous,
            Confidence = confidence,
            CandidateNames = candidates,
            IssueCode = "AMBIGUOUS_INGREDIENT_MATCH",
            IssueMessage = message,
            Hint = hint
        };

    public static ImportIngredientMatchResult Unresolved(
        string code,
        string message,
        string hint) =>
        new()
        {
            MatchType = ImportIngredientMatchType.None,
            Confidence = 0,
            IssueCode = code,
            IssueMessage = message,
            Hint = hint
        };
}
