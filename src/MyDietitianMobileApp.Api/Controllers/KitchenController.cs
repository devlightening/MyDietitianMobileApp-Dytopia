using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using System.Security.Claims;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Kitchen merge/comparison engine: matches pantry ingredients with recipes
/// </summary>
[Authorize]
[ApiController]
[Route("api/client/kitchen")]
[ApiExplorerSettings(IgnoreApi = true)] // Hidden from Swagger (use /api/recipes/match instead)
public class KitchenController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IKitchenNarrator _narrator;
    private readonly IClientActivityWriter _activityWriter;
    private readonly IRecipeRecommendationEngine _engine;
    private readonly ILogger<KitchenController> _logger;

    public KitchenController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IKitchenNarrator narrator,
        IClientActivityWriter activityWriter,
        IRecipeRecommendationEngine engine,
        ILogger<KitchenController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _narrator = narrator;
        _activityWriter = activityWriter;
        _engine = engine;
        _logger = logger;
    }

    /// <summary>
    /// Merge pantry ingredients with recipes to find matches
    /// </summary>
    [HttpPost("merge")]
    [EnableRateLimiting("kitchen")]
    public async Task<IActionResult> Merge([FromBody] KitchenMergeRequest request)
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

            // Get ingredient IDs from request or pantry
            var ingredientIds = request.IngredientIds?.Distinct().ToList() ?? new List<Guid>();
            if (!ingredientIds.Any())
            {
                // Load from pantry
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
                    results = new List<object>()
                });
            }

            // Get premium status
            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid, CancellationToken.None);

            // Load client prohibited ingredients
            var clientProhibitedIds = (await _appDb.ClientProhibitedIngredients
                .Where(cp => cp.ClientId == clientId.Value)
                .Select(cp => cp.IngredientId)
                .ToListAsync())
                .ToHashSet();

            // Determine candidate recipes
            var candidateQuery = _appDb.Recipes.AsNoTracking();
            if (!premiumStatus.IsPremium)
            {
                candidateQuery = candidateQuery.Where(r => r.IsPublic);
            }
            else
            {
                candidateQuery = candidateQuery.Where(r =>
                    r.IsPublic || (r.DietitianId.HasValue && r.DietitianId == premiumStatus.ActiveDietitianId));
            }

            // Optional search filter
            if (!string.IsNullOrWhiteSpace(request.Q))
            {
                var term = request.Q.Trim();
                candidateQuery = candidateQuery.Where(r =>
                    EF.Functions.ILike(r.Name, $"%{term}%") ||
                    EF.Functions.ILike(r.Description, $"%{term}%"));
            }

            var total = await candidateQuery.CountAsync();

            var page = request.Page ?? 1;
            var pageSize = request.PageSize ?? 20;
            page = page <= 0 ? 1 : page;
            pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

            // Load candidate recipes with ingredients
            var candidateRecipes = await candidateQuery
                .OrderByDescending(r => r.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Include(r => r.MandatoryIngredients)
                .Include(r => r.OptionalIngredients)
                .Include(r => r.ProhibitedIngredients)
                .AsSplitQuery()
                .ToListAsync();

            var recipeIds = candidateRecipes.Select(r => r.Id).ToList();

            // Load substitutes for candidate recipes
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

            // Load ingredient names for response
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
            var results = new List<object>();
            var evaluationSummaries = new List<(Guid RecipeId, decimal MatchPercentage, int MissingMandatoryCount, bool ProhibitedRejected, bool UsedSubstitutes, IReadOnlyCollection<Guid> MissingMandatoryIds)>();

            // Build shared evaluation context, including substitutes and client prohibitions
            var context = new RecipeEvaluationContext(
                availableIngredientIds: ingredientIds,
                prohibitedIngredientIds: clientProhibitedIds,
                substitutesByRecipeAndRequired: substitutesByRecipeAndRequired
                    .ToDictionary(
                        kvp => (kvp.Key.RecipeId, kvp.Key.RequiredIngredientId),
                        kvp => (IReadOnlySet<Guid>)kvp.Value));

            foreach (var recipe in candidateRecipes)
            {
                var eval = _engine.EvaluateRecipe(recipe, context);

                // A) Elimination by prohibitions
                if (eval.Explanation.RejectedBecauseProhibited)
                {
                    evaluationSummaries.Add((recipe.Id, eval.MatchPercentage, eval.MissingMandatoryCount, true, eval.Explanation.UsedSubstituteIngredientIds.Any(), eval.MissingMandatoryIngredientIds));
                    continue; // ELIMINATE
                }

                // B) Kitchen semantics for missing mandatory: allow 0 or 1, drop >1
                var missingIds = eval.MissingMandatoryIngredientIds.ToList();
                var missingCount = missingIds.Count;
                if (missingCount > 1)
                {
                    evaluationSummaries.Add((recipe.Id, eval.MatchPercentage, missingCount, false, eval.Explanation.UsedSubstituteIngredientIds.Any(), eval.MissingMandatoryIngredientIds));
                    continue; // ELIMINATE (>1 missing)
                }

                MatchStatus matchStatus = missingCount == 0
                    ? MatchStatus.FullMatch
                    : MatchStatus.OneMissing;

                // C) Score: count optional ingredients present (reuse engine's MatchedOptionalCount)
                var score = eval.MatchedOptionalCount;

                // D) Build missing payload (if exactly one missing)
                var missingPayload = Array.Empty<object>();
                MissingInfo? missingInfoForNarrator = null;

                if (missingCount == 1)
                {
                    var missingId = missingIds[0];
                    var missingName = ingredientNames.GetValueOrDefault(missingId, "Bilinmeyen");

                    // Suggested substitutes: those configured AND available
                    var key = (recipe.Id, missingId);
                    var substituteIds = context.SubstitutesByRecipeAndRequired.TryGetValue(key, out var subIds)
                        ? subIds.Where(id => ingredientSet.Contains(id)).ToList()
                        : new List<Guid>();

                    missingInfoForNarrator = new MissingInfo(
                        missingName,
                        substituteIds.Select(id => ingredientNames.GetValueOrDefault(id, "Bilinmeyen")).ToList());

                    missingPayload = new[]
                    {
                        new
                        {
                            ingredient = new { id = missingId, name = missingName },
                            suggestedSubstitutes = substituteIds
                                .Select(id => new { id, name = ingredientNames.GetValueOrDefault(id, "Bilinmeyen") })
                                .ToList()
                        }
                    };
                }

                var motivationText = _narrator.BuildMotivationText(
                    matchStatus,
                    score,
                    missingInfoForNarrator,
                    recipe.Name);

                results.Add(new
                {
                    recipeId = recipe.Id,
                    name = recipe.Name,
                    description = recipe.Description,
                    matchStatus = matchStatus.ToString().ToUpper(),
                    score,
                    missing = missingPayload,
                    isPublic = recipe.IsPublic,
                    isDietitianRecipe = recipe.DietitianId.HasValue,
                    motivationText
                });

                evaluationSummaries.Add((recipe.Id, eval.MatchPercentage, missingCount, false, eval.Explanation.UsedSubstituteIngredientIds.Any(), eval.MissingMandatoryIngredientIds));
            }

            // Sort: higher score first, then name ascending
            results = results
                .OrderByDescending(r => ((dynamic)r).score)
                .ThenBy(r => ((dynamic)r).name)
                .ToList();

            // Log top recommendation for evaluation (best by current score ordering)
            try
            {
                var top = results.FirstOrDefault();
                if (top != null)
                {
                    var topId = (Guid)((dynamic)top).recipeId;
                    var summary = evaluationSummaries.FirstOrDefault(e => e.RecipeId == topId);

                    var meta = new
                    {
                        eliminatedProhibitedCount = candidateRecipes.Count - results.Count,
                        missingMandatoryCount = results.Count(r => ((dynamic)r).matchStatus == "ONE_MISSING")
                    };

                    var log = new RecipeRecommendationLog(
                        id: Guid.NewGuid(),
                        flow: "kitchen_match",
                        clientId: clientId,
                        dietitianId: premiumStatus.IsPremium ? premiumStatus.ActiveDietitianId : null,
                        plannedRecipeId: null,
                        selectedRecipeId: topId,
                        originalCookable: false,
                        matchPercentage: summary.MatchPercentage,
                        missingMandatoryCount: summary.MissingMandatoryCount,
                        prohibitedRejected: summary.ProhibitedRejected,
                        usedSubstitutes: summary.UsedSubstitutes,
                        missingMandatoryIdsJson: summary.MissingMandatoryIds.Any() ? System.Text.Json.JsonSerializer.Serialize(summary.MissingMandatoryIds) : null,
                        additionalMetaJson: System.Text.Json.JsonSerializer.Serialize(meta),
                        correlationId: HttpContext.TraceIdentifier);

                    _appDb.RecipeRecommendationLogs.Add(log);
                    await _appDb.SaveChangesAsync();
                }
            }
            catch
            {
                // Logging must not break kitchen match flow
            }

            return Ok(new
            {
                page,
                pageSize,
                total = results.Count,
                results
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kitchen merge failed");
            return StatusCode(500, ApiProblems.InternalServerError("KITCHEN_MERGE_FAILED", "Mutfak karşılaştırması başarısız"));
        }
    }

    private async Task<Guid?> GetClientIdAsync(Guid userId)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Client");

        return user?.LinkedClientId;
    }
}

public record KitchenMergeRequest(
    List<Guid>? IngredientIds = null,
    int? Page = null,
    int? PageSize = null,
    string? Q = null);
