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
/// Client perspective dietitian info endpoint
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian")]
public class ClientDietitianInfoController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly ILogger<ClientDietitianInfoController> _logger;

    public ClientDietitianInfoController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IClientIdentityResolver identityResolver,
        ILogger<ClientDietitianInfoController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _identityResolver = identityResolver;
        _logger = logger;
    }

    /// <summary>
    /// Get dietitian info from client perspective (premium required)
    /// </summary>
    [HttpGet("info")]
    public async Task<IActionResult> GetInfo()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (userId, clientId, _) = identity.Value;

        // Premium gate
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
        if (!premiumStatus.IsPremium || !premiumStatus.ActiveDietitianId.HasValue)
            return StatusCode(403, ApiProblems.PremiumRequired());

        var dietitianId = premiumStatus.ActiveDietitianId.Value;

        var dietitian = await _appDb.Dietitians
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == dietitianId);

        if (dietitian == null)
            return NotFound(ApiProblems.NotFound("DIETITIAN_NOT_FOUND", "Diyetisyen bulunamadı"));

        var branding = await _appDb.DietitianBrandingConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.DietitianId == dietitianId);

        return Ok(new
        {
            dietitianId = dietitian.Id,
            fullName = dietitian.FullName,
            clinicName = dietitian.ClinicName ?? dietitian.FullName,
            branding = branding != null ? new
            {
                clinicName = branding.ClinicName,
                logoUrl = branding.LogoUrl,
                primaryColorHex = branding.PrimaryColorHex,
                accentColorHex = branding.AccentColorHex
            } : new
            {
                clinicName = dietitian.ClinicName ?? dietitian.FullName,
                logoUrl = (string?)null,
                primaryColorHex = "#111111",
                accentColorHex = "#22C55E"
            }
        });
    }
}
