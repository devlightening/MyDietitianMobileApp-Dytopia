using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Api.Realtime;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client")]
public class ClientCareController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientGamificationService _gamificationService;
    private readonly ISyncEventPublisher _syncPublisher;

    public ClientCareController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService,
        IClientGamificationService gamificationService,
        ISyncEventPublisher syncPublisher)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
        _gamificationService = gamificationService;
        _syncPublisher = syncPublisher;
    }

    [HttpGet("messages")]
    public async Task<IActionResult> GetMessages()
    {
        var access = await ResolvePremiumClientAsync();
        if (access.ErrorResult != null)
            return access.ErrorResult;

        var dietitian = access.ActiveDietitianId.HasValue
            ? await _appDb.Dietitians.AsNoTracking().FirstOrDefaultAsync(x => x.Id == access.ActiveDietitianId.Value)
            : null;

        var notes = await _appDb.DietitianNotes
            .AsNoTracking()
            .Where(x => x.ClientId == access.ClientId && x.DietitianId == access.ActiveDietitianId)
            .Select(x => new
            {
                id = x.Id,
                kind = "dietitian_note",
                direction = "inbound",
                text = x.Text,
                createdAtUtc = x.CreatedAtUtc,
                isRead = true
            })
            .ToListAsync();

        var messages = await _appDb.ClientCareMessages
            .AsNoTracking()
            .Where(x => x.ClientId == access.ClientId && x.DietitianId == access.ActiveDietitianId)
            .Select(x => new
            {
                id = x.Id,
                kind = x.SenderRole == "Dietitian" ? "dietitian_reply" : "client_message",
                direction = x.SenderRole == "Dietitian" ? "inbound" : "outbound",
                text = x.Text,
                createdAtUtc = x.CreatedAtUtc,
                isRead = x.SenderRole == "Dietitian" ? true : x.ReadAtUtc != null
            })
            .ToListAsync();

        var items = notes.Concat(messages)
            .OrderByDescending(x => x.createdAtUtc)
            .ToList();

        return Ok(new
        {
            activeDietitian = dietitian == null ? null : new
            {
                id = dietitian.Id,
                name = dietitian.FullName,
                clinicName = dietitian.ClinicName
            },
            items
        });
    }

    [HttpPost("messages")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> SendMessage([FromBody] SendClientCareMessageRequest request)
    {
        var access = await ResolvePremiumClientAsync();
        if (access.ErrorResult != null)
            return access.ErrorResult;

        if (string.IsNullOrWhiteSpace(request.Text) || request.Text.Trim().Length < 2)
            return BadRequest(ApiProblems.Validation("INVALID_MESSAGE", "Mesaj en az 2 karakter olmali."));

        var message = new ClientCareMessage(
            access.ClientId,
            access.ActiveDietitianId,
            "Client",
            request.Text);

        _appDb.ClientCareMessages.Add(message);
        await _appDb.SaveChangesAsync();
        await _gamificationService.TrackEventAsync(
            access.ClientId,
            true,
            access.ActiveDietitianId,
            ClientGamificationService.EventTypes.CareMessageSent,
            new { message.Id });
        if (access.ActiveDietitianId.HasValue)
        {
            await _syncPublisher.PublishToLinkAsync(access.ActiveDietitianId.Value, access.ClientId, "care.thread.updated", new
            {
                clientId = access.ClientId,
                source = "message"
            });

            await _syncPublisher.PublishToLinkAsync(access.ActiveDietitianId.Value, access.ClientId, "gamification.summary.updated", new
            {
                clientId = access.ClientId,
                source = "care"
            });
        }

        return Ok(new
        {
            item = new
            {
                id = message.Id,
                kind = "client_message",
                direction = "outbound",
                text = message.Text,
                createdAtUtc = message.CreatedAtUtc,
                isRead = false
            }
        });
    }

    [HttpGet("appointments")]
    public async Task<IActionResult> GetAppointments()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var visibleFromUtc = DateTime.UtcNow.AddDays(-1);
        var appointments = await _appDb.ClientAppointmentSummaries
            .AsNoTracking()
            .Where(x => x.ClientId == identity.Value.clientId && !x.IsCancelled && x.ScheduledAtUtc >= visibleFromUtc)
            .OrderBy(x => x.ScheduledAtUtc)
            .Take(8)
            .Select(x => new
            {
                id = x.Id,
                title = x.Title,
                scheduledAtUtc = x.ScheduledAtUtc,
                mode = x.Mode,
                location = x.Location,
                note = x.Note,
                attendanceStatus = x.AttendanceStatus,
                attendanceMarkedAtUtc = x.AttendanceMarkedAtUtc
            })
            .ToListAsync();

        return Ok(new { items = appointments });
    }

    [HttpPost("appointments/{appointmentId:guid}/attendance")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> MarkAppointmentAttendance(Guid appointmentId, [FromBody] MarkAppointmentAttendanceRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var appointment = await _appDb.ClientAppointmentSummaries
            .FirstOrDefaultAsync(x => x.Id == appointmentId && x.ClientId == identity.Value.clientId && !x.IsCancelled);

        if (appointment == null)
            return NotFound(ApiProblems.NotFound("APPOINTMENT_NOT_FOUND", "Gorusme bulunamadi."));

        if (appointment.ScheduledAtUtc > DateTime.UtcNow)
            return BadRequest(ApiProblems.Validation("APPOINTMENT_TOO_EARLY", "Gorusme saati gelmeden durum secilemez."));

        var normalizedStatus = string.IsNullOrWhiteSpace(request.Status)
            ? ClientAppointmentSummary.AttendancePending
            : request.Status.Trim().ToLowerInvariant();

        if (normalizedStatus != ClientAppointmentSummary.AttendanceAttended &&
            normalizedStatus != ClientAppointmentSummary.AttendanceMissed)
        {
            return BadRequest(ApiProblems.Validation("INVALID_ATTENDANCE_STATUS", "Gecersiz gorusme durumu."));
        }

        appointment.MarkAttendance(normalizedStatus);

        var attendanceText = normalizedStatus == ClientAppointmentSummary.AttendanceAttended
            ? $"Gorusmeye gittim: {appointment.Title}"
            : $"Gorusmeye gidemedim: {appointment.Title}";

        var timelineItem = new ClientCareMessage(
            identity.Value.clientId,
            appointment.DietitianId,
            "Client",
            attendanceText);

        _appDb.ClientCareMessages.Add(timelineItem);
        await _appDb.SaveChangesAsync();

        if (appointment.DietitianId.HasValue)
        {
            await _syncPublisher.PublishToLinkAsync(appointment.DietitianId.Value, identity.Value.clientId, "care.thread.updated", new
            {
                clientId = identity.Value.clientId,
                source = "appointment-attendance"
            });
        }

        return Ok(new
        {
            appointment = new
            {
                id = appointment.Id,
                title = appointment.Title,
                scheduledAtUtc = appointment.ScheduledAtUtc,
                mode = appointment.Mode,
                location = appointment.Location,
                note = appointment.Note,
                attendanceStatus = appointment.AttendanceStatus,
                attendanceMarkedAtUtc = appointment.AttendanceMarkedAtUtc
            },
            item = new
            {
                id = timelineItem.Id,
                kind = "client_message",
                direction = "outbound",
                text = timelineItem.Text,
                createdAtUtc = timelineItem.CreatedAtUtc,
                isRead = false
            }
        });
    }

    private async Task<(Guid ClientId, Guid? ActiveDietitianId, IActionResult? ErrorResult)> ResolvePremiumClientAsync()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return (Guid.Empty, null, Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi.")));

        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId, CancellationToken.None);
        if (!premium.IsPremium || !premium.ActiveDietitianId.HasValue)
            return (identity.Value.clientId, null, StatusCode(403, ApiProblems.PremiumRequired("Care hub aktif bir premium baglantisi gerektirir.")));

        return (identity.Value.clientId, premium.ActiveDietitianId, null);
    }
}

public sealed record SendClientCareMessageRequest(string Text);
public sealed record MarkAppointmentAttendanceRequest(string Status);
