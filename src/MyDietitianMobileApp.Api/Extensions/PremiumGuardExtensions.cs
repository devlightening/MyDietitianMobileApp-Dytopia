using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Extensions;

/// <summary>
/// Extension methods for premium guard checks
/// </summary>
public static class PremiumGuardExtensions
{
    /// <summary>
    /// Check if the authenticated client has active premium subscription
    /// Returns null if premium, or an IActionResult if not premium
    /// </summary>
    public static async Task<IActionResult?> RequirePremiumClient(
        this ControllerBase controller,
        AppDbContext appDb,
        AuthDbContext authDb,
        string userId)
    {
        if (string.IsNullOrEmpty(userId))
            return controller.Unauthorized(new { message = "JWT token eksik" });

        var user = await authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user == null)
            return controller.Unauthorized(new { message = "Kullanıcı bulunamadı" });

        var client = await appDb.Clients.FindAsync(user.LinkedClientId);
        if (client == null)
            return controller.NotFound(new { message = "Client kaydı bulunamadı" });

        // Check if client has active premium
        var activeLink = await appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.ClientId == client.Id && l.IsActive);

        bool isPremium = false;
        if (client.ActiveDietitianId.HasValue && activeLink != null)
        {
            var now = DateTime.UtcNow;
            if (client.ProgramEndDate == null || client.ProgramEndDate > now)
            {
                isPremium = true;
            }
        }

        if (!isPremium)
        {
            return controller.StatusCode(403, new { 
                code = "PREMIUM_REQUIRED",
                message = "Bu özellik premium üyelik gerektirir"
            });
        }

        return null; // Premium check passed
    }
}
