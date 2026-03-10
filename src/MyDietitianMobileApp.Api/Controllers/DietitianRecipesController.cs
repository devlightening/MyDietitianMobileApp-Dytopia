using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages dietitian recipe operations: create, update, search with ingredient dictionary
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian/recipes")]
public class DietitianRecipesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly RecipeMatchService _matchService;
    private readonly ILogger<DietitianRecipesController> _logger;

    public DietitianRecipesController(
        AppDbContext appDb,
        AuthDbContext authDb,
        RecipeMatchService matchService,
        ILogger<DietitianRecipesController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _matchService = matchService;
        _logger = logger;
    }

    /// <summary>
    /// Get all recipes for the authenticated dietitian
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetRecipes(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? visibility = null,
        [FromQuery] string? tag = null,
        [FromQuery] string? q = null)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // Validate pagination
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _appDb.Recipes
            .Where(r => r.DietitianId == dietitianId)
            .AsQueryable();

        // Apply visibility filter
        if (!string.IsNullOrWhiteSpace(visibility))
        {
            if (visibility.ToLower() == "public")
                query = query.Where(r => r.IsPublic);
            else if (visibility.ToLower() == "private")
                query = query.Where(r => !r.IsPublic);
        }

        // Apply tag filter (if tags are stored as JSON or separate table)
        // TODO: Implement tag filtering when tag system is ready

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(q))
        {
            var searchTerm = q.Trim();
            query = query.Where(r =>
                EF.Functions.ILike(r.Name, $"%{searchTerm}%") ||
                EF.Functions.ILike(r.Description, $"%{searchTerm}%"));
        }

        var total = await query.CountAsync();

        var recipes = await query
            .OrderBy(r => r.Name) // Recipe doesn't have CreatedAtUtc, order by name instead
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                id = r.Id,
                name = r.Name,
                description = r.Description,
                isPublic = r.IsPublic
                // TODO: Add createdAt when timestamp is added to Recipe entity
                // TODO: Add tags, image URL, nutrition info
            })
            .ToListAsync();

        return Ok(new
        {
            items = recipes,
            total,
            page,
            pageSize
        });
    }

    /// <summary>
    /// Create a new recipe
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateRecipe([FromBody] CreateRecipeRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // Validate ingredients exist
        var allIngredientIds = request.MandatoryIngredients
            .Concat(request.OptionalIngredients ?? Enumerable.Empty<Guid>())
            .Concat(request.Prohibitions ?? Enumerable.Empty<Guid>())
            .Distinct()
            .ToList();

        var existingIngredients = await _appDb.Ingredients
            .Where(i => allIngredientIds.Contains(i.Id) && i.IsActive)
            .Select(i => i.Id)
            .ToListAsync();

        var missingIds = allIngredientIds.Except(existingIngredients).ToList();
        if (missingIds.Any())
        {
            return BadRequest(ApiProblems.Validation("INGREDIENT_NOT_FOUND",
                $"Some ingredients not found: {string.Join(", ", missingIds)}"));
        }

        // Create recipe
        var recipe = new Recipe(
            Guid.NewGuid(),
            dietitianId,
            request.Name,
            request.Description,
            request.IsPublic);

        _appDb.Recipes.Add(recipe);

        // TODO: Add ingredients, substitutes, tags, instructions
        // This requires proper many-to-many relationship setup

        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            id = recipe.Id,
            name = recipe.Name,
            description = recipe.Description,
            isPublic = recipe.IsPublic
        });
    }

    /// <summary>
    /// Get popular recipes (most completed in specified time range)
    /// </summary>
    [HttpGet("popular")]
    public async Task<IActionResult> GetPopularRecipes([FromQuery] string range = "week")
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // Calculate date range
        var now = DateTime.UtcNow;
        var startDate = range.ToLower() switch
        {
            "week" => now.AddDays(-7),
            "month" => now.AddMonths(-1),
            _ => DateTime.MinValue
        };

        // Get completion counts for recipes
        var popularRecipes = await _appDb.ClientMeals
            .Where(m => m.CompletedAt != null &&
                       m.CompletedAt >= startDate &&
                       m.ClientMealPlan.DietitianId == dietitianId)
            .GroupBy(m => m.RecipeId)
            .Select(g => new
            {
                RecipeId = g.Key,
                CompletionCount = g.Count()
            })
            .OrderByDescending(x => x.CompletionCount)
            .Take(10)
            .ToListAsync();

        // Get recipe details
        var recipeIds = popularRecipes.Select(p => p.RecipeId).ToList();
        var recipes = await _appDb.Recipes
            .Where(r => recipeIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id);

        var result = popularRecipes
            .Where(p => recipes.ContainsKey(p.RecipeId))
            .Select(p => new
            {
                recipeId = p.RecipeId,
                recipeName = recipes[p.RecipeId].Name,
                completionCount = p.CompletionCount
            })
            .ToList();

        return Ok(new { items = result });
    }

    /// <summary>
    /// Match recipes to client basket and dietary restrictions
    /// </summary>
    [HttpPost("match")]
    public async Task<IActionResult> MatchRecipes([FromBody] RecipeMatchRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // Verify client belongs to dietitian (IDOR prevention)
        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == dietitianId &&
                                     l.ClientId == request.ClientId &&
                                     l.IsActive);

        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND",
                "Client not found or not linked to this dietitian"));

        // Get client's prohibited ingredients
        var clientProhibitedIngredients = await _appDb.ClientIngredientProhibitions
            .Where(p => p.ClientId == request.ClientId && p.IsActive)
            .Select(p => p.IngredientId)
            .ToListAsync();

        // Get recipe pool (dietitian's recipes + public recipes)
        var recipePool = await _appDb.Recipes
            .Where(r => r.DietitianId == dietitianId || r.IsPublic)
            .ToListAsync();

        // Load all recipe ingredients and prohibitions
        var recipeIds = recipePool.Select(r => r.Id).ToList();

        var allRecipeIngredients = await _appDb.RecipeIngredients
            .Where(ri => recipeIds.Contains(ri.RecipeId))
            .ToListAsync();

        var allRecipeProhibitions = await _appDb.RecipeProhibitions
            .Where(rp => recipeIds.Contains(rp.RecipeId))
            .ToListAsync();

        // Run matching algorithm
        var matches = _matchService.MatchRecipes(
            request.BasketIngredientIds,
            clientProhibitedIngredients,
            recipePool,
            allRecipeIngredients,
            allRecipeProhibitions);

        // Load ingredient names for missing ingredients
        var allMissingIds = matches
            .SelectMany(m => m.MissingMandatoryIngredientIds)
            .Distinct()
            .ToList();

        var ingredientNames = await _appDb.Ingredients
            .Where(i => allMissingIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, i => i.CanonicalName);

        // Build response
        var response = matches.Select(m => new
        {
            recipeId = m.RecipeId,
            recipeName = m.RecipeName,
            score = m.Score,
            isFullMatch = m.IsFullMatch,
            mandatoryIngredients = new
            {
                total = m.MandatoryIngredientsCount,
                matched = m.MatchedMandatoryCount,
                missing = m.MissingMandatoryIngredientIds.Count
            },
            optionalIngredients = new
            {
                total = m.OptionalIngredientsCount,
                matched = m.MatchedOptionalCount
            },
            missingIngredients = m.MissingMandatoryIngredientIds
                .Select(id => new
                {
                    id,
                    name = ingredientNames.GetValueOrDefault(id, "Unknown")
                })
                .ToList()
        }).ToList();

        return Ok(new
        {
            clientId = request.ClientId,
            basketSize = request.BasketIngredientIds.Count,
            totalMatches = response.Count,
            fullMatches = response.Count(r => r.isFullMatch),
            matches = response
        });
    }
}

// DTOs
public record RecipeMatchRequest(
    Guid ClientId,
    List<Guid> BasketIngredientIds);

public record CreateRecipeRequest(
    string Name,
    string Description,
    bool IsPublic,
    List<Guid> MandatoryIngredients,
    List<Guid>? OptionalIngredients,
    List<Guid>? Prohibitions,
    List<string>? Tags,
    List<string>? Instructions,
    int? PrepTimeMinutes,
    int? CookTimeMinutes,
    int? Servings);
