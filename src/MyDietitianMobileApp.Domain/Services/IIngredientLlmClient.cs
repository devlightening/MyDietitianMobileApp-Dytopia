namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Abstraction over an LLM provider used as the Layer D (final) fallback in ingredient normalization.
///
/// Contract guarantees:
/// - Never called when Layers A–C (canonical/alias/fuzzy) have already resolved a confident match.
/// - Only allowed to select from the provided <see cref="LlmCandidateIngredient"/> shortlist.
/// - Client must handle its own exceptions and surface them as <see cref="LlmMatchCategory.None"/>.
///
/// Implementations:
/// - <c>NullIngredientLlmClient</c>  — always returns None (used when LLM is disabled/unconfigured)
/// - <c>OpenAiIngredientLlmClient</c> — calls OpenAI Chat Completions with a bounded JSON prompt
/// </summary>
public interface IIngredientLlmClient
{
    /// <summary>
    /// Ask the LLM to match <paramref name="normalizedInput"/> against the provided candidate shortlist.
    /// </summary>
    /// <param name="normalizedInput">Lowercase/trimmed ingredient text that deterministic + fuzzy layers could not resolve.</param>
    /// <param name="candidates">Bounded list of real active ingredients to choose from (never the full DB).</param>
    /// <param name="cancellationToken"/>
    Task<LlmIngredientMatchResult> MatchAsync(
        string normalizedInput,
        IReadOnlyList<LlmCandidateIngredient> candidates,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Supported LLM provider types for the optional Layer D fallback.
/// </summary>
public enum IngredientLlmProvider
{
    None = 0,
    OpenAi = 1,
    Ollama = 2
}

/// <summary>A single ingredient candidate surfaced to the LLM.</summary>
public class LlmCandidateIngredient
{
    public Guid IngredientId { get; init; }
    public string CanonicalName { get; init; } = string.Empty;
    public IReadOnlyCollection<string> Aliases { get; init; } = Array.Empty<string>();
    /// <summary>Optional family name for additional semantic context (e.g. "Yoğurt Ailesi").</summary>
    public string? FamilyName { get; init; }
}

/// <summary>Decision category returned by the LLM client.</summary>
public enum LlmMatchCategory
{
    /// <summary>No safe match could be determined; treat as Unmatched.</summary>
    None = 0,
    /// <summary>A single candidate was selected with sufficient confidence.</summary>
    Matched = 1,
    /// <summary>Multiple candidates are plausible; treat as Ambiguous.</summary>
    Ambiguous = 2
}

/// <summary>Structured result returned by an <see cref="IIngredientLlmClient"/> implementation.</summary>
public class LlmIngredientMatchResult
{
    /// <summary>Outcome of the LLM decision.</summary>
    public LlmMatchCategory Category { get; init; }

    /// <summary>
    /// ID of the matched candidate. Must be one of the IDs from the input shortlist.
    /// Null when <see cref="Category"/> is not <see cref="LlmMatchCategory.Matched"/>.
    /// </summary>
    public Guid? MatchedCandidateId { get; init; }

    /// <summary>
    /// LLM-reported confidence (0–1). Thresholds:
    ///   ≥ 0.75 → accept as Matched
    ///   0.50–0.74 → treat as Ambiguous regardless of Category
    ///   &lt; 0.50 → treat as Unmatched
    /// </summary>
    public double Confidence { get; init; }

    /// <summary>Human-readable explanation of the LLM decision for logging and explainability.</summary>
    public string Explanation { get; init; } = string.Empty;

    public static LlmIngredientMatchResult None(string reason = "LLM returned no safe match.")
        => new() { Category = LlmMatchCategory.None, Confidence = 0, Explanation = reason };

    public static LlmIngredientMatchResult AmbiguousResult(double confidence, string explanation)
        => new() { Category = LlmMatchCategory.Ambiguous, Confidence = confidence, Explanation = explanation };

    public static LlmIngredientMatchResult Match(Guid candidateId, double confidence, string explanation)
        => new() { Category = LlmMatchCategory.Matched, MatchedCandidateId = candidateId, Confidence = confidence, Explanation = explanation };
}

/// <summary>
/// Configuration options for the LLM normalization layer.
/// Bind from appsettings section "IngredientLlm".
/// </summary>
public class LlmNormalizationOptions
{
    /// <summary>When false, <see cref="NullIngredientLlmClient"/> is registered and no LLM calls are made.</summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// Provider selection for the optional fallback layer.
    /// Supported values: "openai", "ollama".
    /// </summary>
    public string Provider { get; set; } = "openai";

    /// <summary>
    /// Optional provider-specific base URL override.
    /// OpenAI defaults to https://api.openai.com/
    /// Ollama defaults to http://localhost:11434/
    /// </summary>
    public string? BaseUrl { get; set; }

    /// <summary>OpenAI model name (e.g. "gpt-4o-mini").</summary>
    public string ModelName { get; set; } = "gpt-4o-mini";

    /// <summary>Name of the environment variable holding the OpenAI API key. Never stored in config files.</summary>
    public string ApiKeyEnvVar { get; set; } = "OPENAI_API_KEY";

    /// <summary>
    /// Resolved API key — set by Program.cs from config (user secrets / appsettings.Local.json),
    /// falling back to the environment variable named by ApiKeyEnvVar.
    /// Never placed directly in tracked config files.
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>Maximum number of candidates in the shortlist sent to the LLM.</summary>
    public int MaxCandidates { get; set; } = 12;

    /// <summary>
    /// Minimum fuzzy score for a near-miss ingredient to be included in the LLM shortlist.
    /// Lower = more candidates surfaced; higher = narrower/safer shortlist.
    /// </summary>
    public double MinFuzzyScoreForShortlist { get; set; } = 0.55;

    /// <summary>Normalized inputs longer than this are not sent to the LLM (anti-abuse guard).</summary>
    public int MaxInputLength { get; set; } = 120;

    /// <summary>Minimum LLM confidence to accept a match (vs. returning Ambiguous).</summary>
    public double MinConfidenceToAccept { get; set; } = 0.75;

    /// <summary>Minimum LLM confidence to return Ambiguous (vs. Unmatched).</summary>
    public double MinConfidenceForAmbiguous { get; set; } = 0.50;

    public IngredientLlmProvider ResolveProvider()
    {
        if (!Enabled)
            return IngredientLlmProvider.None;

        return Provider?.Trim().ToLowerInvariant() switch
        {
            "openai" => IngredientLlmProvider.OpenAi,
            "ollama" => IngredientLlmProvider.Ollama,
            _ => IngredientLlmProvider.None
        };
    }
}
