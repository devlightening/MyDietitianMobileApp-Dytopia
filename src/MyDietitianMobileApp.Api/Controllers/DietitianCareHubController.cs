using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Globalization;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize("Dietitian")]
[ApiController]
[Route("api/dietitian/care-hub")]
public class DietitianCareHubController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;

    public DietitianCareHubController(AppDbContext appDb, AuthDbContext authDb)
    {
        _appDb = appDb;
        _authDb = authDb;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int limit = 8)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabi bulunamadi."));

        var safeLimit = Math.Clamp(limit, 1, 24);

        var links = await _appDb.DietitianClientLinks
            .AsNoTracking()
            .Where(x => x.DietitianId == dietitianId.Value && x.IsActive && x.UnlinkedAt == null)
            .Join(
                _appDb.Clients.AsNoTracking(),
                link => link.ClientId,
                client => client.Id,
                (link, client) => new
                {
                    clientId = client.Id,
                    clientName = client.FullName,
                    clientEmail = client.Email,
                    publicUserId = link.PublicUserId,
                    linkedAt = link.LinkedAt
                })
            .ToListAsync();

        var clientIds = links.Select(x => x.clientId).Distinct().ToList();
        if (clientIds.Count == 0)
        {
            return Ok(new
            {
                unreadMessagesCount = 0,
                clientsWithUnreadCount = 0,
                totalThreads = 0,
                threads = Array.Empty<object>()
            });
        }

        var unreadCounts = await _appDb.ClientCareMessages
            .AsNoTracking()
            .Where(x =>
                x.DietitianId == dietitianId.Value &&
                clientIds.Contains(x.ClientId) &&
                x.SenderRole != "Dietitian" &&
                x.ReadAtUtc == null)
            .GroupBy(x => x.ClientId)
            .Select(g => new { clientId = g.Key, count = g.Count() })
            .ToListAsync();

        var latestMessages = await _appDb.ClientCareMessages
            .AsNoTracking()
            .Where(x => x.DietitianId == dietitianId.Value && clientIds.Contains(x.ClientId))
            .Select(x => new
            {
                clientId = x.ClientId,
                text = x.Text,
                createdAtUtc = x.CreatedAtUtc,
                direction = x.SenderRole == "Dietitian" ? "outbound" : "inbound",
                source = x.SenderRole == "Dietitian" ? "reply" : "message"
            })
            .ToListAsync();

        var latestNotes = await _appDb.DietitianNotes
            .AsNoTracking()
            .Where(x => x.DietitianId == dietitianId.Value && clientIds.Contains(x.ClientId))
            .Select(x => new
            {
                clientId = x.ClientId,
                text = x.Text,
                createdAtUtc = x.CreatedAtUtc,
                direction = "outbound",
                source = "note"
            })
            .ToListAsync();

        var upcomingAppointments = await _appDb.ClientAppointmentSummaries
            .AsNoTracking()
            .Where(x =>
                x.DietitianId == dietitianId.Value &&
                clientIds.Contains(x.ClientId) &&
                !x.IsCancelled &&
                x.ScheduledAtUtc >= DateTime.UtcNow)
            .GroupBy(x => x.ClientId)
            .Select(g => g.OrderBy(x => x.ScheduledAtUtc).Select(x => new
            {
                clientId = x.ClientId,
                title = x.Title,
                scheduledAtUtc = x.ScheduledAtUtc
            }).First())
            .ToListAsync();

        var unreadMap = unreadCounts.ToDictionary(x => x.clientId, x => x.count);
        var latestByClient = latestMessages
            .Concat(latestNotes)
            .GroupBy(x => x.clientId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(x => x.createdAtUtc).First());
        var appointmentMap = upcomingAppointments.ToDictionary(x => x.clientId, x => x);

        var threads = links
            .Select(link =>
            {
                latestByClient.TryGetValue(link.clientId, out var latest);
                unreadMap.TryGetValue(link.clientId, out var unreadCount);
                appointmentMap.TryGetValue(link.clientId, out var appointment);

                return new
                {
                    clientId = link.clientId,
                    clientName = string.IsNullOrWhiteSpace(link.clientName) ? "Danisan" : link.clientName,
                    clientEmail = link.clientEmail,
                    publicUserId = link.publicUserId,
                    unreadCount,
                    hasUnread = unreadCount > 0,
                    latestText = latest?.text,
                    latestAtUtc = latest?.createdAtUtc ?? link.linkedAt,
                    latestDirection = latest?.direction ?? "system",
                    latestSource = latest?.source ?? "linked",
                    nextAppointmentTitle = appointment?.title,
                    nextAppointmentAtUtc = appointment?.scheduledAtUtc
                };
            })
            .OrderByDescending(x => x.hasUnread)
            .ThenByDescending(x => x.latestAtUtc)
            .Take(safeLimit)
            .ToList();

        return Ok(new
        {
            unreadMessagesCount = unreadCounts.Sum(x => x.count),
            clientsWithUnreadCount = unreadCounts.Count,
            totalThreads = links.Count,
            threads
        });
    }

    [HttpGet("/api/dietitian/appointments")]
    public async Task<IActionResult> GetAllAppointments(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] Guid? clientId,
        [FromQuery] int limit = 100)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabi bulunamadi."));

        var fromUtc = TryParseUtcDateTime(from, out var parsedFrom)
            ? parsedFrom
            : DateTime.UtcNow.Date;

        var toUtc = TryParseUtcDateTime(to, out var parsedTo)
            ? parsedTo
            : fromUtc.AddDays(90);

        var safeLimit = Math.Clamp(limit, 1, 200);

        var query = _appDb.ClientAppointmentSummaries
            .AsNoTracking()
            .Where(x =>
                x.DietitianId == dietitianId.Value &&
                x.ScheduledAtUtc >= fromUtc &&
                x.ScheduledAtUtc <= toUtc);

        if (clientId.HasValue)
            query = query.Where(x => x.ClientId == clientId.Value);

        var appointments = await query
            .OrderBy(x => x.ScheduledAtUtc)
            .Take(safeLimit)
            .Select(x => new
            {
                id = x.Id,
                clientId = x.ClientId,
                title = x.Title,
                scheduledAtUtc = x.ScheduledAtUtc,
                mode = x.Mode,
                location = x.Location,
                note = x.Note,
                attendanceStatus = x.AttendanceStatus,
                isCancelled = x.IsCancelled
            })
            .ToListAsync();

        var clientIds = appointments.Select(x => x.clientId).Distinct().ToList();
        var clientNames = await _appDb.Clients
            .AsNoTracking()
            .Where(x => clientIds.Contains(x.Id))
            .Select(x => new { x.Id, x.FullName })
            .ToDictionaryAsync(x => x.Id, x => x.FullName);

        var items = appointments.Select(a => new
        {
            a.id,
            a.clientId,
            clientName = clientNames.TryGetValue(a.clientId, out var name) ? name : "Danisan",
            a.title,
            a.scheduledAtUtc,
            a.mode,
            a.location,
            a.note,
            a.attendanceStatus,
            a.isCancelled
        }).ToList();

        return Ok(new { items });
    }

    private async Task<Guid?> GetDietitianIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return null;

        var user = await _authDb.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == Guid.Parse(userId) && x.Role == "Dietitian");

        return user?.LinkedDietitianId;
    }

    private static bool TryParseUtcDateTime(string? value, out DateTime utcDateTime)
    {
        utcDateTime = default;
        if (string.IsNullOrWhiteSpace(value))
            return false;

        const DateTimeStyles styles = DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal;
        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, styles, out var dateTimeOffset))
        {
            utcDateTime = dateTimeOffset.UtcDateTime;
            return true;
        }

        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, styles, out var dateTime))
        {
            utcDateTime = DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);
            return true;
        }

        return false;
    }
}
