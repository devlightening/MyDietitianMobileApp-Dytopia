using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client analytics endpoints for compliance trends, measurements, and activity
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian/clients/{clientId}/analytics")]
public class ClientAnalyticsController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<ClientAnalyticsController> _logger;

    public ClientAnalyticsController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<ClientAnalyticsController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// Get compliance trend for client (daily compliance % over time)
    /// </summary>
    [HttpGet("compliance-trend")]
    public async Task<IActionResult> GetComplianceTrend(
        Guid clientId,
        [FromQuery] int days = 90)
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
                                     l.ClientId == clientId &&
                                     l.IsActive);

        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND",
                "Client not found or not linked to this dietitian"));

        var startDate = DateTime.UtcNow.AddDays(-days).Date;

        // Get daily compliance data
        var complianceData = await _appDb.MealCompliances
            .Where(mc => mc.ClientId == clientId &&
                        mc.Date >= DateOnly.FromDateTime(startDate))
            .GroupBy(mc => mc.Date)
            .Select(g => new
            {
                date = g.Key.ToDateTime(TimeOnly.MinValue),
                // Calculate daily compliance as percentage:
                // Done or Alternative = 100, Skipped = 0
                compliance = g.Average(mc =>
                    mc.Status == ComplianceStatus.Done || mc.Status == ComplianceStatus.Alternative
                        ? 100
                        : 0)
            })
            .OrderBy(x => x.date)
            .ToListAsync();

        return Ok(new
        {
            clientId,
            days,
            dataPoints = complianceData.Count,
            trend = complianceData
        });
    }

    /// <summary>
    /// Get measurement history for client (weight, waist, hip)
    /// </summary>
    [HttpGet("measurements")]
    public async Task<IActionResult> GetMeasurements(
        Guid clientId,
        [FromQuery] int days = 90)
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
                                     l.ClientId == clientId &&
                                     l.IsActive);

        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND",
                "Client not found or not linked to this dietitian"));

        var startDate = DateTime.UtcNow.AddDays(-days).Date;

        // Get measurements
        var measurements = await _appDb.UserMeasurements
            .Where(m => m.ClientId == clientId &&
                       m.CreatedAt >= startDate)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                date = m.CreatedAt,
                weight = m.WeightKg,
                waist = 0,
                hip = 0
            })
            .ToListAsync();

        return Ok(new
        {
            clientId,
            days,
            dataPoints = measurements.Count,
            measurements
        });
    }

    /// <summary>
    /// Get activity feed for client (paginated)
    /// </summary>
    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity(
        Guid clientId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? type = null)
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
                                     l.ClientId == clientId &&
                                     l.IsActive);

        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND",
                "Client not found or not linked to this dietitian"));

        // Build activity query (simplified - you may have a dedicated Activity table)
        var activities = new List<object>();

        // Add meal completions
        var mealActivities = await _appDb.MealCompliances
            .Where(mc => mc.ClientId == clientId)
            .OrderByDescending(mc => mc.Date)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(mc => new
            {
                type = "MEAL_COMPLETED",
                date = mc.Date.ToDateTime(TimeOnly.MinValue),
                data = new
                {
                    // Map status to a simple compliance percentage for activity feed
                    compliance = mc.Status == ComplianceStatus.Done || mc.Status == ComplianceStatus.Alternative
                        ? 100
                        : 0
                }
            })
            .ToListAsync();

        // Add measurements
        var measurementActivities = await _appDb.UserMeasurements
            .Where(m => m.ClientId == clientId)
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new
            {
                type = "MEASUREMENT_LOGGED",
                date = m.CreatedAt,
                data = new { weight = m.WeightKg }
            })
            .ToListAsync();

        activities.AddRange(mealActivities);
        activities.AddRange(measurementActivities);

        var sortedActivities = activities
            .OrderByDescending(a => ((dynamic)a).date)
            .Take(pageSize)
            .ToList();

        return Ok(new
        {
            clientId,
            page,
            pageSize,
            total = sortedActivities.Count,
            activities = sortedActivities
        });
    }
}
