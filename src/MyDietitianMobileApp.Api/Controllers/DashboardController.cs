using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Application.DTOs;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DashboardController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// Get dashboard data for mobile client
    /// Returns different data based on premium status (server-side gating)
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
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

            // Determine premium status
            var activeLink = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.ClientId == client.Id && l.IsActive);

            bool isPremium = false;
            string? clinicName = null;

            if (client.ActiveDietitianId.HasValue && activeLink != null)
            {
                var now = DateTime.UtcNow;
                if (client.ProgramEndDate == null || client.ProgramEndDate > now)
                {
                    isPremium = true;
                    
                    // Get clinic name from Dietitian table
                    var dietitian = await _appDb.Dietitians.FindAsync(client.ActiveDietitianId.Value);
                    clinicName = dietitian?.ClinicName ?? dietitian?.FullName;
                }
            }

            // Build dashboard DTO
            var dashboard = new DashboardDTO
            {
                Date = DateTime.UtcNow,
                GreetingName = client.FullName?.Split(' ').FirstOrDefault() ?? "User",
                CompliancePercent = 0, // TODO: Calculate from actual compliance data
                TodayStatus = "on-track"
            };

            // Premium-only fields (server-side gating)
            if (isPremium)
            {
                dashboard.ClinicName = clinicName;

                // TODO: Get next meal from actual diet plan
                // For now, return mock data
                dashboard.NextMeal = new NextMealDTO
                {
                    Time = "15:00",
                    Title = "Apple & Walnuts",
                    Note = "You're on track today"
                };

                // TODO: Calculate summary from actual data
                dashboard.Summary = new DashboardSummaryDTO
                {
                    Streak = 7,
                    CaloriesToday = 1450,
                    WaterGlasses = 6,
                    Steps = 8500
                };
            }
            else
            {
                // Free users get null for premium fields
                dashboard.ClinicName = null;
                dashboard.NextMeal = null;
                dashboard.Summary = null;
            }

            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get dashboard data for user");
            return StatusCode(500, new { message = "Dashboard verisi alınamadı" });
        }
    }
}
