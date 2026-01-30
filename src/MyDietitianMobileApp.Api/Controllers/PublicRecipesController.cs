using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Public recipes endpoint - available to all authenticated clients (free and premium)
/// </summary>
[Authorize]
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
    /// Get all public recipes (available to free users)
    /// </summary>
    [HttpGet("recipes")]
    public async Task<IActionResult> GetPublicRecipes()
    {
        try
        {
            var recipes = await _appDb.Recipes
                .Where(r => r.IsPublic)
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

            return Ok(new { recipes });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get public recipes");
            return StatusCode(500, new { message = "Tarifler alınamadı" });
        }
    }
}
