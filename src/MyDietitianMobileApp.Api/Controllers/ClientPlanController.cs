using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Api.Features;
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
            .Include(p => p.Items)
                .ThenInclude(i => i.SelectedRecipe)
            .FirstOrDefaultAsync();

        if (plan == null)
            return Ok(new { plan = (object?)null });

        var mealIds = plan.Items.Select(i => i.Id).ToList();
        var completions = await _appDb.MealCompletions
            .Where(c => c.ClientId == clientId!.Value && mealIds.Contains(c.DietPlanMealId))
            .ToListAsync();
        var completionMap = completions.ToDictionary(c => c.DietPlanMealId);
        var altRecipeMap = await LoadAlternativeRecipeMapAsync(completions);

        var dto = MapPlan(plan, completionMap, altRecipeMap);
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
            .Include(p => p.Items)
                .ThenInclude(i => i.SelectedRecipe)
            .OrderBy(p => p.Date)
            .ToListAsync();

        // Bulk-load completions
        var allMealIds = plans.SelectMany(p => p.Items.Select(i => i.Id)).ToList();
        var completions = await _appDb.MealCompletions
            .Where(c => c.ClientId == clientId!.Value && allMealIds.Contains(c.DietPlanMealId))
            .ToListAsync();
        var completionMap = completions.ToDictionary(c => c.DietPlanMealId);
        var altRecipeMap = await LoadAlternativeRecipeMapAsync(completions);

        var dtos = plans.Select(p => MapPlan(p, completionMap, altRecipeMap)).ToList();
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

        var (completionStatus, alternativeRecipeId) = ResolveCompletionTarget(mealItem!);

        return await UpsertCompletion(
            clientId!.Value,
            mealItem!.Plan.CreatedBy,
            mealItemId,
            completionStatus,
            body?.Note,
            alternativeRecipeId);
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

        if (body.AlternativeRecipeId.HasValue && body.AlternativeRecipeId.Value != Guid.Empty)
        {
            mealItem!.SelectedRecipeId = body.AlternativeRecipeId.Value;
            mealItem.SelectedRecipeSource = PlanMealSelectionTypes.Alternative;
        }

        return await UpsertCompletion(
            clientId!.Value,
            mealItem!.Plan.CreatedBy,
            mealItemId,
            MealCompletionStatus.Alternative,
            body.Note,
            body.AlternativeRecipeId);
    }

    [HttpPost("meals/{mealItemId}/selected-recipe")]
    public async Task<IActionResult> SelectMealRecipe(Guid mealItemId, [FromBody] MealRecipeSelectionRequest body)
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var (mealItem, ownershipError) = await VerifyMealOwnership(mealItemId, clientId!.Value);
        if (ownershipError != null) return ownershipError;

        var normalizedSelectionType = NormalizeSelectionType(body.SelectionType);
        if (normalizedSelectionType == null)
        {
            return BadRequest(ApiProblems.Validation(
                "INVALID_SELECTION_TYPE",
                "Seçim türü Original veya Alternative olmalıdır."));
        }

        if (normalizedSelectionType == PlanMealSelectionTypes.Alternative)
        {
            if (!body.AlternativeRecipeId.HasValue || body.AlternativeRecipeId.Value == Guid.Empty)
            {
                return BadRequest(ApiProblems.Validation(
                    "ALTERNATIVE_RECIPE_REQUIRED",
                    "Alternatif seçim için tarif seçilmelidir."));
            }

            var recipe = await LoadAccessibleRecipeAsync(body.AlternativeRecipeId.Value);
            if (recipe == null)
            {
                return NotFound(ApiProblems.NotFound("RECIPE_NOT_FOUND", "Alternatif tarif bulunamadı."));
            }

            mealItem!.SelectedRecipeId = recipe.Id;
            mealItem.SelectedRecipeSource = PlanMealSelectionTypes.Alternative;
            await _appDb.SaveChangesAsync();
            await PublishPlanAndGamificationEventsAsync(clientId.Value, mealItem.Plan.CreatedBy, mealItemId);

            return Ok(new
            {
                message = "Alternatif tarif seçildi.",
                selectionType = PlanMealSelectionTypes.Alternative,
                selectedRecipeId = recipe.Id,
                selectedRecipeName = recipe.Name
            });
        }

        mealItem!.SelectedRecipeId = mealItem.RecipeId;
        mealItem.SelectedRecipeSource = PlanMealSelectionTypes.Original;
        await _appDb.SaveChangesAsync();
        await PublishPlanAndGamificationEventsAsync(clientId.Value, mealItem.Plan.CreatedBy, mealItemId);

        return Ok(new
        {
            message = "Planlanan tarif tekrar seçildi.",
            selectionType = PlanMealSelectionTypes.Original,
            selectedRecipeId = mealItem.RecipeId,
            selectedRecipeName = mealItem.Recipe?.Name
        });
    }

    [HttpPost("meals/{mealItemId}/feedback")]
    public async Task<IActionResult> SaveMealFeedback(Guid mealItemId, [FromBody] MealFeedbackRequest body)
    {
        var (clientId, premiumError) = await RequirePremiumClientAsync();
        if (premiumError != null) return premiumError;

        var (mealItem, ownershipError) = await VerifyMealOwnership(mealItemId, clientId!.Value);
        if (ownershipError != null) return ownershipError;

        var completion = await _appDb.MealCompletions
            .FirstOrDefaultAsync(c => c.ClientId == clientId.Value && c.DietPlanMealId == mealItemId);

        if (completion == null)
        {
            return BadRequest(new { message = "Değerlendirme yalnızca tamamlanan öğünlere eklenebilir." });
        }

        var normalizedFeedback = NormalizeFeedbackKey(body.FeedbackKey);
        if (normalizedFeedback == null)
        {
            return BadRequest(new { message = "Geçersiz değerlendirme anahtarı." });
        }

        completion.Update(
            completion.Status,
            MealFeedbackCodec.Apply(completion.Note, normalizedFeedback),
            completion.AlternativeRecipeId);

        await _appDb.SaveChangesAsync();
        await PublishPlanAndGamificationEventsAsync(clientId.Value, mealItem!.Plan.CreatedBy, mealItemId);

        return Ok(new { message = "Öğün değerlendirmesi kaydedildi.", feedbackKey = normalizedFeedback });
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

    private async Task<Dictionary<Guid, AltRecipeInfo>> LoadAlternativeRecipeMapAsync(
        IEnumerable<MealCompletion> completions)
    {
        var altIds = completions
            .Where(c => c.AlternativeRecipeId.HasValue)
            .Select(c => c.AlternativeRecipeId!.Value)
            .Distinct()
            .ToList();

        if (altIds.Count == 0) return new Dictionary<Guid, AltRecipeInfo>();

        return await _appDb.Recipes
            .Where(r => altIds.Contains(r.Id))
            .Select(r => new AltRecipeInfo
            {
                Id           = r.Id,
                Name         = r.Name,
                CaloriesKcal = r.CaloriesKcal,
                ProteinGrams = r.ProteinGrams,
                CarbsGrams   = r.CarbsGrams,
                FatGrams     = r.FatGrams,
            })
            .ToDictionaryAsync(r => r.Id);
    }

    private static MealPlanDTO MapPlan(
        MealPlan plan,
        Dictionary<Guid, MealCompletion> completionMap,
        Dictionary<Guid, AltRecipeInfo> altRecipeMap)
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
                    AltRecipeInfo? alt = comp?.AlternativeRecipeId.HasValue == true
                        && altRecipeMap.TryGetValue(comp.AlternativeRecipeId!.Value, out var a) ? a : null;
                    var selectedRecipe = i.SelectedRecipeId.HasValue && i.SelectedRecipeId == i.SelectedRecipe?.Id
                        ? i.SelectedRecipe
                        : (i.SelectedRecipeId == i.RecipeId ? i.Recipe : null);
                    var selectedRecipeId = i.SelectedRecipeId ?? i.RecipeId;
                    var selectedRecipeName = selectedRecipe?.Name ?? i.Recipe?.Name;
                    var selectedRecipeSource = string.IsNullOrWhiteSpace(i.SelectedRecipeSource)
                        ? PlanMealSelectionTypes.Original
                        : i.SelectedRecipeSource;

                    return new MealItemDTO
                    {
                        Id               = i.Id,
                        Time             = i.Time.ToString(@"hh\:mm"),
                        MealType         = i.MealType.ToString(),
                        RecipeId         = i.RecipeId,
                        RecipeName       = i.Recipe?.Name,
                        SelectedRecipeId = selectedRecipeId,
                        SelectedRecipeName = selectedRecipeName,
                        SelectedRecipeSource = selectedRecipeSource,
                        SelectedCalories = selectedRecipe?.CaloriesKcal ?? i.Calories,
                        SelectedMacros = selectedRecipe != null && (selectedRecipe.ProteinGrams.HasValue || selectedRecipe.CarbsGrams.HasValue || selectedRecipe.FatGrams.HasValue)
                            ? new MacrosDTO
                            {
                                ProteinGrams = selectedRecipe.ProteinGrams,
                                CarbsGrams = selectedRecipe.CarbsGrams,
                                FatGrams = selectedRecipe.FatGrams,
                            }
                            : (i.ProteinGrams.HasValue || i.CarbsGrams.HasValue || i.FatGrams.HasValue
                                ? new MacrosDTO { ProteinGrams = i.ProteinGrams, CarbsGrams = i.CarbsGrams, FatGrams = i.FatGrams }
                                : null),
                        Title            = i.Title,
                        Note             = i.Note,
                        OrderIndex       = i.OrderIndex,
                        Calories         = i.Calories,
                        Macros           = i.ProteinGrams.HasValue || i.CarbsGrams.HasValue || i.FatGrams.HasValue
                            ? new MacrosDTO { ProteinGrams = i.ProteinGrams, CarbsGrams = i.CarbsGrams, FatGrams = i.FatGrams }
                            : null,
                        CompletionStatus       = comp?.Status.ToString() ?? "Planned",
                        AlternativeRecipeId    = comp?.AlternativeRecipeId,
                        AlternativeRecipeName  = alt?.Name,
                        AlternativeCalories    = alt?.CaloriesKcal,
                        AlternativeMacros      = alt != null && (alt.ProteinGrams.HasValue || alt.CarbsGrams.HasValue || alt.FatGrams.HasValue)
                            ? new MacrosDTO { ProteinGrams = alt.ProteinGrams, CarbsGrams = alt.CarbsGrams, FatGrams = alt.FatGrams }
                            : null,
                        FeedbackKey            = MealFeedbackCodec.TryParse(comp?.Note, out var feedbackKey)
                            ? feedbackKey
                            : null,
                        IsActionableNow        = AppTime.CanClientActOnMeal(plan.Date, i.Time),
                        ActionBlockedUntilDate = planDateKey,
                        ActionBlockedUntilTime = AppTime.FormatTimeKey(i.Time),
                    };
                })
                .ToList()
        };
    }

    private sealed class AltRecipeInfo
    {
        public Guid Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public int? CaloriesKcal { get; init; }
        public decimal? ProteinGrams { get; init; }
        public decimal? CarbsGrams { get; init; }
        public decimal? FatGrams { get; init; }
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
            .Include(i => i.Recipe)
            .Include(i => i.SelectedRecipe)
            .FirstOrDefaultAsync(i => i.Id == mealItemId);

        if (item == null)
            return (null, NotFound(new { message = "Öğün bulunamadı" }));

        if (item.Plan.ClientId != clientId)
            return (null, Forbid());

        return (item, null);
    }

    private (MealCompletionStatus status, Guid? alternativeRecipeId) ResolveCompletionTarget(PlanMealItem mealItem)
    {
        if (mealItem.SelectedRecipeSource == PlanMealSelectionTypes.Alternative
            && mealItem.SelectedRecipeId.HasValue
            && mealItem.SelectedRecipeId != mealItem.RecipeId)
        {
            return (MealCompletionStatus.Alternative, mealItem.SelectedRecipeId);
        }

        return (MealCompletionStatus.Done, null);
    }

    private async Task<Recipe?> LoadAccessibleRecipeAsync(Guid recipeId)
    {
        var userIdRaw = User.GetUserId();
        if (string.IsNullOrWhiteSpace(userIdRaw) || !Guid.TryParse(userIdRaw, out var userId))
            return null;

        var premium = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
        var query = _appDb.Recipes
            .AsNoTracking()
            .Where(x => x.Id == recipeId)
            .Where(x => !x.IsDemo && !x.IsDraft && !x.IsHiddenFromProduction);

        if (!premium.IsPremium)
            return await query.FirstOrDefaultAsync(x => x.IsPublic);

        return await query.FirstOrDefaultAsync(x => x.IsPublic || x.DietitianId == premium.ActiveDietitianId);
    }

    private static string? NormalizeSelectionType(string? selectionType)
    {
        if (string.IsNullOrWhiteSpace(selectionType))
            return null;

        var normalized = selectionType.Trim();
        if (normalized.Equals(PlanMealSelectionTypes.Original, StringComparison.OrdinalIgnoreCase))
            return PlanMealSelectionTypes.Original;
        if (normalized.Equals(PlanMealSelectionTypes.Alternative, StringComparison.OrdinalIgnoreCase))
            return PlanMealSelectionTypes.Alternative;
        return null;
    }

    private async Task<IActionResult> UpsertCompletion(
        Guid clientId, Guid dietitianId, Guid mealItemId,
        MealCompletionStatus status, string? note, Guid? alternativeRecipeId)
    {
        var existing = await _appDb.MealCompletions
            .FirstOrDefaultAsync(c => c.ClientId == clientId && c.DietPlanMealId == mealItemId);

        var effectiveStatus = status;
        var effectiveAlternativeRecipeId = alternativeRecipeId;

        if (existing != null)
        {
            if (existing.Status == MealCompletionStatus.Alternative && status == MealCompletionStatus.Done)
            {
                // Protect alternative-based progress from accidental "Done" taps on a different
                // screen. Switching back to the planned recipe should require an explicit undo.
                effectiveStatus = MealCompletionStatus.Alternative;
                effectiveAlternativeRecipeId = existing.AlternativeRecipeId;
            }

            existing.Update(effectiveStatus, note, effectiveAlternativeRecipeId);
        }
        else
        {
            var completion = new MealCompletion(clientId, dietitianId, mealItemId, effectiveStatus, note, effectiveAlternativeRecipeId);
            _appDb.MealCompletions.Add(completion);
        }

        await _appDb.SaveChangesAsync();
        await _gamificationService.TrackEventAsync(
            clientId,
            true,
            dietitianId,
            effectiveStatus switch
            {
                MealCompletionStatus.Done => ClientGamificationService.EventTypes.MealDone,
                MealCompletionStatus.Alternative => ClientGamificationService.EventTypes.MealAlternative,
                MealCompletionStatus.Skipped => ClientGamificationService.EventTypes.MealSkipped,
                _ => ClientGamificationService.EventTypes.MealDone
            },
            new
            {
                mealItemId,
                requestedStatus = status.ToString(),
                effectiveStatus = effectiveStatus.ToString()
            });
        await PublishPlanAndGamificationEventsAsync(clientId, dietitianId, mealItemId);

        var message = effectiveStatus switch
        {
            MealCompletionStatus.Done        => "Harika! Öğün tamamlandı 🎉",
            MealCompletionStatus.Skipped     => "Öğün atlandı olarak işaretlendi",
            MealCompletionStatus.Alternative => "Alternatif tarif ile tamamlandı 👍",
            _                                => "Kaydedildi"
        };

        return Ok(new { message, status = effectiveStatus.ToString() });
    }

    private static string? NormalizeFeedbackKey(string? feedbackKey)
    {
        if (string.IsNullOrWhiteSpace(feedbackKey))
            return null;

        var normalized = feedbackKey.Trim().ToLowerInvariant();
        return normalized is "filling" or "light" or "again" or "hard"
            ? normalized
            : null;
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

public record MealFeedbackRequest(string FeedbackKey);

public record MealRecipeSelectionRequest(string SelectionType, Guid? AlternativeRecipeId);

internal static class PlanMealSelectionTypes
{
    public const string Original = "Original";
    public const string Alternative = "Alternative";
}
