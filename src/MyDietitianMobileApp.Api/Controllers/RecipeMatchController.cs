using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Options;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using System.Security.Claims;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Recipe match endpoint — deterministic, rule-based, clinic-isolated.
///
/// Evaluation pipeline (spec §3):
///   A. Candidate scoping  — premium: linked clinic (+ optional global public fallback if configured); free: public only
///   B. Production filter  — exclude IsDemo / IsDraft / IsHiddenFromProduction
///   C. Per-recipe eval    — 1) prohibited check  2) mandatory check  3) optional scoring
///   D. Hard classification — FULL_MATCH | ONE_MISSING | NOT_ELIGIBLE (≥2 missing → dropped)
///   E. Sort               — validity tier → clinic bonus → score → name
///   F. Paginate           — after evaluation, not before
/// </summary>
[Authorize]
[ApiController]
[Route("api/recipes")]
public class RecipeMatchController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IKitchenNarrator _narrator;
    private readonly IClientActivityWriter _activityWriter;
    private readonly IClientGamificationService _gamificationService;
    private readonly IRecipeRecommendationEngine _engine;
    private readonly ILogger<RecipeMatchController> _logger;
    private readonly IOptions<PremiumKitchenMatchOptions> _kitchenMatchOptions;

    public RecipeMatchController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IKitchenNarrator narrator,
        IClientActivityWriter activityWriter,
        IClientGamificationService gamificationService,
        IRecipeRecommendationEngine engine,
        IOptions<PremiumKitchenMatchOptions> kitchenMatchOptions,
        ILogger<RecipeMatchController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _narrator = narrator;
        _activityWriter = activityWriter;
        _gamificationService = gamificationService;
        _engine = engine;
        _kitchenMatchOptions = kitchenMatchOptions;
        _logger = logger;
    }

    /// <summary>
    /// Match recipes with pantry ingredients.
    /// Returns deterministic, explainable results ranked by validity-first then score.
    /// </summary>
    [HttpPost("match")]
    [EnableRateLimiting("kitchen")]
    public async Task<IActionResult> Match([FromBody] KitchenMergeRequest request)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Kimlik doğrulama gerekli"));

            var userGuid = Guid.Parse(userId);
            var clientId = await GetClientIdAsync(userGuid);
            if (!clientId.HasValue)
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

            // ── A. Ingredient basket ───────────────────────────────────────────────
            var ingredientIds = request.IngredientIds?.Distinct().ToList() ?? new List<Guid>();
            if (!ingredientIds.Any())
            {
                ingredientIds = await _appDb.ClientPantryItems
                    .Where(cp => cp.ClientId == clientId.Value)
                    .Select(cp => cp.IngredientId)
                    .ToListAsync();
            }

            if (!ingredientIds.Any())
            {
                return Ok(new
                {
                    page = request.Page ?? 1,
                    pageSize = request.PageSize ?? 20,
                    total = 0,
                    results = new List<object>(),
                    meta = new { selectedIngredientCount = 0, isPremium = false }
                });
            }

            // ── A2. Canonical name expansion ──────────────────────────────────────
            // The database may contain duplicate ingredient records for the same food
            // (e.g. a taxonomy-seeded record with ID ee000034-... and a manually created
            // record with a regular UUID, both named "Kuru Fasulye").
            // If the mobile app returns taxonomy IDs but a recipe was created with the
            // normal UUID (or vice-versa), matching would silently fail.
            // Solution: resolve every basket ID to its canonical name, then include ALL
            // active ingredient records that share that canonical name.
            var basketCanonicalNames = await _appDb.Ingredients
                .AsNoTracking()
                .Where(i => ingredientIds.Contains(i.Id) && i.IsActive)
                .Select(i => i.CanonicalName)
                .ToListAsync();

            if (basketCanonicalNames.Any())
            {
                var expanded = await _appDb.Ingredients
                    .AsNoTracking()
                    .Where(i => i.IsActive && basketCanonicalNames.Contains(i.CanonicalName))
                    .Select(i => i.Id)
                    .ToListAsync();

                ingredientIds = ingredientIds
                    .Concat(expanded)
                    .Distinct()
                    .ToList();

                _logger.LogDebug(
                    "[MATCH] Basket expanded by canonical name: {Original} → {Expanded} IDs",
                    ingredientIds.Count - expanded.Count + ingredientIds.Except(expanded).Count(),
                    ingredientIds.Count);
            }

            // ── B. Premium status + client prohibitions ────────────────────────────
            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid, CancellationToken.None);

            var clientProhibitedIds = (await _appDb.ClientProhibitedIngredients
                .Where(cp => cp.ClientId == clientId.Value)
                .Select(cp => cp.IngredientId)
                .ToListAsync())
                .ToHashSet();

            // ── C. Candidate query — scope + production safety filter ──────────────
            var candidateQuery = _appDb.Recipes
                .AsNoTracking()
                // Production safety: never show demo/test/seed/hidden/draft recipes
                .Where(r => !r.IsDemo)
                .Where(r => !r.IsDraft)
                .Where(r => !r.IsHiddenFromProduction)
                .Where(r => !r.IsArchived)
                .Where(r => r.IsPublic || r.DietitianId.HasValue) // must be either public or owned
                // Quality gate: exclude obviously placeholder titles (length ≤ 3 catches "aa", "bb" etc.)
                .Where(r => r.Name != null && r.Name.Length > 3);

            var kmOpt = _kitchenMatchOptions.Value;
            candidateQuery = PremiumKitchenCandidateFilter.ApplyVisibilityPolicy(
                candidateQuery,
                premiumStatus.IsPremium,
                premiumStatus.ActiveDietitianId,
                premiumStatus.IsPremium && kmOpt.AllowGlobalPublicFallback);

            // Optional text search
            if (!string.IsNullOrWhiteSpace(request.Q))
            {
                var term = request.Q.Trim();
                candidateQuery = candidateQuery.Where(r =>
                    EF.Functions.ILike(r.Name, $"%{term}%") ||
                    EF.Functions.ILike(r.Description, $"%{term}%"));
            }

            // ── D. Load ALL candidates — evaluation must happen before pagination ───
            // Loading all then paginating in memory ensures deterministic, score-ranked results.
            // Recipe counts are bounded (clinic ~50–200 + public ~50–200) so full load is safe.
            var candidateRecipes = await candidateQuery
                .Include(r => r.MandatoryIngredients)
                .Include(r => r.OptionalIngredients)
                .Include(r => r.ProhibitedIngredients)
                .AsSplitQuery()
                .ToListAsync();

            // ── D1. Orphan fallback — hydrate recipes missing shadow table rows ────
            // Shadow join tables (RecipeMandatoryIngredients / RecipeOptionalIngredients) may be
            // empty for recipes created via the web panel before the shadow-sync fix was applied.
            // If a recipe has zero shadow rows but has rows in RecipeIngredients (explicit table),
            // we hydrate its collections in-memory so the structured-ingredient gate doesn't
            // silently skip it. Run repair-recipe-shadow-tables.sql to fix this permanently.
            var orphanedRecipeIds = candidateRecipes
                .Where(r => r.MandatoryIngredients.Count + r.OptionalIngredients.Count == 0)
                .Select(r => r.Id)
                .ToList();

            if (orphanedRecipeIds.Any())
            {
                _logger.LogWarning(
                    "[MATCH] {Count} recipe(s) have empty shadow ingredient tables — loading from RecipeIngredients fallback. " +
                    "Run scripts/repair-recipe-shadow-tables.sql to fix this permanently.",
                    orphanedRecipeIds.Count);

                var explicitRows = await _appDb.RecipeIngredients
                    .AsNoTracking()
                    .Where(ri => orphanedRecipeIds.Contains(ri.RecipeId))
                    .Include(ri => ri.Ingredient)
                    .ToListAsync();

                foreach (var recipe in candidateRecipes)
                {
                    if (!orphanedRecipeIds.Contains(recipe.Id)) continue;
                    var rows = explicitRows.Where(ri => ri.RecipeId == recipe.Id).ToList();
                    var mandatory = rows
                        .Where(ri => ri.Role == "Mandatory" && ri.Ingredient != null)
                        .Select(ri => ri.Ingredient);
                    var optional = rows
                        .Where(ri => (ri.Role == RecipeIngredient.OptionalRole || ri.Role == RecipeIngredient.FlavoringRole) && ri.Ingredient != null)
                        .Select(ri => ri.Ingredient);
                    recipe.HydrateFromExplicitIngredients(mandatory, optional);
                }
            }

            var dietitianNameById = await _appDb.Dietitians
                .AsNoTracking()
                .Where(d => candidateRecipes
                    .Select(cr => cr.DietitianId)
                    .Where(id => id.HasValue)
                    .Select(id => id!.Value)
                    .Distinct()
                    .Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, d => d.FullName);

            var recipeIds = candidateRecipes.Select(r => r.Id).ToList();
            var explicitRoleRows = await _appDb.RecipeIngredients
                .AsNoTracking()
                .Where(ri => recipeIds.Contains(ri.RecipeId))
                .Select(ri => new { ri.RecipeId, ri.IngredientId, ri.Role })
                .ToListAsync();
            var explicitRoleLookup = explicitRoleRows
                .GroupBy(x => x.RecipeId)
                .ToDictionary(
                    g => g.Key,
                    g => g.GroupBy(item => item.IngredientId).ToDictionary(x => x.Key, x => x.Last().Role));

            // ── E. Load substitutes for all candidates ────────────────────────────
            var substitutes = await _appDb.RecipeIngredientSubstitutes
                .Where(s => recipeIds.Contains(s.RecipeId))
                .Include(s => s.RequiredIngredient)
                .Include(s => s.SubstituteIngredient)
                .ToListAsync();

            var substitutesByRecipeAndRequired = substitutes
                .GroupBy(s => new { s.RecipeId, s.RequiredIngredientId })
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(s => s.SubstituteIngredientId).ToHashSet());

            // ── F. Resolve ingredient names for response ──────────────────────────
            var allIngredientIds = ingredientIds
                .Concat(candidateRecipes.SelectMany(r => r.MandatoryIngredients.Select(i => i.Id)))
                .Concat(candidateRecipes.SelectMany(r => r.OptionalIngredients.Select(i => i.Id)))
                .Concat(substitutes.Select(s => s.SubstituteIngredientId))
                .Distinct()
                .ToList();

            var ingredientNames = await _appDb.Ingredients
                .Where(i => allIngredientIds.Contains(i.Id))
                .ToDictionaryAsync(i => i.Id, i => i.CanonicalName);

            var ingredientSet = ingredientIds.ToHashSet();

            // ── G-0. Load condiment ingredient IDs for the guardrail ──────────────
            // These are pantry helpers (oils, salt, spices) that cannot be the sole
            // evidence of a meaningful recipe match (spec §5.2).
            var condimentIds = await _appDb.Ingredients
                .AsNoTracking()
                .Where(i => i.IsCondiment)
                .Select(i => i.Id)
                .ToListAsync();

            _logger.LogDebug("[MATCH] Condiment guardrail loaded {Count} condiment IDs", condimentIds.Count);

            // ── G. Deterministic evaluation loop ─────────────────────────────────
            var context = new RecipeEvaluationContext(
                availableIngredientIds: ingredientIds,
                prohibitedIngredientIds: clientProhibitedIds,
                substitutesByRecipeAndRequired: substitutesByRecipeAndRequired
                    .ToDictionary(
                        kvp => (kvp.Key.RecipeId, kvp.Key.RequiredIngredientId),
                        kvp => (IReadOnlySet<Guid>)kvp.Value),
                condimentIngredientIds: condimentIds);

            var results = new List<object>();
            var evaluationSummaries = new List<(Guid RecipeId, decimal MatchPercentage, int MissingMandatoryCount,
                bool ProhibitedRejected, bool UsedSubstitutes, IReadOnlyCollection<Guid> MissingMandatoryIds)>();

            var totalCandidates = candidateRecipes.Count;
            var activeD = premiumStatus.ActiveDietitianId;
            var ownedInPool = activeD.HasValue
                ? candidateRecipes.Count(r => r.DietitianId == activeD.Value)
                : 0;
            var evalIndex = 0;
            _logger.LogInformation(
                "[MATCH] Pool ready — total={Total} linkedClinicOwned={Owned} nonOwnedInPool={Other} | basket={Basket} | premium={Premium} activeDietitian={ActiveDietitianId} allowPublicFallback={Fallback}",
                totalCandidates, ownedInPool, totalCandidates - ownedInPool,
                ingredientIds.Count, premiumStatus.IsPremium, premiumStatus.ActiveDietitianId,
                premiumStatus.IsPremium && _kitchenMatchOptions.Value.AllowGlobalPublicFallback);

            foreach (var recipe in candidateRecipes)
            {
                evalIndex++;

                // Structured-ingredient gate: kitchen matching must not compete on title-only rows
                if (recipe.MandatoryIngredients.Count + recipe.OptionalIngredients.Count == 0)
                {
                    _logger.LogDebug(
                        "[MATCH {Idx}/{Total}] SKIP_NO_STRUCTURED_INGREDIENTS | id={Id} name={Name}",
                        evalIndex, totalCandidates, recipe.Id, recipe.Name);
                    continue;
                }

                var sourceMeta = KitchenRecipeSourceLabels.Classify(recipe, premiumStatus.ActiveDietitianId);
                var recipeSource = sourceMeta.SourceType;

                // Hard tenant isolation guard — second line of defence after the candidate filter.
                // A private recipe from another dietitian must never enter the premium result set.
                // This can only happen if ActiveDietitianId resolved wrong (free-fall to public mode),
                // if AllowGlobalPublicFallback was mistakenly enabled, or if there is a data anomaly.
                // Log it as an error (not debug) and hard-skip; never expose to the client.
                if (recipeSource == KitchenRecipeSourceLabels.OtherDietitianPrivateViolation)
                {
                    _logger.LogError(
                        "[MATCH {Idx}/{Total}] TENANT_ISOLATION_VIOLATION — private recipe from another dietitian reached evaluation | " +
                        "id={RecipeId} name={Name} recipeDietitianId={RecipeDId} activeDietitianId={ActiveDId} premium={Premium}",
                        evalIndex, totalCandidates, recipe.Id, recipe.Name,
                        recipe.DietitianId, premiumStatus.ActiveDietitianId, premiumStatus.IsPremium);
                    continue;
                }

                var eval = _engine.EvaluateRecipe(recipe, context);

                // Step 0 — Quality / guardrail reject (0-mandatory, condiment-only)
                if (eval.Rejected && !eval.Explanation.RejectedBecauseProhibited)
                {
                    _logger.LogDebug(
                        "[MATCH {Idx}/{Total}] REJECTED_QUALITY | id={Id} name={Name} source={Source} reason={Reason}",
                        evalIndex, totalCandidates, recipe.Id, recipe.Name, recipeSource, eval.Explanation.Reason);
                    evaluationSummaries.Add((recipe.Id, 0, 0, false, false, Array.Empty<Guid>()));
                    continue;
                }

                // Step 1 — Prohibited check: hard reject
                if (eval.Explanation.RejectedBecauseProhibited)
                {
                    _logger.LogDebug(
                        "[MATCH {Idx}/{Total}] REJECTED_PROHIBITED | id={Id} name={Name} source={Source}",
                        evalIndex, totalCandidates, recipe.Id, recipe.Name, recipeSource);
                    evaluationSummaries.Add((recipe.Id, eval.MatchPercentage, eval.MissingMandatoryCount,
                        true, eval.Explanation.UsedSubstituteIngredientIds.Any(), eval.MissingMandatoryIngredientIds));
                    continue;
                }

                // Step 2 — Mandatory check: hard reject based on missing count
                // FULL_MATCH:     0 missing                                  → pass
                // ONE_MISSING:    1 missing                                  → pass
                // PARTIAL_MATCH:  exactly 2 missing AND ≥50 % covered       → pass (new)
                // Otherwise:      reject
                var missingIds = eval.MissingMandatoryIngredientIds.ToList();
                var missingCount = missingIds.Count;

                // Evaluate whether a 2-or-3-missing recipe qualifies as PARTIAL_MATCH.
                // Threshold: ≥40 % of mandatory ingredients must be in the basket.
                // This allows traditional recipes with many mandatory ingredients (e.g. "Etli Kuru
                // Fasulye" with 6–8 mandatory) to surface when the basket covers the core protein/base.
                bool isPartialMatchCandidate = false;
                if (missingCount == 2 || missingCount == 3)
                {
                    var totalM = recipe.MandatoryIngredients.Count;
                    var matchedM = totalM - missingCount;
                    var coverage = totalM > 0 ? (double)matchedM / totalM : 0.0;
                    isPartialMatchCandidate = coverage >= 0.40;
                }

                if (missingCount > 3 || ((missingCount == 2 || missingCount == 3) && !isPartialMatchCandidate))
                {
                    var missingNames = missingIds
                        .Select(id => ingredientNames.GetValueOrDefault(id, id.ToString()[..8]))
                        .ToList();
                    _logger.LogDebug(
                        "[MATCH {Idx}/{Total}] REJECTED_MISSING_REQUIRED ({Missing}/{Total2} mandatory missing) | id={Id} name={Name} source={Source} | missing=[{MissingNames}]",
                        evalIndex, totalCandidates, missingCount, recipe.MandatoryIngredients.Count,
                        recipe.Id, recipe.Name, recipeSource, string.Join(", ", missingNames));
                    evaluationSummaries.Add((recipe.Id, eval.MatchPercentage, missingCount,
                        false, eval.Explanation.UsedSubstituteIngredientIds.Any(), eval.MissingMandatoryIngredientIds));
                    continue;
                }

                // Step 2b — ONE_MISSING no-overlap guardrail:
                // If exactly 1 mandatory is missing AND 0 mandatory ingredients are matched,
                // the recipe has zero actual ingredient overlap with the basket (e.g. the recipe
                // has only 1 mandatory ingredient and it is not in the basket). Showing such
                // results with a ~47 % score is misleading — drop them.
                var matchedMandatoryForGuardrail = recipe.MandatoryIngredients.Count - missingCount;
                if (missingCount == 1 && matchedMandatoryForGuardrail == 0)
                {
                    _logger.LogDebug(
                        "[MATCH {Idx}/{Total}] REJECTED_NO_OVERLAP | id={Id} name={Name} source={Source} reason=ONE_MISSING with 0 mandatory matched",
                        evalIndex, totalCandidates, recipe.Id, recipe.Name, recipeSource);
                    evaluationSummaries.Add((recipe.Id, eval.MatchPercentage, missingCount,
                        false, eval.Explanation.UsedSubstituteIngredientIds.Any(), eval.MissingMandatoryIngredientIds));
                    continue;
                }

                // Step 3 — Classify: FULL_MATCH / ONE_MISSING / PARTIAL_MATCH
                bool usedSubstitutes = eval.Explanation.UsedSubstituteIngredientIds.Any();

                // matchStatus: spec-aligned strings
                string matchStatus = missingCount == 0 ? "FULL_MATCH"
                    : missingCount == 1 ? "ONE_MISSING"
                    : "PARTIAL_MATCH"; // 2 or 3 missing, ≥40 % covered (validated above)

                // matchCategory: finer grain including substitute detection
                string matchCategory = missingCount == 0
                    ? (usedSubstitutes ? "SUBSTITUTE_MATCH" : "FULL_MATCH")
                    : "PARTIAL_MISSING";

                var sourceType = sourceMeta.SourceType;
                var isOwnedByActiveDietitian = sourceMeta.IsOwnedByActiveDietitian;
                var isPublicFallback = sourceMeta.IsPublicFallback;
                var sourceDietitianId = sourceMeta.SourceDietitianId;
                var sourceDietitianName = sourceDietitianId is { } ownerId &&
                    dietitianNameById.TryGetValue(ownerId, out var nameVal)
                        ? nameVal
                        : null;

                // Step 4 — Weighted score + explainability (core mandatories >> condiments; clinic bonus)
                // Pass ingredientSet so the scoring can split optional matches into core vs condiment.
                var scoreBreakdown = KitchenMatchScoring.Compute(
                    recipe,
                    eval,
                    missingCount,
                    matchStatus,
                    condimentIds.ToHashSet(),
                    isOwnedByActiveDietitian,
                    isPublicFallback,
                    availableIngredientIds: ingredientSet,
                    optionalFlavoringIngredientIds: explicitRoleLookup.TryGetValue(recipe.Id, out var roleMapForScore)
                        ? roleMapForScore.Where(x => x.Value == RecipeIngredient.FlavoringRole).Select(x => x.Key).ToHashSet()
                        : null);

                var score = scoreBreakdown.NormalizedScore;
                var rankingReason = scoreBreakdown.RankingReason;

                // Step 5 — Build missing payload (for ONE_MISSING and PARTIAL_MATCH)
                var missingPayload = Array.Empty<object>();
                MissingInfo? missingInfoForNarrator = null;

                if (missingCount >= 1)
                {
                    var payloadItems = new List<object>();
                    foreach (var missingId in missingIds)
                    {
                        var missingName = ingredientNames.GetValueOrDefault(missingId, "Bilinmeyen");
                        var substituteKey = (recipe.Id, missingId);
                        var substituteIds = context.SubstitutesByRecipeAndRequired
                            .TryGetValue(substituteKey, out var subIds)
                            ? subIds.Where(id => ingredientSet.Contains(id)).ToList()
                            : new List<Guid>();

                        payloadItems.Add(new
                        {
                            ingredient = new { id = missingId, name = missingName },
                            suggestedSubstitutes = substituteIds
                                .Select(id => new { id, name = ingredientNames.GetValueOrDefault(id, "Bilinmeyen") })
                                .ToList()
                        });
                    }

                    missingPayload = payloadItems.ToArray();

                    // Narrator only uses a single missing item; take the first
                    var firstMissingId = missingIds[0];
                    var firstMissingName = ingredientNames.GetValueOrDefault(firstMissingId, "Bilinmeyen");
                    var firstSubstituteKey = (recipe.Id, firstMissingId);
                    var firstSubstituteIds = context.SubstitutesByRecipeAndRequired
                        .TryGetValue(firstSubstituteKey, out var firstSubIds)
                        ? firstSubIds.Where(id => ingredientSet.Contains(id)).ToList()
                        : new List<Guid>();

                    missingInfoForNarrator = new MissingInfo(
                        firstMissingName,
                        firstSubstituteIds.Select(id => ingredientNames.GetValueOrDefault(id, "Bilinmeyen")).ToList());
                }

                // Step 6 — Motivation text
                var kitchenMatchStatus = missingCount == 0 ? MatchStatus.FullMatch : MatchStatus.OneMissing;
                var motivationText = _narrator.BuildMotivationText(
                    kitchenMatchStatus,
                    eval.MatchedOptionalCount,
                    missingInfoForNarrator,
                    recipe.Name);

                // Step 7 — Explainability payload (thesis §3.2)
                var matchedMandatoryIngredients = recipe.MandatoryIngredients
                    .Where(mi =>
                    {
                        if (ingredientSet.Contains(mi.Id)) return true;
                        if (context.SubstitutesByRecipeAndRequired.TryGetValue((recipe.Id, mi.Id), out var subSet))
                            return subSet.Any(sid => ingredientSet.Contains(sid));
                        return false;
                    })
                    .Select(mi => new { id = mi.Id, name = ingredientNames.GetValueOrDefault(mi.Id, "Bilinmeyen") })
                    .ToList();

                var flavoringRoleIds = explicitRoleLookup.TryGetValue(recipe.Id, out var roleMap)
                    ? roleMap.Where(x => x.Value == RecipeIngredient.FlavoringRole).Select(x => x.Key).ToHashSet()
                    : new HashSet<Guid>();
                var optionalRoleIds = explicitRoleLookup.TryGetValue(recipe.Id, out var optionalRoleMap)
                    ? optionalRoleMap.Where(x => x.Value == RecipeIngredient.OptionalRole).Select(x => x.Key).ToHashSet()
                    : new HashSet<Guid>();

                var optionalPool = optionalRoleIds.Count > 0
                    ? recipe.OptionalIngredients.Where(oi => optionalRoleIds.Contains(oi.Id) && !flavoringRoleIds.Contains(oi.Id))
                    : recipe.OptionalIngredients.Where(oi => !flavoringRoleIds.Contains(oi.Id));
                var flavoringPool = flavoringRoleIds.Count > 0
                    ? recipe.OptionalIngredients.Where(oi => flavoringRoleIds.Contains(oi.Id))
                    : Enumerable.Empty<Ingredient>();

                var matchedOptionalIngredients = optionalPool
                    .Where(oi => ingredientSet.Contains(oi.Id))
                    .Select(oi => new { id = oi.Id, name = ingredientNames.GetValueOrDefault(oi.Id, "Bilinmeyen") })
                    .ToList();

                var missingOptionalIngredients = optionalPool
                    .Where(oi => !ingredientSet.Contains(oi.Id))
                    .Select(oi => new { id = oi.Id, name = ingredientNames.GetValueOrDefault(oi.Id, "Bilinmeyen") })
                    .ToList();
                var matchedFlavoringIngredients = flavoringPool
                    .Where(oi => ingredientSet.Contains(oi.Id))
                    .Select(oi => new { id = oi.Id, name = ingredientNames.GetValueOrDefault(oi.Id, "Bilinmeyen") })
                    .ToList();
                var missingFlavoringIngredients = flavoringPool
                    .Where(oi => !ingredientSet.Contains(oi.Id))
                    .Select(oi => new { id = oi.Id, name = ingredientNames.GetValueOrDefault(oi.Id, "Bilinmeyen") })
                    .ToList();

                var usedSubstituteDetails = eval.Explanation.UsedSubstituteIngredientIds
                    .Select(id => new { id, name = ingredientNames.GetValueOrDefault(id, "Bilinmeyen") })
                    .ToList();

                var missingMandatoryIngredientNames = missingIds
                    .Select(id => ingredientNames.GetValueOrDefault(id, "Bilinmeyen"))
                    .ToList();

                var condimentMatches = matchedMandatoryIngredients
                    .Where(x => condimentIds.Contains(x.id))
                    .Select(x => x.name)
                    .ToList();

                var flavoringTotalCount = flavoringPool.Count();
                var flavoringMatchedCount = matchedFlavoringIngredients.Count;
                var compatibilityPercent = CalculateCompatibilityPercent(
                    totalMandatoryCount: recipe.MandatoryIngredients.Count,
                    matchedMandatoryCount: recipe.MandatoryIngredients.Count - missingCount,
                    totalOptionalCount: optionalPool.Count(),
                    matchedOptionalCount: matchedOptionalIngredients.Count,
                    totalFlavoringCount: flavoringTotalCount,
                    matchedFlavoringCount: flavoringMatchedCount,
                    hasProhibitedConflict: false);

                _logger.LogDebug(
                    "[MATCH {Idx}/{Total}] {Bucket} | id={Id} name={Name} source={Source} score={Score:F4} mandatory={Mandatory}/{Total2} optional={OptMatch}/{OptTotal} usedSub={UsedSub} | reason={Reason}",
                    evalIndex, totalCandidates, matchStatus,
                    recipe.Id, recipe.Name, sourceType, score,
                    recipe.MandatoryIngredients.Count - missingCount, recipe.MandatoryIngredients.Count,
                    eval.MatchedOptionalCount, recipe.OptionalIngredients.Count,
                    usedSubstitutes, rankingReason);

                // Steps (deserialized from StepsJson; empty array when not yet authored)
                var steps = recipe.Steps.ToArray();

                results.Add(new
                {
                    recipeId            = recipe.Id,
                    name                = recipe.Name,
                    description         = recipe.Description,
                    matchStatus,
                    matchCategory,
                    sourceType,
                    sourceDietitianId,
                    sourceDietitianName,
                    isOwnedByActiveDietitian,
                    isPublicFallback,
                    compatibilityPercent,
                    score,
                    scoreRaw              = scoreBreakdown.Raw,
                    mandatoryCount        = recipe.MandatoryIngredients.Count,
                    matchedMandatoryCount = recipe.MandatoryIngredients.Count - missingCount,
                    usedSubstitutes,
                    missing               = missingPayload,
                    steps,
                    hasSteps              = steps.Length > 0,
                    isPublic              = recipe.IsPublic,
                    isDietitianRecipe     = recipe.DietitianId.HasValue,
                    motivationText,
                    explanation = new
                    {
                        matchCategory,
                        matchStatus,
                        sourceType,
                        compatibilityPercent,
                        rankingScoreNormalized = score,
                        sourceDietitianId,
                        sourceDietitianName,
                        isOwnedByActiveDietitian,
                        isPublicFallback,
                        isTenantRecipe        = isOwnedByActiveDietitian,
                        isPublicRecipe        = recipe.IsPublic,
                        // ── Mandatory coverage ────────────────────────────────────────
                        totalMandatoryCount        = recipe.MandatoryIngredients.Count,
                        matchedMandatoryCount      = recipe.MandatoryIngredients.Count - missingCount,
                        mandatoryCoveragePercent   = scoreBreakdown.MandatoryCoveragePct,
                        coreMandatoryMatchedCount  = scoreBreakdown.CoreMandatoryMatched,
                        condimentMandatoryMatchedCount = scoreBreakdown.CondimentMandatoryMatched,
                        // ── Optional coverage (split into core vs condiment) ──────────
                        optionalCount              = recipe.OptionalIngredients.Count,
                        matchedOptionalCount       = matchedOptionalIngredients.Count,
                        flavoringTotalCount,
                        flavoringMatchedCount,
                        supportTotalCount          = flavoringTotalCount,
                        supportMatchedCount        = flavoringMatchedCount,
                        coreOptionalMatchedCount   = scoreBreakdown.CoreOptionalMatched,
                        condimentOptionalMatchedCount = scoreBreakdown.CondimentOptionalMatched,
                        // ── Supporting detail ─────────────────────────────────────────
                        usedSubstitutes            = usedSubstituteDetails,
                        missingMandatory           = missingPayload,
                        missingMandatoryIngredientNames,
                        matchedIngredients         = matchedMandatoryIngredients,
                        matchedOptionalIngredients,
                        missingOptionalIngredients,
                        matchedFlavoringIngredients,
                        missingFlavoringIngredients,
                        matchedSupportIngredients   = matchedFlavoringIngredients,
                        missingSupportIngredients   = missingFlavoringIngredients,
                        condimentMatches,
                        blockedByRules             = Array.Empty<string>(),
                        rankingReason,
                        narrationInput             = eval.Explanation.Reason,
                    }
                });

                evaluationSummaries.Add((recipe.Id, eval.MatchPercentage, missingCount,
                    false, usedSubstitutes, eval.MissingMandatoryIngredientIds));
            }

            // ── H. Deterministic sort: validity tier → clinic bonus → score → name ─
            // FULL_MATCH (0) → ONE_MISSING (1) → PARTIAL_MATCH (2)
            // Within same tier: clinic before public, then score descending, then name asc.
            results = results
                .OrderBy(r => (string)((dynamic)r).matchStatus switch
                {
                    "FULL_MATCH"    => 0,
                    "ONE_MISSING"   => 1,
                    _               => 2   // PARTIAL_MATCH
                })
                .ThenByDescending(r => (bool)((dynamic)r).isOwnedByActiveDietitian ? 1 : 0)
                .ThenByDescending(r => !(bool)((dynamic)r).isPublicFallback ? 1 : 0)
                .ThenByDescending(r => (double)((dynamic)r).score)
                .ThenBy(r     => (string)((dynamic)r).name)
                .ToList();

            // ── I. Paginate post-evaluation ────────────────────────────────────────
            var page     = Math.Max(1, request.Page ?? 1);
            var pageSize = Math.Min(100, Math.Max(1, request.PageSize ?? 20));
            var totalEvaluated = results.Count;
            var pagedResults = results
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            // ── J. Activity + recommendation log ──────────────────────────────────
            try
            {
                var topRecipe = pagedResults.FirstOrDefault() ?? results.FirstOrDefault();
                var topRecipeId = topRecipe != null ? ((dynamic)topRecipe).recipeId : (Guid?)null;
                var topScore = topRecipe != null ? ((dynamic)topRecipe).score : 0;

                await _activityWriter.WriteAsync(
                    clientId.Value,
                    premiumStatus.IsPremium ? premiumStatus.ActiveDietitianId : null,
                    "KITCHEN_MERGE_DONE",
                    new
                    {
                        topRecipeId,
                        score = topScore,
                        totalResults = totalEvaluated,
                        clinicResults = results.Count(r => (bool)((dynamic)r).isOwnedByActiveDietitian),
                        missingMandatoryCount = results.Count(r => (string)((dynamic)r).matchStatus == "ONE_MISSING")
                    });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to write kitchen merge activity");
            }

            try
            {
                var top = results.FirstOrDefault();
                if (top != null)
                {
                    var topId = (Guid)((dynamic)top).recipeId;
                    var summary = evaluationSummaries.FirstOrDefault(e => e.RecipeId == topId);

                    var meta = new
                    {
                        totalEvaluated,
                        clinicCount  = results.Count(r => (bool)((dynamic)r).isOwnedByActiveDietitian),
                        fullCount    = results.Count(r => (string)((dynamic)r).matchStatus == "FULL_MATCH"),
                        missingCount = results.Count(r => (string)((dynamic)r).matchStatus == "ONE_MISSING")
                    };

                    var log = new RecipeRecommendationLog(
                        id: Guid.NewGuid(),
                        flow: "recipe_match",
                        clientId: clientId,
                        dietitianId: premiumStatus.IsPremium ? premiumStatus.ActiveDietitianId : null,
                        plannedRecipeId: null,
                        selectedRecipeId: topId,
                        originalCookable: false,
                        matchPercentage: summary.MatchPercentage,
                        missingMandatoryCount: summary.MissingMandatoryCount,
                        prohibitedRejected: summary.ProhibitedRejected,
                        usedSubstitutes: summary.UsedSubstitutes,
                        missingMandatoryIdsJson: summary.MissingMandatoryIds.Any()
                            ? System.Text.Json.JsonSerializer.Serialize(summary.MissingMandatoryIds) : null,
                        rejectionReasonSummary: null,
                        missingMandatoryNamesJson: null,
                        substituteUsageSummaryJson: null,
                        additionalMetaJson: System.Text.Json.JsonSerializer.Serialize(meta),
                        correlationId: HttpContext.TraceIdentifier);

                    _appDb.RecipeRecommendationLogs.Add(log);
                    await _appDb.SaveChangesAsync();
                }
            }
            catch
            {
                // Logging must not break the recipe match flow
            }

            // ── K. Build response ──────────────────────────────────────────────────
            var clinicCount    = results.Count(r => (bool)((dynamic)r).isOwnedByActiveDietitian);
            var fullCount      = results.Count(r => (string)((dynamic)r).matchStatus == "FULL_MATCH");
            var partialCount   = results.Count(r => (string)((dynamic)r).matchStatus == "ONE_MISSING");
            var partialCount2  = results.Count(r => (string)((dynamic)r).matchStatus == "PARTIAL_MATCH");

            if (results.Count > 0)
            {
                await _gamificationService.TrackEventAsync(
                    clientId.Value,
                    premiumStatus.IsPremium,
                    premiumStatus.ActiveDietitianId,
                    ClientGamificationService.EventTypes.KitchenRecipeGenerated,
                    new { resultCount = results.Count, ingredientCount = ingredientIds.Count });
            }

            return Ok(new
            {
                page,
                pageSize,
                total = totalEvaluated,
                results = pagedResults,
                meta = new
                {
                    selectedIngredientCount = ingredientIds.Count,
                    isPremium               = premiumStatus.IsPremium,
                    activeDietitianId       = premiumStatus.IsPremium ? premiumStatus.ActiveDietitianId : (Guid?)null,
                    allowGlobalPublicFallback = premiumStatus.IsPremium && _kitchenMatchOptions.Value.AllowGlobalPublicFallback,
                    tenantRecipeCount       = clinicCount,
                    publicRecipeCount       = results.Count - clinicCount,
                    fullMatchCount          = fullCount,
                    partialMatchCount       = partialCount,
                    partialMatch2Count      = partialCount2,
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recipe match failed");
            return StatusCode(500, ApiProblems.InternalServerError("RECIPE_MATCH_FAILED", "Tarif eşleştirme başarısız"));
        }
    }

    /// <summary>
    /// Diagnose why the current user's premium status and clinic recipe pool look the way they do.
    /// Call this when clinic recipes are unexpectedly absent from match results.
    /// Returns premium status, active dietitian ID, and the first 20 clinic recipe candidates.
    /// </summary>
    [HttpGet("match/diagnose")]
    public async Task<IActionResult> Diagnose()
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Kimlik doğrulama gerekli"));

            var userGuid = Guid.Parse(userId);
            var clientId = await GetClientIdAsync(userGuid);

            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid, CancellationToken.None);

            // Check active DietitianClientLink independently for diagnostics
            Guid? clientGuid = clientId;
            bool hasActiveLink = false;
            bool hasClientRecord = false;
            DateTime? programEndDate = null;

            if (clientGuid.HasValue)
            {
                var client = await _appDb.Clients.FindAsync(clientGuid.Value);
                hasClientRecord = client != null;
                programEndDate = client?.ProgramEndDate;

                hasActiveLink = await _appDb.DietitianClientLinks
                    .AnyAsync(l => l.ClientId == clientGuid.Value && l.IsActive);
            }

            // Clinic recipe candidates for this user's active dietitian
            List<object> clinicCandidates;
            if (premiumStatus.ActiveDietitianId.HasValue)
            {
                var raw = await _appDb.Recipes
                    .AsNoTracking()
                    .Where(r => r.DietitianId == premiumStatus.ActiveDietitianId.Value)
                    .Where(r => !r.IsArchived)
                    .OrderBy(r => r.Name)
                    .Take(20)
                    .Include(r => r.MandatoryIngredients)
                    .ToListAsync();

                var rawIds = raw.Select(r => r.Id).ToList();

                // Count explicit RecipeIngredients rows per recipe to detect shadow/explicit mismatch
                var explicitCountMap = await _appDb.RecipeIngredients
                    .AsNoTracking()
                    .Where(ri => rawIds.Contains(ri.RecipeId))
                    .GroupBy(ri => ri.RecipeId)
                    .Select(g => new { RecipeId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.RecipeId, x => x.Count);

                clinicCandidates = raw.Select(r => (object)new
                {
                    r.Id,
                    r.Name,
                    r.IsPublic,
                    r.IsDraft,
                    r.IsDemo,
                    r.IsHiddenFromProduction,
                    r.IsArchived,
                    MandatoryCount = r.MandatoryIngredients.Count,
                    ExplicitIngredientCount = explicitCountMap.GetValueOrDefault(r.Id, 0),
                    ShadowTableMismatch = r.MandatoryIngredients.Count == 0
                        && explicitCountMap.GetValueOrDefault(r.Id, 0) > 0,
                    ProductionReady = !r.IsDraft && !r.IsDemo && !r.IsHiddenFromProduction && !r.IsArchived,
                }).ToList();
            }
            else
            {
                clinicCandidates = new List<object>();
            }

            return Ok(new
            {
                auth = new
                {
                    userId = userGuid,
                    clientId,
                    hasClientRecord,
                    hasActiveLink,
                    programEndDate,
                    programExpired = programEndDate.HasValue && programEndDate.Value <= DateTime.UtcNow,
                },
                premium = new
                {
                    isPremium = premiumStatus.IsPremium,
                    activeDietitianId = premiumStatus.ActiveDietitianId,
                    premiumUntil = premiumStatus.PremiumUntilUtc,
                },
                clinicPool = new
                {
                    count = clinicCandidates.Count,
                    recipes = clinicCandidates,
                },
                hint = !premiumStatus.IsPremium
                    ? "NOT_PREMIUM: clinic recipes are invisible. Activate premium with a valid access key first."
                    : !hasActiveLink
                        ? "NO_ACTIVE_LINK: DietitianClientLink is missing or inactive. Re-activate premium."
                        : programEndDate.HasValue && programEndDate.Value <= DateTime.UtcNow
                            ? "PROGRAM_EXPIRED: premium has expired. Renew access key."
                            : "OK: premium is active and clinic recipes should be visible.",
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Diagnose endpoint failed");
            return StatusCode(500, ApiProblems.InternalServerError("DIAGNOSE_FAILED", "Tanı başarısız"));
        }
    }

    private async Task<Guid?> GetClientIdAsync(Guid userId)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Client");

        return user?.LinkedClientId;
    }

    private static int CalculateCompatibilityPercent(
        int totalMandatoryCount,
        int matchedMandatoryCount,
        int totalOptionalCount,
        int matchedOptionalCount,
        int totalFlavoringCount,
        int matchedFlavoringCount,
        bool hasProhibitedConflict)
    {
        if (hasProhibitedConflict)
            return 0;

        static double Coverage(int matched, int total)
            => total <= 0 ? 1.0 : Math.Clamp((double)matched / total, 0.0, 1.0);

        var mandatoryCoverage = Coverage(matchedMandatoryCount, totalMandatoryCount);
        var optionalCoverage = Coverage(matchedOptionalCount, totalOptionalCount);
        var flavoringCoverage = Coverage(matchedFlavoringCount, totalFlavoringCount);

        var weighted = (mandatoryCoverage * 0.70) + (optionalCoverage * 0.20) + (flavoringCoverage * 0.10);
        var percent = (int)Math.Round(weighted * 100, MidpointRounding.AwayFromZero);
        return Math.Clamp(percent, 0, 100);
    }
}
