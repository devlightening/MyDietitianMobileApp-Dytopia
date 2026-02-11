using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client endpoints for viewing and completing meal plans
/// API-PLAN-03: Client meal plan operations
/// </summary>
[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client")]
public class ClientPlanController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly ILogger<ClientPlanController> _logger;

    public ClientPlanController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        ILogger<ClientPlanController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _logger = logger;
    }

    /// <summary>
    /// Get today's published meal plan (legacy route, use /api/client/plan instead)
    /// </summary>
    [HttpGet("plans/today")]
    [ApiExplorerSettings(IgnoreApi = true)] // Hidden from Swagger (use /api/client/plan instead)
    public async Task<IActionResult> GetTodayPlan()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return Unauthorized();

        var premium = await _premiumStatusService.GetPremiumStatusAsync(userGuid);
        if (!premium.IsPremium)
        {
            var problem = ApiProblems.PremiumRequired();
            return StatusCode(problem.Status ?? 403, problem);
        }

        var clientId = await GetClientIdAsync();
        if (clientId == null)
            return Unauthorized();

        var today = DateTime.UtcNow.Date;

        var plan = await _appDb.MealPlans
            .Where(p => p.ClientId == clientId.Value && p.Date.Date == today && p.Status == MealPlanStatus.Published)
            .Include(p => p.Items)
            .ThenInclude(i => i.Completion)
            .FirstOrDefaultAsync();

        if (plan == null)
            return Ok(new { plan = (object?)null }); // No plan for today

        var planDto = new MealPlanDTO
        {
            Id = plan.Id,
            ClientId = plan.ClientId,
            Date = plan.Date,
            Status = plan.Status.ToString(),
            UpdatedAt = plan.UpdatedAt,
            Items = plan.Items.OrderBy(i => i.Time).Select(i => new MealItemDTO
            {
                Id = i.Id,
                Time = i.Time.ToString(@"hh\:mm"),
                Title = i.Title,
                Note = i.Note,
                OrderIndex = i.OrderIndex,
                Calories = i.Calories,
                Macros = i.ProteinGrams.HasValue || i.CarbsGrams.HasValue || i.FatGrams.HasValue
                    ? new MacrosDTO
                    {
                        ProteinGrams = i.ProteinGrams,
                        CarbsGrams = i.CarbsGrams,
                        FatGrams = i.FatGrams
                    }
                    : null,
                IsCompleted = i.Completion != null
            }).ToList()
        };

        return Ok(new { plan = planDto });
    }

    /// <summary>
    /// Get this week's published meal plans
    /// </summary>
    [HttpGet("plans/week")]
    public async Task<IActionResult> GetWeekPlans()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return Unauthorized();

        var premium = await _premiumStatusService.GetPremiumStatusAsync(userGuid);
        if (!premium.IsPremium)
        {
            var problem = ApiProblems.PremiumRequired();
            return StatusCode(problem.Status ?? 403, problem);
        }

        var clientId = await GetClientIdAsync();
        if (clientId == null)
            return Unauthorized();

        var today = DateTime.UtcNow.Date;
        var weekStart = today.AddDays(-(int)today.DayOfWeek); // Sunday
        var weekEnd = weekStart.AddDays(7);

        var plans = await _appDb.MealPlans
            .Where(p => p.ClientId == clientId.Value && p.Date >= weekStart && p.Date < weekEnd && p.Status == MealPlanStatus.Published)
            .Include(p => p.Items)
            .ThenInclude(i => i.Completion)
            .OrderBy(p => p.Date)
            .Select(p => new MealPlanDTO
            {
                Id = p.Id,
                ClientId = p.ClientId,
                Date = p.Date,
                Status = p.Status.ToString(),
                UpdatedAt = p.UpdatedAt,
                Items = p.Items.OrderBy(i => i.Time).Select(i => new MealItemDTO
                {
                    Id = i.Id,
                    Time = i.Time.ToString(@"hh\:mm"),
                    Title = i.Title,
                    Note = i.Note,
                    OrderIndex = i.OrderIndex,
                    Calories = i.Calories,
                    Macros = i.ProteinGrams.HasValue || i.CarbsGrams.HasValue || i.FatGrams.HasValue
                        ? new MacrosDTO
                        {
                            ProteinGrams = i.ProteinGrams,
                            CarbsGrams = i.CarbsGrams,
                            FatGrams = i.FatGrams
                        }
                        : null,
                    IsCompleted = i.Completion != null
                }).ToList()
            })
            .ToListAsync();

        return Ok(new { plans });
    }

    /// <summary>
    /// Mark a meal as completed
    /// </summary>
    [HttpPost("meals/{mealItemId}/complete")]
    public async Task<IActionResult> CompleteMeal(Guid mealItemId)
    {
        var clientId = await GetClientIdAsync();
        if (clientId == null)
            return Unauthorized();

        var mealItem = await _appDb.PlanMealItems
            .Include(i => i.Plan)
            .Include(i => i.Completion)
            .FirstOrDefaultAsync(i => i.Id == mealItemId);

        if (mealItem == null)
            return NotFound(new { message = "Öğün bulunamadı" });

        // Verify this meal belongs to the client
        if (mealItem.Plan.ClientId != clientId.Value)
            return Forbid();

        // Get dietitian ID from plan
        var dietitianId = mealItem.Plan.CreatedBy;

        // Check if already completed
        var existingCompletion = await _appDb.MealCompletions
            .FirstOrDefaultAsync(c => c.ClientId == clientId.Value && c.DietPlanMealId == mealItemId);

        if (existingCompletion != null)
            return Ok(new { message = "Öğün zaten tamamlanmış", alreadyCompleted = true });

        var completion = new MealCompletion(clientId.Value, dietitianId, mealItemId, MealCompletionStatus.Done, null);

        _appDb.MealCompletions.Add(completion);
        await _appDb.SaveChangesAsync();

        return Ok(new { message = "Öğün tamamlandı", completedAt = completion.AtUtc });
    }

    /// <summary>
    /// Unmark a meal (remove completion)
    /// </summary>
    [HttpDelete("meals/{mealItemId}/complete")]
    public async Task<IActionResult> UncompleteMeal(Guid mealItemId)
    {
        var clientId = await GetClientIdAsync();
        if (clientId == null)
            return Unauthorized();

        var completion = await _appDb.MealCompletions
            .FirstOrDefaultAsync(c => c.DietPlanMealId == mealItemId && c.ClientId == clientId.Value);

        if (completion == null)
            return NotFound(new { message = "Tamamlanma kaydı bulunamadı" });

        // Verify this meal belongs to the client
        var planMealItem = await _appDb.PlanMealItems
            .Include(i => i.Plan)
            .FirstOrDefaultAsync(i => i.Id == completion.DietPlanMealId);
        
        if (planMealItem == null || planMealItem.Plan.ClientId != clientId.Value)
            return Forbid();

        _appDb.MealCompletions.Remove(completion);
        await _appDb.SaveChangesAsync();

        return Ok(new { message = "Öğün işareti kaldırıldı" });
    }

    private async Task<Guid?> GetClientIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return null;

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user == null)
            return null;

        return user.LinkedClientId;
    }
}
