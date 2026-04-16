using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Builds the bounded candidate shortlist that is passed to <see cref="IIngredientLlmClient"/>.
///
/// The shortlist strategy (in order applied):
///   1. Near-miss fuzzy candidates:
///      Score each active ingredient against the raw input with <see cref="FuzzyIngredientMatcher"/>.
///      Include any ingredient whose best token score ≥ <see cref="LlmNormalizationOptions.MinFuzzyScoreForShortlist"/>.
///      These are the most likely true positives that deterministic layers narrowly missed.
///
///   2. Token-overlap candidates:
///      If the near-miss list is small, add any ingredient whose CanonicalName or any alias
///      shares at least one token (≥3 chars) with the normalized input.
///      Broadens coverage for multi-word or compound inputs.
///
///   3. Dedup by ID + cap at <see cref="LlmNormalizationOptions.MaxCandidates"/>.
///
/// Returns an empty list if nothing qualifies → LLM will not be called.
/// </summary>
public sealed class IngredientLlmCandidateBuilder
{
    private readonly AppDbContext _db;
    private readonly LlmNormalizationOptions _options;

    public IngredientLlmCandidateBuilder(AppDbContext db, LlmNormalizationOptions options)
    {
        _db = db;
        _options = options;
    }

    public async Task<IReadOnlyList<LlmCandidateIngredient>> BuildAsync(
        string normalizedInput,
        CancellationToken cancellationToken = default)
    {
        // Load all active ingredients (with family info) — this is cached by EF context
        var allIngredients = await _db.Ingredients
            .Where(i => i.IsActive)
            .ToListAsync(cancellationToken);

        // Optionally load family memberships for additional context
        var familyMemberships = await _db.IngredientFamilyMembers
            .Include(m => m.Family)
            .ToListAsync(cancellationToken);

        var familyByIngredientId = familyMemberships
            .GroupBy(m => m.IngredientId)
            .ToDictionary(g => g.Key, g => g.First().Family?.Name);

        // ── Pass 1: Near-miss scoring (below fuzzy MinThreshold but above our lower floor) ─────
        // We use a simple Similarity (Levenshtein) score against canonical name and aliases.
        // This intentionally uses a lower threshold than FuzzyIngredientMatcher.MinThreshold (0.72)
        // to cast a wider net for the LLM to reason over.
        var foldedInput = FuzzyIngredientMatcher.TurkishFold(normalizedInput);

        var scored = allIngredients
            .Select(i =>
            {
                var foldedCanonical = FuzzyIngredientMatcher.TurkishFold(i.CanonicalName);
                double bestScore = FuzzyIngredientMatcher.Similarity(foldedInput, foldedCanonical);

                // Check aliases too — take the highest score seen
                foreach (var alias in i.Aliases)
                {
                    var foldedAlias = FuzzyIngredientMatcher.TurkishFold(alias);
                    var aliasScore = FuzzyIngredientMatcher.Similarity(foldedInput, foldedAlias);
                    if (aliasScore > bestScore) bestScore = aliasScore;
                }

                return new { Ingredient = i, Score = bestScore };
            })
            .Where(x => x.Score >= _options.MinFuzzyScoreForShortlist)
            .OrderByDescending(x => x.Score)
            .Take(_options.MaxCandidates)
            .ToList();

        var seen = new HashSet<Guid>();
        var candidates = new List<LlmCandidateIngredient>();

        foreach (var s in scored)
        {
            if (!seen.Add(s.Ingredient.Id)) continue;
            candidates.Add(ToCandidateDto(s.Ingredient, familyByIngredientId));
        }

        // ── Pass 2: Token overlap (broaden if shortlist is still small) ───────
        if (candidates.Count < _options.MaxCandidates)
        {
            var inputTokens = FuzzyIngredientMatcher.Tokenize(normalizedInput)
                .Where(t => t.Length >= 3)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (inputTokens.Count > 0)
            {
                foreach (var ing in allIngredients)
                {
                    if (seen.Contains(ing.Id)) continue;
                    if (candidates.Count >= _options.MaxCandidates) break;

                    var nameTokens = FuzzyIngredientMatcher.Tokenize(ing.CanonicalName);
                    var aliasTokens = ing.Aliases.SelectMany(a => FuzzyIngredientMatcher.Tokenize(a));
                    var allTokens = nameTokens.Concat(aliasTokens);

                    if (allTokens.Any(t => inputTokens.Contains(t)))
                    {
                        seen.Add(ing.Id);
                        candidates.Add(ToCandidateDto(ing, familyByIngredientId));
                    }
                }
            }
        }

        return candidates.Take(_options.MaxCandidates).ToList();
    }

    private static LlmCandidateIngredient ToCandidateDto(
        MyDietitianMobileApp.Domain.Entities.Ingredient ing,
        Dictionary<Guid, string?> familyMap)
        => new()
        {
            IngredientId = ing.Id,
            CanonicalName = ing.CanonicalName,
            Aliases = ing.Aliases,
            FamilyName = familyMap.TryGetValue(ing.Id, out var f) ? f : null
        };
}
