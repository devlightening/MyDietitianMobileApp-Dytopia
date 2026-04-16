using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Text.RegularExpressions;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Public contact form endpoint + owner-key-protected message management.
/// </summary>
[ApiController]
[Route("api/contact")]
public class ContactController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<ContactController> _logger;

    // Simple HTML-tag stripper — prevents stored XSS
    private static readonly Regex HtmlTagPattern =
        new(@"<[^>]*>", RegexOptions.Compiled, TimeSpan.FromMilliseconds(200));

    public ContactController(
        AppDbContext db,
        IConfiguration config,
        ILogger<ContactController> logger)
    {
        _db     = db;
        _config = config;
        _logger = logger;
    }

    // ────────────────────────────────────────────────────────────────
    //  POST /api/contact
    //  Public: landing page form submission
    // ────────────────────────────────────────────────────────────────
    [HttpPost]
    [EnableRateLimiting("contact")]
    public async Task<IActionResult> Submit([FromBody] SubmitContactRequest req)
    {
        // ── Input validation ──────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Length > 150)
            return BadRequest(new { code = "INVALID_NAME", message = "Ad geçersiz veya çok uzun (maks. 150)." });

        if (string.IsNullOrWhiteSpace(req.Email) || req.Email.Length > 255 ||
            !Regex.IsMatch(req.Email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.None, TimeSpan.FromMilliseconds(100)))
            return BadRequest(new { code = "INVALID_EMAIL", message = "Geçerli bir e-posta adresi girin." });

        if (!string.IsNullOrEmpty(req.Phone) && req.Phone.Length > 30)
            return BadRequest(new { code = "INVALID_PHONE", message = "Telefon numarası çok uzun (maks. 30)." });

        if (string.IsNullOrWhiteSpace(req.Subject) || req.Subject.Length > 200)
            return BadRequest(new { code = "INVALID_SUBJECT", message = "Konu boş bırakılamaz veya çok uzun (maks. 200)." });

        if (string.IsNullOrWhiteSpace(req.Message) || req.Message.Length > 4000)
            return BadRequest(new { code = "INVALID_MESSAGE", message = "Mesaj boş bırakılamaz veya çok uzun (maks. 4000)." });

        // ── Sanitize: strip HTML tags to prevent stored XSS ──────────
        var cleanName    = Sanitize(req.Name);
        var cleanPhone   = req.Phone is null ? null : Sanitize(req.Phone);
        var cleanSubject = Sanitize(req.Subject);
        var cleanMessage = Sanitize(req.Message);

        // ── Persist ───────────────────────────────────────────────────
        var msg = new ContactMessage(cleanName, req.Email.Trim().ToLowerInvariant(), cleanPhone, cleanSubject, cleanMessage);
        _db.ContactMessages.Add(msg);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Contact form submitted by {Email} — subject: {Subject}", msg.Email, msg.Subject);

        return StatusCode(201, new { success = true, id = msg.Id });
    }

    // ────────────────────────────────────────────────────────────────
    //  GET /api/contact
    //  Protected: owner panel only (X-Contact-Admin-Key header)
    // ────────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool? unread, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        if (!IsOwner()) return Unauthorized(new { code = "FORBIDDEN" });

        pageSize = Math.Clamp(pageSize, 1, 100);
        page     = Math.Max(page, 1);

        var query = _db.ContactMessages.AsQueryable();
        if (unread == true) query = query.Where(m => !m.IsRead);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.Email,
                m.Phone,
                m.Subject,
                m.Message,
                m.CreatedAt,
                m.IsRead,
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, items });
    }

    // ────────────────────────────────────────────────────────────────
    //  PATCH /api/contact/{id}/read
    // ────────────────────────────────────────────────────────────────
    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        if (!IsOwner()) return Unauthorized(new { code = "FORBIDDEN" });

        var msg = await _db.ContactMessages.FindAsync(id);
        if (msg is null) return NotFound();

        msg.MarkAsRead();
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ────────────────────────────────────────────────────────────────
    //  DELETE /api/contact/{id}
    // ────────────────────────────────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!IsOwner()) return Unauthorized(new { code = "FORBIDDEN" });

        var msg = await _db.ContactMessages.FindAsync(id);
        if (msg is null) return NotFound();

        _db.ContactMessages.Remove(msg);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ────────────────────────────────────────────────────────────────
    //  Helpers
    // ────────────────────────────────────────────────────────────────
    private bool IsOwner()
    {
        var expectedKey = _config["ContactAdmin:ApiKey"];
        if (string.IsNullOrWhiteSpace(expectedKey)) return false;

        Request.Headers.TryGetValue("X-Contact-Admin-Key", out var provided);
        return !string.IsNullOrWhiteSpace(provided) && provided == expectedKey;
    }

    private static string Sanitize(string input) =>
        HtmlTagPattern.Replace(input, string.Empty).Trim();
}

public record SubmitContactRequest(
    string Name,
    string Email,
    string? Phone,
    string Subject,
    string Message
);
