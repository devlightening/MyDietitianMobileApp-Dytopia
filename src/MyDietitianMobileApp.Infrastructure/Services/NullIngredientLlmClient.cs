using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// No-op implementation of <see cref="IIngredientLlmClient"/>.
/// Registered when LLM is disabled or not configured — always returns "None",
/// ensuring the normalization pipeline behaves as if Layer D does not exist.
/// </summary>
public sealed class NullIngredientLlmClient : IIngredientLlmClient
{
    public Task<LlmIngredientMatchResult> MatchAsync(
        string normalizedInput,
        IReadOnlyList<LlmCandidateIngredient> candidates,
        CancellationToken cancellationToken = default)
        => Task.FromResult(LlmIngredientMatchResult.None("LLM layer is disabled or not configured."));
}
