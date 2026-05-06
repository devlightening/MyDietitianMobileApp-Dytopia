using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize("Dietitian")]
[ApiController]
[Route("api/dietitian")]
public class DietitianAnnouncementController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;

    public DietitianAnnouncementController(AppDbContext appDb, AuthDbContext authDb)
    {
        _appDb = appDb;
        _authDb = authDb;
    }

    [HttpGet("clients/{clientId:guid}/announcements")]
    public async Task<IActionResult> GetAnnouncements(Guid clientId)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var hasLink = await HasActiveLinkAsync(dietitianId.Value, clientId);
        if (!hasLink)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif bağlantınız yok"));

        var now = DateTime.UtcNow;
        var items = await _appDb.ClientAnnouncements
            .AsNoTracking()
            .Where(a => a.ClientId == clientId && a.DietitianId == dietitianId.Value)
            .OrderByDescending(a => a.StartsAt)
            .Select(a => new
            {
                id = a.Id,
                title = a.Title,
                body = a.Body,
                startsAt = a.StartsAt.ToString("yyyy-MM-dd"),
                endsAt = a.EndsAt.ToString("yyyy-MM-dd"),
                isActive = a.StartsAt <= now && now <= a.EndsAt,
            })
            .ToListAsync();

        return Ok(new { items });
    }

    [HttpPost("clients/{clientId:guid}/announcements")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> CreateAnnouncement(Guid clientId, [FromBody] AnnouncementPayload request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var hasLink = await HasActiveLinkAsync(dietitianId.Value, clientId);
        if (!hasLink)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif bağlantınız yok"));

        var validation = ValidatePayload(request);
        if (validation != null) return validation;

        var startsAt = DateTime.SpecifyKind(DateTime.Parse(request.StartsAt), DateTimeKind.Utc);
        var endsAt = DateTime.SpecifyKind(DateTime.Parse(request.EndsAt), DateTimeKind.Utc);

        if (endsAt < startsAt)
            return BadRequest(ApiProblems.Validation("INVALID_DATES", "Bitiş tarihi başlangıç tarihinden önce olamaz"));

        var announcement = new ClientAnnouncement(clientId, dietitianId.Value, request.Title, request.Body, startsAt, endsAt);
        _appDb.ClientAnnouncements.Add(announcement);
        await _appDb.SaveChangesAsync();

        var now = DateTime.UtcNow;
        return CreatedAtAction(nameof(GetAnnouncements), new { clientId }, new
        {
            id = announcement.Id,
            title = announcement.Title,
            body = announcement.Body,
            startsAt = announcement.StartsAt.ToString("yyyy-MM-dd"),
            endsAt = announcement.EndsAt.ToString("yyyy-MM-dd"),
            isActive = announcement.StartsAt <= now && now <= announcement.EndsAt,
        });
    }

    [HttpPut("clients/{clientId:guid}/announcements/{id:guid}")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> UpdateAnnouncement(Guid clientId, Guid id, [FromBody] AnnouncementPayload request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var announcement = await _appDb.ClientAnnouncements
            .FirstOrDefaultAsync(a => a.Id == id && a.ClientId == clientId && a.DietitianId == dietitianId.Value);

        if (announcement == null)
            return NotFound(ApiProblems.NotFound("NOT_FOUND", "Duyuru bulunamadı"));

        var validation = ValidatePayload(request);
        if (validation != null) return validation;

        var startsAt = DateTime.SpecifyKind(DateTime.Parse(request.StartsAt), DateTimeKind.Utc);
        var endsAt = DateTime.SpecifyKind(DateTime.Parse(request.EndsAt), DateTimeKind.Utc);

        if (endsAt < startsAt)
            return BadRequest(ApiProblems.Validation("INVALID_DATES", "Bitiş tarihi başlangıç tarihinden önce olamaz"));

        announcement.Update(request.Title, request.Body, startsAt, endsAt);
        await _appDb.SaveChangesAsync();

        var now = DateTime.UtcNow;
        return Ok(new
        {
            id = announcement.Id,
            title = announcement.Title,
            body = announcement.Body,
            startsAt = announcement.StartsAt.ToString("yyyy-MM-dd"),
            endsAt = announcement.EndsAt.ToString("yyyy-MM-dd"),
            isActive = announcement.StartsAt <= now && now <= announcement.EndsAt,
        });
    }

    [HttpDelete("clients/{clientId:guid}/announcements/{id:guid}")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> DeleteAnnouncement(Guid clientId, Guid id)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var announcement = await _appDb.ClientAnnouncements
            .FirstOrDefaultAsync(a => a.Id == id && a.ClientId == clientId && a.DietitianId == dietitianId.Value);

        if (announcement == null)
            return NotFound(ApiProblems.NotFound("NOT_FOUND", "Duyuru bulunamadı"));

        _appDb.ClientAnnouncements.Remove(announcement);
        await _appDb.SaveChangesAsync();

        return NoContent();
    }

    private IActionResult? ValidatePayload(AnnouncementPayload request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(ApiProblems.Validation("INVALID_TITLE", "Başlık boş olamaz"));
        if (request.Title.Length > 200)
            return BadRequest(ApiProblems.Validation("INVALID_TITLE", "Başlık en fazla 200 karakter olabilir"));
        if (string.IsNullOrWhiteSpace(request.Body))
            return BadRequest(ApiProblems.Validation("INVALID_BODY", "İçerik boş olamaz"));
        if (request.Body.Length > 2000)
            return BadRequest(ApiProblems.Validation("INVALID_BODY", "İçerik en fazla 2000 karakter olabilir"));
        if (string.IsNullOrWhiteSpace(request.StartsAt) || !DateTime.TryParse(request.StartsAt, out _))
            return BadRequest(ApiProblems.Validation("INVALID_DATES", "Geçersiz başlangıç tarihi"));
        if (string.IsNullOrWhiteSpace(request.EndsAt) || !DateTime.TryParse(request.EndsAt, out _))
            return BadRequest(ApiProblems.Validation("INVALID_DATES", "Geçersiz bitiş tarihi"));
        return null;
    }

    private async Task<bool> HasActiveLinkAsync(Guid dietitianId, Guid clientId) =>
        await _appDb.DietitianClientLinks
            .AsNoTracking()
            .AnyAsync(l => l.DietitianId == dietitianId && l.ClientId == clientId && l.IsActive && l.UnlinkedAt == null);

    private async Task<Guid?> GetDietitianIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId)) return null;

        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId) && u.Role == "Dietitian");

        return user?.LinkedDietitianId;
    }
}

public record AnnouncementPayload(string Title, string Body, string StartsAt, string EndsAt);
