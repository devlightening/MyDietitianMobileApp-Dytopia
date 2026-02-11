using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client notes endpoint (premium required)
/// </summary>
[Authorize]
[ApiController]
[Route("api/client")]
public class ClientNotesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly ILogger<ClientNotesController> _logger;

    public ClientNotesController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService,
        ILogger<ClientNotesController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
        _logger = logger;
    }

    /// <summary>
    /// Get notes from active dietitian (premium required)
    /// </summary>
    [HttpGet("notes")]
    public async Task<IActionResult> GetNotes(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (userId, clientId, _) = identity.Value;

        // Premium gate
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
        if (!premiumStatus.IsPremium || !premiumStatus.ActiveDietitianId.HasValue)
            return StatusCode(403, ApiProblems.PremiumRequired("Bu özellik premium üyelik gerektirir"));

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        var query = _appDb.DietitianNotes
            .AsNoTracking()
            .Where(n => n.ClientId == clientId && n.DietitianId == premiumStatus.ActiveDietitianId.Value);

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
}
