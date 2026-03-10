using MediatR;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Application.Handlers
{
    /// <summary>
    /// Handles ingredient search requests.
    ///
    /// Search pipeline (two-layer, merged result):
    ///
    ///   Layer 1 — Normalization (canonical → alias → fuzzy)
    ///     Calls IIngredientNormalizationService.NormalizeAsync(searchTerm).
    ///     If Matched: the resolved ingredient is promoted to the TOP of the result list.
    ///     If Ambiguous: all candidate ingredients are promoted to the TOP (ranked above repo results).
    ///     If Unmatched: falls through to Layer 2 only.
    ///
    ///   Layer 2 — Repository substring search (ILike + in-memory alias)
    ///     Always runs. Provides the full searchable result set for autocomplete and browsing.
    ///
    ///   Merge:
    ///     - Normalization results appear first (highest quality match)
    ///     - Repository results follow, with normalization duplicates removed
    ///     - maxResults cap applied to the final merged list
    ///
    /// API contract (IngredientDto shape) is unchanged.
    /// </summary>
    public class SearchIngredientsQueryHandler
        : IRequestHandler<SearchIngredientsQuery, SearchIngredientsResult>
    {
        private readonly IIngredientRepository _ingredientRepository;
        private readonly IIngredientNormalizationService _normalizationService;

        public SearchIngredientsQueryHandler(
            IIngredientRepository ingredientRepository,
            IIngredientNormalizationService normalizationService)
        {
            _ingredientRepository = ingredientRepository;
            _normalizationService = normalizationService;
        }

        public async Task<SearchIngredientsResult> Handle(
            SearchIngredientsQuery query,
            CancellationToken cancellationToken)
        {
            // ── Layer 1: Normalization (canonical + alias + fuzzy) ─────────────
            var normalizedIds = new HashSet<Guid>();
            var normalizedDtos = new List<IngredientDto>();

            var normResult = await _normalizationService.NormalizeAsync(
                query.SearchTerm, cancellationToken);

            if (normResult.Status == IngredientMatchStatus.Matched
                && normResult.MatchedIngredientId.HasValue)
            {
                // Single winner — promote to the very top
                normalizedDtos.Add(new IngredientDto
                {
                    Id = normResult.MatchedIngredientId.Value,
                    CanonicalName = normResult.MatchedCanonicalName ?? string.Empty,
                    Aliases = normResult.MatchedAliases ?? Array.Empty<string>()
                });
                normalizedIds.Add(normResult.MatchedIngredientId.Value);
            }
            else if (normResult.Status == IngredientMatchStatus.Ambiguous
                     && normResult.Candidates != null)
            {
                // Multiple close candidates — promote them all, keep ordering by confidence
                foreach (var candidate in normResult.Candidates
                             .OrderByDescending(c => c.Confidence)
                             .Take(5))
                {
                    if (normalizedIds.Add(candidate.IngredientId))
                    {
                        normalizedDtos.Add(new IngredientDto
                        {
                            Id = candidate.IngredientId,
                            CanonicalName = candidate.CanonicalName ?? string.Empty,
                            Aliases = candidate.Aliases ?? Array.Empty<string>()
                        });
                    }
                }
            }
            // If Unmatched → normalizedDtos stays empty; fall through to repo only

            // ── Layer 2: Repository substring search (always runs) ────────────
            var repoResults = _ingredientRepository.Search(
                query.SearchTerm,
                maxResults: query.MaxResults);

            var repoDtos = repoResults
                .Where(i => !normalizedIds.Contains(i.Id))  // deduplicate
                .Select(i => new IngredientDto
                {
                    Id = i.Id,
                    CanonicalName = i.CanonicalName,
                    Aliases = i.Aliases
                });

            // ── Merge: normalization first → repo results after ───────────────
            var merged = normalizedDtos
                .Concat(repoDtos)
                .Take(query.MaxResults)
                .ToList();

            return new SearchIngredientsResult(merged);
        }
    }
}
