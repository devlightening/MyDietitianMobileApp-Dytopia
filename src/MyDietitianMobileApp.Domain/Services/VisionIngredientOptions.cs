namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Represents the availability state of the vision detection feature.
/// Returned with every analyze-image response so the client can show a meaningful message.
/// </summary>
public enum VisionFeatureStatus
{
    /// <summary>Feature is enabled and the API key is set — detection will proceed.</summary>
    Active,
    /// <summary>VisionIngredient:Enabled = false in configuration.</summary>
    Disabled,
    /// <summary>Feature is enabled but the OPENAI_API_KEY environment variable is missing.</summary>
    ApiKeyMissing,
}

/// <summary>
/// Wraps raw food-name labels returned by <see cref="IVisionIngredientService"/>
/// together with token-usage data for cost tracking.
/// </summary>
public class VisionDetectionResult
{
    public static readonly VisionDetectionResult Empty = new();

    public IReadOnlyList<string> Items { get; init; } = Array.Empty<string>();
    /// <summary>Prompt tokens consumed by the vision call (0 when not applicable).</summary>
    public int PromptTokens { get; init; }
    /// <summary>Completion tokens consumed by the vision call (0 when not applicable).</summary>
    public int CompletionTokens { get; init; }
}

/// <summary>
/// Configuration for the GPT-4o Vision-based ingredient detection feature.
/// Mirrors the shape of <see cref="LlmNormalizationOptions"/> for consistency.
/// </summary>
public class VisionIngredientOptions
{
    /// <summary>When false the endpoint returns empty results immediately — safe circuit breaker.</summary>
    public bool Enabled { get; set; } = false;

    /// <summary>Must be a vision-capable model: gpt-4o or gpt-4o-2024-11-20.</summary>
    public string ModelName { get; set; } = "gpt-4o";

    /// <summary>Shares the same env var as IngredientLlm — one API key, two services.</summary>
    public string ApiKeyEnvVar { get; set; } = "OPENAI_API_KEY";

    /// <summary>
    /// Resolved API key — set by Program.cs from config (user secrets / appsettings.Local.json),
    /// falling back to the environment variable named by ApiKeyEnvVar.
    /// Never placed directly in tracked config files.
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>Hard cap on items the vision call may return (prevents runaway normalization).</summary>
    public int MaxDetectedItems { get; set; } = 20;

    /// <summary>Max raw base64 characters accepted (guard against huge images). Default ≈ 4 MB.</summary>
    public int MaxImageBytes { get; set; } = 4_194_304;

    /// <summary>OpenAI call timeout in seconds — vision is slower than text completions.</summary>
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Closed-set ingredient names used as a HINT in the GPT-4o detection prompt only.
    /// These names tell the vision model which ingredients to focus on during detection.
    ///
    /// This list is NOT used to filter resolver results unless
    /// <see cref="EnforceClosedSetInResolver"/> is explicitly set to true.
    ///
    /// The full <c>Ingredients</c> table is always the source of truth for resolution.
    /// </summary>
    public List<string> ClosedSetCanonicalNames { get; set; } = [];

    /// <summary>
    /// When false (default), the resolver accepts any match from the full Ingredients table
    /// regardless of whether the canonical name appears in <see cref="ClosedSetCanonicalNames"/>.
    ///
    /// Set to true only in controlled Faz 1 demos where strict closed-set enforcement is required.
    /// </summary>
    public bool EnforceClosedSetInResolver { get; set; } = false;
}
