using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientGamificationService _gamificationService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IClientGamificationService gamificationService,
        ILogger<DashboardController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _gamificationService = gamificationService;
        _logger = logger;
    }

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
                return Unauthorized(new { message = "Kullanici bulunamadi" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return NotFound(new { message = "Client kaydi bulunamadi" });

            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid);
            var isPremium = premiumStatus.IsPremium;
            var gamification = await _gamificationService.GetSummaryAsync(
                client.Id,
                isPremium,
                premiumStatus.ActiveDietitianId);

            string? clinicName = null;
            if (isPremium && premiumStatus.ActiveDietitianId.HasValue)
            {
                var dietitian = await _appDb.Dietitians.FindAsync(premiumStatus.ActiveDietitianId.Value);
                clinicName = dietitian?.ClinicName ?? dietitian?.FullName;
            }

            var today = DateTime.UtcNow.Date;
            var dailyTracking = await _appDb.ClientDailyTrackings
                .AsNoTracking()
                .FirstOrDefaultAsync(t =>
                    t.ClientId == client.Id &&
                    t.Date == DateOnly.FromDateTime(today));

            var dashboard = new DashboardDTO
            {
                Date = DateTime.UtcNow,
                GreetingName = client.FullName?.Split(' ').FirstOrDefault() ?? "User",
                CompliancePercent = 0,
                TodayStatus = gamification.StreakAtRisk ? "needs-attention" : "on-track",
                ClinicName = clinicName,
                Motivation = MapMotivation(gamification),
                Summary = new DashboardSummaryDTO
                {
                    Streak = gamification.CurrentStreak,
                    CaloriesToday = 0,
                    WaterGlasses = gamification.Today.WaterGlasses,
                    Steps = dailyTracking?.Steps ?? 0,
                    BadgeCount = gamification.EarnedBadgeCount
                }
            };

            if (!isPremium)
            {
                dashboard.ClinicName = null;
                dashboard.NextMeal = null;
                return Ok(dashboard);
            }

            var motivationWindowStart = today.AddDays(-30);
            var recentPlans = await _appDb.MealPlans
                .Where(p =>
                    p.ClientId == client.Id &&
                    p.Status == MealPlanStatus.Published &&
                    p.Date.Date >= motivationWindowStart &&
                    p.Date.Date <= today)
                .Include(p => p.Items)
                .ThenInclude(i => i.Completion)
                .OrderByDescending(p => p.Date)
                .ToListAsync();

            var todayItems = recentPlans
                .Where(p => p.Date.Date == today)
                .SelectMany(p => p.Items)
                .OrderBy(i => i.Time)
                .ThenBy(i => i.OrderIndex)
                .ToList();

            if (todayItems.Count > 0)
            {
                var now = DateTime.UtcNow.TimeOfDay;
                var completedCount = todayItems.Count(i => CountsAsCompliant(i.Completion));
                dashboard.CompliancePercent = (int)Math.Round((double)completedCount / todayItems.Count * 100);
                dashboard.Summary!.CaloriesToday = todayItems
                    .Where(i => CountsAsCompliant(i.Completion))
                    .Sum(i => i.Calories ?? 0);

                var nextMealItem = todayItems
                    .Where(i => i.Time > now && i.Completion == null)
                    .OrderBy(i => i.Time)
                    .FirstOrDefault();

                if (nextMealItem != null)
                {
                    dashboard.NextMeal = new NextMealDTO
                    {
                        MealItemId = nextMealItem.Id,
                        MealType = nextMealItem.MealType.ToString(),
                        Time = nextMealItem.Time.ToString(@"hh\:mm"),
                        Title = nextMealItem.Title,
                        Note = nextMealItem.Note,
                        RecipeId = nextMealItem.RecipeId
                    };
                }
                else if (todayItems.All(i => i.Completion != null))
                {
                    dashboard.NextMeal = new NextMealDTO
                    {
                        Time = string.Empty,
                        Title = "Tum ogunler tamamlandi",
                        Note = "Harika bir gun gecirdiniz"
                    };
                }

                dashboard.TodayStatus = dashboard.CompliancePercent switch
                {
                    >= 80 => "on-track",
                    >= 45 => "needs-attention",
                    _ => "off-track"
                };
            }
            else
            {
                dashboard.NextMeal = new NextMealDTO
                {
                    Time = string.Empty,
                    Title = "Bugun icin plan yok",
                    Note = "Diyetisyeninizle iletisime gecin"
                };
                dashboard.TodayStatus = "needs-attention";
            }

            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get dashboard data for user");
            return StatusCode(500, new { message = "Dashboard verisi alinamadi" });
        }
    }

    private static bool CountsAsCompliant(MealCompletion? completion)
    {
        return completion?.Status is MealCompletionStatus.Done or MealCompletionStatus.Alternative;
    }

    private static DashboardMotivationDTO MapMotivation(ClientGamificationSummaryDTO summary)
    {
        return new DashboardMotivationDTO
        {
            CurrentStreak = summary.CurrentStreak,
            BestStreak = summary.BestStreak,
            EarnedBadgeCount = summary.EarnedBadgeCount,
            NextMilestoneDays = summary.NextMilestoneDays,
            Achievements = summary.Achievements
                .Select(x => new DashboardAchievementDTO
                {
                    Id = x.Id,
                    ProgressCurrent = x.ProgressCurrent,
                    ProgressTarget = x.ProgressTarget,
                    Unlocked = x.Unlocked
                })
                .ToList()
        };
    }
}
