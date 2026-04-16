using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client")]
public class ClientStateController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<ClientStateController> _logger;
    private readonly IPremiumStatusService _premiumStatusService;

    public ClientStateController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        ILogger<ClientStateController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _logger = logger;
    }

    /// <summary>
    /// Get current client state
    /// Returns premium status based on active DietitianClientLink and valid date range
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
                return Unauthorized(new { message = "JWT token eksik" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userGuid);
            if (user == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return NotFound(new { message = "Client kaydı bulunamadı" });

            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid);

            return Ok(new
            {
                userId = userId,
                clientId = client.Id,
                publicUserId = user.PublicUserId,
                isPremium = premiumStatus.IsPremium,
                premiumUntilUtc = premiumStatus.PremiumUntilUtc?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                activeDietitianId = premiumStatus.ActiveDietitianId?.ToString(),
                fullName = client.FullName,
                email = client.Email
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get client state");
            return StatusCode(500, new { message = "Durum alınamadı" });
        }
    }

    [HttpPut("me")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateClientProfileRequest request)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
                return Unauthorized(new { message = "JWT token eksik" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userGuid);
            if (user == null)
                return Unauthorized(new { message = "Kullanici bulunamadi" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return NotFound(new { message = "Client kaydi bulunamadi" });

            client.UpdateProfile(request.FullName);
            await _appDb.SaveChangesAsync();

            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid);

            return Ok(new
            {
                userId = userId,
                clientId = client.Id,
                publicUserId = user.PublicUserId,
                isPremium = premiumStatus.IsPremium,
                premiumUntilUtc = premiumStatus.PremiumUntilUtc?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                activeDietitianId = premiumStatus.ActiveDietitianId?.ToString(),
                fullName = client.FullName,
                email = client.Email
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update client profile");
            return StatusCode(500, new { message = "Profil guncellenemedi" });
        }
    }
}

public sealed record UpdateClientProfileRequest(string FullName);
