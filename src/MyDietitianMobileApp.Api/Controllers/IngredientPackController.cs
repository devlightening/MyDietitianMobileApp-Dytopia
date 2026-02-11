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
/// Ingredient packs for quick-add functionality
/// </summary>
[ApiController]
[Route("api/ingredients/packs")]
public class IngredientPackController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly ILogger<IngredientPackController> _logger;

    public IngredientPackController(
        AppDbContext appDb,
        ILogger<IngredientPackController> logger)
    {
        _appDb = appDb;
        _logger = logger;
    }

    /// <summary>
    /// Get all ingredient packs (system packs are public, dietitian packs require premium)
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetPacks()
    {
        try
        {
            var packs = await _appDb.IngredientPacks
                .Where(p => p.IsSystem) // Only system packs for now (dietitian packs require premium check)
                .OrderBy(p => p.SortOrder)
                .ThenBy(p => p.Name)
                .Include(p => p.Items)
                .ThenInclude(i => i.Ingredient)
                .Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    sortOrder = p.SortOrder,
                    items = p.Items.Select(i => new { id = i.IngredientId, name = i.Ingredient.CanonicalName }).ToList()
                })
                .ToListAsync();

            return Ok(new { packs });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get ingredient packs");
            return StatusCode(500, ApiProblems.InternalServerError("PACKS_FETCH_FAILED", "Paketler alınamadı"));
        }
    }
}
