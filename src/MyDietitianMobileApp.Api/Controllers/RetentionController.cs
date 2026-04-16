using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Api.Time;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Retention module for managing expired clients and campaigns
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian/retention")]
public class RetentionController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<RetentionController> _logger;

    public RetentionController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<RetentionController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// Get expired clients (free clients or clients with expired plans)
    /// </summary>
    [HttpGet("expired-clients")]
    public async Task<IActionResult> GetExpiredClients()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        var nowUtc = AppTime.UtcNow;
        var thirtyDaysAgo = AppTime.EnsureUtc(nowUtc.AddDays(-30));

        // Get clients with expired plans or no active plans
        var expiredClients = await _appDb.DietitianClientLinks
            .Where(l => l.DietitianId == dietitianId && l.IsActive)
            .Join(_appDb.Clients,
                link => link.ClientId,
                client => client.Id,
                (link, client) => new { link, client })
            .GroupJoin(_appDb.ClientMealPlans.Where(p => !p.EndDate.HasValue || p.EndDate.Value >= thirtyDaysAgo),
                x => x.client.Id,
                plan => plan.ClientId,
                (x, plans) => new
                {
                    x.client.Id,
                    x.client.FullName,
                    x.client.Email,
                    linkCreatedAt = x.link.LinkCreatedAtUtc,
                    hasActivePlan = plans.Any(p => p.EndDate == null || p.EndDate >= nowUtc),
                    lastPlanEndDate = plans.Max(p => p.EndDate),
                    planCount = plans.Count()
                })
            .Where(x => !x.hasActivePlan)
            .OrderBy(x => x.lastPlanEndDate)
            .ToListAsync();

        return Ok(new
        {
            total = expiredClients.Count,
            clients = expiredClients
        });
    }

    /// <summary>
    /// Create retention campaign (placeholder - integrate with email/push provider)
    /// </summary>
    [HttpPost("campaigns")]
    public async Task<IActionResult> CreateCampaign([FromBody] CreateCampaignRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // Verify all clients belong to dietitian
        var clientLinks = await _appDb.DietitianClientLinks
            .Where(l => l.DietitianId == dietitianId &&
                       request.ClientIds.Contains(l.ClientId) &&
                       l.IsActive)
            .ToListAsync();

        if (clientLinks.Count != request.ClientIds.Count)
            return NotFound(ApiProblems.NotFound("INVALID_CLIENTS",
                "Some clients do not belong to this dietitian"));

        // TODO: Integrate with email/push notification provider
        // For now, just log the campaign
        _logger.LogInformation("Campaign created for {Count} clients: {Message}",
            request.ClientIds.Count, request.Message);

        return Ok(new
        {
            campaignId = Guid.NewGuid(),
            clientCount = request.ClientIds.Count,
            message = "Campaign created successfully (email integration pending)"
        });
    }
}

// DTOs
public record CreateCampaignRequest(
    List<Guid> ClientIds,
    string Message,
    string? OfferDetails);
