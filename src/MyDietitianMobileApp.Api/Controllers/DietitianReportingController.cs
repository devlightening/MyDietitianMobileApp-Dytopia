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
/// Dietitian reporting endpoints (read-only, IDOR-safe)
/// </summary>
[Authorize("Dietitian")]
[ApiController]
[Route("api/dietitian")]
public class DietitianReportingController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IComplianceService _complianceService;
    private readonly ILogger<DietitianReportingController> _logger;

    public DietitianReportingController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IComplianceService complianceService,
        ILogger<DietitianReportingController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _complianceService = complianceService;
        _logger = logger;
    }

    /// <summary>
    /// Get client activity log (IDOR-safe: only active linked clients)
    /// </summary>
    [HttpGet("clients/{publicUserId}/activity")]
    [EnableRateLimiting("dietitian-read-heavy")]
    public async Task<IActionResult> GetClientActivity(
        string publicUserId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? from = null,
        [FromQuery] string? to = null)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        // Resolve client from publicUserId and verify active link
        var user = await _authDb.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PublicUserId == publicUserId && u.Role == "Client");

        if (user == null || !user.LinkedClientId.HasValue)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client bulunamadı"));

        var clientId = user.LinkedClientId.Value;

        // Verify active link exists
        var link = await _appDb.DietitianClientLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(l =>
                l.DietitianId == dietitianId.Value &&
                l.ClientId == clientId &&
                l.IsActive &&
                l.UnlinkedAt == null);

        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif bağlantınız yok"));

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        var query = _appDb.ClientActivities
            .AsNoTracking()
            .Where(a => a.ClientId == clientId);

        if (!string.IsNullOrEmpty(from) && DateTime.TryParse(from, out var fromDt))
            query = query.Where(a => a.AtUtc >= fromDt);
        if (!string.IsNullOrEmpty(to) && DateTime.TryParse(to, out var toDt))
            query = query.Where(a => a.AtUtc <= toDt);

        var total = await query.CountAsync();

        var activities = await query
            .OrderByDescending(a => a.AtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                id = a.Id,
                type = a.Type,
                atUtc = a.AtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                metaJson = a.MetaJson
            })
            .ToListAsync();

        return Ok(new { page, pageSize, total, activities });
    }

    /// <summary>
    /// Get client compliance data (IDOR-safe)
    /// </summary>
    [HttpGet("clients/{publicUserId}/compliance")]
    [EnableRateLimiting("dietitian-read-heavy")]
    public async Task<IActionResult> GetClientCompliance(
        string publicUserId,
        [FromQuery] string? from = null,
        [FromQuery] string? to = null)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        // Resolve client and verify active link
        var user = await _authDb.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PublicUserId == publicUserId && u.Role == "Client");

        if (user == null || !user.LinkedClientId.HasValue)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client bulunamadı"));

        var clientId = user.LinkedClientId.Value;

        var link = await _appDb.DietitianClientLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(l =>
                l.DietitianId == dietitianId.Value &&
                l.ClientId == clientId &&
                l.IsActive &&
                l.UnlinkedAt == null);

        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif bağlantınız yok"));

        DateOnly? fromDate = null;
        DateOnly? toDate = null;

        if (!string.IsNullOrEmpty(from) && DateOnly.TryParse(from, out var fd))
            fromDate = fd;
        if (!string.IsNullOrEmpty(to) && DateOnly.TryParse(to, out var td))
            toDate = td;

        if (!fromDate.HasValue || !toDate.HasValue)
        {
            // Default to last 30 days
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            fromDate = today.AddDays(-30);
            toDate = today;
        }

        var compliance = await _complianceService.GetRangeAsync(clientId, dietitianId.Value, fromDate.Value, toDate.Value);

        return Ok(new
        {
            from = compliance.From.ToString("yyyy-MM-dd"),
            to = compliance.To.ToString("yyyy-MM-dd"),
            days = compliance.Days.Select(d => new
            {
                date = d.Date.ToString("yyyy-MM-dd"),
                plannedCount = d.PlannedCount,
                completedCount = d.CompletedCount,
                skippedCount = d.SkippedCount,
                score0_100 = d.Score0_100,
                status = d.Status
            })
        });
    }

    /// <summary>
    /// Get today's dashboard for all active linked clients
    /// </summary>
    [HttpGet("dashboard/today")]
    [EnableRateLimiting("dietitian-read-heavy")]
    public async Task<IActionResult> GetTodayDashboard()
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Get all active linked clients
        var links = await _appDb.DietitianClientLinks
            .AsNoTracking()
            .Where(l =>
                l.DietitianId == dietitianId.Value &&
                l.IsActive &&
                l.UnlinkedAt == null)
            .Include(l => l.Client)
            .ToListAsync();

        var clientIds = links.Select(l => l.ClientId).ToList();

        // Get today's compliance snapshots
        var snapshots = await _appDb.DailyComplianceSnapshots
            .AsNoTracking()
            .Where(s => clientIds.Contains(s.ClientId) && s.Date == today)
            .ToDictionaryAsync(s => s.ClientId);

        // Get last activity per client
        var lastActivities = await _appDb.ClientActivities
            .AsNoTracking()
            .Where(a => clientIds.Contains(a.ClientId))
            .GroupBy(a => a.ClientId)
            .Select(g => new { ClientId = g.Key, LastAtUtc = g.Max(a => a.AtUtc) })
            .ToDictionaryAsync(x => x.ClientId, x => x.LastAtUtc);

        // Resolve user accounts for premium status
        var userIds = await _authDb.UserAccounts
            .AsNoTracking()
            .Where(u => clientIds.Contains(u.LinkedClientId ?? Guid.Empty))
            .ToDictionaryAsync(u => u.LinkedClientId!.Value, u => u.Id);

        var results = new List<object>();

        foreach (var link in links)
        {
            var snapshot = snapshots.GetValueOrDefault(link.ClientId);
            DateTime? lastActivityAtUtc = lastActivities.TryGetValue(link.ClientId, out var lastAct) ? lastAct : null;

            // Get premium status
            var isPremium = false;
            DateTime? premiumUntilUtc = null;

            if (userIds.TryGetValue(link.ClientId, out var userId))
            {
                try
                {
                    var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
                    isPremium = premiumStatus.IsPremium;
                    premiumUntilUtc = premiumStatus.PremiumUntilUtc;
                }
                catch
                {
                    // Fallback: check client directly
                    isPremium = link.Client.ActiveDietitianId == dietitianId.Value &&
                                (link.Client.ProgramEndDate == null || link.Client.ProgramEndDate > DateTime.UtcNow);
                    premiumUntilUtc = link.Client.ProgramEndDate;
                }
            }

            var score = snapshot?.Score0_100 ?? 0;
            var status = snapshot != null
                ? (snapshot.PlannedCount == 0 ? "no-plan" : (score >= 80 ? "on-track" : "needs-attention"))
                : "no-plan";

            results.Add(new
            {
                publicUserId = (await _authDb.UserAccounts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.LinkedClientId == link.ClientId))?.PublicUserId ?? string.Empty,
                fullName = link.Client.FullName,
                todayScore0_100 = score,
                todayStatus = status,
                lastActivityAtUtc = lastActivityAtUtc?.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                isPremium,
                premiumUntilUtc = premiumUntilUtc?.ToString("yyyy-MM-ddTHH:mm:ssZ")
            });
        }

        return Ok(new { clients = results });
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
