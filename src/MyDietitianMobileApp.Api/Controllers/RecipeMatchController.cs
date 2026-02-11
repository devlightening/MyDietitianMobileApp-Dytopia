using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using System.Security.Claims;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Recipe match endpoint (documentation contract alias for kitchen merge)
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
    private readonly ILogger<RecipeMatchController> _logger;

    public RecipeMatchController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IKitchenNarrator narrator,
        IClientActivityWriter activityWriter,
        ILogger<RecipeMatchController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _narrator = narrator;
        _activityWriter = activityWriter;
        _logger = logger;
    }

    /// <summary>
    /// Match recipes with pantry ingredients (alias for /api/client/kitchen/merge)
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

            foreach (var recipe in candidateRecipes)
            {
                // A) Elimination by prohibitions
                var recipeProhibitedIds = recipe.ProhibitedIngredients.Select(i => i.Id).ToHashSet();
                if (clientProhibitedIds.Intersect(recipeProhibitedIds).Any())
                {
                    continue; // ELIMINATE
                }

                // B) Mandatory coverage with substitutes
                var mandatoryIds = recipe.MandatoryIngredients.Select(i => i.Id).ToList();
                var missingMandatory = new List<(Guid Id, string Name, List<Guid> Substitutes)>();

                foreach (var mandatoryId in mandatoryIds)
                {
                    var hasRequired = ingredientSet.Contains(mandatoryId);
                    var hasSubstitute = false;
                    var substituteIds = new List<Guid>();

                    if (!hasRequired)
                    {
                        // Check substitutes
                        var key = new { RecipeId = recipe.Id, RequiredIngredientId = mandatoryId };
                        if (substitutesByRecipeAndRequired.TryGetValue(key, out var subIds))
                        {
                            hasSubstitute = subIds.Any(id => ingredientSet.Contains(id));
                            substituteIds = subIds.Where(id => ingredientSet.Contains(id)).ToList();
                        }
                    }

                    if (!hasRequired && !hasSubstitute)
                    {
                        var substituteOptions = substitutesByRecipeAndRequired
                            .GetValueOrDefault(new { RecipeId = recipe.Id, RequiredIngredientId = mandatoryId }, new HashSet<Guid>())
                            .ToList();
                        missingMandatory.Add((mandatoryId, ingredientNames.GetValueOrDefault(mandatoryId, "Bilinmeyen"), substituteOptions));
                    }
                }

                var missingCount = missingMandatory.Count;
                if (missingCount > 1)
                {
                    continue; // ELIMINATE (>1 missing)
                }

                MatchStatus matchStatus;
                if (missingCount == 0)
                {
                    matchStatus = MatchStatus.FullMatch;
                }
                else
                {
                    matchStatus = MatchStatus.OneMissing;
                }

                // C) Score: count optional ingredients present
                var optionalIds = recipe.OptionalIngredients.Select(i => i.Id).ToList();
                var score = optionalIds.Count(id => ingredientSet.Contains(id));

                // D) Build response
                var missingInfo = missingMandatory.FirstOrDefault();
                var missingPayload = missingCount == 1 ? new[]
                {
                    new
                    {
                        ingredient = new { id = missingInfo.Id, name = missingInfo.Name },
                        suggestedSubstitutes = missingInfo.Substitutes
                            .Select(id => new { id, name = ingredientNames.GetValueOrDefault(id, "Bilinmeyen") })
                            .ToList()
                    }
                } : Array.Empty<object>();

                var motivationText = _narrator.BuildMotivationText(
                    matchStatus,
                    score,
                    missingCount == 1 ? new MissingInfo(missingInfo.Name, missingInfo.Substitutes.Select(id => ingredientNames.GetValueOrDefault(id, "Bilinmeyen")).ToList()) : null,
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
            }

            // Sort: higher score first, then name ascending
            results = results
                .OrderByDescending(r => ((dynamic)r).score)
                .ThenBy(r => ((dynamic)r).name)
                .ToList();

            // Write activity after successful merge
            try
            {
                var topRecipe = results.FirstOrDefault();
                var topRecipeId = topRecipe != null ? ((dynamic)topRecipe).recipeId : (Guid?)null;
                var score = topRecipe != null ? ((dynamic)topRecipe).score : 0;

                await _activityWriter.WriteAsync(
                    clientId.Value,
                    premiumStatus.IsPremium ? premiumStatus.ActiveDietitianId : null,
                    "KITCHEN_MERGE_DONE",
                    new
                    {
                        topRecipeId,
                        score,
                        eliminatedProhibitedCount = candidateRecipes.Count - results.Count,
                        missingMandatoryCount = results.Count(r => ((dynamic)r).matchStatus == "ONE_MISSING")
                    });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to write kitchen merge activity");
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
            _logger.LogError(ex, "Recipe match failed");
            return StatusCode(500, ApiProblems.InternalServerError("RECIPE_MATCH_FAILED", "Tarif eşleştirme başarısız"));
        }
    }

    private async Task<Guid?> GetClientIdAsync(Guid userId)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Client");

        return user?.LinkedClientId;
    }
}
