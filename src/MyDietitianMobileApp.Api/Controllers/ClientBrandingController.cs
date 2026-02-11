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
/// Client branding endpoint (premium home)
/// </summary>
[Authorize]
[ApiController]
[Route("api/client")]
public class ClientBrandingController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly ILogger<ClientBrandingController> _logger;

    public ClientBrandingController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService,
        ILogger<ClientBrandingController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
        _logger = logger;
    }

    /// <summary>
    /// Get branding config for active dietitian (if premium) or null
    /// </summary>
    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (userId, clientId, _) = identity.Value;

        // Check premium status
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);

        if (!premiumStatus.IsPremium || !premiumStatus.ActiveDietitianId.HasValue)
        {
            return Ok(new { branding = (object?)null });
        }

        var dietitianId = premiumStatus.ActiveDietitianId.Value;

        var config = await _appDb.DietitianBrandingConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.DietitianId == dietitianId);

        if (config == null)
        {
            // Return defaults from dietitian
            var dietitian = await _appDb.Dietitians
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == dietitianId);

            return Ok(new
            {
                branding = new
                {
                    clinicName = dietitian?.ClinicName ?? "Klinik",
                    logoUrl = (string?)null,
                    primaryColorHex = "#111111",
                    accentColorHex = "#22C55E"
                }
            });
        }

        return Ok(new
        {
            branding = new
            {
                clinicName = config.ClinicName,
                logoUrl = config.LogoUrl,
                primaryColorHex = config.PrimaryColorHex,
                accentColorHex = config.AccentColorHex
            }
        });
    }
}
