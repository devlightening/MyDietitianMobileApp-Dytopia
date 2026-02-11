using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using System.Security.Claims;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages dietitian's private recipes: full CRUD with IDOR protection
/// </summary>
[Authorize("Dietitian")]
[ApiController]
[Route("api/dietitian/recipes")]
public class DietitianRecipesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DietitianRecipesController> _logger;

    public DietitianRecipesController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DietitianRecipesController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// List dietitian's recipes with pagination and search
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListRecipes(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? q = null)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        var queryable = _appDb.Recipes
            .Where(r => r.DietitianId == dietitianId.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            queryable = queryable.Where(r =>
                EF.Functions.ILike(r.Name, $"%{term}%") ||
                EF.Functions.ILike(r.Description, $"%{term}%"));
        }

        var total = await queryable.CountAsync();

        var recipes = await queryable
            .OrderByDescending(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .ToListAsync();

        var recipeIds = recipes.Select(r => r.Id).ToList();
        var substitutes = await _appDb.RecipeIngredientSubstitutes
            .Where(s => recipeIds.Contains(s.RecipeId))
            .Include(s => s.RequiredIngredient)
            .Include(s => s.SubstituteIngredient)
            .ToListAsync();

        var substitutesByRecipe = substitutes
            .GroupBy(s => s.RecipeId)
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(s => s.RequiredIngredientId)
                    .Select(gr => new
                    {
                        requiredIngredient = new { id = gr.Key, name = gr.First().RequiredIngredient.CanonicalName },
                        substitutes = gr.Select(s => new { id = s.SubstituteIngredientId, name = s.SubstituteIngredient.CanonicalName }).ToList()
                    })
                    .Cast<object>()
                    .ToList());

        var result = recipes.Select(r =>
        {
            var recipeSubstitutes = substitutesByRecipe.ContainsKey(r.Id)
                ? substitutesByRecipe[r.Id]
                : new List<object>();
            return new
            {
                id = r.Id,
                name = r.Name,
                description = r.Description,
                isPublic = r.IsPublic,
                mandatoryIngredients = r.MandatoryIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
                optionalIngredients = r.OptionalIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
                prohibitedIngredients = r.ProhibitedIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
                substitutes = recipeSubstitutes
            };
        }).ToList();

        return Ok(new { page, pageSize, total, recipes = result });
    }

    /// <summary>
    /// Get single recipe by ID (IDOR-safe: only own recipes)
    /// </summary>
    [HttpGet("{recipeId:guid}")]
    public async Task<IActionResult> GetRecipe(Guid recipeId)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var recipe = await _appDb.Recipes
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .FirstOrDefaultAsync(r => r.Id == recipeId && r.DietitianId == dietitianId.Value);

        if (recipe == null)
            return NotFound(ApiProblems.NotFound("RECIPE_NOT_FOUND", "Tarif bulunamadı veya erişim yetkiniz yok"));

        var substitutes = await _appDb.RecipeIngredientSubstitutes
            .Where(s => s.RecipeId == recipeId)
            .Include(s => s.RequiredIngredient)
            .Include(s => s.SubstituteIngredient)
            .ToListAsync();

        var substitutesGrouped = substitutes
            .GroupBy(s => s.RequiredIngredientId)
            .Select(gr => new
            {
                requiredIngredient = new { id = gr.Key, name = gr.First().RequiredIngredient.CanonicalName },
                substitutes = gr.Select(s => new { id = s.SubstituteIngredientId, name = s.SubstituteIngredient.CanonicalName }).ToList()
            }).ToList();

        return Ok(new
        {
            id = recipe.Id,
            name = recipe.Name,
            description = recipe.Description,
            isPublic = recipe.IsPublic,
            mandatoryIngredients = recipe.MandatoryIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
            optionalIngredients = recipe.OptionalIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
            prohibitedIngredients = recipe.ProhibitedIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
            substitutes = substitutesGrouped
        });
    }

    /// <summary>
    /// Create new recipe
    /// </summary>
    [HttpPost]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> CreateRecipe([FromBody] CreateDietitianRecipeRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        // Validate ingredient sets are disjoint
        var allIngredientIds = request.MandatoryIngredientIds
            .Concat(request.OptionalIngredientIds)
            .Concat(request.ProhibitedIngredientIds)
            .Distinct()
            .ToList();

        if (allIngredientIds.Count != request.MandatoryIngredientIds.Count +
            request.OptionalIngredientIds.Count +
            request.ProhibitedIngredientIds.Count)
        {
            return BadRequest(ApiProblems.Validation("INVALID_RECIPE_INGREDIENTS",
                "Malzemeler mandatory, optional ve prohibited kategorilerinde çakışamaz."));
        }

        // Validate all ingredient IDs exist
        var existingIngredients = await _appDb.Ingredients
            .Where(i => allIngredientIds.Contains(i.Id) && i.IsActive)
            .ToListAsync();

        var missingIds = allIngredientIds.Except(existingIngredients.Select(i => i.Id)).ToList();
        if (missingIds.Any())
        {
            return BadRequest(ApiProblems.Validation("INGREDIENT_NOT_FOUND",
                $"Şu malzemeler bulunamadı: {string.Join(", ", missingIds)}"));
        }

        // Create recipe
        var recipe = new Recipe(
            Guid.NewGuid(),
            dietitianId.Value,
            request.Name.Trim(),
            request.Description?.Trim() ?? string.Empty,
            isPublic: false);

        foreach (var ingId in request.MandatoryIngredientIds)
        {
            var ingredient = existingIngredients.First(i => i.Id == ingId);
            recipe.AddMandatoryIngredient(ingredient);
        }

        foreach (var ingId in request.OptionalIngredientIds)
        {
            var ingredient = existingIngredients.First(i => i.Id == ingId);
            recipe.AddOptionalIngredient(ingredient);
        }

        foreach (var ingId in request.ProhibitedIngredientIds)
        {
            var ingredient = existingIngredients.First(i => i.Id == ingId);
            recipe.AddProhibitedIngredient(ingredient);
        }

        _appDb.Recipes.Add(recipe);
        await _appDb.SaveChangesAsync();

        // Add substitutes
        if (request.Substitutes != null && request.Substitutes.Any())
        {
            foreach (var sub in request.Substitutes)
            {
                foreach (var substituteId in sub.SubstituteIngredientIds.Distinct())
                {
                    if (substituteId == sub.RequiredIngredientId)
                        continue; // Skip self-reference

                    var substitute = new RecipeIngredientSubstitute(recipe.Id, sub.RequiredIngredientId, substituteId);
                    _appDb.RecipeIngredientSubstitutes.Add(substitute);
                }
            }
            await _appDb.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetRecipe), new { recipeId = recipe.Id }, new
        {
            id = recipe.Id,
            name = recipe.Name,
            description = recipe.Description,
            isPublic = recipe.IsPublic
        });
    }

    /// <summary>
    /// Update recipe (IDOR-safe: only own recipes)
    /// </summary>
    [HttpPut("{recipeId:guid}")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> UpdateRecipe(Guid recipeId, [FromBody] UpdateDietitianRecipeRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var recipe = await _appDb.Recipes
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .FirstOrDefaultAsync(r => r.Id == recipeId && r.DietitianId == dietitianId.Value);

        if (recipe == null)
            return NotFound(ApiProblems.NotFound("RECIPE_NOT_FOUND", "Tarif bulunamadı veya erişim yetkiniz yok"));

        // Validate ingredient sets are disjoint
        var allIngredientIds = request.MandatoryIngredientIds
            .Concat(request.OptionalIngredientIds)
            .Concat(request.ProhibitedIngredientIds)
            .Distinct()
            .ToList();

        if (allIngredientIds.Count != request.MandatoryIngredientIds.Count +
            request.OptionalIngredientIds.Count +
            request.ProhibitedIngredientIds.Count)
        {
            return BadRequest(ApiProblems.Validation("INVALID_RECIPE_INGREDIENTS",
                "Malzemeler mandatory, optional ve prohibited kategorilerinde çakışamaz."));
        }

        // Validate substitutes: requiredIngredientId must be in mandatoryIngredients
        if (request.Substitutes != null)
        {
            foreach (var sub in request.Substitutes)
            {
                if (!request.MandatoryIngredientIds.Contains(sub.RequiredIngredientId))
                {
                    return BadRequest(ApiProblems.Validation("INVALID_RECIPE_INGREDIENTS",
                        $"Substitute için belirtilen requiredIngredientId ({sub.RequiredIngredientId}) mandatoryIngredients içinde olmalıdır."));
                }
            }

            // Validate substitute ingredient IDs exist and add to validation set
            var substituteIngredientIds = request.Substitutes.SelectMany(s => s.SubstituteIngredientIds).Distinct().ToList();
            allIngredientIds = allIngredientIds.Concat(substituteIngredientIds).Distinct().ToList();

            // Validate substitutes cannot overlap with prohibited
            var prohibitedSet = request.ProhibitedIngredientIds.ToHashSet();
            var invalidSubstitutes = substituteIngredientIds.Where(id => prohibitedSet.Contains(id)).ToList();
            if (invalidSubstitutes.Any())
            {
                return BadRequest(ApiProblems.Validation("INVALID_RECIPE_INGREDIENTS",
                    $"Substitute malzemeler prohibitedIngredients içinde olamaz: {string.Join(", ", invalidSubstitutes)}"));
            }
        }

        // Validate all ingredient IDs exist
        var existingIngredients = await _appDb.Ingredients
            .Where(i => allIngredientIds.Contains(i.Id) && i.IsActive)
            .ToListAsync();

        var missingIds = allIngredientIds.Except(existingIngredients.Select(i => i.Id)).ToList();
        if (missingIds.Any())
        {
            return BadRequest(ApiProblems.Validation("INGREDIENT_NOT_FOUND",
                $"Şu malzemeler bulunamadı: {string.Join(", ", missingIds)}"));
        }

        // Update recipe properties using domain methods
        recipe.UpdateName(request.Name);
        recipe.UpdateDescription(request.Description ?? string.Empty);

        // Clear existing ingredient collections
        recipe.ClearMandatoryIngredients();
        recipe.ClearOptionalIngredients();
        recipe.ClearProhibitedIngredients();

        // Re-add ingredients
        foreach (var ingId in request.MandatoryIngredientIds)
        {
            var ingredient = existingIngredients.First(i => i.Id == ingId);
            recipe.AddMandatoryIngredient(ingredient);
        }

        foreach (var ingId in request.OptionalIngredientIds)
        {
            var ingredient = existingIngredients.First(i => i.Id == ingId);
            recipe.AddOptionalIngredient(ingredient);
        }

        foreach (var ingId in request.ProhibitedIngredientIds)
        {
            var ingredient = existingIngredients.First(i => i.Id == ingId);
            recipe.AddProhibitedIngredient(ingredient);
        }

        // Update substitutes: delete existing, add new
        var existingSubstitutes = await _appDb.RecipeIngredientSubstitutes
            .Where(s => s.RecipeId == recipeId)
            .ToListAsync();
        _appDb.RecipeIngredientSubstitutes.RemoveRange(existingSubstitutes);

        if (request.Substitutes != null && request.Substitutes.Any())
        {
            foreach (var sub in request.Substitutes)
            {
                foreach (var substituteId in sub.SubstituteIngredientIds.Distinct())
                {
                    if (substituteId == sub.RequiredIngredientId)
                        continue; // Skip self-reference

                    var substitute = new RecipeIngredientSubstitute(recipe.Id, sub.RequiredIngredientId, substituteId);
                    _appDb.RecipeIngredientSubstitutes.Add(substitute);
                }
            }
        }

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
    /// Delete recipe (IDOR-safe: only own recipes)
    /// </summary>
    [HttpDelete("{recipeId:guid}")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> DeleteRecipe(Guid recipeId)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var recipe = await _appDb.Recipes
            .FirstOrDefaultAsync(r => r.Id == recipeId && r.DietitianId == dietitianId.Value);

        if (recipe == null)
            return NotFound(ApiProblems.NotFound("RECIPE_NOT_FOUND", "Tarif bulunamadı veya erişim yetkiniz yok"));

        _appDb.Recipes.Remove(recipe);
        await _appDb.SaveChangesAsync();

        return NoContent();
    }

    private async Task<Guid?> GetDietitianIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return null;

        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId) && u.Role == "Dietitian");

        return user?.LinkedDietitianId;
    }
}

// DTOs
public record CreateDietitianRecipeRequest(
    string Name,
    string? Description,
    List<Guid> MandatoryIngredientIds,
    List<Guid> OptionalIngredientIds,
    List<Guid> ProhibitedIngredientIds,
    List<SubstituteGroup>? Substitutes = null);

public record UpdateDietitianRecipeRequest(
    string Name,
    string? Description,
    List<Guid> MandatoryIngredientIds,
    List<Guid> OptionalIngredientIds,
    List<Guid> ProhibitedIngredientIds,
    List<SubstituteGroup>? Substitutes = null);

public record SubstituteGroup(
    Guid RequiredIngredientId,
    List<Guid> SubstituteIngredientIds);
