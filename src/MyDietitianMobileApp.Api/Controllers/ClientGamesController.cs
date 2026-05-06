using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client/games")]
public class ClientGamesController : ControllerBase
{
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientGameService _gameService;

    public ClientGamesController(
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService,
        IClientGameService gameService)
    {
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
        _gameService = gameService;
    }

    [HttpGet("daily")]
    public async Task<IActionResult> GetDaily([FromQuery] string? language = "tr", CancellationToken ct = default)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var pack = await _gameService.GetDailyPackAsync(identity.Value.clientId, language, ct);
        return Ok(pack);
    }

    [HttpPost("{challengeId:guid}/submit")]
    public async Task<IActionResult> Submit(Guid challengeId, [FromBody] SubmitGameRequestDTO request, CancellationToken ct = default)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId);

        try
        {
            var result = await _gameService.SubmitAsync(
                identity.Value.clientId,
                premium.IsPremium,
                premium.ActiveDietitianId,
                challengeId,
                request,
                ct);

            return Ok(result);
        }
        catch (InvalidOperationException ex) when (ex.Message == "GAME_NOT_FOUND")
        {
            return NotFound(ApiProblems.NotFound("GAME_NOT_FOUND", "Bu oyun bulunamadi veya gunluk paketten kaldirildi."));
        }
    }
}
