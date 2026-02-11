using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        ILogger<DashboardController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
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
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
                return Unauthorized(new { message = "JWT token eksik" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userGuid);
            if (user == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return NotFound(new { message = "Client kaydı bulunamadı" });

            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid);

            bool isPremium = premiumStatus.IsPremium;
            string? clinicName = null;

            if (isPremium && premiumStatus.ActiveDietitianId.HasValue)
            {
                var dietitian = await _appDb.Dietitians.FindAsync(premiumStatus.ActiveDietitianId.Value);
                clinicName = dietitian?.ClinicName ?? dietitian?.FullName;
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

                // Get today's published meal plan
                var today = DateTime.UtcNow.Date;
                var todayPlan = await _appDb.MealPlans
                    .Where(p => p.ClientId == client.Id && p.Date.Date == today && p.Status == Domain.Entities.MealPlanStatus.Published)
                    .Include(p => p.Items)
                    .ThenInclude(i => i.Completion)
                    .FirstOrDefaultAsync();

                if (todayPlan != null)
                {
                    var now = DateTime.UtcNow.TimeOfDay;
                    var items = todayPlan.Items.OrderBy(i => i.Time).ToList();
                    
                    // Calculate compliance percent for today
                    if (items.Any())
                    {
                        var completedCount = items.Count(i => i.Completion != null);
                        dashboard.CompliancePercent = (int)Math.Round((double)completedCount / items.Count * 100);
                    }

                    // Find next meal (first incomplete meal after current time)
                    var nextMealItem = items
                        .Where(i => i.Time > now && i.Completion == null)
                        .OrderBy(i => i.Time)
                        .FirstOrDefault();

                    if (nextMealItem != null)
                    {
                        dashboard.NextMeal = new NextMealDTO
                        {
                            Time = nextMealItem.Time.ToString(@"hh\:mm"),
                            Title = nextMealItem.Title,
                            Note = nextMealItem.Note
                        };
                    }
                    else
                    {
                        // All meals completed or past
                        var allCompleted = items.All(i => i.Completion != null);
                        if (allCompleted && items.Any())
                        {
                            dashboard.NextMeal = new NextMealDTO
                            {
                                Time = "",
                                Title = "Tüm öğünler tamamlandı! 🎉",
                                Note = "Harika bir gün geçirdiniz"
                            };
                        }
                    }

                    // Update today status based on compliance
                    if (dashboard.CompliancePercent >= 80)
                        dashboard.TodayStatus = "excellent";
                    else if (dashboard.CompliancePercent >= 50)
                        dashboard.TodayStatus = "on-track";
                    else
                        dashboard.TodayStatus = "needs-attention";
                }
                else
                {
                    // No plan for today
                    dashboard.NextMeal = new NextMealDTO
                    {
                        Time = "",
                        Title = "Bugün için plan yok",
                        Note = "Diyetisyeninizle iletişime geçin"
                    };
                }

                // Calculate summary from actual data
                // TODO: Implement streak, calories, water, steps tracking
                dashboard.Summary = new DashboardSummaryDTO
                {
                    Streak = 0, // TODO: Calculate from historical compliance
                    CaloriesToday = todayPlan?.Items.Where(i => i.Completion != null).Sum(i => i.Calories ?? 0) ?? 0,
                    WaterGlasses = 0, // TODO: Implement water tracking
                    Steps = 0 // TODO: Implement steps tracking
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
