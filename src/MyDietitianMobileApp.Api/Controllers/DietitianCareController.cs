using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Api.Realtime;
using MyDietitianMobileApp.Api.Time;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Globalization;
using System.Text;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize("Dietitian")]
[ApiController]
[Route("api/dietitian/clients/{clientId:guid}/care")]
public class DietitianCareController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ISyncEventPublisher _syncPublisher;

    public DietitianCareController(AppDbContext appDb, AuthDbContext authDb, ISyncEventPublisher syncPublisher)
    {
        _appDb = appDb;
        _authDb = authDb;
        _syncPublisher = syncPublisher;
    }

    [HttpGet]
    public async Task<IActionResult> GetCareHub(Guid clientId)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabi bulunamadi."));

        var link = await ValidateLinkAsync(dietitianId.Value, clientId);
        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif baglantiniz yok."));

        var client = await _appDb.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == clientId);

        if (client == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client bulunamadi."));

        var unreadClientMessages = await _appDb.ClientCareMessages
            .Where(x =>
                x.ClientId == clientId &&
                x.DietitianId == dietitianId.Value &&
                x.SenderRole != "Dietitian" &&
                x.ReadAtUtc == null)
            .ToListAsync();

        if (unreadClientMessages.Count > 0)
        {
            foreach (var message in unreadClientMessages)
            {
                message.MarkRead();
            }

            await _appDb.SaveChangesAsync();
        }

        var notes = await _appDb.DietitianNotes
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && x.DietitianId == dietitianId.Value)
            .Select(x => new
            {
                id = x.Id,
                kind = "dietitian_note",
                author = "Dietitian",
                direction = "outbound",
                text = x.Text,
                createdAtUtc = x.CreatedAtUtc,
                isRead = true,
                replyToId = (Guid?)null,
                replyToSnippet = (string?)null
            })
            .ToListAsync();

        var messages = await _appDb.ClientCareMessages
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && x.DietitianId == dietitianId.Value)
            .Select(x => new
            {
                id = x.Id,
                kind = x.SenderRole == "Dietitian" ? "dietitian_reply" : "client_message",
                author = x.SenderRole == "Dietitian" ? "Dietitian" : "Client",
                direction = x.SenderRole == "Dietitian" ? "outbound" : "inbound",
                text = x.Text,
                createdAtUtc = x.CreatedAtUtc,
                isRead = x.SenderRole == "Dietitian" ? true : x.ReadAtUtc != null,
                replyToId = x.ReplyToId,
                replyToSnippet = x.ReplyToSnippet
            })
            .ToListAsync();

        var visibleFromUtc = DateTime.UtcNow.AddDays(-1);
        var appointments = await _appDb.ClientAppointmentSummaries
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && x.DietitianId == dietitianId.Value && !x.IsCancelled && x.ScheduledAtUtc >= visibleFromUtc)
            .OrderBy(x => x.ScheduledAtUtc)
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

        return Ok(new
        {
            client = new
            {
                id = client.Id,
                fullName = client.FullName,
                email = client.Email,
                publicUserId = link.PublicUserId
            },
            appointments,
            items = notes.Concat(messages).OrderByDescending(x => x.createdAtUtc).ToList()
        });
    }

    [HttpPost("replies")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> SendReply(Guid clientId, [FromBody] SendCareReplyRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabi bulunamadi."));

        var link = await ValidateLinkAsync(dietitianId.Value, clientId);
        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif baglantiniz yok."));

        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(ApiProblems.Validation("INVALID_REPLY", "Yanit metni bos olamaz."));

        var text = request.Text.Trim();
        if (text.Length > 2000)
            return BadRequest(ApiProblems.Validation("INVALID_REPLY", "Yanit metni en fazla 2000 karakter olabilir."));

        var reply = new ClientCareMessage(clientId, dietitianId.Value, "Dietitian", text,
            request.ReplyToId, request.ReplyToSnippet);
        _appDb.ClientCareMessages.Add(reply);
        await _appDb.SaveChangesAsync();
        await PublishCareUpdateAsync(dietitianId.Value, clientId, "reply");

        return Ok(new
        {
            item = new
            {
                id = reply.Id,
                kind = "dietitian_reply",
                author = "Dietitian",
                direction = "outbound",
                text = reply.Text,
                createdAtUtc = reply.CreatedAtUtc,
                isRead = true,
                replyToId = reply.ReplyToId,
                replyToSnippet = reply.ReplyToSnippet
            }
        });
    }

    [HttpPost("notes")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> CreateNote(Guid clientId, [FromBody] CreateCareNoteRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabi bulunamadi."));

        var link = await ValidateLinkAsync(dietitianId.Value, clientId);
        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif baglantiniz yok."));

        var text = string.IsNullOrWhiteSpace(request.Text) ? request.Content : request.Text;
        if (string.IsNullOrWhiteSpace(text))
            return BadRequest(ApiProblems.Validation("INVALID_TEXT", "Not metni bos olamaz."));

        if (text.Trim().Length > 2000)
            return BadRequest(ApiProblems.Validation("INVALID_TEXT", "Not metni en fazla 2000 karakter olabilir."));

        var note = new DietitianNote(dietitianId.Value, clientId, text);
        _appDb.DietitianNotes.Add(note);
        await _appDb.SaveChangesAsync();
        await PublishCareUpdateAsync(dietitianId.Value, clientId, "note");

        return Ok(new
        {
            item = new
            {
                id = note.Id,
                kind = "dietitian_note",
                author = "Dietitian",
                direction = "outbound",
                text = note.Text,
                createdAtUtc = note.CreatedAtUtc,
                isRead = true
            }
        });
    }

    [HttpPost("appointments")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> CreateAppointment(Guid clientId, [FromBody] CreateAppointmentRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabi bulunamadi."));

        var link = await ValidateLinkAsync(dietitianId.Value, clientId);
        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif baglantiniz yok."));

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(ApiProblems.Validation("INVALID_APPOINTMENT", "Gorusme basligi gereklidir."));

        if (!TryParseUtcDateTime(request.ScheduledAtUtc, out var scheduledAtUtc))
            return BadRequest(ApiProblems.Validation("INVALID_APPOINTMENT_TIME", "Gecersiz gorusme tarihi."));

        var client = await _appDb.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == clientId);

        if (client == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client bulunamadi."));

        var appointment = new ClientAppointmentSummary(
            clientId,
            dietitianId.Value,
            request.Title,
            scheduledAtUtc,
            request.Mode ?? "online",
            request.Location,
            request.Note);

        _appDb.ClientAppointmentSummaries.Add(appointment);
        _appDb.ClientCareMessages.Add(new ClientCareMessage(
            clientId,
            dietitianId.Value,
            "Dietitian",
            BuildAppointmentMessage(client.FullName, appointment, isUpdate: false)));
        await _appDb.SaveChangesAsync();
        await PublishCareUpdateAsync(dietitianId.Value, clientId, "appointment");

        return Ok(new
        {
            item = new
            {
                id = appointment.Id,
                title = appointment.Title,
                scheduledAtUtc = appointment.ScheduledAtUtc,
                mode = appointment.Mode,
                location = appointment.Location,
                note = appointment.Note,
                attendanceStatus = appointment.AttendanceStatus,
                attendanceMarkedAtUtc = appointment.AttendanceMarkedAtUtc
            }
        });
    }

    [HttpPut("appointments/{appointmentId:guid}")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> UpdateAppointment(Guid clientId, Guid appointmentId, [FromBody] UpdateAppointmentRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabi bulunamadi."));

        var link = await ValidateLinkAsync(dietitianId.Value, clientId);
        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif baglantiniz yok."));

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(ApiProblems.Validation("INVALID_APPOINTMENT", "Gorusme basligi gereklidir."));

        if (!TryParseUtcDateTime(request.ScheduledAtUtc, out var scheduledAtUtc))
            return BadRequest(ApiProblems.Validation("INVALID_APPOINTMENT_TIME", "Gecersiz gorusme tarihi."));

        var appointment = await _appDb.ClientAppointmentSummaries
            .FirstOrDefaultAsync(x => x.Id == appointmentId && x.ClientId == clientId && x.DietitianId == dietitianId.Value);

        if (appointment == null)
            return NotFound(ApiProblems.NotFound("APPOINTMENT_NOT_FOUND", "Gorusme bulunamadi."));

        if (appointment.IsCancelled)
            return BadRequest(ApiProblems.Validation("APPOINTMENT_CANCELLED", "Iptal edilmis gorusme guncellenemez."));

        appointment.UpdateDetails(request.Title, scheduledAtUtc, request.Mode ?? "online", request.Location, request.Note);
        var client = await _appDb.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == clientId);
        _appDb.ClientCareMessages.Add(new ClientCareMessage(
            clientId,
            dietitianId.Value,
            "Dietitian",
            BuildAppointmentMessage(client?.FullName, appointment, isUpdate: true)));
        await _appDb.SaveChangesAsync();
        await PublishCareUpdateAsync(dietitianId.Value, clientId, "appointment");

        return Ok(new
        {
            item = new
            {
                id = appointment.Id,
                clientId = appointment.ClientId,
                title = appointment.Title,
                scheduledAtUtc = appointment.ScheduledAtUtc,
                mode = appointment.Mode,
                location = appointment.Location,
                note = appointment.Note,
                attendanceStatus = appointment.AttendanceStatus,
                isCancelled = appointment.IsCancelled
            }
        });
    }

    [HttpDelete("appointments/{appointmentId:guid}")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> CancelAppointment(Guid clientId, Guid appointmentId)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabi bulunamadi."));

        var link = await ValidateLinkAsync(dietitianId.Value, clientId);
        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif baglantiniz yok."));

        var appointment = await _appDb.ClientAppointmentSummaries
            .FirstOrDefaultAsync(x => x.Id == appointmentId && x.ClientId == clientId && x.DietitianId == dietitianId.Value);

        if (appointment == null)
            return NotFound(ApiProblems.NotFound("APPOINTMENT_NOT_FOUND", "Gorusme bulunamadi."));

        appointment.Cancel();
        await _appDb.SaveChangesAsync();
        await PublishCareUpdateAsync(dietitianId.Value, clientId, "appointment");
        return NoContent();
    }

    private Task PublishCareUpdateAsync(Guid dietitianId, Guid clientId, string source)
    {
        return _syncPublisher.PublishToLinkAsync(dietitianId, clientId, "care.thread.updated", new
        {
            clientId,
            source
        });
    }

    private static string BuildAppointmentMessage(string? clientName, ClientAppointmentSummary appointment, bool isUpdate)
    {
        var localDateTime = AppTime.ToLocal(appointment.ScheduledAtUtc);
        var culture = new CultureInfo("tr-TR");
        var displayName = string.IsNullOrWhiteSpace(clientName) ? "danışanım" : clientName.Trim();
        var mode = FormatAppointmentMode(appointment.Mode);
        var actionText = isUpdate
            ? "randevu bilgilerinizi güncelledim"
            : "yeni randevunuzu oluşturdum";

        var builder = new StringBuilder();
        builder.AppendLine($"Merhaba {displayName}, {actionText}.");
        builder.AppendLine();
        builder.AppendLine($"Görüşme: {appointment.Title}");
        builder.AppendLine($"Tarih: {localDateTime.ToString("d MMMM yyyy dddd", culture)}");
        builder.AppendLine($"Saat: {localDateTime.ToString("HH:mm", culture)}");
        builder.AppendLine($"Görüşme türü: {mode}");

        if (!string.IsNullOrWhiteSpace(appointment.Location))
        {
            builder.AppendLine($"Konum: {appointment.Location}");
        }

        if (!string.IsNullOrWhiteSpace(appointment.Note))
        {
            builder.AppendLine($"Not: {appointment.Note}");
        }

        builder.AppendLine();
        builder.Append("Görüşme saatinden önce hazırlıklarınızı tamamlayabilirsiniz. Görüşmek üzere.");

        return builder.ToString();
    }

    private static string FormatAppointmentMode(string? mode)
    {
        var normalized = mode?.Trim().ToLowerInvariant();
        return normalized switch
        {
            "in-person" or "in_person" or "face-to-face" or "face_to_face" or "yuz-yuze" or "yüz yüze" => "Yüz yüze",
            "online" or "remote" => "Online",
            _ => string.IsNullOrWhiteSpace(mode) ? "Online" : mode.Trim()
        };
    }

    private async Task<DietitianClientLink?> ValidateLinkAsync(Guid dietitianId, Guid clientId)
    {
        return await _appDb.DietitianClientLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.DietitianId == dietitianId &&
                x.ClientId == clientId &&
                x.IsActive &&
                x.UnlinkedAt == null);
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
}

public sealed record CreateCareNoteRequest(string? Text, string? Content);

public sealed record CreateAppointmentRequest(
    string Title,
    string ScheduledAtUtc,
    string? Mode,
    string? Location,
    string? Note);

public sealed record UpdateAppointmentRequest(
    string Title,
    string ScheduledAtUtc,
    string? Mode,
    string? Location,
    string? Note);

public sealed record SendCareReplyRequest(string Text, Guid? ReplyToId = null, string? ReplyToSnippet = null);
