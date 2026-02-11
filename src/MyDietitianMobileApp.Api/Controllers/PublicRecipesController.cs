using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Public recipes endpoint - available to free and premium users, no auth required.
/// </summary>
[ApiController]
[Route("api/public")]
public class PublicRecipesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly ILogger<PublicRecipesController> _logger;

    public PublicRecipesController(
        AppDbContext appDb,
        ILogger<PublicRecipesController> logger)
    {
        _appDb = appDb;
        _logger = logger;
    }

    /// <summary>
    /// Get public recipes (available to free users) with pagination and optional search.
    /// </summary>
    [HttpGet("recipes")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicRecipes(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? q = null)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        try
        {
            var queryable = _appDb.Recipes
                .Where(r => r.IsPublic);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                queryable = queryable.Where(r =>
                    EF.Functions.ILike(r.Name, $"%{term}%") ||
                    EF.Functions.ILike(r.Description, $"%{term}%"));
            }

            var total = await queryable.CountAsync();

            var recipes = await queryable
                .OrderBy(r => r.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Include(r => r.MandatoryIngredients)
                .Include(r => r.OptionalIngredients)
                .Include(r => r.ProhibitedIngredients)
                .Select(r => new
                {
                    id = r.Id,
                    name = r.Name,
                    description = r.Description,
                    mandatoryIngredients = r.MandatoryIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
                    optionalIngredients = r.OptionalIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
                    prohibitedIngredients = r.ProhibitedIngredients.Select(i => new { id = i.Id, name = i.CanonicalName })
                })
                .ToListAsync();

            return Ok(new
            {
                page,
                pageSize,
                total,
                recipes
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get public recipes");
            return StatusCode(500, new { message = "Tarifler alınamadı" });
        }
    }
}
