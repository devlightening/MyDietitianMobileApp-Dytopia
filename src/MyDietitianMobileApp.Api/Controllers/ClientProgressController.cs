using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Problems;
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
    private readonly ILogger<ClientProgressController> _logger;

    public ClientProgressController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver,
        ILogger<ClientProgressController> logger)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
        _logger = logger;
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

        return NoContent();
    }

    /// <summary>
    /// Get measurement entries with pagination
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

        var query = _appDb.ClientMeasurementEntries
            .AsNoTracking()
            .Where(m => m.ClientId == clientId);

        if (!string.IsNullOrEmpty(from) && DateTime.TryParse(from, out var fromDt))
            query = query.Where(m => m.AtUtc >= fromDt);
        if (!string.IsNullOrEmpty(to) && DateTime.TryParse(to, out var toDt))
            query = query.Where(m => m.AtUtc <= toDt);

        var total = await query.CountAsync();

        var measurements = await query
            .OrderByDescending(m => m.AtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new
            {
                id = m.Id,
                atUtc = m.AtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                waistCm = m.WaistCm,
                hipCm = m.HipCm,
                chestCm = m.ChestCm
            })
            .ToListAsync();

        return Ok(new { page, pageSize, total, measurements });
    }

    /// <summary>
    /// Add measurement entry
    /// </summary>
    [HttpPost("measurements")]
    [EnableRateLimiting("progress-write")]
    public async Task<IActionResult> AddMeasurement([FromBody] AddMeasurementRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        var atUtc = request.AtUtc ?? DateTime.UtcNow;

        var entry = new ClientMeasurementEntry(clientId, atUtc, request.WaistCm, request.HipCm, request.ChestCm);
        _appDb.ClientMeasurementEntries.Add(entry);
        await _appDb.SaveChangesAsync();

        return CreatedAtAction(nameof(GetMeasurements), new { id = entry.Id }, new
        {
            id = entry.Id,
            atUtc = entry.AtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            waistCm = entry.WaistCm,
            hipCm = entry.HipCm,
            chestCm = entry.ChestCm
        });
    }

    /// <summary>
    /// Delete measurement entry
    /// </summary>
    [HttpDelete("measurements/{id:guid}")]
    [EnableRateLimiting("progress-write")]
    public async Task<IActionResult> DeleteMeasurement(Guid id)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (_, clientId, _) = identity.Value;

        var entry = await _appDb.ClientMeasurementEntries
            .FirstOrDefaultAsync(m => m.Id == id && m.ClientId == clientId);

        if (entry == null)
            return NotFound(ApiProblems.NotFound("MEASUREMENT_NOT_FOUND", "Ölçüm kaydı bulunamadı"));

        _appDb.ClientMeasurementEntries.Remove(entry);
        await _appDb.SaveChangesAsync();

        return NoContent();
    }
}

public record UpdateTrackingRequest(int WaterGlasses, int Steps, string? Notes);
public record AddWeightRequest(decimal WeightKg, DateTime? AtUtc = null);
public record AddMeasurementRequest(decimal? WaistCm, decimal? HipCm, decimal? ChestCm, DateTime? AtUtc = null);
