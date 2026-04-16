using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Shared deterministic recipe recommendation engine built on the modern Recipe model.
/// This centralizes:
/// - prohibited ingredient rejection
/// - mandatory coverage (with optional substitute support)
/// - optional ingredient coverage / scoring
/// and produces structured evaluation metadata for thesis-grade analysis.
/// </summary>
public interface IRecipeRecommendationEngine
{
    /// <summary>
    /// Evaluate a single recipe candidate against available/prohibited ingredients.
    /// </summary>
    RecipeEvaluationResult EvaluateRecipe(
        Recipe recipe,
        RecipeEvaluationContext context);

    /// <summary>
    /// Rank multiple recipe candidates by descending score (and other tie-breakers).
    /// </summary>
    IReadOnlyList<RecipeEvaluationResult> RankRecipes(
        IEnumerable<Recipe> recipes,
        RecipeEvaluationContext context);
}

/// <summary>
/// Immutable evaluation context shared across recipe evaluations.
/// </summary>
public sealed class RecipeEvaluationContext
{
    /// <summary>
    /// Ingredient IDs the client currently has (basket/pantry).
    /// </summary>
    public IReadOnlySet<Guid> AvailableIngredientIds { get; }

    /// <summary>
    /// Ingredient IDs the client must avoid (allergies/prohibitions).
    /// </summary>
    public IReadOnlySet<Guid> ProhibitedIngredientIds { get; }

    /// <summary>
    /// Optional: substitute mapping for required ingredients per recipe.
    /// Key: (RecipeId, RequiredIngredientId) → substitute ingredient IDs.
    /// </summary>
    public IReadOnlyDictionary<(Guid RecipeId, Guid RequiredIngredientId), IReadOnlySet<Guid>> SubstitutesByRecipeAndRequired { get; }
    public IReadOnlyDictionary<(Guid RecipeId, Guid RequiredIngredientId, Guid CandidateIngredientId), MyDietitianMobileApp.Domain.Enums.CompatibilityType> SubstituteCompatibilityByRecipeRequiredAndCandidate { get; }

    /// <summary>
    /// Ingredient IDs classified as condiments/pantry helpers (oil, salt, spice, sauce, etc.).
    /// A recipe whose ONLY matched mandatory ingredients are all condiments is NOT a valid full match.
    /// </summary>
    public IReadOnlySet<Guid> CondimentIngredientIds { get; }

    public RecipeEvaluationContext(
        IReadOnlyCollection<Guid> availableIngredientIds,
        IReadOnlyCollection<Guid> prohibitedIngredientIds,
        IReadOnlyDictionary<(Guid RecipeId, Guid RequiredIngredientId), IReadOnlySet<Guid>>? substitutesByRecipeAndRequired = null,
        IReadOnlyCollection<Guid>? condimentIngredientIds = null,
        IReadOnlyDictionary<(Guid RecipeId, Guid RequiredIngredientId, Guid CandidateIngredientId), MyDietitianMobileApp.Domain.Enums.CompatibilityType>? substituteCompatibilityByRecipeRequiredAndCandidate = null)
    {
        AvailableIngredientIds = new HashSet<Guid>(availableIngredientIds ?? Array.Empty<Guid>());
        ProhibitedIngredientIds = new HashSet<Guid>(prohibitedIngredientIds ?? Array.Empty<Guid>());
        SubstitutesByRecipeAndRequired = substitutesByRecipeAndRequired ?? new Dictionary<(Guid, Guid), IReadOnlySet<Guid>>();
        CondimentIngredientIds = new HashSet<Guid>(condimentIngredientIds ?? Array.Empty<Guid>());
        SubstituteCompatibilityByRecipeRequiredAndCandidate = substituteCompatibilityByRecipeRequiredAndCandidate
            ?? new Dictionary<(Guid, Guid, Guid), MyDietitianMobileApp.Domain.Enums.CompatibilityType>();
    }
}

/// <summary>
/// Structured explanation metadata for a recipe evaluation.
/// </summary>
public sealed class RecipeEvaluationExplanation
{
    public bool RejectedBecauseProhibited { get; init; }
    public int MissingMandatoryCount { get; init; }
    public IReadOnlyCollection<Guid> MissingMandatoryIngredientIds { get; init; } = Array.Empty<Guid>();
    public int MatchedOptionalCount { get; init; }
    public int ExactMandatoryMatchedCount { get; init; }
    public int SubstituteMandatoryMatchedCount { get; init; }
    public IReadOnlyCollection<Guid> UsedSubstituteIngredientIds { get; init; } = Array.Empty<Guid>();
    public bool IsCookable { get; init; }
    public bool IsStrongAlternativeCandidate { get; init; }
    public string Reason { get; init; } = string.Empty;
}

/// <summary>
/// Result of evaluating a recipe candidate.
/// </summary>
public sealed class RecipeEvaluationResult
{
    public Recipe Recipe { get; init; } = null!;
    public bool Rejected { get; init; }
    public decimal MatchPercentage { get; init; }
    public int MissingMandatoryCount { get; init; }
    public IReadOnlyCollection<Guid> MissingMandatoryIngredientIds { get; init; } = Array.Empty<Guid>();
    public int MatchedOptionalCount { get; init; }
    public RecipeEvaluationExplanation Explanation { get; init; } = new();
}

