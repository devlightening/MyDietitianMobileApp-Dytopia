using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Conservative, deterministic fuzzy ingredient matcher.
///
/// Algorithm:
/// 1. Turkey-fold the input (strip Turkish diacritics so "yogurt" matches "yoğurt")
/// 2. Score each active ingredient's canonical + aliases using a weighted hybrid:
///    - Best single-token Levenshtein similarity (tolerates typos inside tokens)
///    - Multi-token sequence match bonus (rewards more specific multi-word matches)
/// 3. Apply conservative safety rules:
///    - Minimum similarity threshold (0.72 overall)
///    - Stricter threshold for short words (≤ 4 chars: 0.80)
///    - Minimum margin over second-best candidate (0.04) to avoid ambiguous auto-match
///    - Short ambiguous inputs stay Ambiguous instead of being forced to a single match
/// 4. Return scored candidates ordered by score (best first).
///
/// NO external libraries, APIs, or embeddings used.
/// Fully deterministic and reproducible.
/// </summary>
public static class FuzzyIngredientMatcher
{
    /// <summary>Minimum fuzzy score to even consider a candidate (0–1).</summary>
    public const double MinThreshold = 0.72;

    /// <summary>Stricter threshold applied to short inputs (≤ ShortInputLength chars).</summary>
    public const double ShortInputThreshold = 0.80;

    /// <summary>Inputs with normalized length ≤ this are considered "short" for threshold purposes.</summary>
    public const int ShortInputLength = 4;

    /// <summary>Minimum margin between top and second candidate to auto-accept (not ambiguous).</summary>
    public const double MinMarginForAutoAccept = 0.04;

    /// <param name="normalizedInput">Already text-normalized (lowercase, trimmed) input from NormalizeText().</param>
    /// <param name="ingredients">Active ingredients to search against.</param>
    /// <returns>Candidates ordered descending by score. Empty if no candidate passes threshold.</returns>
    public static IReadOnlyList<FuzzyCandidate> Match(string normalizedInput, IEnumerable<Ingredient> ingredients)
    {
        if (string.IsNullOrWhiteSpace(normalizedInput))
            return Array.Empty<FuzzyCandidate>();

        var foldedInput = TurkishFold(normalizedInput);
        var inputTokens = Tokenize(foldedInput);
        var threshold = foldedInput.Length <= ShortInputLength ? ShortInputThreshold : MinThreshold;

        var candidates = new List<FuzzyCandidate>();

        foreach (var ingredient in ingredients)
        {
            // Score against canonical name and all aliases; take best
            double bestScore = 0;
            string? bestMatchedText = null;

            Score(foldedInput, inputTokens, TurkishFold(ingredient.CanonicalName), ref bestScore, ref bestMatchedText);

            foreach (var alias in ingredient.Aliases)
                Score(foldedInput, inputTokens, TurkishFold(alias), ref bestScore, ref bestMatchedText);

            if (bestScore >= threshold)
            {
                candidates.Add(new FuzzyCandidate
                {
                    Ingredient = ingredient,
                    Score = bestScore,
                    BestMatchedText = bestMatchedText ?? ingredient.CanonicalName
                });
            }
        }

        return candidates
            .OrderByDescending(c => c.Score)
            .ToList();
    }

    // ─── Scoring ────────────────────────────────────────────────────────────────

    public static void Score(
        string foldedInput,
        string[] inputTokens,
        string foldedTarget,
        ref double bestScore,
        ref string? bestText)
    {
        // Full-string Levenshtein similarity
        var stringSim = Similarity(foldedInput, foldedTarget);

        // Token-based: compare individual tokens and take average of best pairings
        var targetTokens = Tokenize(foldedTarget);
        double tokenSim = 0;

        if (inputTokens.Length == 0 || targetTokens.Length == 0)
        {
            tokenSim = stringSim;
        }
        else if (inputTokens.Length == 1 && targetTokens.Length == 1)
        {
            tokenSim = Similarity(inputTokens[0], targetTokens[0]);
        }
        else
        {
            // Greedy best-match pairing between input tokens and target tokens
            double totalPairSim = 0;
            foreach (var it in inputTokens)
            {
                double localBest = targetTokens.Max(tt => Similarity(it, tt));
                totalPairSim += localBest;
            }
            tokenSim = totalPairSim / inputTokens.Length;

            // Bonus for token count match (rewards specificity)
            if (inputTokens.Length == targetTokens.Length)
                tokenSim = Math.Min(1.0, tokenSim + 0.05);
        }

        // Weighted blend: full-string similarity gets higher weight for single-word inputs
        var weight = inputTokens.Length <= 1 ? 0.6 : 0.4;
        var blended = weight * stringSim + (1.0 - weight) * tokenSim;

        // ── Compound word matching ──────────────────────────────────────────────
        // Try concatenating input tokens (e.g. "zeytin yagi" → "zeytinyagi")
        // and comparing against both the concatenated input and single-token targets.
        // This handles common Turkish compound words split by users.
        double compoundScore = 0;
        if (inputTokens.Length >= 2)
        {
            var concatenated = string.Concat(inputTokens);
            compoundScore = Similarity(concatenated, foldedTarget);

            // Also try concatenating the target tokens vs input
            if (targetTokens.Length == 1 && inputTokens.Length == 2)
            {
                // e.g. input="zeytin yagi" [2 tokens], target="zeytinyagi" [1 token]
                var inputConcat = string.Concat(inputTokens);
                var targetConcat = string.Concat(targetTokens);
                compoundScore = Math.Max(compoundScore, Similarity(inputConcat, targetConcat));
            }
        }

        var finalScore = Math.Max(blended, compoundScore);

        if (finalScore > bestScore)
        {
            bestScore = finalScore;
            bestText = foldedTarget;
        }
    }

    // ─── Levenshtein similarity (0–1) ───────────────────────────────────────────

    /// <summary>
    /// Returns normalized edit-distance similarity: 1.0 = identical, 0 = completely different.
    /// Uses classic Levenshtein with Wagner-Fischer DP.
    /// </summary>
    public static double Similarity(string a, string b)
    {
        if (a == b) return 1.0;
        if (a.Length == 0 || b.Length == 0) return 0.0;

        int maxLen = Math.Max(a.Length, b.Length);
        int dist = LevenshteinDistance(a, b);
        return 1.0 - (double)dist / maxLen;
    }

    private static int LevenshteinDistance(string a, string b)
    {
        int m = a.Length, n = b.Length;
        // Use two-row rolling array for O(min(m,n)) space
        if (m < n) { (a, b) = (b, a); (m, n) = (n, m); }

        var prev = new int[n + 1];
        var curr = new int[n + 1];

        for (int j = 0; j <= n; j++) prev[j] = j;

        for (int i = 1; i <= m; i++)
        {
            curr[0] = i;
            for (int j = 1; j <= n; j++)
            {
                int cost = a[i - 1] == b[j - 1] ? 0 : 1;
                curr[j] = Math.Min(
                    Math.Min(curr[j - 1] + 1, prev[j] + 1),
                    prev[j - 1] + cost);
            }
            Array.Copy(curr, prev, n + 1);
        }
        return prev[n];
    }

    // ─── Turkish diacritics folding ──────────────────────────────────────────────

    /// <summary>
    /// Fold Turkish-specific characters to their ASCII equivalents so that
    /// "yogurt" can match "yoğurt", "sut" matches "süt", etc.
    /// Applied to both input and target before comparison.
    /// </summary>
    public static string TurkishFold(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;

        var sb = new System.Text.StringBuilder(s.Length);
        foreach (var c in s)
        {
            sb.Append(c switch
            {
                'ğ' or 'Ğ' => 'g',
                'ü' or 'Ü' => 'u',
                'ş' or 'Ş' => 's',
                'ı' or 'I' => 'i',  // Turkish dotless 'ı' and capital İ→i
                'İ' => 'i',
                'ö' or 'Ö' => 'o',
                'ç' or 'Ç' => 'c',
                _ => char.ToLowerInvariant(c)
            });
        }
        return sb.ToString();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    public static string[] Tokenize(string s)
        => s.Split(' ', StringSplitOptions.RemoveEmptyEntries);
}

/// <summary>
/// A single fuzzy match candidate with its score.
/// </summary>
public class FuzzyCandidate
{
    public Ingredient Ingredient { get; init; } = null!;
    /// <summary>Blended similarity score (0–1). Higher is better.</summary>
    public double Score { get; init; }
    /// <summary>The target text (canonical or alias, Turkey-folded) that produced this score.</summary>
    public string BestMatchedText { get; init; } = string.Empty;
}
