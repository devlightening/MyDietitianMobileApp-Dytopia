using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Api.Realtime;
using System.Security.Claims;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client progress tracking endpoints (free tier, no premium required)
/// </summary>
[Authorize]
[ApiController]
[Route("api/client")]
public class ClientProgressController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientGamificationService _gamificationService;
    private readonly ILogger<ClientProgressController> _logger;
    private readonly ISyncEventPublisher _syncPublisher;

    public ClientProgressController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService,
        IClientGamificationService gamificationService,
        ILogger<ClientProgressController> logger,
        ISyncEventPublisher syncPublisher)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
        _gamificationService = gamificationService;
        _logger = logger;
        _syncPublisher = syncPublisher;
    }

    /// <summary>
    /// Get today's tracking data (returns defaults if missing)
    /// </summary>
    [HttpGet("tracking/today")]
    public async Task<IActionResult> GetTodayTracking()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var tracking = await _appDb.ClientDailyTrackings
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.ClientId == clientId && t.Date == today);

        if (tracking == null)
        {
            return Ok(new
            {
                date = today.ToString("yyyy-MM-dd"),
                waterGlasses = 0,
                steps = 0,
                notes = (string?)null
            });
        }

        return Ok(new
        {
            date = tracking.Date.ToString("yyyy-MM-dd"),
            waterGlasses = tracking.WaterGlasses,
            steps = tracking.Steps,
            notes = tracking.Notes
        });
    }

    /// <summary>
    /// Update today's tracking data (upsert)
    /// </summary>
    [HttpPut("tracking/today")]
    [EnableRateLimiting("progress-write")]
    public async Task<IActionResult> UpdateTodayTracking([FromBody] UpdateTrackingRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Validation
        if (request.WaterGlasses < 0 || request.WaterGlasses > 50)
            return BadRequest(ApiProblems.Validation("INVALID_WATER_GLASSES", "Su bardağı sayısı 0-50 arasında olmalıdır"));

        if (request.Steps < 0)
            return BadRequest(ApiProblems.Validation("INVALID_STEPS", "Adım sayısı 0 veya daha büyük olmalıdır"));

        if (!string.IsNullOrEmpty(request.Notes) && request.Notes.Length > 500)
            return BadRequest(ApiProblems.Validation("INVALID_NOTES", "Notlar en fazla 500 karakter olabilir"));

        var tracking = await _appDb.ClientDailyTrackings
            .FirstOrDefaultAsync(t => t.ClientId == clientId && t.Date == today);

        if (tracking == null)
        {
            tracking = new ClientDailyTracking(clientId, today);
            _appDb.ClientDailyTrackings.Add(tracking);
        }

        tracking.Update(request.WaterGlasses, request.Steps, request.Notes);
        await _appDb.SaveChangesAsync();
        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId);
        if (request.WaterGlasses >= 8)
        {
            await _gamificationService.TrackEventAsync(
                clientId,
                premium.IsPremium,
                premium.ActiveDietitianId,
                ClientGamificationService.EventTypes.WaterGoalHit,
                new { request.WaterGlasses });
        }
        else
        {
            await _gamificationService.GetSummaryAsync(clientId, premium.IsPremium, premium.ActiveDietitianId);
        }
        await PublishClientMetricsAsync(clientId, premium.ActiveDietitianId, "tracking");

        return Ok(new
        {
            date = tracking.Date.ToString("yyyy-MM-dd"),
            waterGlasses = tracking.WaterGlasses,
            steps = tracking.Steps,
            notes = tracking.Notes
        });
    }

    /// <summary>
    /// Get tracking history for date range
    /// </summary>
    [HttpGet("tracking/history")]
    public async Task<IActionResult> GetTrackingHistory(
        [FromQuery] string? from = null,
        [FromQuery] string? to = null)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        DateOnly? fromDate = null;
        DateOnly? toDate = null;

        if (!string.IsNullOrEmpty(from) && DateOnly.TryParse(from, out var fd))
            fromDate = fd;
        if (!string.IsNullOrEmpty(to) && DateOnly.TryParse(to, out var td))
            toDate = td;

        var query = _appDb.ClientDailyTrackings
            .AsNoTracking()
            .Where(t => t.ClientId == clientId);

        if (fromDate.HasValue)
            query = query.Where(t => t.Date >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(t => t.Date <= toDate.Value);

        var trackings = await query
            .OrderBy(t => t.Date)
            .Select(t => new
            {
                date = t.Date.ToString("yyyy-MM-dd"),
                waterGlasses = t.WaterGlasses,
                steps = t.Steps,
                notes = t.Notes
            })
            .ToListAsync();

        return Ok(trackings);
    }

    /// <summary>
    /// Get weight entries with pagination
    /// </summary>
    [HttpGet("weights")]
    public async Task<IActionResult> GetWeights(
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        var query = _appDb.ClientWeightEntries
            .AsNoTracking()
            .Where(w => w.ClientId == clientId);

        if (!string.IsNullOrEmpty(from) && DateTime.TryParse(from, out var fromDt))
            query = query.Where(w => w.AtUtc >= fromDt);
        if (!string.IsNullOrEmpty(to) && DateTime.TryParse(to, out var toDt))
            query = query.Where(w => w.AtUtc <= toDt);

        var total = await query.CountAsync();

        var weights = await query
            .OrderByDescending(w => w.AtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(w => new
            {
                id = w.Id,
                atUtc = w.AtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                weightKg = w.WeightKg
            })
            .ToListAsync();

        return Ok(new { page, pageSize, total, weights });
    }

    /// <summary>
    /// Add weight entry
    /// </summary>
    [HttpPost("weights")]
    [EnableRateLimiting("progress-write")]
    public async Task<IActionResult> AddWeight([FromBody] AddWeightRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        if (request.WeightKg <= 0 || request.WeightKg > 500)
            return BadRequest(ApiProblems.Validation("INVALID_WEIGHT", "Kilo 0 ile 500 kg arasında olmalıdır"));

        var atUtc = request.AtUtc ?? DateTime.UtcNow;

        var entry = new ClientWeightEntry(clientId, atUtc, request.WeightKg);
        _appDb.ClientWeightEntries.Add(entry);
        await _appDb.SaveChangesAsync();
        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId);
        await PublishClientMetricsAsync(clientId, premium.ActiveDietitianId, "weight");

        return CreatedAtAction(nameof(GetWeights), new { id = entry.Id }, new
        {
            id = entry.Id,
            atUtc = entry.AtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            weightKg = entry.WeightKg
        });
    }

    /// <summary>
    /// Delete weight entry
    /// </summary>
    [HttpDelete("weights/{id:guid}")]
    [EnableRateLimiting("progress-write")]
    public async Task<IActionResult> DeleteWeight(Guid id)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        var entry = await _appDb.ClientWeightEntries
            .FirstOrDefaultAsync(w => w.Id == id && w.ClientId == clientId);

        if (entry == null)
            return NotFound(ApiProblems.NotFound("WEIGHT_NOT_FOUND", "Kilo kaydı bulunamadı"));

        _appDb.ClientWeightEntries.Remove(entry);
        await _appDb.SaveChangesAsync();
        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId);
        await PublishClientMetricsAsync(clientId, premium.ActiveDietitianId, "weight");

        return NoContent();
    }

    /// <summary>
    /// Get measurement history (paginated), newest first.
    /// Returns unified ClientMeasurement records (weight + body measurements in one record).
    /// </summary>
    [HttpGet("measurements")]
    public async Task<IActionResult> GetMeasurements(
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        var query = _appDb.ClientMeasurements
            .AsNoTracking()
            .Where(m => m.ClientId == clientId);

        if (!string.IsNullOrEmpty(from) && DateTime.TryParse(from, out var fromDt))
            query = query.Where(m => m.RecordedAtUtc >= fromDt);
        if (!string.IsNullOrEmpty(to) && DateTime.TryParse(to, out var toDt))
            query = query.Where(m => m.RecordedAtUtc <= toDt);

        var total = await query.CountAsync();

        var measurements = await query
            .OrderByDescending(m => m.RecordedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new
            {
                id            = m.Id,
                recordedAtUtc = m.RecordedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                sourceType    = m.SourceType,
                weightKg      = m.WeightKg,
                heightCm      = m.HeightCm,
                bodyFatPercent= m.BodyFatPercent,
                musclePercent = m.MusclePercent,
                waterPercent  = m.WaterPercent,
                waistCm       = m.WaistCm,
                hipCm         = m.HipCm,
                chestCm       = m.ChestCm,
                bmi           = m.Bmi,
                bmiCategory   = m.BmiCategory,
                bmr           = m.Bmr,
                waistHipRatio = m.WaistHipRatio,
                notes         = m.Notes,
                isClinicallyVerified = m.IsClinicallyVerified,
            })
            .ToListAsync();

        return Ok(new { page, pageSize, total, measurements });
    }

    /// <summary>
    /// Get the single most recent measurement for the current client.
    /// Used by the mobile summary card on the measurements screen.
    /// </summary>
    [HttpGet("measurements/latest")]
    public async Task<IActionResult> GetLatestMeasurement()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        var m = await _appDb.ClientMeasurements
            .AsNoTracking()
            .Where(m => m.ClientId == clientId)
            .OrderByDescending(m => m.RecordedAtUtc)
            .Select(m => new
            {
                id            = m.Id,
                recordedAtUtc = m.RecordedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                sourceType    = m.SourceType,
                weightKg      = m.WeightKg,
                heightCm      = m.HeightCm,
                bodyFatPercent= m.BodyFatPercent,
                musclePercent = m.MusclePercent,
                waterPercent  = m.WaterPercent,
                waistCm       = m.WaistCm,
                hipCm         = m.HipCm,
                chestCm       = m.ChestCm,
                bmi           = m.Bmi,
                bmiCategory   = m.BmiCategory,
                bmr           = m.Bmr,
                waistHipRatio = m.WaistHipRatio,
                notes         = m.Notes,
                isClinicallyVerified = m.IsClinicallyVerified,
            })
            .FirstOrDefaultAsync();

        if (m == null)
            return Ok(new { measurement = (object?)null });

        return Ok(new { measurement = m });
    }

    /// <summary>
    /// Record a new measurement (self-reported by client: sourceType = "client").
    /// Accepts weight, body fat %, circumferences, etc. At least one metric required.
    /// </summary>
    [HttpPost("measurements")]
    [EnableRateLimiting("progress-write")]
    public async Task<IActionResult> AddMeasurement([FromBody] AddMeasurementRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        // At least one metric must be present
        if (!request.WeightKg.HasValue && !request.HeightCm.HasValue &&
            !request.BodyFatPercent.HasValue && !request.WaistCm.HasValue &&
            !request.HipCm.HasValue && !request.ChestCm.HasValue)
        {
            return BadRequest(ApiProblems.Validation("MEASUREMENT_EMPTY",
                "En az bir ölçüm değeri girilmelidir."));
        }

        // Try to compute BMR from client profile
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
                    client.BirthDate.Year > 0
                        ? DateTime.UtcNow.Year - client.BirthDate.Year
                        : null,
                    (int)client.Gender);
        }
        catch { /* BMR is optional — never fail the save */ }

        var entry = new ClientMeasurement(
            clientId:           clientId,
            sourceType:         "client",
            recordedByUserId:   identity.Value.userId,
            recordedAtUtc:      request.RecordedAtUtc,
            weightKg:           request.WeightKg,
            heightCm:           request.HeightCm,
            bodyFatPercent:     request.BodyFatPercent,
            musclePercent:      request.MusclePercent,
            waterPercent:       request.WaterPercent,
            waistCm:            request.WaistCm,
            hipCm:              request.HipCm,
            chestCm:            request.ChestCm,
            bmr:                bmr,
            notes:              request.Notes,
            isClinicallyVerified: false);

        _appDb.ClientMeasurements.Add(entry);

        // Write a ClientActivity event so it surfaces in the dietitian's activity feed
        _appDb.ClientActivities.Add(new ClientActivity(
            clientId,
            dietitianId: null,
            type: "measurement_logged",
            metadata: new { weightKg = entry.WeightKg, bmi = entry.Bmi, sourceType = "client" }));

        await _appDb.SaveChangesAsync();

        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId);
        await _gamificationService.TrackEventAsync(
            clientId,
            premium.IsPremium,
            premium.ActiveDietitianId,
            ClientGamificationService.EventTypes.MeasurementLogged,
            new { entry.Id });
        await PublishClientMetricsAsync(clientId, premium.ActiveDietitianId, "measurement");

        return CreatedAtAction(nameof(GetMeasurements), new { id = entry.Id }, new
        {
            id            = entry.Id,
            recordedAtUtc = entry.RecordedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            sourceType    = entry.SourceType,
            weightKg      = entry.WeightKg,
            heightCm      = entry.HeightCm,
            bmi           = entry.Bmi,
            bmiCategory   = entry.BmiCategory,
            bmr           = entry.Bmr,
            waistCm       = entry.WaistCm,
            hipCm         = entry.HipCm,
            chestCm       = entry.ChestCm,
            waistHipRatio = entry.WaistHipRatio,
        });
    }

    /// <summary>
    /// Delete a measurement entry (client can only delete their own records).
    /// </summary>
    [HttpDelete("measurements/{id:guid}")]
    [EnableRateLimiting("progress-write")]
    public async Task<IActionResult> DeleteMeasurement(Guid id)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        var entry = await _appDb.ClientMeasurements
            .FirstOrDefaultAsync(m => m.Id == id && m.ClientId == clientId);

        if (entry == null)
            return NotFound(ApiProblems.NotFound("MEASUREMENT_NOT_FOUND", "Ölçüm kaydı bulunamadı"));

        _appDb.ClientMeasurements.Remove(entry);
        await _appDb.SaveChangesAsync();

        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId);
        await PublishClientMetricsAsync(clientId, premium.ActiveDietitianId, "measurement");

        return NoContent();
    }

    private async Task PublishClientMetricsAsync(Guid clientId, Guid? dietitianId, string source)
    {
        if (!dietitianId.HasValue)
            return;

        await _syncPublisher.PublishToLinkAsync(dietitianId.Value, clientId, "client.metrics.updated", new
        {
            clientId,
            source
        });

        await _syncPublisher.PublishToLinkAsync(dietitianId.Value, clientId, "gamification.summary.updated", new
        {
            clientId,
            source
        });
    }
}

public record UpdateTrackingRequest(int WaterGlasses, int Steps, string? Notes);
public record AddWeightRequest(decimal WeightKg, DateTime? AtUtc = null);
public record AddMeasurementRequest(
    decimal? WeightKg,
    decimal? HeightCm,
    decimal? BodyFatPercent,
    decimal? MusclePercent,
    decimal? WaterPercent,
    decimal? WaistCm,
    decimal? HipCm,
    decimal? ChestCm,
    string? Notes,
    DateTime? RecordedAtUtc = null);
