using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Production-safe ingredient normalization service with four-layer matching:
///
///   Layer A — Exact canonical match  (Confidence = 1.00)
///   Layer B — Exact alias match      (Confidence = 0.95)
///   Layer C — Fuzzy fallback match   (Confidence = 0.65–0.89, based on score)
///   Layer D — LLM semantic fallback  (Confidence = 0.55–0.79, LLM-reported)
///
/// Deterministic exact matching always wins. Fuzzy is the second fallback.
/// LLM is the final fallback — called only when Layers A–C all fail.
/// When LLM is disabled (NullIngredientLlmClient), behavior is identical to the three-layer version.
/// All matches are logged to IngredientNormalizationLog.
/// </summary>
public class IngredientNormalizationService : IIngredientNormalizationService
{
    private static readonly Regex WhitespaceRegex = new(@"\s+", RegexOptions.Compiled);
    private static readonly char[] TrimPunctuation = [',', '.', ';', ':', '!', '?', '"', '\'', '(', ')', '[', ']', '{', '}'];

    /// <summary>Maximum fuzzy confidence (score = 1.0 → this value). Kept below alias (0.95).</summary>
    private const double FuzzyMaxConfidence = 0.89;
    /// <summary>Minimum fuzzy confidence (score = FuzzyIngredientMatcher.MinThreshold → this value).</summary>
    private const double FuzzyMinConfidence = 0.65;

    /// <summary>Maximum LLM confidence. Kept below fuzzy max (0.89) to preserve hierarchy.</summary>
    private const double LlmMaxConfidence = 0.79;
    /// <summary>Minimum LLM confidence (for accepted matches above MinConfidenceToAccept).</summary>
    private const double LlmMinConfidence = 0.55;

    private readonly AppDbContext _db;
    private readonly IIngredientLlmClient _llmClient;
    private readonly IngredientLlmCandidateBuilder _candidateBuilder;
    private readonly LlmNormalizationOptions _llmOptions;

    public IngredientNormalizationService(
        AppDbContext db,
        IIngredientLlmClient llmClient,
        IngredientLlmCandidateBuilder candidateBuilder,
        LlmNormalizationOptions llmOptions)
    {
        _db = db;
        _llmClient = llmClient;
        _candidateBuilder = candidateBuilder;
        _llmOptions = llmOptions;
    }

    public async Task<IngredientNormalizationResult> NormalizeAsync(string rawInput, CancellationToken cancellationToken = default)
    {
        var sw = Stopwatch.StartNew();
        rawInput ??= string.Empty;
        var normalized = NormalizeText(rawInput);

        if (string.IsNullOrWhiteSpace(normalized))
        {
            sw.Stop();
            var emptyResult = new IngredientNormalizationResult
            {
                RawInput = rawInput,
                NormalizedInput = normalized,
                Status = IngredientMatchStatus.Unmatched,
                MatchedBy = IngredientMatchedBy.None,
                Confidence = 0,
                Explanation = "Empty or whitespace input."
            };
            await LogAsync(emptyResult, sw, cancellationToken);
            return emptyResult;
        }

        // Load active ingredients (cached in normalized form)
        var ingredients = await _db.Ingredients
            .AsNoTracking()
            .Where(i => i.IsActive)
            .ToListAsync(cancellationToken);

        // ── Layer A: Exact canonical match ───────────────────────────────────────
        var canonicalMatches = ingredients
            .Where(i => NormalizeText(i.CanonicalName) == normalized)
            .ToList();

        if (canonicalMatches.Count == 1)
        {
            var match = canonicalMatches[0];
            var result = new IngredientNormalizationResult
            {
                RawInput = rawInput,
                NormalizedInput = normalized,
                Status = IngredientMatchStatus.Matched,
                MatchedBy = IngredientMatchedBy.Canonical,
                Confidence = 1.0,
                MatchedIngredientId = match.Id,
                MatchedCanonicalName = match.CanonicalName,
                MatchedAliases = match.Aliases.ToArray(),
                Candidates = new[]
                {
                    new IngredientNormalizationCandidate
                    {
                        IngredientId = match.Id,
                        CanonicalName = match.CanonicalName,
                        Aliases = match.Aliases.ToArray(),
                        MatchedBy = IngredientMatchedBy.Canonical,
                        Confidence = 1.0
                    }
                },
                Explanation = "Exact canonical ingredient match."
            };
            await LogAsync(result, sw, cancellationToken);
            return result;
        }

        if (canonicalMatches.Count > 1)
        {
            if (IngredientResolutionPolicy.TryCollapseSameCanonicalIdentity(canonicalMatches, out var preferredCanonical, out var orderedCanonicalCandidates))
            {
                var collapsedResult = new IngredientNormalizationResult
                {
                    RawInput = rawInput,
                    NormalizedInput = normalized,
                    Status = IngredientMatchStatus.Matched,
                    MatchedBy = IngredientMatchedBy.Canonical,
                    Confidence = 1.0,
                    MatchedIngredientId = preferredCanonical.Id,
                    MatchedCanonicalName = preferredCanonical.CanonicalName,
                    MatchedAliases = preferredCanonical.Aliases.ToArray(),
                    Candidates = orderedCanonicalCandidates
                        .Select(i => new IngredientNormalizationCandidate
                        {
                            IngredientId = i.Id,
                            CanonicalName = i.CanonicalName,
                            Aliases = i.Aliases.ToArray(),
                            MatchedBy = IngredientMatchedBy.Canonical,
                            Confidence = 1.0
                        })
                        .ToArray(),
                    Explanation = $"Exact canonical ingredient match after collapsing {orderedCanonicalCandidates.Count} duplicate active rows for the same canonical identity."
                };
                await LogAsync(collapsedResult, sw, cancellationToken);
                return collapsedResult;
            }

            var candidates = canonicalMatches
                .Select(i => new IngredientNormalizationCandidate
                {
                    IngredientId = i.Id,
                    CanonicalName = i.CanonicalName,
                    Aliases = i.Aliases.ToArray(),
                    MatchedBy = IngredientMatchedBy.Canonical,
                    Confidence = 1.0
                })
                .ToArray();

            var result = new IngredientNormalizationResult
            {
                RawInput = rawInput,
                NormalizedInput = normalized,
                Status = IngredientMatchStatus.Ambiguous,
                MatchedBy = IngredientMatchedBy.Canonical,
                Confidence = 1.0,
                Candidates = candidates,
                Explanation = "Multiple ingredients share the same canonical name after normalization."
            };
            await LogAsync(result, sw, cancellationToken);
            return result;
        }

        // ── Layer B: Exact alias match ────────────────────────────────────────────
        var aliasMatches = new List<Ingredient>();
        foreach (var ingredient in ingredients)
        {
            if (ingredient.Aliases == null || ingredient.Aliases.Count == 0) continue;
            if (ingredient.Aliases.Any(alias => NormalizeText(alias) == normalized))
                aliasMatches.Add(ingredient);
        }

        if (aliasMatches.Count == 1)
        {
            var match = aliasMatches[0];
            var result = new IngredientNormalizationResult
            {
                RawInput = rawInput,
                NormalizedInput = normalized,
                Status = IngredientMatchStatus.Matched,
                MatchedBy = IngredientMatchedBy.Alias,
                Confidence = 0.95,
                MatchedIngredientId = match.Id,
                MatchedCanonicalName = match.CanonicalName,
                MatchedAliases = match.Aliases.ToArray(),
                Candidates = new[]
                {
                    new IngredientNormalizationCandidate
                    {
                        IngredientId = match.Id,
                        CanonicalName = match.CanonicalName,
                        Aliases = match.Aliases.ToArray(),
                        MatchedBy = IngredientMatchedBy.Alias,
                        Confidence = 0.95
                    }
                },
                Explanation = "Exact alias ingredient match."
            };
            await LogAsync(result, sw, cancellationToken);
            return result;
        }

        if (aliasMatches.Count > 1)
        {
            if (IngredientResolutionPolicy.TryCollapseSameCanonicalIdentity(aliasMatches, out var preferredAlias, out var orderedAliasCandidates))
            {
                var collapsedResult = new IngredientNormalizationResult
                {
                    RawInput = rawInput,
                    NormalizedInput = normalized,
                    Status = IngredientMatchStatus.Matched,
                    MatchedBy = IngredientMatchedBy.Alias,
                    Confidence = 0.95,
                    MatchedIngredientId = preferredAlias.Id,
                    MatchedCanonicalName = preferredAlias.CanonicalName,
                    MatchedAliases = preferredAlias.Aliases.ToArray(),
                    Candidates = orderedAliasCandidates
                        .Select(i => new IngredientNormalizationCandidate
                        {
                            IngredientId = i.Id,
                            CanonicalName = i.CanonicalName,
                            Aliases = i.Aliases.ToArray(),
                            MatchedBy = IngredientMatchedBy.Alias,
                            Confidence = 0.95
                        })
                        .ToArray(),
                    Explanation = $"Exact alias ingredient match after collapsing {orderedAliasCandidates.Count} duplicate active rows for the same canonical identity."
                };
                await LogAsync(collapsedResult, sw, cancellationToken);
                return collapsedResult;
            }

            var candidates = aliasMatches
                .Select(i => new IngredientNormalizationCandidate
                {
                    IngredientId = i.Id,
                    CanonicalName = i.CanonicalName,
                    Aliases = i.Aliases.ToArray(),
                    MatchedBy = IngredientMatchedBy.Alias,
                    Confidence = 0.95
                })
                .ToArray();

            var result = new IngredientNormalizationResult
            {
                RawInput = rawInput,
                NormalizedInput = normalized,
                Status = IngredientMatchStatus.Ambiguous,
                MatchedBy = IngredientMatchedBy.Alias,
                Confidence = 0.95,
                Candidates = candidates,
                Explanation = "Multiple ingredients share the same alias after normalization."
            };
            await LogAsync(result, sw, cancellationToken);
            return result;
        }

        // ── Layer C: Fuzzy fallback match ─────────────────────────────────────────
        var fuzzyCandidates = CollapseDuplicateFuzzyCandidates(FuzzyIngredientMatcher.Match(normalized, ingredients));

        if (fuzzyCandidates.Count >= 2)
        {
            var top = fuzzyCandidates[0];
            var second = fuzzyCandidates[1];
            var margin = top.Score - second.Score;

            if (margin >= FuzzyIngredientMatcher.MinMarginForAutoAccept)
            {
                // Clear winner above threshold
                var confidence = MapFuzzyScore(top.Score);
                var fuzzyResult = new IngredientNormalizationResult
                {
                    RawInput = rawInput,
                    NormalizedInput = normalized,
                    Status = IngredientMatchStatus.Matched,
                    MatchedBy = IngredientMatchedBy.Fuzzy,
                    Confidence = confidence,
                    MatchedIngredientId = top.Ingredient.Id,
                    MatchedCanonicalName = top.Ingredient.CanonicalName,
                    MatchedAliases = top.Ingredient.Aliases.ToArray(),
                    Candidates = fuzzyCandidates.Take(5).Select(c => new IngredientNormalizationCandidate
                    {
                        IngredientId = c.Ingredient.Id,
                        CanonicalName = c.Ingredient.CanonicalName,
                        Aliases = c.Ingredient.Aliases.ToArray(),
                        MatchedBy = IngredientMatchedBy.Fuzzy,
                        Confidence = MapFuzzyScore(c.Score)
                    }).ToArray(),
                    Explanation = $"Fuzzy match: '{top.Ingredient.CanonicalName}' (score {top.Score:F3}, margin {margin:F3} over second candidate '{second.Ingredient.CanonicalName}')."
                };
                await LogAsync(fuzzyResult, sw, cancellationToken);
                return fuzzyResult;
            }
            else
            {
                // Top candidates are too close — return as ambiguous
                var ambiguousResult = new IngredientNormalizationResult
                {
                    RawInput = rawInput,
                    NormalizedInput = normalized,
                    Status = IngredientMatchStatus.Ambiguous,
                    MatchedBy = IngredientMatchedBy.Fuzzy,
                    Confidence = MapFuzzyScore(top.Score),
                    Candidates = fuzzyCandidates.Take(5).Select(c => new IngredientNormalizationCandidate
                    {
                        IngredientId = c.Ingredient.Id,
                        CanonicalName = c.Ingredient.CanonicalName,
                        Aliases = c.Ingredient.Aliases.ToArray(),
                        MatchedBy = IngredientMatchedBy.Fuzzy,
                        Confidence = MapFuzzyScore(c.Score)
                    }).ToArray(),
                    Explanation = $"Fuzzy match is ambiguous: '{top.Ingredient.CanonicalName}' (score {top.Score:F3}) and '{second.Ingredient.CanonicalName}' (score {second.Score:F3}) are too close (margin {margin:F3} < {FuzzyIngredientMatcher.MinMarginForAutoAccept:F3})."
                };
                await LogAsync(ambiguousResult, sw, cancellationToken);
                return ambiguousResult;
            }
        }
        else if (fuzzyCandidates.Count == 1)
        {
            // Single fuzzy candidate above threshold
            var top = fuzzyCandidates[0];
            var confidence = MapFuzzyScore(top.Score);
            var fuzzyResult = new IngredientNormalizationResult
            {
                RawInput = rawInput,
                NormalizedInput = normalized,
                Status = IngredientMatchStatus.Matched,
                MatchedBy = IngredientMatchedBy.Fuzzy,
                Confidence = confidence,
                MatchedIngredientId = top.Ingredient.Id,
                MatchedCanonicalName = top.Ingredient.CanonicalName,
                MatchedAliases = top.Ingredient.Aliases.ToArray(),
                Candidates = new[]
                {
                    new IngredientNormalizationCandidate
                    {
                        IngredientId = top.Ingredient.Id,
                        CanonicalName = top.Ingredient.CanonicalName,
                        Aliases = top.Ingredient.Aliases.ToArray(),
                        MatchedBy = IngredientMatchedBy.Fuzzy,
                        Confidence = confidence
                    }
                },
                Explanation = $"Fuzzy match: '{top.Ingredient.CanonicalName}' (score {top.Score:F3}, no competing candidate)."
            };
            await LogAsync(fuzzyResult, sw, cancellationToken);
            return fuzzyResult;
        }

        // ── Layer D: LLM semantic fallback ────────────────────────────────────────
        if (_llmOptions.Enabled && normalized.Length <= _llmOptions.MaxInputLength)
        {
            var llmResult = await TryLlmMatchAsync(normalized, rawInput, sw, cancellationToken);
            if (llmResult != null)
                return llmResult;
        }

        // ── No match ──────────────────────────────────────────────────────────────
        var unmatched = new IngredientNormalizationResult
        {
            RawInput = rawInput,
            NormalizedInput = normalized,
            Status = IngredientMatchStatus.Unmatched,
            MatchedBy = IngredientMatchedBy.None,
            Confidence = 0,
            Explanation = "No match found via canonical, alias, fuzzy, or LLM layers."
        };
        await LogAsync(unmatched, sw, cancellationToken);
        return unmatched;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// Layer D: Build the shortlist, call the LLM client, and map the result to IngredientNormalizationResult.
    /// Returns null if the shortlist is empty, the LLM returns None, or any safety rule triggers.
    /// </summary>
    private async Task<IngredientNormalizationResult?> TryLlmMatchAsync(
        string normalized, string rawInput, Stopwatch sw, CancellationToken cancellationToken)
    {
        try
        {
            var candidates = await _candidateBuilder.BuildAsync(normalized, cancellationToken);
            if (candidates.Count == 0)
                return null; // Nothing to show the LLM — skip

            var llmResult = await _llmClient.MatchAsync(normalized, candidates, cancellationToken);

            if (llmResult.Category == LlmMatchCategory.None)
            {
                // LLM could not determine a safe match → proceed to unmatched
                return null;
            }

            if (llmResult.Category == LlmMatchCategory.Ambiguous
                || llmResult.Confidence < _llmOptions.MinConfidenceToAccept)
            {
                // LLM indicated ambiguity or low confidence → return Ambiguous so caller can use candidates
                var ambig = new IngredientNormalizationResult
                {
                    RawInput = rawInput,
                    NormalizedInput = normalized,
                    Status = IngredientMatchStatus.Ambiguous,
                    MatchedBy = IngredientMatchedBy.Llm,
                    Confidence = MapLlmConfidence(llmResult.Confidence),
                    Candidates = candidates.Select(c => new IngredientNormalizationCandidate
                    {
                        IngredientId = c.IngredientId,
                        CanonicalName = c.CanonicalName,
                        Aliases = c.Aliases,
                        MatchedBy = IngredientMatchedBy.Llm,
                        Confidence = MapLlmConfidence(llmResult.Confidence)
                    }).ToArray(),
                    Explanation = $"LLM fallback ambiguous or low-confidence. {llmResult.Explanation}"
                };
                await LogAsync(ambig, sw, cancellationToken);
                return ambig;
            }

            // Matched — validate candidate ID is real (hallucination guard also in the LLM client,
            // but we double-check here for defense in depth)
            var matched = candidates.FirstOrDefault(c => c.IngredientId == llmResult.MatchedCandidateId);
            if (matched is null)
                return null;

            // Look up full ingredient entity for aliases
            var ing = await _db.Ingredients
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == matched.IngredientId, cancellationToken);

            if (ing is null || !ing.IsActive)
                return null;

            var confidence = MapLlmConfidence(llmResult.Confidence);
            var result = new IngredientNormalizationResult
            {
                RawInput = rawInput,
                NormalizedInput = normalized,
                Status = IngredientMatchStatus.Matched,
                MatchedBy = IngredientMatchedBy.Llm,
                Confidence = confidence,
                MatchedIngredientId = ing.Id,
                MatchedCanonicalName = ing.CanonicalName,
                MatchedAliases = ing.Aliases.ToArray(),
                Candidates = candidates.Take(5).Select(c => new IngredientNormalizationCandidate
                {
                    IngredientId = c.IngredientId,
                    CanonicalName = c.CanonicalName,
                    Aliases = c.Aliases,
                    MatchedBy = IngredientMatchedBy.Llm,
                    Confidence = confidence
                }).ToArray(),
                Explanation = $"LLM fallback matched '{ing.CanonicalName}' (confidence {confidence:F2}). {llmResult.Explanation}"
            };
            await LogAsync(result, sw, cancellationToken);
            return result;
        }
        catch
        {
            // LLM failure must never break normalization — silently fall through
            return null;
        }
    }

    /// <summary>
    /// Maps LLM-reported confidence (0–1) to the LLM band [LlmMinConfidence, LlmMaxConfidence].
    /// Always below fuzzy max (0.89) so the precedence hierarchy is unambiguous.
    /// </summary>
    private static double MapLlmConfidence(double rawConfidence)
    {
        var mapped = LlmMinConfidence + Math.Clamp(rawConfidence, 0.0, 1.0) * (LlmMaxConfidence - LlmMinConfidence);
        return Math.Round(Math.Clamp(mapped, LlmMinConfidence, LlmMaxConfidence), 4);
    }

    /// <summary>
    /// Maps a raw fuzzy score (0–1) to the fuzzy confidence band [FuzzyMinConfidence, FuzzyMaxConfidence].
    /// Keeps fuzzy confidence clearly below alias (0.95) and above a useless threshold.
    /// </summary>
    private static double MapFuzzyScore(double score)
    {
        // Linear interpolation from [MinThreshold, 1.0] → [FuzzyMinConfidence, FuzzyMaxConfidence]
        var min = FuzzyIngredientMatcher.MinThreshold;
        var mapped = FuzzyMinConfidence + (score - min) / (1.0 - min) * (FuzzyMaxConfidence - FuzzyMinConfidence);
        return Math.Round(Math.Clamp(mapped, FuzzyMinConfidence, FuzzyMaxConfidence), 4);
    }

    private static IReadOnlyList<FuzzyCandidate> CollapseDuplicateFuzzyCandidates(IReadOnlyList<FuzzyCandidate> rawCandidates)
    {
        if (rawCandidates.Count <= 1)
        {
            return rawCandidates;
        }

        return rawCandidates
            .GroupBy(c => NormalizeText(c.Ingredient.CanonicalName), StringComparer.Ordinal)
            .Select(group =>
            {
                var bestScore = group.Max(c => c.Score);
                var bestScoreIngredients = group
                    .Where(c => c.Score == bestScore)
                    .Select(c => c.Ingredient);

                var preferredIngredient = IngredientResolutionPolicy.SelectPreferred(bestScoreIngredients);
                var preferredCandidate = group.First(c => c.Ingredient.Id == preferredIngredient.Id && c.Score == bestScore);

                return new FuzzyCandidate
                {
                    Ingredient = preferredCandidate.Ingredient,
                    Score = bestScore,
                    BestMatchedText = preferredCandidate.BestMatchedText
                };
            })
            .OrderByDescending(c => c.Score)
            .ThenBy(c => c.Ingredient.Id)
            .ToArray();
    }

    /// <summary>
    /// Deterministic text normalization: trim, lowercase (InvariantCulture, preserves Turkish),
    /// collapse whitespace, strip leading/trailing punctuation noise.
    /// No typo correction or fuzzy behavior applied here.
    /// </summary>
    internal static string NormalizeText(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var trimmed = input.Trim().Trim(TrimPunctuation);
        if (trimmed.Length == 0) return string.Empty;

        var collapsed = WhitespaceRegex.Replace(trimmed, " ");
        return collapsed.ToLowerInvariant();
    }

    private async Task LogAsync(
        IngredientNormalizationResult result,
        Stopwatch sw,
        CancellationToken cancellationToken)
    {
        try
        {
            var elapsedMs          = sw.ElapsedMilliseconds;
            var candidateCount     = result.Candidates?.Count ?? 0;
            var ambiguousCount     = result.Status == IngredientMatchStatus.Ambiguous
                ? candidateCount
                : 0;

            string? candidateSummaryJson = null;
            if (result.Candidates != null && result.Candidates.Any())
            {
                candidateSummaryJson = System.Text.Json.JsonSerializer.Serialize(
                    result.Candidates.Select(c => new
                    {
                        ingredientId = c.IngredientId,
                        canonicalName = c.CanonicalName,
                        matchedBy = c.MatchedBy.ToString(),
                        confidence = c.Confidence
                    }));
            }

            var log = new IngredientNormalizationLog(
                id: Guid.NewGuid(),
                rawInput: result.RawInput,
                normalizedInput: result.NormalizedInput,
                status: result.Status.ToString(),
                matchedBy: result.MatchedBy.ToString(),
                matchedIngredientId: result.MatchedIngredientId,
                matchedCanonicalName: result.MatchedCanonicalName,
                confidence: result.Confidence,
                elapsedTimeMs: elapsedMs,
                candidateCount: candidateCount,
                ambiguousCandidateCount: ambiguousCount,
                candidateSummaryJson: candidateSummaryJson,
                correlationId: null,
                requestPath: null);

            _db.IngredientNormalizationLogs.Add(log);
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Logging must never break normalization
        }
    }
}
