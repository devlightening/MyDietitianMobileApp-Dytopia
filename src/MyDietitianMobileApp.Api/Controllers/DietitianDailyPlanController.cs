using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Api.Time;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Realtime;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Dietitian endpoints for creating and managing daily meal plans (MealPlan/PlanMealItem domain).
/// These plans are what clients see in GET /api/client/plans/today.
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian/daily-plans")]
public class DietitianDailyPlanController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DietitianDailyPlanController> _logger;
    private readonly ISyncEventPublisher _syncPublisher;

    public DietitianDailyPlanController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DietitianDailyPlanController> logger,
        ISyncEventPublisher syncPublisher)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
        _syncPublisher = syncPublisher;
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private async Task<(Guid dietitianId, IActionResult? error)> GetDietitianIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId)) return (Guid.Empty, Unauthorized());

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null) return (Guid.Empty, Forbid());

        return (user.LinkedDietitianId.Value, null);
    }

    private async Task<bool> OwnsClientAsync(Guid dietitianId, Guid clientId) =>
        await _appDb.DietitianClientLinks
            .AnyAsync(l => l.DietitianId == dietitianId && l.ClientId == clientId && l.IsActive);

    // ─── GET week ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Get all daily plans for a client in a date range (max 14 days).
    /// Used by the weekly planner grid.
    /// </summary>
    [HttpGet("clients/{clientId:guid}")]
    public async Task<IActionResult> GetWeekPlans(
        Guid clientId,
        [FromQuery] string from,
        [FromQuery] string? to)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        if (!await OwnsClientAsync(dietitianId, clientId))
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found or not linked."));

        if (!DateOnly.TryParse(from, out var fromDate))
            return BadRequest(ApiProblems.Validation("INVALID_DATE", "from must be yyyy-MM-dd"));

        var toDate = DateOnly.TryParse(to, out var parsedTo) ? parsedTo : fromDate.AddDays(6);
        if ((toDate.DayNumber - fromDate.DayNumber) > 14)
            toDate = fromDate.AddDays(13);

        var (fromDt, _) = AppTime.ToStoredDayRange(fromDate);
        var (toDtExclusive, _) = AppTime.ToStoredDayRange(toDate.AddDays(1));

        var plans = await _appDb.MealPlans
            .Where(p => p.ClientId == clientId
                     && p.CreatedBy == dietitianId
                     && p.Date >= fromDt
                     && p.Date < toDtExclusive)
            .Include(p => p.Items)
            .OrderBy(p => p.Date)
            .ToListAsync();

        var result = plans.Select(MapPlanSummary).ToList();
        return Ok(new { plans = result });
    }

    // ─── POST create/upsert plan for a date ───────────────────────────────────

    /// <summary>
    /// Create a new Draft meal plan for a specific date.
    /// Only one plan per client per date is allowed — returns conflict if exists.
    /// </summary>
    [HttpPost("clients/{clientId:guid}")]
    public async Task<IActionResult> CreatePlan(
        Guid clientId,
        [FromBody] CreateDailyPlanRequest request)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        if (!await OwnsClientAsync(dietitianId, clientId))
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found or not linked."));

        if (!DateOnly.TryParse(request.Date, out var date))
            return BadRequest(ApiProblems.Validation("INVALID_DATE", "date must be yyyy-MM-dd"));

        if (date < AppTime.LocalToday)
            return BadRequest(ApiProblems.Validation("INVALID_PLAN_DATE", "Geçmiş bir gün için yeni plan oluşturulamaz."));

        var dateDt     = AppTime.ToStoredPlanDate(date);
        var dateDtNext = dateDt.AddDays(1);

        // Conflict check — range query avoids EF .Date property translation issues
        var existing = await _appDb.MealPlans
            .FirstOrDefaultAsync(p => p.ClientId == clientId
                                   && p.CreatedBy == dietitianId
                                   && p.Date >= dateDt
                                   && p.Date < dateDtNext);

        if (existing != null)
            return Conflict(new { code = "PLAN_EXISTS", message = $"A plan already exists for {request.Date}.", existingPlanId = existing.Id });

        var plan = new MealPlan
        {
            Id        = Guid.NewGuid(),
            ClientId  = clientId,
            CreatedBy = dietitianId,
            Date      = dateDt,
            Status    = MealPlanStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _appDb.MealPlans.Add(plan);
        await _appDb.SaveChangesAsync();
        await PublishPlanEventsAsync(dietitianId, clientId, plan.Id, plan.Date);

        return Ok(MapPlanSummary(plan));
    }

    // ─── PUT publish ──────────────────────────────────────────────────────────

    /// <summary>
    /// Publish a draft plan — makes it visible to the client.
    /// Requires at least 1 meal item.
    /// </summary>
    [HttpPut("{planId:guid}/publish")]
    public async Task<IActionResult> PublishPlan(Guid planId)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var plan = await _appDb.MealPlans
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == planId && p.CreatedBy == dietitianId);

        if (plan == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "Plan not found."));

        if (!plan.Items.Any())
            return BadRequest(ApiProblems.Validation("NO_MEALS", "Cannot publish a plan with no meal items."));

        plan.Status    = MealPlanStatus.Published;
        plan.UpdatedAt = DateTime.UtcNow;
        await _appDb.SaveChangesAsync();
        await PublishPlanEventsAsync(dietitianId, plan.ClientId, plan.Id, plan.Date);

        return Ok(MapPlanSummary(plan));
    }

    // ─── PUT unpublish ────────────────────────────────────────────────────────

    /// <summary>
    /// Revert a published plan back to Draft.
    /// </summary>
    [HttpPut("{planId:guid}/unpublish")]
    public async Task<IActionResult> UnpublishPlan(Guid planId)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var plan = await _appDb.MealPlans
            .FirstOrDefaultAsync(p => p.Id == planId && p.CreatedBy == dietitianId);

        if (plan == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "Plan not found."));

        plan.Status    = MealPlanStatus.Draft;
        plan.UpdatedAt = DateTime.UtcNow;
        await _appDb.SaveChangesAsync();
        await PublishPlanEventsAsync(dietitianId, plan.ClientId, plan.Id, plan.Date);

        return Ok(MapPlanSummary(plan));
    }

    // ─── DELETE plan ──────────────────────────────────────────────────────────

    /// <summary>
    /// Delete a Draft plan and all its meal items.
    /// Published plans cannot be deleted.
    /// </summary>
    [HttpDelete("{planId:guid}")]
    public async Task<IActionResult> DeletePlan(Guid planId)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var plan = await _appDb.MealPlans
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == planId && p.CreatedBy == dietitianId);

        if (plan == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "Plan not found."));

        if (plan.Status == MealPlanStatus.Published)
            return BadRequest(ApiProblems.Validation("PLAN_PUBLISHED",
                "Cannot delete a published plan. Unpublish it first."));

        _appDb.MealPlans.Remove(plan);
        await _appDb.SaveChangesAsync();
        await PublishPlanEventsAsync(dietitianId, plan.ClientId, plan.Id, plan.Date);

        return NoContent();
    }

    // ─── POST add meal item ───────────────────────────────────────────────────

    /// <summary>
    /// Add a meal item to an existing plan.
    /// </summary>
    [HttpPost("{planId:guid}/meals")]
    public async Task<IActionResult> AddMealItem(
        Guid planId,
        [FromBody] AddMealItemRequest request)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var plan = await _appDb.MealPlans
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == planId && p.CreatedBy == dietitianId);

        if (plan == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "Plan not found."));

        if (!TimeSpan.TryParse(request.Time, out var time))
            return BadRequest(ApiProblems.Validation("INVALID_TIME", "time must be HH:mm"));

        var scheduleError = ValidateEditableMealWindow(plan.Date, time);
        if (scheduleError != null) return scheduleError;

        if (!Enum.TryParse<PlanMealItemType>(request.MealType, ignoreCase: true, out var mealType))
            return BadRequest(ApiProblems.Validation("INVALID_MEAL_TYPE",
                "mealType must be one of: Breakfast, MidMorning, Lunch, Afternoon, Dinner, Evening, Snack"));

        var item = new PlanMealItem
        {
            Id         = Guid.NewGuid(),
            PlanId     = planId,
            Time       = time,
            MealType   = mealType,
            Title      = request.Title.Trim(),
            Note       = request.Note?.Trim(),
            OrderIndex = plan.Items.Count,
            Calories   = request.Calories,
            ProteinGrams = request.ProteinGrams,
            CarbsGrams   = request.CarbsGrams,
            FatGrams     = request.FatGrams,
            RecipeId   = request.RecipeId,
            CreatedAt  = DateTime.UtcNow,
        };

        _appDb.PlanMealItems.Add(item);
        plan.UpdatedAt = DateTime.UtcNow;
        await _appDb.SaveChangesAsync();
        await PublishPlanEventsAsync(dietitianId, plan.ClientId, plan.Id, plan.Date);

        return Ok(MapMealItem(item));
    }

    // ─── PUT update meal item ─────────────────────────────────────────────────

    /// <summary>
    /// Update an existing meal item.
    /// </summary>
    [HttpPut("{planId:guid}/meals/{mealId:guid}")]
    public async Task<IActionResult> UpdateMealItem(
        Guid planId,
        Guid mealId,
        [FromBody] AddMealItemRequest request)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var plan = await _appDb.MealPlans
            .FirstOrDefaultAsync(p => p.Id == planId && p.CreatedBy == dietitianId);

        if (plan == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "Plan not found."));

        var item = await _appDb.PlanMealItems.FirstOrDefaultAsync(i => i.Id == mealId && i.PlanId == planId);
        if (item == null)
            return NotFound(ApiProblems.NotFound("MEAL_NOT_FOUND", "Meal item not found."));

        if (!TimeSpan.TryParse(request.Time, out var time))
            return BadRequest(ApiProblems.Validation("INVALID_TIME", "time must be HH:mm"));

        var scheduleError = ValidateEditableMealWindow(plan.Date, time);
        if (scheduleError != null) return scheduleError;

        if (!Enum.TryParse<PlanMealItemType>(request.MealType, ignoreCase: true, out var mealType))
            return BadRequest(ApiProblems.Validation("INVALID_MEAL_TYPE",
                "mealType must be one of: Breakfast, MidMorning, Lunch, Afternoon, Dinner, Evening, Snack"));

        item.Time         = time;
        item.MealType     = mealType;
        item.Title        = request.Title.Trim();
        item.Note         = request.Note?.Trim();
        item.Calories     = request.Calories;
        item.ProteinGrams = request.ProteinGrams;
        item.CarbsGrams   = request.CarbsGrams;
        item.FatGrams     = request.FatGrams;
        item.RecipeId     = request.RecipeId;
        plan.UpdatedAt    = DateTime.UtcNow;

        await _appDb.SaveChangesAsync();
        await PublishPlanEventsAsync(dietitianId, plan.ClientId, plan.Id, plan.Date);
        return Ok(MapMealItem(item));
    }

    // ─── DELETE meal item ─────────────────────────────────────────────────────

    /// <summary>
    /// Delete a meal item from a plan.
    /// </summary>
    [HttpDelete("{planId:guid}/meals/{mealId:guid}")]
    public async Task<IActionResult> DeleteMealItem(Guid planId, Guid mealId)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var plan = await _appDb.MealPlans
            .FirstOrDefaultAsync(p => p.Id == planId && p.CreatedBy == dietitianId);

        if (plan == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "Plan not found."));

        var item = await _appDb.PlanMealItems.FirstOrDefaultAsync(i => i.Id == mealId && i.PlanId == planId);
        if (item == null)
            return NotFound(ApiProblems.NotFound("MEAL_NOT_FOUND", "Meal item not found."));

        _appDb.PlanMealItems.Remove(item);
        plan.UpdatedAt = DateTime.UtcNow;
        await _appDb.SaveChangesAsync();
        await PublishPlanEventsAsync(dietitianId, plan.ClientId, plan.Id, plan.Date);

        return NoContent();
    }

    // ─── POST bulk-publish ────────────────────────────────────────────────────

    /// <summary>
    /// Publish multiple Draft plans at once. Plans must have ≥1 meal item to be published.
    /// Returns { published, skipped } — skipped means already Published or 0 items.
    /// Max 14 dates per request.
    /// </summary>
    [HttpPost("clients/{clientId:guid}/bulk-publish")]
    public async Task<IActionResult> BulkPublish(Guid clientId, [FromBody] BulkPublishRequest req)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        if (!await OwnsClientAsync(dietitianId, clientId))
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found or not linked."));

        if (req.Dates == null || req.Dates.Count == 0)
            return BadRequest(ApiProblems.Validation("NO_DATES", "At least one date is required."));

        int published = 0, skipped = 0;

        foreach (var date in req.Dates.Take(14))
        {
            var dateDt = AppTime.ToStoredPlanDate(date);

            var plan = await _appDb.MealPlans
                .Include(p => p.Items)
                .FirstOrDefaultAsync(p => p.ClientId  == clientId
                                       && p.CreatedBy == dietitianId
                                       && p.Date      >= dateDt
                                       && p.Date      <  dateDt.AddDays(1));

            if (plan == null || plan.Status == MealPlanStatus.Published || !plan.Items.Any())
            {
                skipped++;
                continue;
            }

            plan.Status    = MealPlanStatus.Published;
            plan.UpdatedAt = DateTime.UtcNow;
            published++;
        }

        if (published > 0)
            await _appDb.SaveChangesAsync();

        return Ok(new { published, skipped });
    }

    // ─── POST copy-day ────────────────────────────────────────────────────────

    /// <summary>
    /// Copy all meal items from a source date plan to a new Draft plan on the target date.
    /// Returns 404 if no plan exists on sourceDate.
    /// Returns 409 if a plan already exists on targetDate (conflictMode=skip).
    /// </summary>
    [HttpPost("clients/{clientId:guid}/copy-day")]
    public async Task<IActionResult> CopyDay(Guid clientId, [FromBody] CopyDayRequest req)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        if (!await OwnsClientAsync(dietitianId, clientId))
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found or not linked."));

        var sourceDt    = AppTime.ToStoredPlanDate(req.SourceDate);
        var targetDt    = AppTime.ToStoredPlanDate(req.TargetDate);

        var sourcePlan = await _appDb.MealPlans
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.ClientId  == clientId
                                   && p.CreatedBy == dietitianId
                                   && p.Date      >= sourceDt
                                   && p.Date      <  sourceDt.AddDays(1));

        if (sourcePlan == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "No plan found for source date."));

        var targetExists = await _appDb.MealPlans
            .AnyAsync(p => p.ClientId  == clientId
                        && p.CreatedBy == dietitianId
                        && p.Date      >= targetDt
                        && p.Date      <  targetDt.AddDays(1));

        if (targetExists)
            return Conflict(new { code = "PLAN_EXISTS", message = $"A plan already exists for {req.TargetDate}." });

        var newPlan = new MealPlan
        {
            Id        = Guid.NewGuid(),
            ClientId  = clientId,
            CreatedBy = dietitianId,
            Date      = targetDt,
            Status    = MealPlanStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        var newItems = sourcePlan.Items
            .OrderBy(i => i.OrderIndex)
            .Select((item, idx) => new PlanMealItem
            {
                Id           = Guid.NewGuid(),
                PlanId       = newPlan.Id,
                Time         = item.Time,
                MealType     = item.MealType,
                Title        = item.Title,
                Note         = item.Note,
                OrderIndex   = idx,
                Calories     = item.Calories,
                ProteinGrams = item.ProteinGrams,
                CarbsGrams   = item.CarbsGrams,
                FatGrams     = item.FatGrams,
                RecipeId     = item.RecipeId,
                CreatedAt    = DateTime.UtcNow,
            })
            .ToList();

        _appDb.MealPlans.Add(newPlan);
        _appDb.PlanMealItems.AddRange(newItems);
        await _appDb.SaveChangesAsync();
        await PublishPlanEventsAsync(dietitianId, clientId, newPlan.Id, newPlan.Date);

        return Ok(MapPlanSummary(newPlan));
    }

    // ─── POST copy-week ───────────────────────────────────────────────────────

    /// <summary>
    /// Copy 7 days of plans from one week to another. Existing target days are skipped.
    /// sourceWeekStart and targetWeekStart should be the Monday of each week (yyyy-MM-dd).
    /// Returns { copied, skipped }.
    /// </summary>
    [HttpPost("clients/{clientId:guid}/copy-week")]
    public async Task<IActionResult> CopyWeek(Guid clientId, [FromBody] CopyWeekRequest req)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        if (!await OwnsClientAsync(dietitianId, clientId))
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found or not linked."));

        int copied = 0, skipped = 0;

        for (int i = 0; i < 7; i++)
        {
            var sourceDate = req.SourceWeekStart.AddDays(i);
            var targetDate = req.TargetWeekStart.AddDays(i);
            var sourceDt   = AppTime.ToStoredPlanDate(sourceDate);
            var targetDt   = AppTime.ToStoredPlanDate(targetDate);

            var sourcePlan = await _appDb.MealPlans
                .Include(p => p.Items)
                .FirstOrDefaultAsync(p => p.ClientId  == clientId
                                       && p.CreatedBy == dietitianId
                                       && p.Date      >= sourceDt
                                       && p.Date      <  sourceDt.AddDays(1));

            if (sourcePlan == null || !sourcePlan.Items.Any())
            {
                skipped++;
                continue;
            }

            var targetExists = await _appDb.MealPlans
                .AnyAsync(p => p.ClientId  == clientId
                            && p.CreatedBy == dietitianId
                            && p.Date      >= targetDt
                            && p.Date      <  targetDt.AddDays(1));

            if (targetExists)
            {
                skipped++;
                continue;
            }

            var newPlan = new MealPlan
            {
                Id        = Guid.NewGuid(),
                ClientId  = clientId,
                CreatedBy = dietitianId,
                Date      = targetDt,
                Status    = MealPlanStatus.Draft,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            var newItems = sourcePlan.Items
                .OrderBy(x => x.OrderIndex)
                .Select((item, idx) => new PlanMealItem
                {
                    Id           = Guid.NewGuid(),
                    PlanId       = newPlan.Id,
                    Time         = item.Time,
                    MealType     = item.MealType,
                    Title        = item.Title,
                    Note         = item.Note,
                    OrderIndex   = idx,
                    Calories     = item.Calories,
                    ProteinGrams = item.ProteinGrams,
                    CarbsGrams   = item.CarbsGrams,
                    FatGrams     = item.FatGrams,
                    RecipeId     = item.RecipeId,
                    CreatedAt    = DateTime.UtcNow,
                })
                .ToList();

            _appDb.MealPlans.Add(newPlan);
            _appDb.PlanMealItems.AddRange(newItems);
            copied++;
        }

        if (copied > 0)
            await _appDb.SaveChangesAsync();

        return Ok(new { copied, skipped });
    }

    private async Task PublishPlanEventsAsync(Guid dietitianId, Guid clientId, Guid planId, DateTime planDateUtc)
    {
        var date = AppTime.ToPlanDateOnly(planDateUtc);
        var payload = new
        {
            clientId,
            planId,
            date = date.ToString("yyyy-MM-dd")
        };

        await _syncPublisher.PublishToLinkAsync(dietitianId, clientId, "plan.week.updated", payload);

        if (date == AppTime.LocalToday)
        {
            await _syncPublisher.PublishToLinkAsync(dietitianId, clientId, "plan.today.updated", payload);
        }
    }

    private IActionResult? ValidateEditableMealWindow(DateTime storedPlanDate, TimeSpan mealTime)
    {
        var planDate = AppTime.ToPlanDateOnly(storedPlanDate);
        if (planDate < AppTime.LocalToday)
        {
            return BadRequest(ApiProblems.Validation(
                "PLAN_DATE_PASSED",
                "Geçmiş günlerdeki öğün saatleri değiştirilemez."));
        }

        if (false && planDate == AppTime.LocalToday && mealTime < AppTime.LocalNow.TimeOfDay)
        {
            return BadRequest(ApiProblems.Validation(
                "MEAL_TIME_IN_PAST",
                "Bugün için yalnızca şu an ve sonrasındaki saatlere öğün ekleyebilirsin."));
        }

        return null;
    }

    // ─── mappers ──────────────────────────────────────────────────────────────

    private static object MapPlanSummary(MealPlan plan) => new
    {
        id       = plan.Id,
        date     = AppTime.FormatDateKey(plan.Date),
        status   = plan.Status.ToString(),
        meals    = plan.Items.OrderBy(i => i.Time).Select(MapMealItem).ToList(),
        updatedAt = plan.UpdatedAt,
    };

    private static object MapMealItem(PlanMealItem item) => new
    {
        id         = item.Id,
        time       = item.Time.ToString(@"hh\:mm"),
        mealType   = item.MealType.ToString(),
        title      = item.Title,
        note       = item.Note,
        orderIndex = item.OrderIndex,
        calories   = item.Calories,
        proteinGrams = item.ProteinGrams,
        carbsGrams   = item.CarbsGrams,
        fatGrams     = item.FatGrams,
        recipeId   = item.RecipeId,
    };
}

// ── Request DTOs ────────────────────────────────────────────────────────────

public record CreateDailyPlanRequest(string Date);

public record AddMealItemRequest(
    string Time,        // HH:mm
    string MealType,    // Breakfast | MidMorning | Lunch | Afternoon | Dinner | Evening | Snack
    string Title,
    string? Note,
    int? Calories,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    Guid? RecipeId);

public record BulkPublishRequest(
    [System.ComponentModel.DataAnnotations.Required] List<DateOnly> Dates);

public record CopyDayRequest(
    [System.ComponentModel.DataAnnotations.Required] DateOnly SourceDate,
    [System.ComponentModel.DataAnnotations.Required] DateOnly TargetDate,
    string ConflictMode = "skip");   // future: overwrite | merge

public record CopyWeekRequest(
    [System.ComponentModel.DataAnnotations.Required] DateOnly SourceWeekStart,
    [System.ComponentModel.DataAnnotations.Required] DateOnly TargetWeekStart,
    string ConflictMode = "skip");   // future: overwrite | merge
