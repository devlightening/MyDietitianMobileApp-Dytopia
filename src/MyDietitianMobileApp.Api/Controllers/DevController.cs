using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Development-only endpoints for testing and seeding
/// </summary>
[ApiController]
[Route("api/dev")]
[ApiExplorerSettings(IgnoreApi = true)]
public class DevController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DevController> _logger;
    private readonly IWebHostEnvironment _env;

    public DevController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DevController> logger,
        IWebHostEnvironment env)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
        _env = env;
    }

    /// <summary>
    /// Create a sample "today" plan for the current premium user (dev only)
    /// </summary>
    [HttpPost("seed-today-plan")]
    [Authorize("Client")]
    public async Task<IActionResult> SeedTodayPlan()
    {
        // Only allow in development
        if (!_env.IsDevelopment())
        {
            return NotFound();
        }

        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "JWT token eksik", code = "AUTH_REQUIRED" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı", code = "AUTH_REQUIRED" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return NotFound(new { message = "Client kaydı bulunamadı", code = "CLIENT_NOT_FOUND" });

            // Check premium status
            var activeLink = await _appDb.DietitianClientLinks
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
                return StatusCode(403, new { 
                    message = "Bu özellik premium üyelik gerektirir",
                    code = "PREMIUM_REQUIRED"
                });
            }

            var dietitianId = client.ActiveDietitianId!.Value;
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            // Check if plan already exists for today
            var existingPlan = await _appDb.DietPlans
                .Where(p => p.ClientId == client.Id && p.Status == DietPlanStatus.Active)
                .Include(p => p.Days.Where(d => d.Date == today))
                .FirstOrDefaultAsync();

            if (existingPlan != null && existingPlan.Days.Any(d => d.Date == today))
            {
                return Ok(new { 
                    message = "Bugün için plan zaten mevcut",
                    planId = existingPlan.Id
                });
            }

            // Create a simple diet plan if none exists
            DietPlan plan;
            if (existingPlan == null)
            {
                plan = new DietPlan(
                    Guid.NewGuid(),
                    dietitianId,
                    client.Id,
                    "Örnek Diyet Planı",
                    today.ToDateTime(TimeOnly.MinValue),
                    today.AddDays(7).ToDateTime(TimeOnly.MinValue),
                    DietPlanStatus.Active
                );
                _appDb.DietPlans.Add(plan);
            }
            else
            {
                plan = existingPlan;
            }

            // Create today's day if it doesn't exist
            var todayDay = existingPlan?.Days.FirstOrDefault(d => d.Date == today);
            if (todayDay == null)
            {
                todayDay = new DietPlanDay(Guid.NewGuid(), plan.Id, today, 2000); // 2000 kcal target
                _appDb.DietPlanDays.Add(todayDay);
                plan.AddDay(todayDay); // Link to plan
            }

            // Get some recipes from the dietitian
            var recipes = await _appDb.Recipes
                .Where(r => r.DietitianId == dietitianId)
                .Take(3)
                .ToListAsync();

            if (recipes.Any())
            {
                // Add sample meals
                var mealTypes = new[] { MealType.Breakfast, MealType.Lunch, MealType.Dinner };
                foreach (var mealType in mealTypes)
                {
                    var recipe = recipes[mealTypes.ToList().IndexOf(mealType) % recipes.Count];
                    var meal = new DietPlanMeal(
                        Guid.NewGuid(),
                        todayDay.Id,
                        mealType,
                        recipe.Id,
                        isMandatory: true
                    );
                    _appDb.DietPlanMeals.Add(meal);
                    todayDay.AddMeal(meal); // Link to day
                }
            }
            else
            {
                // No recipes, create custom meals
                var mealTypes = new[] { MealType.Breakfast, MealType.Lunch, MealType.Dinner };
                var mealNames = new[] { "Kahvaltı", "Öğle Yemeği", "Akşam Yemeği" };
                
                for (int i = 0; i < mealTypes.Length; i++)
                {
                    var meal = new DietPlanMeal(
                        Guid.NewGuid(),
                        todayDay.Id,
                        mealTypes[i],
                        customName: mealNames[i],
                        isMandatory: true
                    );
                    _appDb.DietPlanMeals.Add(meal);
                    todayDay.AddMeal(meal); // Link to day
                }
            }

            await _appDb.SaveChangesAsync();

            return Ok(new { 
                message = "Örnek plan oluşturuldu",
                planId = plan.Id,
                date = today.ToString("yyyy-MM-dd")
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to seed today plan");
            return StatusCode(500, new { 
                message = "Plan oluşturulurken bir hata oluştu",
                code = "INTERNAL_ERROR"
            });
        }
    }
}
