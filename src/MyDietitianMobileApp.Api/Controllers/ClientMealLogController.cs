using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client meal log (photo journal) endpoints.
/// GET /api/client/meal-logs        — list today's logs
/// POST /api/client/meal-logs       — add a new log entry
/// DELETE /api/client/meal-logs/{id} — remove a log entry
/// </summary>
[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client/meal-logs")]
public class ClientMealLogController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;

    public ClientMealLogController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
    }

    // GET /api/client/meal-logs?date=YYYY-MM-DD
    [HttpGet]
    public async Task<IActionResult> GetLogs([FromQuery] string? date)
    {
        var (clientId, err) = await RequireClientAsync();
        if (err != null) return err;

        DateOnly queryDate;
        if (string.IsNullOrEmpty(date) || !DateOnly.TryParse(date, out queryDate))
            queryDate = DateOnly.FromDateTime(DateTime.UtcNow);

        var logs = await _appDb.ClientMealLogs
            .Where(l => l.ClientId == clientId!.Value && l.Date == queryDate)
            .OrderBy(l => l.CreatedAtUtc)
            .Select(l => new
            {
                l.Id,
                l.Date,
                l.MealType,
                l.Notes,
                l.PhotoUrl,
                l.CreatedAtUtc,
            })
            .ToListAsync();

        return Ok(new { logs });
    }

    // POST /api/client/meal-logs
    [HttpPost]
    public async Task<IActionResult> CreateLog([FromBody] CreateMealLogRequest req)
    {
        var (clientId, err) = await RequireClientAsync();
        if (err != null) return err;

        var date = req.Date.HasValue
            ? DateOnly.FromDateTime(req.Date.Value)
            : DateOnly.FromDateTime(DateTime.UtcNow);

        var log = new ClientMealLog(clientId!.Value, date, req.MealType ?? "Snack", req.Notes, req.PhotoUrl);
        _appDb.ClientMealLogs.Add(log);
        await _appDb.SaveChangesAsync();

        return Created($"/api/client/meal-logs/{log.Id}", new
        {
            log.Id,
            log.Date,
            log.MealType,
            log.Notes,
            log.PhotoUrl,
            log.CreatedAtUtc,
        });
    }

    // DELETE /api/client/meal-logs/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteLog(Guid id)
    {
        var (clientId, err) = await RequireClientAsync();
        if (err != null) return err;

        var log = await _appDb.ClientMealLogs
            .FirstOrDefaultAsync(l => l.Id == id && l.ClientId == clientId!.Value);

        if (log == null) return NotFound(new { message = "Kayıt bulunamadı." });

        _appDb.ClientMealLogs.Remove(log);
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    private async Task<(Guid? clientId, IActionResult? error)> RequireClientAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return (null, Unauthorized());

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userGuid);
        if (user?.LinkedClientId == null)
            return (null, Unauthorized());

        return (user.LinkedClientId, null);
    }
}

public record CreateMealLogRequest(string? MealType, string? Notes, string? PhotoUrl, DateTime? Date);
