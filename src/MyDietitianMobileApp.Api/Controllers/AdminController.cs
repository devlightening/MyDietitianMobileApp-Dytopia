using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Admin dashboard for multi-dietitian management
/// </summary>
[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<AdminController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// Get all dietitians with stats
    /// </summary>
    [HttpGet("dietitians")]
    public async Task<IActionResult> GetDietitians()
    {
        var dietitians = await _appDb.Dietitians
            .Select(d => new
            {
                d.Id,
                d.FullName,
                d.ClinicName,
                                activeClients = _appDb.DietitianClientLinks
                    .Count(l => l.DietitianId == d.Id && l.IsActive),
                totalRecipes = _appDb.Recipes
                    .Count(r => r.DietitianId == d.Id),
                accessKeysGenerated = _appDb.AccessKeys
                    .Count(k => k.DietitianId == d.Id)
            })
            .OrderByDescending(d => d.activeClients)
            .ToListAsync();

        return Ok(new
        {
            total = dietitians.Count,
            dietitians
        });
    }

    /// <summary>
    /// Set limits for dietitian (access key generation, max clients)
    /// </summary>
    [HttpPost("dietitians/{id}/limits")]
    public async Task<IActionResult> SetLimits(
        Guid id,
        [FromBody] SetLimitsRequest request)
    {
        var dietitian = await _appDb.Dietitians.FindAsync(id);
        if (dietitian == null)
            return NotFound();

        // TODO: Add limits fields to Dietitian entity
        // For now, just log the action
        _logger.LogInformation("Limits set for dietitian {Id}: MaxClients={MaxClients}, MaxAccessKeys={MaxAccessKeys}",
            id, request.MaxClients, request.MaxAccessKeys);

        return Ok(new
        {
            dietitianId = id,
            message = "Limits updated successfully (implementation pending)"
        });
    }
}

// DTOs
public record SetLimitsRequest(
    int? MaxClients,
    int? MaxAccessKeys);
