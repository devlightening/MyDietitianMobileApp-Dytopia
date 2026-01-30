using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client")]
public class ClientStateController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<ClientStateController> _logger;

    public ClientStateController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<ClientStateController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
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
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "JWT token eksik" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return NotFound(new { message = "Client kaydı bulunamadı" });

            // Determine premium status from active DietitianClientLink
            // Premium is active if:
            // 1. Client has ActiveDietitianId
            // 2. There's an active DietitianClientLink
            // 3. ProgramEndDate is null (unlimited) or in the future
            var activeLink = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.ClientId == client.Id && l.IsActive);

            bool isPremium = false;
            DateTime? premiumUntilUtc = null;
            Guid? activeDietitianId = null;

            if (client.ActiveDietitianId.HasValue && activeLink != null)
            {
                // Check if premium period is still valid
                var now = DateTime.UtcNow;
                if (client.ProgramEndDate == null || client.ProgramEndDate > now)
                {
                    isPremium = true;
                    activeDietitianId = client.ActiveDietitianId;
                    premiumUntilUtc = client.ProgramEndDate;
                }
                else
                {
                    // Premium expired - deactivate
                    _logger.LogWarning("Premium expired for client {ClientId}, end date: {EndDate}", 
                        client.Id, client.ProgramEndDate);
                }
            }

            return Ok(new
            {
                userId = userId,
                publicUserId = user.PublicUserId,
                isPremium = isPremium,
                premiumUntilUtc = premiumUntilUtc?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                activeDietitianId = activeDietitianId?.ToString(),
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
}
