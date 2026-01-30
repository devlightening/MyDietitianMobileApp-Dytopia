using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client")]
public class ClientController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<ClientController> _logger;

    public ClientController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<ClientController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// Activate premium with access key
    /// </summary>
    [HttpPost("activate-premium")]
    public async Task<IActionResult> ActivatePremium([FromBody] ActivatePremiumRequest request)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "JWT token eksik veya geçersiz" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return BadRequest(new { message = "Client kaydı bulunamadı" });

            // Validate access key
            var accessKey = await _appDb.AccessKeys
                .Where(k => k.Key == request.AccessKey && k.IsActive)
                .FirstOrDefaultAsync();

            if (accessKey == null)
                return NotFound(new { message = "Geçersiz erişim anahtarı" });

            if (accessKey.EndDate < DateTime.UtcNow)
                return BadRequest(new { message = "Erişim anahtarının süresi dolmuş" });

            if (accessKey.StartDate > DateTime.UtcNow)
                return BadRequest(new { message = "Erişim anahtarı henüz aktif değil" });

            // Get dietitian info
            var dietitian = await _appDb.Dietitians.FindAsync(accessKey.DietitianId);
            if (dietitian == null || !dietitian.IsActive)
                return BadRequest(new { message = "Diyetisyen bulunamadı veya aktif değil" });

            // Update client premium status using domain method
            client.ActivatePremium(dietitian.Id, accessKey.StartDate, accessKey.EndDate);

            // Create or update binding
            var existingBinding = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.ClientId == client.Id && l.DietitianId == dietitian.Id);

            if (existingBinding == null)
            {
                var binding = new DietitianClientLink(
                    dietitian.Id,
                    client.Id,
                    user.PublicUserId
                );
                _appDb.DietitianClientLinks.Add(binding);
            }
            else if (!existingBinding.IsActive)
            {
                existingBinding.Reactivate();
            }

            await _appDb.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = "Premium aktivasyonu başarılı",
                dietitianName = dietitian.FullName,
                isPremium = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Premium activation failed for key {AccessKey}", request.AccessKey);
            return StatusCode(500, new { message = $"Aktivasyon başarısız: {ex.Message}" });
        }
    }
}

public record ActivatePremiumRequest(string AccessKey);
