using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;

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
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        try
        {
            var userId = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "JWT token eksik" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return NotFound(new { message = "Client kaydı bulunamadı" });

            return Ok(new
            {
                publicUserId = user.PublicUserId,
                isPremium = client.IsPremium,
                activeDietitianId = client.ActiveDietitianId,
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
