using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Interfaces;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Api.Time;
using System.Text.Json.Serialization;
using System.Security.Claims;
using System.Text.Json;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages dietitian operations: client management, access keys, client health data
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian")]
public class DietitianManagementController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly IUserRepository _userRepo;
    private readonly ILogger<DietitianManagementController> _logger;
    private readonly IWebHostEnvironment _env;

    public DietitianManagementController(
        IMediator mediator,
        AuthDbContext authDb,
        AppDbContext appDb,
        IUserRepository userRepo,
        ILogger<DietitianManagementController> logger,
        IWebHostEnvironment env)
    {
        _mediator = mediator;
        _authDb = authDb;
        _appDb = appDb;
        _userRepo = userRepo;
        _logger = logger;
        _env = env;
    }

    /// <summary>
    /// Get all clients for the authenticated dietitian with pagination, search, and filtering
    /// </summary>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 25)</param>
    /// <param name="search">Search by name or email</param>
    /// <param name="status">Filter by status: 'premium' or 'free'</param>
    /// <param name="expiringSoon">Filter premium clients expiring within 7 days</param>
    /// <param name="lowCompliance">Filter clients with compliance < 60%</param>
    /// <param name="sortBy">Sort by: 'lastActivity', 'name', or 'endDate'</param>
    /// <param name="sortDir">Sort direction: 'asc' or 'desc'</param>
    [HttpGet("clients")]
    public async Task<IActionResult> GetClients(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] bool? expiringSoon = null,
        [FromQuery] bool? lowCompliance = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // Validate pagination parameters
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 25;

        var query = new GetClientsByDietitianQuery
        {
            DietitianId = user.LinkedDietitianId.Value,
            Page = page,
            PageSize = pageSize,
            Search = search,
            Status = status,
            ExpiringSoon = expiringSoon,
            LowCompliance = lowCompliance,
            SortBy = sortBy,
            SortDir = sortDir
        };

        var result = await _mediator.Send(query);

        return Ok(new 
        { 
            items = result.Items,
            total = result.Total,
            page = result.Page,
            pageSize = result.PageSize
        });
    }

    /// <summary>
    /// Get live/active clients for real-time dashboard monitoring
    /// Returns clients with their current activity status
    /// </summary>
    [HttpGet("live-clients")]
    public async Task<IActionResult> GetLiveClients()
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedDietitianId == null)
                return Forbid();

            var dietitianId = user.LinkedDietitianId.Value;

            // Get active client links with basic client info
            var activeClients = await (from link in _appDb.DietitianClientLinks
                                       join client in _appDb.Clients on link.ClientId equals client.Id
                                       where link.DietitianId == dietitianId && link.IsActive
                                       select new
                                       {
                                           clientId = client.Id,
                                           clientName = client.FullName ?? "Unknown",
                                           lastActivity = (string?)null, // TODO: Implement activity tracking
                                           todayCompliancePercentage = 0, // TODO: Calculate from meal plan completions
                                           currentMeal = (string?)null, // TODO: Get from today's meal plan
                                           lastMealItem = (string?)null // TODO: Get last completed meal
                                       })
                                      .Take(50) // Limit to 50 most recent
                                      .ToListAsync();

            return Ok(new { ActiveClients = activeClients });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting live clients");
            return StatusCode(500, new { message = "Failed to retrieve live clients", traceId = HttpContext.TraceIdentifier });
        }
    }


    /// <summary>
    /// Get dashboard statistics for dietitian web panel
    /// </summary>
    [HttpGet("dashboard/stats")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        try
        {
            // Sequential queries — EF Core scoped DbContext does not support concurrent operations.
            var clientsCount = await _appDb.DietitianClientLinks
                .CountAsync(l => l.DietitianId == dietitianId && l.IsActive);

            var today = AppTime.ToStoredPlanDate(AppTime.LocalToday);
            var activePlans = await _appDb.ClientMealPlans
                .Where(p => p.DietitianId == dietitianId &&
                            p.IsActive &&
                            (p.EndDate == null || p.EndDate.Value >= today))
                .Select(p => p.ClientId)
                .Distinct()
                .CountAsync();

            var recipesCount = await _appDb.Recipes
                .CountAsync(r => r.DietitianId == dietitianId);

            var pendingInvites = await _appDb.AccessKeys
                .CountAsync(k => k.DietitianId == dietitianId && k.IsActive);

            return Ok(new
            {
                totalClientsCount = clientsCount,
                activeClientsCount = activePlans,
                recipeCount = recipesCount,
                accessKeyCount = pendingInvites
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetDashboardStats failed for dietitian {DietitianId}", dietitianId);
            return StatusCode(500, new { message = "Dashboard istatistikleri alınamadı." });
        }
    }

    /// <summary>
    /// Get recent activity feed for dietitian dashboard
    /// </summary>
    [HttpGet("dashboard/activity")]
    public async Task<IActionResult> GetDashboardActivity([FromQuery] int limit = 15)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;
        var safeLimit = Math.Clamp(limit, 1, 100);

        // Get recent client links with client names
        var activities = await (from link in _appDb.DietitianClientLinks
                                join client in _appDb.Clients on link.ClientId equals client.Id
                                where link.DietitianId == dietitianId
                                orderby link.LinkedAt descending
                                select new
                                {
                                    id = link.Id.ToString(),
                                    type = "client_linked",
                                    clientId = client.Id.ToString(),
                                    clientName = client.FullName ?? "Danışan",
                                    timestamp = link.LinkedAt,
                                    metadata = new
                                    {
                                        note = link.IsActive ? "kliniğe bağlandı" : "bağlantısı pasife alındı"
                                    }
                                })
                               .Take(safeLimit)
                               .ToListAsync();

        return Ok(new { activities });
    }


    /// <summary>
    /// Get specific client details by ID (for web panel detail page).
    /// Returns clinical snapshot: latest measurement, active plan, 7-day compliance, demographics.
    /// WEB-CLIENT-03: Client detail endpoint with IDOR prevention
    /// </summary>
    [HttpGet("clients/{clientId}")]
    public async Task<IActionResult> GetClientById(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // IDOR Prevention: Verify dietitian owns this client
        var link = await _appDb.DietitianClientLinks
            .Include(l => l.Client)
            .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value
                                   && l.ClientId == clientId
                                   && l.IsActive);

        if (link == null)
            return NotFound(new { message = "Danışan bulunamadı veya erişim yetkiniz yok" });

        var client = link.Client;

        // Sequential queries — EF Core scoped DbContext does not support concurrent operations.
        var m = await _appDb.ClientMeasurements
            .AsNoTracking()
            .Where(cm => cm.ClientId == clientId)
            .OrderByDescending(cm => cm.RecordedAtUtc)
            .Select(cm => new { cm.WeightKg, cm.HeightCm, cm.Bmi, cm.Bmr, cm.RecordedAtUtc })
            .FirstOrDefaultAsync();

        var plan = await _appDb.ClientMealPlans
            .AsNoTracking()
            .Where(p => p.ClientId == clientId && p.IsActive)
            .OrderByDescending(p => p.StartDate)
            .Select(p => new { p.Id, p.Name, p.StartDate, p.EndDate })
            .FirstOrDefaultAsync();

        var sevenDaysAgo = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7));
        var comp = await _appDb.MealCompliances
            .AsNoTracking()
            .Where(mc => mc.ClientId == clientId && mc.Date >= sevenDaysAgo)
            .GroupBy(mc => 1)
            .Select(g => new
            {
                total = g.Count(),
                done  = g.Count(mc => mc.Status == ComplianceStatus.Done || mc.Status == ComplianceStatus.Alternative)
            })
            .FirstOrDefaultAsync();

        // _authDb is a separate context — safe to query after _appDb queries are complete.
        var publicUserId = await _authDb.UserAccounts
            .AsNoTracking()
            .Where(u => u.LinkedClientId == clientId)
            .Select(u => u.PublicUserId)
            .FirstOrDefaultAsync();

        decimal compliancePct = (comp != null && comp.total > 0)
            ? Math.Round((decimal)comp.done / comp.total * 100, 1)
            : 0;

        return Ok(new
        {
            id              = client.Id,
            publicUserId    = publicUserId ?? client.Id.ToString(),
            fullName        = client.FullName,
            email           = client.Email,
            gender          = (int)client.Gender,
            birthDate       = client.BirthDate.ToString("yyyy-MM-dd"),
            isPremium       = client.IsPremium,
            isActive        = client.IsActive,
            linkedAt        = link.LinkedAt,
            programStartDate = client.ProgramStartDate,
            programEndDate   = client.ProgramEndDate,
            // Clinical snapshot
            latestWeight           = m?.WeightKg,
            latestHeight           = m?.HeightCm,
            latestBmi              = m?.Bmi,
            latestBmr              = m?.Bmr,
            lastMeasurementDate    = m?.RecordedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            // Active plan
            activePlanId   = plan?.Id,
            activePlanName = plan?.Name,
            activePlanStartDate = plan?.StartDate.ToString("yyyy-MM-dd"),
            activePlanEndDate   = plan?.EndDate?.ToString("yyyy-MM-dd"),
            // Compliance
            compliancePercent = compliancePct,
        });
    }

    /// <summary>
    /// Get the active meal plan for a specific client with full meal details.
    /// </summary>
    [HttpGet("clients/{clientId}/active-plan")]
    public async Task<IActionResult> GetClientActivePlan(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value
                                   && l.ClientId == clientId
                                   && l.IsActive);
        if (link == null)
            return NotFound(new { message = "Danışan bulunamadı" });

        var plan = await _appDb.ClientMealPlans
            .AsNoTracking()
            .Include(p => p.Meals)
                .ThenInclude(m => m.Recipe)
            .Where(p => p.ClientId == clientId && p.IsActive)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();

        if (plan == null)
            return Ok(new { plan = (object?)null });

        var totalMeals = plan.Meals.Count;
        var completedMeals = plan.Meals.Count(m => m.CompletedAt != null);

        var dayNames = new[] { "Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt" };

        return Ok(new
        {
            plan = new
            {
                id              = plan.Id,
                name            = plan.Name,
                description     = plan.Description,
                startDate       = plan.StartDate.ToString("yyyy-MM-dd"),
                endDate         = plan.EndDate?.ToString("yyyy-MM-dd"),
                isActive        = plan.IsActive,
                totalMeals      = totalMeals,
                completedMeals  = completedMeals,
                completionPercent = totalMeals > 0 ? Math.Round((decimal)completedMeals / totalMeals * 100, 1) : 0,
                meals = plan.Meals
                    .OrderBy(m => m.DayOfWeek).ThenBy(m => m.MealType)
                    .Select(m => new
                    {
                        id          = m.Id,
                        dayOfWeek   = m.DayOfWeek,
                        dayName     = dayNames[m.DayOfWeek],
                        mealType    = m.MealType,
                        servings    = m.Servings,
                        isCompleted = m.CompletedAt != null,
                        recipe = m.Recipe == null ? null : new
                        {
                            id   = m.Recipe.Id,
                            name = m.Recipe.Name,
                        }
                    })
            }
        });
    }


    /// <summary>
    /// Get activities for a specific client (for client detail page)
    /// </summary>
    [HttpGet("clients/{clientId}/activities")]
    public async Task<IActionResult> GetClientActivities(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // IDOR Prevention: Verify this client belongs to this dietitian
        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value && 
                                     l.ClientId == clientId && 
                                     l.IsActive);
        if (link == null)
            return NotFound(new { message = "Client not found or not linked to this dietitian" });

        // Merge multiple event sources into one unified feed
        var rawActivities = await _appDb.ClientActivities
            .AsNoTracking()
            .Where(a => a.ClientId == clientId)
            .OrderByDescending(a => a.AtUtc)
            .Take(40)
            .Select(a => new
            {
                id        = a.Id.ToString(),
                type      = MapActivityType(a.Type),
                timestamp = a.AtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                metadata  = (object?)a.MetaJson
            })
            .ToListAsync();

        var badgeActivities = await _appDb.ClientAchievementUnlocks
            .AsNoTracking()
            .Where(b => b.ClientId == clientId)
            .OrderByDescending(b => b.UnlockedAtUtc)
            .Take(20)
            .Select(b => new
            {
                id        = b.ClientId.ToString() + "_" + b.BadgeId,
                type      = "badge_unlocked",
                timestamp = b.UnlockedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                metadata  = (object?)new { badgeId = b.BadgeId, level = b.CurrentLevel }
            })
            .ToListAsync();

        var measurementActivities = await _appDb.ClientMeasurements
            .AsNoTracking()
            .Where(m => m.ClientId == clientId)
            .OrderByDescending(m => m.RecordedAtUtc)
            .Take(20)
            .Select(m => new
            {
                id        = m.Id.ToString(),
                type      = "weight_update",
                timestamp = m.RecordedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                metadata  = (object?)new { weight = m.WeightKg, bmi = m.Bmi, sourceType = m.SourceType }
            })
            .ToListAsync();

        var merged = rawActivities
            .Cast<object>()
            .Concat(badgeActivities)
            .Concat(measurementActivities)
            .OrderByDescending(a => ((dynamic)a).timestamp)
            .Take(50)
            .ToList();

        return Ok(new { activities = merged });
    }

    /// <summary>
    /// Get unified measurement history for a client (dietitian view).
    /// Returns ClientMeasurements records ordered newest first.
    /// </summary>
    [HttpGet("clients/{clientId}/measurements")]
    public async Task<IActionResult> GetClientMeasurements(
        Guid clientId,
        [FromQuery] int lastNDays = 365)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedDietitianId == null)
                return Forbid();

            var link = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value &&
                                         l.ClientId == clientId &&
                                         l.IsActive);
            if (link == null)
                return NotFound(new { message = "Danışan bulunamadı veya diyetisyene bağlı değil" });

            var cutoff = DateTime.UtcNow.AddDays(-Math.Abs(lastNDays));

            var measurements = await _appDb.ClientMeasurements
                .AsNoTracking()
                .Where(m => m.ClientId == clientId && m.RecordedAtUtc >= cutoff)
                .OrderByDescending(m => m.RecordedAtUtc)
                .Take(120)
                .Select(m => new
                {
                    id                   = m.Id,
                    recordedAtUtc        = m.RecordedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    sourceType           = m.SourceType,
                    weightKg             = m.WeightKg,
                    heightCm             = m.HeightCm,
                    bodyFatPercent       = m.BodyFatPercent,
                    musclePercent        = m.MusclePercent,
                    waterPercent         = m.WaterPercent,
                    waistCm              = m.WaistCm,
                    hipCm                = m.HipCm,
                    chestCm              = m.ChestCm,
                    bmi                  = m.Bmi,
                    bmiCategory          = m.BmiCategory,
                    bmr                  = m.Bmr,
                    waistHipRatio        = m.WaistHipRatio,
                    notes                = m.Notes,
                    isClinicallyVerified = m.IsClinicallyVerified,
                    createdAtUtc         = m.CreatedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                })
                .ToListAsync();

            return Ok(new { measurements });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting measurements for client {ClientId}", clientId);
            return StatusCode(500, new { message = "Ölçümler alınamadı", traceId = HttpContext.TraceIdentifier });
        }
    }

    /// <summary>
    /// Add a clinical measurement for a client (dietitian entry: sourceType = "dietitian").
    /// </summary>
    [HttpPost("clients/{clientId}/measurements")]
    public async Task<IActionResult> AddClientMeasurement(
        Guid clientId,
        [FromBody] DietitianAddMeasurementRequest request)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedDietitianId == null)
                return Forbid();

            var link = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value &&
                                         l.ClientId == clientId &&
                                         l.IsActive);
            if (link == null)
                return NotFound(new { message = "Danışan bulunamadı" });

            // Compute BMR from client profile
            decimal? bmr = null;
            try
            {
                var client = await _appDb.Clients
                    .AsNoTracking()
                    .Where(c => c.Id == clientId)
                    .Select(c => new { c.Gender, c.BirthDate })
                    .FirstOrDefaultAsync();

                if (client != null)
                    bmr = ClientMeasurement.ComputeBmr(
                        request.WeightKg,
                        request.HeightCm,
                        DateTime.UtcNow.Year - client.BirthDate.Year,
                        (int)client.Gender);
            }
            catch { /* BMR optional */ }

            var entry = new ClientMeasurement(
                clientId:             clientId,
                sourceType:           "dietitian",
                recordedByUserId:     Guid.Parse(userId),
                recordedAtUtc:        request.RecordedAtUtc,
                weightKg:             request.WeightKg,
                heightCm:             request.HeightCm,
                bodyFatPercent:       request.BodyFatPercent,
                musclePercent:        request.MusclePercent,
                waterPercent:         request.WaterPercent,
                waistCm:              request.WaistCm,
                hipCm:                request.HipCm,
                chestCm:              request.ChestCm,
                bmr:                  bmr,
                notes:                request.Notes,
                isClinicallyVerified: request.IsClinicallyVerified);

            _appDb.ClientMeasurements.Add(entry);
            await _appDb.SaveChangesAsync();

            return Ok(new { id = entry.Id, recordedAtUtc = entry.RecordedAtUtc, bmi = entry.Bmi, bmr = entry.Bmr });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding measurement for client {ClientId}", clientId);
            return StatusCode(500, new { message = "Ölçüm kaydedilemedi", traceId = HttpContext.TraceIdentifier });
        }
    }

    /// <summary>
    /// Update an existing measurement (dietitian can edit any measurement for their client).
    /// </summary>
    [HttpPut("clients/{clientId}/measurements/{measurementId:guid}")]
    public async Task<IActionResult> UpdateClientMeasurement(
        Guid clientId,
        Guid measurementId,
        [FromBody] DietitianAddMeasurementRequest request)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedDietitianId == null)
                return Forbid();

            var link = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value &&
                                         l.ClientId == clientId &&
                                         l.IsActive);
            if (link == null)
                return NotFound(new { message = "Danışan bulunamadı" });

            var entry = await _appDb.ClientMeasurements
                .FirstOrDefaultAsync(m => m.Id == measurementId && m.ClientId == clientId);
            if (entry == null)
                return NotFound(new { message = "Ölçüm kaydı bulunamadı" });

            decimal? bmr = null;
            try
            {
                var client = await _appDb.Clients
                    .AsNoTracking()
                    .Where(c => c.Id == clientId)
                    .Select(c => new { c.Gender, c.BirthDate })
                    .FirstOrDefaultAsync();

                if (client != null)
                    bmr = ClientMeasurement.ComputeBmr(
                        request.WeightKg,
                        request.HeightCm,
                        DateTime.UtcNow.Year - client.BirthDate.Year,
                        (int)client.Gender);
            }
            catch { /* BMR optional */ }

            entry.Update(
                weightKg:             request.WeightKg,
                heightCm:             request.HeightCm,
                bodyFatPercent:       request.BodyFatPercent,
                musclePercent:        request.MusclePercent,
                waterPercent:         request.WaterPercent,
                waistCm:              request.WaistCm,
                hipCm:                request.HipCm,
                chestCm:              request.ChestCm,
                bmr:                  bmr,
                notes:                request.Notes,
                isClinicallyVerified: request.IsClinicallyVerified);

            await _appDb.SaveChangesAsync();

            return Ok(new { id = entry.Id, bmi = entry.Bmi, bmr = entry.Bmr });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating measurement {MeasurementId}", measurementId);
            return StatusCode(500, new { message = "Ölçüm güncellenemedi", traceId = HttpContext.TraceIdentifier });
        }
    }



    /// <summary>
    /// Get all access keys for authenticated dietitian
    /// </summary>
    [HttpGet("access-keys")]
    public async Task<IActionResult> GetAccessKeys()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { message = "JWT token eksik" });

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
        {
            return BadRequest(new
            {
                message = "Diyetisyen profili bulunamadı. Lütfen profil oluşturun veya destek ile iletişime geçin.",
                code = "DIETITIAN_PROFILE_MISSING",
                requiresSetup = true
            });
        }

        var keys = await _appDb.AccessKeys
            .Where(k => k.DietitianId == user.LinkedDietitianId)
            .OrderByDescending(k => k.CreatedAtUtc)
            .Select(k => new {
                k.Id,
                k.KeyValue,
                k.CreatedAtUtc,
                k.ExpiresAtUtc,
                k.ClientId,
                k.IsActive
            })
            .ToListAsync();

        return Ok(new { accessKeys = keys });
    }

    /// <summary>
    /// Create premium access key for a client using publicUserId route parameter.
    ///
    /// Example:
    /// POST /api/dietitian/clients/MD-FMXI-BLKY-MA/access-key
    /// {
    ///   "startDate": "2026-02-11",
    ///   "endDate": "2026-02-18"
    /// }
    /// </summary>
    [HttpPost("clients/{publicUserId}/access-key")]
    [EnableRateLimiting("keygen")]
    public Task<IActionResult> CreateAccessKeyForClient(string publicUserId, [FromBody] CreateAccessKeyForClientRequest request)
    {
        // Delegate to main access-key flow while keeping Swagger-friendly wrapper
        var inner = new CreateAccessKeyRequest(publicUserId, request.CreatedAtUtc, request.ExpiresAtUtc);
        return CreateAccessKey(inner);
    }

    /// <summary>
    /// Revoke a client's premium access for the authenticated dietitian.
    /// Deactivates the DietitianClientLink and any active AccessKeys, and updates client premium state.
    /// </summary>
    [HttpPost("clients/{clientId:guid}/revoke")]
    [Authorize("Dietitian")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> RevokeClientPremium(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var command = new RevokePremiumCommand
        {
            DietitianId = user.LinkedDietitianId.Value,
            ClientId = clientId
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            // IDOR-safe: do not leak whether client exists, only that link is missing
            if (result.ErrorCode == "LINK_NOT_FOUND")
            {
                var problem = ApiProblems.NotFound("LINK_NOT_FOUND", result.ErrorMessage ?? "Danışan bulunamadı veya erişim yetkiniz yok");
                return StatusCode(problem.Status ?? 404, problem);
            }

            var validation = ApiProblems.Validation(result.ErrorCode ?? "PREMIUM_REVOKE_FAILED", result.ErrorMessage ?? "Premium iptali başarısız");
            return StatusCode(validation.Status ?? 400, validation);
        }

        // Audit log
        var audit = new PremiumAuditLog(
            Guid.NewGuid(),
            result.ClientId,
            user.LinkedDietitianId,
            "Revoke",
            result.RevokedAtUtc,
            null);

        _appDb.PremiumAuditLogs.Add(audit);
        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            clientId = result.ClientId,
            revokedAt = result.RevokedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            wasPremium = result.WasPremium,
            nowPremium = false
        });
    }

    /// <summary>
    /// Revoke a client's premium access using publicUserId (canonical route).
    /// </summary>
    [HttpPost("clients/{publicUserId}/revoke")]
    [Authorize("Dietitian")]
    public async Task<IActionResult> RevokeClientPremiumByPublicUserId(string publicUserId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var client = await _userRepo.GetClientByPublicUserIdAsync(publicUserId);
        if (client == null)
        {
            var problem = ApiProblems.NotFound("CLIENT_NOT_FOUND", $"Danışan bulunamadı: {publicUserId}");
            return StatusCode(problem.Status ?? 404, problem);
        }

        var clientEntity = (Client)client;

        var command = new RevokePremiumCommand
        {
            DietitianId = user.LinkedDietitianId.Value,
            ClientId = clientEntity.Id
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            if (result.ErrorCode == "LINK_NOT_FOUND")
            {
                var problem = ApiProblems.NotFound("LINK_NOT_FOUND", result.ErrorMessage ?? "Danışan bulunamadı veya erişim yetkiniz yok");
                return StatusCode(problem.Status ?? 404, problem);
            }

            var validation = ApiProblems.Validation(result.ErrorCode ?? "PREMIUM_REVOKE_FAILED", result.ErrorMessage ?? "Premium iptali başarısız");
            return StatusCode(validation.Status ?? 400, validation);
        }

        // Audit log
        var audit = new PremiumAuditLog(
            Guid.NewGuid(),
            result.ClientId,
            user.LinkedDietitianId,
            "Revoke",
            result.RevokedAtUtc,
            System.Text.Json.JsonSerializer.Serialize(new { publicUserId }));

        _appDb.PremiumAuditLogs.Add(audit);
        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            publicUserId,
            clientId = result.ClientId,
            revokedAt = result.RevokedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            wasPremium = result.WasPremium,
            nowPremium = false
        });
    }

    /// <summary>
    /// Create premium access key for a client.
    ///
    /// Preferred payload (public user id based):
    /// {
    ///   "publicUserId": "MD-FMXI-BLKY-MA",
    ///   "startDate": "2026-02-11",
    ///   "endDate": "2026-02-18"
    /// }
    ///
    /// For backward compatibility, legacy clients can still send "clientId"
    /// with the same MD-XXXX-XXXX-XX value; if both are present,
    /// publicUserId takes precedence.
    /// </summary>
    [HttpPost("access-keys")]
    [EnableRateLimiting("keygen")]
    public async Task<IActionResult> CreateAccessKey([FromBody] CreateAccessKeyRequest request)
    {
        try
        {
            // DEBUG: Check if user is authenticated
            if (!User.Identity?.IsAuthenticated ?? true)
            {
                _logger.LogWarning("POST access-keys: User not authenticated");
                return Unauthorized(new { message = "Kullanıcı doğrulanmadı" });
            }

            // DEBUG: Log all claims
            var claims = User.Claims.Select(c => $"{c.Type}={c.Value}").ToList();
            _logger.LogInformation("POST access-keys: User claims: {Claims}", string.Join(", ", claims));

            // Robust userId resolution with fallback
            var userId = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub) 
                ?? User.FindFirstValue("sub") 
                ?? User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                _logger.LogWarning("POST access-keys: User ID claim not found in token");
                return Unauthorized(new { 
                    code = "AUTH_MISSING_USERID", 
                    message = "JWT user id claim missing" 
                });
            }

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user == null)
            {
                _logger.LogWarning("POST access-keys: User not found for ID {UserId}", userId);
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });
            }

            if (user.LinkedDietitianId == null)
            {
                return BadRequest(new
                {
                    message = "Diyetisyen profili bulunamadı. Lütfen profil oluşturun veya destek ile iletişime geçin.",
                    code = "DIETITIAN_PROFILE_MISSING",
                    requiresSetup = true
                });
            }

            var dietitian = await _appDb.Dietitians.FindAsync(user.LinkedDietitianId.Value);
            if (dietitian == null)
                return BadRequest(new { message = "Diyetisyen kaydı bulunamadı" });

            if (!dietitian.IsActive)
                return BadRequest(new { message = "Diyetisyen hesabı aktif değil" });

            // Resolve public user id (new contract) with backward compatibility
            var publicUserId = request.PublicUserId;

            var client = await _userRepo.GetClientByPublicUserIdAsync(publicUserId);
            if (client == null)
                return NotFound(new { message = $"Danışan bulunamadı: {publicUserId}" });

            var clientEntity = (Client)client;

            if (!DateTime.TryParse(request.CreatedAtUtc, out var startDate) ||
                !DateTime.TryParse(request.ExpiresAtUtc, out var endDate))
            {
                return BadRequest(new { message = "Geçersiz tarih formatı" });
            }

            // Normalize dates to UTC (Npgsql requires DateTimeKind.Utc)
            // Use .Date to get midnight, then specify UTC kind
            var startUtc = DateTime.SpecifyKind(startDate.Date, DateTimeKind.Utc);
            var endUtc = DateTime.SpecifyKind(endDate.Date, DateTimeKind.Utc);

            // Server-side validation: endUtc must be after startUtc
            if (endUtc < startUtc)
            {
                return BadRequest(new 
                { 
                    code = "ACCESSKEY_INVALID_DATE_RANGE",
                    message = "Bitiş tarihi başlangıç tarihinden sonra olmalı" 
                });
            }

            // Check for existing active key (idempotent)
            var existingKey = await _appDb.AccessKeys
                .Where(k => k.DietitianId == user.LinkedDietitianId.Value 
                         && k.ClientId == clientEntity.Id 
                         && k.IsActive 
                         && k.ExpiresAtUtc > DateTime.UtcNow)
                .FirstOrDefaultAsync();

            if (existingKey != null)
            {
                return Ok(new
                {
                    success = true,
                    key = existingKey.KeyValue,
                    publicUserId,
                    startDate = existingKey.CreatedAtUtc.ToString("yyyy-MM-dd"),
                    endDate = existingKey.ExpiresAtUtc.ToString("yyyy-MM-dd"),
                    message = "Mevcut aktif anahtar döndürüldü"
                });
            }

            var keyValue = GenerateAccessKey();
            var accessKeyId = Guid.NewGuid();
            var accessKey = new AccessKey(
                accessKeyId,
                keyValue,
                user.LinkedDietitianId.Value,
                clientEntity.Id,
                startUtc,  // Use UTC-normalized date
                endUtc,    // Use UTC-normalized date
                true
            );

            _appDb.AccessKeys.Add(accessKey);

            // Audit log for key generation
            var audit = new PremiumAuditLog(
                Guid.NewGuid(),
                clientEntity.Id,
                user.LinkedDietitianId.Value,
                "KeyGenerated",
                DateTime.UtcNow,
                System.Text.Json.JsonSerializer.Serialize(new
                {
                    accessKeyId,
                    accessKey = keyValue,
                    startDate = startUtc,
                    endDate = endUtc
                }));

            _appDb.PremiumAuditLogs.Add(audit);

            // FAZ 3: Create permanent binding (only if link doesn't already exist)
            // Check if an active link already exists for this (ClientId, DietitianId) pair
            var existingLink = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => 
                    l.ClientId == clientEntity.Id && 
                    l.DietitianId == user.LinkedDietitianId.Value && 
                    l.IsActive);

            if (existingLink == null)
            {
                // Only create link if it doesn't exist
                var bindCommand = new BindClientToDietitianCommand
                {
                    DietitianId = user.LinkedDietitianId.Value,
                    ClientId = clientEntity.Id,
                    PublicUserId = publicUserId
                };

                await _mediator.Send(bindCommand);
            }
            // If link exists, no need to update - it's already bound correctly

            await _appDb.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                key = accessKey.KeyValue,
                publicUserId,
                startDate = accessKey.CreatedAtUtc.ToString("yyyy-MM-dd"),
                endDate = accessKey.ExpiresAtUtc.ToString("yyyy-MM-dd")
            });
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
        {
        _logger.LogError(dbEx, "Database update failed during access key creation for client {PublicUserId}", request.PublicUserId);
            
            // Extract inner exception message for development
            var innerMessage = dbEx.InnerException?.Message ?? dbEx.Message;
            var detail = _env.IsDevelopment() ? innerMessage : null;

            return StatusCode(500, new 
            { 
                code = "DB_SAVE_FAILED",
                message = "Veritabanı kayıt hatası. Lütfen tekrar deneyin.",
                detail = detail
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Access key creation failed for client {PublicUserId}", request.PublicUserId);
            return StatusCode(500, new { message = $"Key oluşturulamadı: {ex.Message}" });
        }
    }

    /// <summary>
    /// Extend an existing access key's end date
    /// </summary>
    [HttpPost("clients/{clientId:guid}/access-keys/{keyId:guid}/extend")]
    public async Task<IActionResult> ExtendAccessKey(
        Guid clientId,
        Guid keyId,
        [FromBody] ExtendAccessKeyRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // IDOR Prevention: Verify dietitian owns this client
        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value &&
                                     l.ClientId == clientId &&
                                     l.IsActive);

        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found or not linked to this dietitian"));

        // Find the access key
        var accessKey = await _appDb.AccessKeys
            .FirstOrDefaultAsync(k => k.Id == keyId &&
                                     k.DietitianId == user.LinkedDietitianId.Value &&
                                     k.ClientId == clientId);

        if (accessKey == null)
            return NotFound(ApiProblems.NotFound("KEY_NOT_FOUND", "Access key not found"));

        // Parse and validate extension months
        if (request.ExtensionMonths < 1 || request.ExtensionMonths > 12)
        {
            return BadRequest(ApiProblems.Validation("INVALID_EXTENSION",
                "Extension must be between 1 and 12 months"));
        }

        // Calculate new end date
        var newEndDate = accessKey.ExpiresAtUtc.AddMonths(request.ExtensionMonths);

        try
        {
            // Extend the key
            accessKey.Extend(newEndDate);

            // Update client's program end date if this is the active key
            var client = await _appDb.Clients.FindAsync(clientId);
            if (client != null && client.IsPremium && client.ProgramEndDate == accessKey.ExpiresAtUtc)
            {
                client.ActivatePremium(user.LinkedDietitianId.Value, client.ProgramStartDate ?? DateTime.UtcNow, newEndDate);
            }

            // Audit log
            var audit = new PremiumAuditLog(
                Guid.NewGuid(),
                clientId,
                user.LinkedDietitianId,
                "Extended",
                DateTime.UtcNow,
                System.Text.Json.JsonSerializer.Serialize(new
                {
                    keyId,
                    extensionMonths = request.ExtensionMonths,
                    oldEndDate = accessKey.ExpiresAtUtc.AddMonths(-request.ExtensionMonths),
                    newEndDate
                }));

            _appDb.PremiumAuditLogs.Add(audit);
            await _appDb.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                keyId,
                newEndDate = newEndDate.ToString("yyyy-MM-dd"),
                extensionMonths = request.ExtensionMonths
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiProblems.Validation("EXTEND_FAILED", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extend access key {KeyId}", keyId);
            return StatusCode(500, ApiProblems.InternalServerError("EXTEND_FAILED", "Failed to extend access key"));
        }
    }

    private static string GenerateAccessKey()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 12)
            .Select(_ => chars[random.Next(chars.Length)])
            .ToArray());
    }

    /// <summary>Maps raw internal activity type strings to frontend-recognizable types.</summary>
    private static string MapActivityType(string raw) => raw?.ToLowerInvariant() switch
    {
        "meal_done" or "meal_completed"           => "meal_logged",
        "measurement_logged" or "weight_update"   => "weight_update",
        "badge_earned" or "badge_unlocked"         => "badge_unlocked",
        "streak_increased" or "streak_milestone"  => "streak_milestone",
        "streak_broken" or "streak_at_risk"       => "streak_at_risk",
        "plan_assigned" or "plan_started"         => "plan_assigned",
        "compliance" or "day_fully_completed"     => "compliance",
        "app_open" or "login"                     => "login",
        _                                         => raw ?? "unknown"
    };
}

// DTOs
[JsonConverter(typeof(MyDietitianMobileApp.Api.Json.CreateAccessKeyRequestJsonConverter))]
public record CreateAccessKeyRequest(string PublicUserId, string CreatedAtUtc, string ExpiresAtUtc);
public record CreateAccessKeyForClientRequest(string CreatedAtUtc, string ExpiresAtUtc);
public record ExtendAccessKeyRequest(int ExtensionMonths);
public record AddClientNoteRequest(string Text);
public record DietitianAddMeasurementRequest(
    decimal? WeightKg,
    decimal? HeightCm,
    decimal? BodyFatPercent,
    decimal? MusclePercent,
    decimal? WaterPercent,
    decimal? WaistCm,
    decimal? HipCm,
    decimal? ChestCm,
    string? Notes,
    bool IsClinicallyVerified = true,
    DateTime? RecordedAtUtc = null);
