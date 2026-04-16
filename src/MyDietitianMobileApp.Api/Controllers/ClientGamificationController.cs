using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client/gamification")]
public class ClientGamificationController : ControllerBase
{
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientGamificationService _gamificationService;

    public ClientGamificationController(
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService,
        IClientGamificationService gamificationService)
    {
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
        _gamificationService = gamificationService;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId);
        var summary = await _gamificationService.GetSummaryAsync(
            identity.Value.clientId,
            premium.IsPremium,
            premium.ActiveDietitianId);

        return Ok(summary);
    }

    [HttpPost("ping")]
    public async Task<IActionResult> Ping()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId);
        await _gamificationService.TrackEventAsync(
            identity.Value.clientId,
            premium.IsPremium,
            premium.ActiveDietitianId,
            ClientGamificationService.EventTypes.AppOpen,
            new { source = "mobile" });

        return NoContent();
    }
}
