using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Realtime;
using MyDietitianMobileApp.Api.Time;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client endpoints for viewing and completing daily meal plans.
/// Uses the MealPlan / PlanMealItem / MealCompletion domain.
/// API-PLAN-03
/// </summary>
[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client")]
public class ClientPlanController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientGamificationService _gamificationService;
    private readonly ILogger<ClientPlanController> _logger;
    private readonly ISyncEventPublisher _syncPublisher;

    public ClientPlanController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IClientGamificationService gamificationService,
        ILogger<ClientPlanController> logger,
        ISyncEventPublisher syncPublisher)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _gamificationService = gamificationService;
        _logger = logger;
        _syncPublisher = syncPublisher;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/client/plans/today
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns today's published meal plan with per-meal completion status.
    /// Mobile PlansScreen primary data source.
    /// </summary>
    [HttpGet("plans/today")]
    [ProducesResponseType(typeof(object), 200)]
    public async Task<IActionResult> GetTodayPlan()
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var (today, todayNext) = AppTime.ToStoredDayRange(AppTime.LocalToday);

        var plan = await _appDb.MealPlans
            .Where(p => p.ClientId == clientId!.Value
                     && p.Date >= today && p.Date < todayNext
                     && p.Status == MealPlanStatus.Published)
            .Include(p => p.Items)
                .ThenInclude(i => i.Recipe)
            .FirstOrDefaultAsync();

        if (plan == null)
            return Ok(new { plan = (object?)null });

        // Fetch completions for today in one query
        var mealIds = plan.Items.Select(i => i.Id).ToList();
        var completions = await _appDb.MealCompletions
            .Where(c => c.ClientId == clientId!.Value && mealIds.Contains(c.DietPlanMealId))
            .ToListAsync();
        var completionMap = completions.ToDictionary(c => c.DietPlanMealId);

        var dto = MapPlan(plan, completionMap);
        return Ok(new { plan = dto });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/client/plans/week
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns this week's published meal plans (Mon–Sun of current week).
    /// </summary>
    [HttpGet("plans/week")]
    [ProducesResponseType(typeof(object), 200)]
    public async Task<IActionResult> GetWeekPlans()
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var today = AppTime.LocalToday;
        // ISO week: Monday start
        var dow = (int)today.DayOfWeek;
        var weekStartLocal = today.AddDays(dow == 0 ? -6 : -(dow - 1));
        var weekEndLocal = weekStartLocal.AddDays(7);
        var (weekStart, _) = AppTime.ToStoredDayRange(weekStartLocal);
        var (weekEnd, _) = AppTime.ToStoredDayRange(weekEndLocal);

        var plans = await _appDb.MealPlans
            .Where(p => p.ClientId == clientId!.Value
                     && p.Date >= weekStart && p.Date < weekEnd
                     && p.Status == MealPlanStatus.Published)
            .Include(p => p.Items)
                .ThenInclude(i => i.Recipe)
            .OrderBy(p => p.Date)
            .ToListAsync();

        // Bulk-load completions
        var allMealIds = plans.SelectMany(p => p.Items.Select(i => i.Id)).ToList();
        var completions = await _appDb.MealCompletions
            .Where(c => c.ClientId == clientId!.Value && allMealIds.Contains(c.DietPlanMealId))
            .ToListAsync();
        var completionMap = completions.ToDictionary(c => c.DietPlanMealId);

        var dtos = plans.Select(p => MapPlan(p, completionMap)).ToList();
        return Ok(new { plans = dtos });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/client/meals/next
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the next uncompleted meal scheduled for today.
    /// Used by the Dashboard premium hero widget.
    /// </summary>
    [HttpGet("meals/next")]
    [ProducesResponseType(typeof(NextMealDTO), 200)]
    public async Task<IActionResult> GetNextMeal()
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var (today, todayNext) = AppTime.ToStoredDayRange(AppTime.LocalToday);
        var nowTime = AppTime.LocalNow.TimeOfDay;

        var plan = await _appDb.MealPlans
            .Where(p => p.ClientId == clientId!.Value
                     && p.Date >= today && p.Date < todayNext
                     && p.Status == MealPlanStatus.Published)
            .Include(p => p.Items)
                .ThenInclude(i => i.Recipe)
            .FirstOrDefaultAsync();

        if (plan == null)
            return Ok(new { nextMeal = (object?)null });

        var completedIds = await _appDb.MealCompletions
            .Where(c => c.ClientId == clientId!.Value
                     && plan.Items.Select(i => i.Id).Contains(c.DietPlanMealId)
                     && c.Status != MealCompletionStatus.Skipped)
            .Select(c => c.DietPlanMealId)
            .ToListAsync();

        // Next = earliest meal today that hasn't been done/alternative-ed, preferring upcoming times
        var next = plan.Items
            .Where(i => !completedIds.Contains(i.Id))
            .OrderBy(i => i.Time >= nowTime ? 0 : 1) // upcoming first
            .ThenBy(i => i.Time >= nowTime ? i.Time : i.Time.Add(TimeSpan.FromDays(1)))
            .FirstOrDefault();

        if (next == null)
            return Ok(new { nextMeal = (object?)null });

        var minutesUntil = (int)(next.Time - nowTime).TotalMinutes;
        return Ok(new
        {
            nextMeal = new NextMealDTO
            {
                MealItemId   = next.Id,
                Time         = next.Time.ToString(@"hh\:mm"),
                MealType     = next.MealType.ToString(),
                Title        = next.Title,
                RecipeId     = next.RecipeId,
                MinutesUntil = minutesUntil
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/client/meals/{mealItemId}/complete
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Mark a meal as Done.</summary>
    [HttpPost("meals/{mealItemId}/complete")]
    public async Task<IActionResult> CompleteMeal(Guid mealItemId, [FromBody] MealActionRequest? body)
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var (mealItem, ownershipError) = await VerifyMealOwnership(mealItemId, clientId!.Value);
        if (ownershipError != null) return ownershipError;
        var availabilityError = ValidateMealActionWindow(mealItem!);
        if (availabilityError != null) return availabilityError;

        return await UpsertCompletion(
            clientId!.Value,
            mealItem!.Plan.CreatedBy,
            mealItemId,
            MealCompletionStatus.Done,
            body?.Note,
            null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/client/meals/{mealItemId}/skip
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Mark a meal as Skipped.</summary>
    [HttpPost("meals/{mealItemId}/skip")]
    public async Task<IActionResult> SkipMeal(Guid mealItemId, [FromBody] MealActionRequest? body)
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var (mealItem, ownershipError) = await VerifyMealOwnership(mealItemId, clientId!.Value);
        if (ownershipError != null) return ownershipError;
        var availabilityError = ValidateMealActionWindow(mealItem!, allowBeforeMealTime: true);
        if (availabilityError != null) return availabilityError;

        return await UpsertCompletion(
            clientId!.Value,
            mealItem!.Plan.CreatedBy,
            mealItemId,
            MealCompletionStatus.Skipped,
            body?.Note,
            null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/client/meals/{mealItemId}/alternative
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Mark a meal as completed with an alternative recipe.</summary>
    [HttpPost("meals/{mealItemId}/alternative")]
    public async Task<IActionResult> AlternativeMeal(Guid mealItemId, [FromBody] AlternativeMealRequest body)
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var (mealItem, ownershipError) = await VerifyMealOwnership(mealItemId, clientId!.Value);
        if (ownershipError != null) return ownershipError;
        var availabilityError = ValidateMealActionWindow(mealItem!);
        if (availabilityError != null) return availabilityError;

        return await UpsertCompletion(
            clientId!.Value,
            mealItem!.Plan.CreatedBy,
            mealItemId,
            MealCompletionStatus.Alternative,
            body.Note,
            body.AlternativeRecipeId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/client/meals/{mealItemId}/complete  (undo)
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Undo a completion (returns meal to Planned state).</summary>
    [HttpDelete("meals/{mealItemId}/complete")]
    public async Task<IActionResult> UncompleteMeal(Guid mealItemId)
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var completion = await _appDb.MealCompletions
            .FirstOrDefaultAsync(c => c.DietPlanMealId == mealItemId && c.ClientId == clientId!.Value);

        if (completion == null)
            return NotFound(new { message = "Tamamlanma kaydı bulunamadı" });

        // Verify ownership
        var mealPlanItem = await _appDb.PlanMealItems
            .Include(i => i.Plan)
            .FirstOrDefaultAsync(i => i.Id == mealItemId);

        if (mealPlanItem == null || mealPlanItem.Plan.ClientId != clientId!.Value)
            return Forbid();

        _appDb.MealCompletions.Remove(completion);
        await _appDb.SaveChangesAsync();
        await _gamificationService.GetSummaryAsync(clientId.Value, true, mealPlanItem.Plan.CreatedBy);
        await PublishPlanAndGamificationEventsAsync(clientId.Value, mealPlanItem.Plan.CreatedBy, mealItemId);

        return Ok(new { message = "Öğün işareti kaldırıldı" });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/client/meal-plans  (legacy ClientMealPlan list — kept for compat)
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Legacy: Returns assigned ClientMealPlan list (plan-level, no meal detail).
    /// Prefer /api/client/plans/today for meal-level data.
    /// </summary>
    [HttpGet("meal-plans")]
    public async Task<IActionResult> GetMyPlans()
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var today = AppTime.ToStoredPlanDate(AppTime.LocalToday);

        var rawPlans = await _appDb.ClientMealPlans
            .Where(p => p.ClientId == clientId!.Value)
            .OrderByDescending(p => p.IsActive)
            .ThenByDescending(p => p.StartDate)
            .Select(p => new
            {
                id             = p.Id,
                name           = p.Name,
                description    = p.Description,
                startDate      = p.StartDate,
                endDate        = p.EndDate,
                isActive       = p.IsActive,
                mealCount      = p.Meals.Count,
                completedMeals = p.Meals.Count(m => m.CompletedAt != null)
            })
            .ToListAsync();

        var plans = rawPlans.Select(plan => new
        {
            plan.id,
            plan.name,
            plan.description,
            startDate = AppTime.EnsureUtc(plan.startDate).ToString("yyyy-MM-dd"),
            endDate = AppTime.EnsureUtc(plan.endDate)?.ToString("yyyy-MM-dd"),
            isActive = plan.isActive && (!plan.endDate.HasValue || AppTime.EnsureUtc(plan.endDate.Value) >= today),
            plan.mealCount,
            plan.completedMeals
        });

        return Ok(new { plans });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static MealPlanDTO MapPlan(MealPlan plan, Dictionary<Guid, MealCompletion> completionMap)
    {
        var planDateKey = AppTime.FormatDateKey(plan.Date);
        return new MealPlanDTO
        {
            Id        = plan.Id,
            ClientId  = plan.ClientId,
            Date      = plan.Date,
            Status    = plan.Status.ToString(),
            UpdatedAt = plan.UpdatedAt,
            Items     = plan.Items
                .OrderBy(i => i.Time)
                .Select(i =>
                {
                    completionMap.TryGetValue(i.Id, out var comp);
                    return new MealItemDTO
                    {
                        Id                = i.Id,
                        Time              = i.Time.ToString(@"hh\:mm"),
                        MealType          = i.MealType.ToString(),
                        RecipeId          = i.RecipeId,
                        RecipeName        = i.Recipe?.Name,
                        Title             = i.Title,
                        Note              = i.Note,
                        OrderIndex        = i.OrderIndex,
                        Calories          = i.Calories,
                        Macros            = i.ProteinGrams.HasValue || i.CarbsGrams.HasValue || i.FatGrams.HasValue
                            ? new MacrosDTO
                            {
                                ProteinGrams = i.ProteinGrams,
                                CarbsGrams   = i.CarbsGrams,
                                FatGrams     = i.FatGrams
                            }
                            : null,
                        CompletionStatus      = comp?.Status.ToString() ?? "Planned",
                        AlternativeRecipeId   = comp?.AlternativeRecipeId,
                        IsActionableNow       = AppTime.CanClientActOnMeal(plan.Date, i.Time),
                        ActionBlockedUntilDate = planDateKey,
                        ActionBlockedUntilTime = AppTime.FormatTimeKey(i.Time)
                    };
                })
                .ToList()
        };
    }

    private IActionResult? ValidateMealActionWindow(PlanMealItem item, bool allowBeforeMealTime = false)
    {
        var planDate = AppTime.ToPlanDateOnly(item.Plan.Date);
        if (planDate > AppTime.LocalToday)
        {
            return BadRequest(ApiProblems.Validation(
                "MEAL_NOT_AVAILABLE_YET",
                "Bu öğün henüz açılmadı. Gelecek günün planı zamanı gelince işaretlenebilir."));
        }

        if (!allowBeforeMealTime && !AppTime.CanClientActOnMeal(item.Plan.Date, item.Time))
        {
            var opensAt = $"{planDate:dd.MM.yyyy} {AppTime.FormatTimeKey(item.Time)}";
            return BadRequest(ApiProblems.Validation(
                "MEAL_TIME_NOT_REACHED",
                $"Bu öğün {opensAt} itibarıyla işaretlenebilir."));
        }

        return null;
    }

    private async Task<(Guid? clientId, IActionResult? error)> RequirePremiumClientAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return (null, Unauthorized());

        var premium = await _premiumStatusService.GetPremiumStatusAsync(userGuid);
        if (!premium.IsPremium)
        {
            var problem = ApiProblems.PremiumRequired();
            return (null, StatusCode(problem.Status ?? 403, problem));
        }

        var clientId = await GetClientIdAsync();
        if (clientId == null)
            return (null, Unauthorized());

        return (clientId, null);
    }

    private async Task<(PlanMealItem? item, IActionResult? error)> VerifyMealOwnership(
        Guid mealItemId, Guid clientId)
    {
        var item = await _appDb.PlanMealItems
            .Include(i => i.Plan)
            .FirstOrDefaultAsync(i => i.Id == mealItemId);

        if (item == null)
            return (null, NotFound(new { message = "Öğün bulunamadı" }));

        if (item.Plan.ClientId != clientId)
            return (null, Forbid());

        return (item, null);
    }

    private async Task<IActionResult> UpsertCompletion(
        Guid clientId, Guid dietitianId, Guid mealItemId,
        MealCompletionStatus status, string? note, Guid? alternativeRecipeId)
    {
        var existing = await _appDb.MealCompletions
            .FirstOrDefaultAsync(c => c.ClientId == clientId && c.DietPlanMealId == mealItemId);

        if (existing != null)
        {
            existing.Update(status, note, alternativeRecipeId);
        }
        else
        {
            var completion = new MealCompletion(clientId, dietitianId, mealItemId, status, note, alternativeRecipeId);
            _appDb.MealCompletions.Add(completion);
        }

        await _appDb.SaveChangesAsync();
        await _gamificationService.TrackEventAsync(
            clientId,
            true,
            dietitianId,
            status switch
            {
                MealCompletionStatus.Done => ClientGamificationService.EventTypes.MealDone,
                MealCompletionStatus.Alternative => ClientGamificationService.EventTypes.MealAlternative,
                MealCompletionStatus.Skipped => ClientGamificationService.EventTypes.MealSkipped,
                _ => ClientGamificationService.EventTypes.MealDone
            },
            new { mealItemId, status = status.ToString() });
        await PublishPlanAndGamificationEventsAsync(clientId, dietitianId, mealItemId);

        var message = status switch
        {
            MealCompletionStatus.Done        => "Harika! Öğün tamamlandı 🎉",
            MealCompletionStatus.Skipped     => "Öğün atlandı olarak işaretlendi",
            MealCompletionStatus.Alternative => "Alternatif tarif ile tamamlandı 👍",
            _                                => "Kaydedildi"
        };

        return Ok(new { message, status = status.ToString() });
    }

    private async Task PublishPlanAndGamificationEventsAsync(Guid clientId, Guid dietitianId, Guid mealItemId)
    {
        await _syncPublisher.PublishToLinkAsync(dietitianId, clientId, "plan.today.updated", new
        {
            clientId,
            mealItemId
        });

        await _syncPublisher.PublishToLinkAsync(dietitianId, clientId, "gamification.summary.updated", new
        {
            clientId,
            source = "plan"
        });
    }

    private async Task<Guid?> GetClientIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId)) return null;
        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        return user?.LinkedClientId;
    }
}

// ─── Request models ───────────────────────────────────────────────────────────

public record MealActionRequest(string? Note);

public record AlternativeMealRequest(Guid? AlternativeRecipeId, string? Note);
