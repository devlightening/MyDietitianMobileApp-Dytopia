using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Dietitian notes endpoints (MVP instead of chat)
/// </summary>
[Authorize("Dietitian")]
[ApiController]
[Route("api/dietitian")]
public class DietitianNotesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DietitianNotesController> _logger;

    public DietitianNotesController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DietitianNotesController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// Create note for client (IDOR-safe: must have active link)
    /// </summary>
    [HttpPost("clients/{clientId:guid}/notes")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> CreateNote(Guid clientId, [FromBody] CreateNoteRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        // IDOR Prevention: Verify this client belongs to this dietitian
        var link = await _appDb.DietitianClientLinks
            .AsNoTracking()
            .FirstOrDefaultAsync(l =>
                l.DietitianId == dietitianId.Value &&
                l.ClientId == clientId &&
                l.IsActive &&
                l.UnlinkedAt == null);

        if (link == null)
            return NotFound(ApiProblems.NotFound("LINK_NOT_FOUND", "Bu client ile aktif bağlantınız yok"));

        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(ApiProblems.Validation("INVALID_TEXT", "Not metni boş olamaz"));

        if (request.Text.Length > 2000)
            return BadRequest(ApiProblems.Validation("INVALID_TEXT", "Not metni en fazla 2000 karakter olabilir"));

        var note = new DietitianNote(dietitianId.Value, clientId, request.Text);
        _appDb.DietitianNotes.Add(note);
        await _appDb.SaveChangesAsync();

        return CreatedAtAction(nameof(GetNotes), new { clientId }, new
        {
            id = note.Id,
            text = note.Text,
            createdAtUtc = note.CreatedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
        });
    }

    /// <summary>
    /// Get notes for client (IDOR-safe)
    /// </summary>
    [HttpGet("clients/{clientId:guid}/notes")]
    public async Task<IActionResult> GetNotes(
        Guid clientId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        // IDOR Prevention: Verify this client belongs to this dietitian
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

        var query = _appDb.DietitianNotes
            .AsNoTracking()
            .Where(n => n.DietitianId == dietitianId.Value && n.ClientId == clientId);

        var total = await query.CountAsync();

        var notes = await query
            .OrderByDescending(n => n.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new
            {
                id = n.Id,
                text = n.Text,
                createdAtUtc = n.CreatedAtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
            })
            .ToListAsync();

        return Ok(new { page, pageSize, total, notes });
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

public record CreateNoteRequest(string Text);
