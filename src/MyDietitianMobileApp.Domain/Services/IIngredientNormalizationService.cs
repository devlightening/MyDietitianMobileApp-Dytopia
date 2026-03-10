using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Centralized deterministic ingredient normalization and matching service.
/// This abstracts:
/// - safe text normalization
/// - exact canonical matches
/// - exact alias matches
/// 
/// Future phases (fuzzy / LLM) can build on this contract without changing callers.
/// </summary>
public interface IIngredientNormalizationService
{
    /// <summary>
    /// Normalize a raw ingredient input and attempt to match it against known ingredients.
    /// </summary>
    Task<IngredientNormalizationResult> NormalizeAsync(string rawInput, CancellationToken cancellationToken = default);
}

/// <summary>
/// Deterministic status for ingredient normalization.
/// </summary>
public enum IngredientMatchStatus
{
    Unmatched = 0,
    Matched = 1,
    Ambiguous = 2
}

/// <summary>
/// Indicates whether a match came from canonical name, alias, fuzzy fallback, LLM fallback, or none.
/// </summary>
public enum IngredientMatchedBy
{
    None = 0,
    Canonical = 1,
    Alias = 2,
    Fuzzy = 3,
    Llm = 4
}

/// <summary>
/// A single deterministic ingredient match or candidate.
/// </summary>
public class IngredientNormalizationCandidate
{
    public Guid IngredientId { get; init; }
    public string CanonicalName { get; init; } = string.Empty;
    public IReadOnlyCollection<string> Aliases { get; init; } = Array.Empty<string>();
    public IngredientMatchedBy MatchedBy { get; init; }
    public double Confidence { get; init; }
}

/// <summary>
/// Result of deterministic ingredient normalization.
/// </summary>
public class IngredientNormalizationResult
{
    public string RawInput { get; init; } = string.Empty;
    public string NormalizedInput { get; init; } = string.Empty;
    public IngredientMatchStatus Status { get; init; }
    public IngredientMatchedBy MatchedBy { get; init; }
    public double Confidence { get; init; }
    public Guid? MatchedIngredientId { get; init; }
    public string? MatchedCanonicalName { get; init; }
    public IReadOnlyCollection<string> MatchedAliases { get; init; } = Array.Empty<string>();
    public IReadOnlyCollection<IngredientNormalizationCandidate> Candidates { get; init; } = Array.Empty<IngredientNormalizationCandidate>();
    public string Explanation { get; init; } = string.Empty;
}

