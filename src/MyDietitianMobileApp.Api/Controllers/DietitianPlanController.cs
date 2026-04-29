using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages dietitian meal plan operations: templates, assignments, client plans
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian/plans")]
public class DietitianPlanController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DietitianPlanController> _logger;

    public DietitianPlanController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DietitianPlanController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// Assign a meal plan to a client
    /// </summary>
    [HttpPost("clients/{clientId:guid}/assign")]
    public async Task<IActionResult> AssignPlanToClient(
        Guid clientId,
        [FromBody] AssignPlanRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // IDOR Prevention: Verify dietitian owns this client
        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == dietitianId &&
                                     l.ClientId == clientId &&
                                     l.IsActive);

        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND",
                "Client not found or not linked to this dietitian"));

        // Validate dates
        if (!DateTime.TryParse(request.StartDate, out var startDate))
        {
            return BadRequest(ApiProblems.Validation("INVALID_START_DATE", "Invalid start date format"));
        }

        DateTime? endDate = null;
        if (!string.IsNullOrWhiteSpace(request.EndDate))
        {
            if (!DateTime.TryParse(request.EndDate, out var parsedEndDate))
            {
                return BadRequest(ApiProblems.Validation("INVALID_END_DATE", "Invalid end date format"));
            }
            endDate = DateTime.SpecifyKind(parsedEndDate.Date, DateTimeKind.Utc);
        }

        var startUtc = DateTime.SpecifyKind(startDate.Date, DateTimeKind.Utc);

        // Validate recipes exist
        var recipeIds = request.Meals.Select(m => m.RecipeId).Distinct().ToList();
        var existingRecipes = await _appDb.Recipes
            .Where(r => recipeIds.Contains(r.Id) &&
                       r.DietitianId == dietitianId &&
                       !r.IsArchived &&
                       !r.IsDemo &&
                       !r.IsDraft &&
                       !r.IsHiddenFromProduction)
            .Select(r => r.Id)
            .ToListAsync();

        var missingRecipes = recipeIds.Except(existingRecipes).ToList();
        if (missingRecipes.Any())
        {
            return BadRequest(ApiProblems.Validation("RECIPE_NOT_FOUND",
                $"Some recipes not found or not accessible: {string.Join(", ", missingRecipes)}"));
        }

        // Create meal plan
        var mealPlan = new ClientMealPlan(
            clientId,
            dietitianId,
            request.Name,
            startUtc,
            endDate,
            request.Description);

        _appDb.ClientMealPlans.Add(mealPlan);

        // Add meals to plan
        foreach (var mealRequest in request.Meals)
        {
            var meal = new ClientMeal(
                mealPlan.Id,
                mealRequest.RecipeId,
                mealRequest.DayOfWeek,
                mealRequest.MealType,
                mealRequest.Servings);

            _appDb.ClientMeals.Add(meal);
        }

        // Write plan_assigned activity event
        _appDb.ClientActivities.Add(new ClientActivity(
            clientId,
            dietitianId,
            "plan_assigned",
            new { planId = mealPlan.Id.ToString(), planName = mealPlan.Name }));

        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            id = mealPlan.Id,
            name = mealPlan.Name,
            startDate = mealPlan.StartDate.ToString("yyyy-MM-dd"),
            endDate = mealPlan.EndDate?.ToString("yyyy-MM-dd"),
            mealCount = request.Meals.Count
        });
    }

    /// <summary>
    /// Get all meal plans for a specific client
    /// </summary>
    [HttpGet("clients/{clientId:guid}")]
    public async Task<IActionResult> GetClientPlans(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // IDOR Prevention
        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value &&
                                     l.ClientId == clientId &&
                                     l.IsActive);

        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND",
                "Client not found or not linked to this dietitian"));

        var plans = await _appDb.ClientMealPlans
            .Where(p => p.ClientId == clientId)
            .OrderByDescending(p => p.StartDate)
            .Select(p => new
            {
                id = p.Id,
                name = p.Name,
                description = p.Description,
                startDate = p.StartDate,
                endDate = p.EndDate,
                isActive = p.IsActive,
                mealCount = p.Meals.Count,
                completedMeals = p.Meals.Count(m => m.CompletedAt != null)
            })
            .ToListAsync();

        return Ok(new { items = plans });
    }

    /// <summary>
    /// Assign a plan to a client from a template — creates a ClientMealPlan (with ClientMeals
    /// for template items that have a RecipeId) and optionally deactivates the current active plan.
    /// </summary>
    [HttpPost("clients/{clientId:guid}/assign-from-template")]
    public async Task<IActionResult> AssignFromTemplate(
        Guid clientId,
        [FromBody] AssignFromTemplateRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == dietitianId &&
                                     l.ClientId == clientId &&
                                     l.IsActive);
        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found"));

        var template = await _appDb.MealPlanTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.DietitianId == dietitianId);

        if (template == null)
            return NotFound(ApiProblems.NotFound("TEMPLATE_NOT_FOUND", "Template not found"));

        if (!DateTime.TryParse(request.StartDate, out var startDate))
            return BadRequest(ApiProblems.Validation("INVALID_START_DATE", "Invalid start date"));

        DateTime? endDate = null;
        if (!string.IsNullOrWhiteSpace(request.EndDate) && DateTime.TryParse(request.EndDate, out var ed))
            endDate = DateTime.SpecifyKind(ed.Date, DateTimeKind.Utc);

        var startUtc = DateTime.SpecifyKind(startDate.Date, DateTimeKind.Utc);

        // Deactivate current active plan if requested
        if (request.DeactivateCurrent)
        {
            var currentPlan = await _appDb.ClientMealPlans
                .Where(p => p.ClientId == clientId && p.IsActive)
                .ToListAsync();
            foreach (var cp in currentPlan) cp.Deactivate();
        }

        var planName = string.IsNullOrWhiteSpace(request.Name) ? template.Name : request.Name;
        var mealPlan = new ClientMealPlan(clientId, dietitianId, planName, startUtc, endDate, template.Description);
        _appDb.ClientMealPlans.Add(mealPlan);

        // Only create ClientMeal entries for template items that have a RecipeId
        var recipeItems = template.Items.Where(i => i.RecipeId.HasValue).ToList();
        foreach (var item in recipeItems)
        {
            // Map PlanMealItemType enum ordinal to day-of-week by order index (cycle Mon–Sun)
            var dow = item.OrderIndex % 7;
            var mealType = item.MealType.ToString().ToLower() switch
            {
                "breakfast" => "breakfast",
                "lunch"     => "lunch",
                "dinner"    => "dinner",
                _           => "snack"
            };
            _appDb.ClientMeals.Add(new ClientMeal(mealPlan.Id, item.RecipeId!.Value, dow, mealType));
        }

        // Write plan_assigned activity event
        _appDb.ClientActivities.Add(new ClientActivity(
            clientId,
            dietitianId,
            "plan_assigned",
            new { planId = mealPlan.Id.ToString(), planName = mealPlan.Name, templateName = template.Name }));

        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            id             = mealPlan.Id,
            name           = mealPlan.Name,
            startDate      = mealPlan.StartDate.ToString("yyyy-MM-dd"),
            endDate        = mealPlan.EndDate?.ToString("yyyy-MM-dd"),
            mealsCreated   = recipeItems.Count,
            templateName   = template.Name
        });
    }

    /// <summary>
    /// Update an existing client meal plan's name/description/dates (does not touch meals).
    /// Writes a plan_updated activity event.
    /// </summary>
    [HttpPatch("{planId:guid}")]
    public async Task<IActionResult> UpdateClientPlan(
        Guid planId,
        [FromBody] UpdateClientPlanRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        var plan = await _appDb.ClientMealPlans
            .FirstOrDefaultAsync(p => p.Id == planId && p.DietitianId == dietitianId);

        if (plan == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "Plan not found"));

        // Apply updates — use existing fields as fallback when omitted
        var newName = string.IsNullOrWhiteSpace(request.Name) ? plan.Name : request.Name;
        var newDescription = request.Description ?? plan.Description;

        DateTime newStartDate = plan.StartDate;
        if (!string.IsNullOrWhiteSpace(request.StartDate) && DateTime.TryParse(request.StartDate, out var sd))
            newStartDate = DateTime.SpecifyKind(sd.Date, DateTimeKind.Utc);

        DateTime? newEndDate = plan.EndDate;
        if (request.EndDate is not null)
        {
            newEndDate = string.IsNullOrWhiteSpace(request.EndDate)
                ? null
                : DateTime.TryParse(request.EndDate, out var ed)
                    ? DateTime.SpecifyKind(ed.Date, DateTimeKind.Utc)
                    : plan.EndDate;
        }

        plan.UpdateDetails(newName, newDescription, newStartDate, newEndDate);

        // Write plan_updated activity event
        _appDb.ClientActivities.Add(new ClientActivity(
            plan.ClientId,
            dietitianId,
            "plan_updated",
            new { planId = plan.Id.ToString(), planName = plan.Name }));

        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            id          = plan.Id,
            name        = plan.Name,
            description = plan.Description,
            startDate   = plan.StartDate.ToString("yyyy-MM-dd"),
            endDate     = plan.EndDate?.ToString("yyyy-MM-dd"),
        });
    }

    /// <summary>
    /// Get dashboard summary (KPIs)
    /// </summary>
    [HttpGet("~/api/dietitian/dashboard/summary")]
    public async Task<IActionResult> GetDashboardSummary()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // Get active premium clients
        var activePremiumClients = await _appDb.DietitianClientLinks
            .Where(l => l.DietitianId == dietitianId &&
                       l.IsActive &&
                       l.Client.IsPremium)
            .CountAsync();

        // Get expiring soon (within 7 days)
        var sevenDaysFromNow = DateTime.UtcNow.AddDays(7);
        var expiringSoon = await _appDb.DietitianClientLinks
            .Where(l => l.DietitianId == dietitianId &&
                       l.IsActive &&
                       l.Client.IsPremium &&
                       l.Client.ProgramEndDate != null &&
                       l.Client.ProgramEndDate <= sevenDaysFromNow &&
                       l.Client.ProgramEndDate > DateTime.UtcNow)
            .CountAsync();

        // Calculate average compliance
        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
        var clientIds = await _appDb.DietitianClientLinks
            .Where(l => l.DietitianId == dietitianId && l.IsActive)
            .Select(l => l.ClientId)
            .ToListAsync();

        var complianceData = await _appDb.ClientMealPlans
            .Where(p => clientIds.Contains(p.ClientId) && p.StartDate >= thirtyDaysAgo)
            .SelectMany(p => p.Meals)
            .GroupBy(m => 1)
            .Select(g => new
            {
                TotalMeals = g.Count(),
                CompletedMeals = g.Count(m => m.CompletedAt != null)
            })
            .FirstOrDefaultAsync();

        decimal averageCompliance = 0;
        if (complianceData != null && complianceData.TotalMeals > 0)
        {
            averageCompliance = Math.Round((decimal)complianceData.CompletedMeals / complianceData.TotalMeals * 100, 1);
        }

        // Get at-risk clients (compliance < 50%)
        // This is a simplified calculation - in production, you'd calculate per-client compliance
        var atRisk = 0; // TODO: Implement per-client compliance calculation

        return Ok(new
        {
            activePremiumClients,
            averageCompliance,
            expiringSoon,
            atRisk
        });
    }
}

// DTOs
public record AssignFromTemplateRequest(
    Guid TemplateId,
    string StartDate,
    string? EndDate = null,
    string? Name = null,
    bool DeactivateCurrent = true);

public record AssignPlanRequest(
    string Name,
    string? Description,
    string StartDate,
    string? EndDate,
    List<MealRequest> Meals);

public record MealRequest(
    Guid RecipeId,
    int DayOfWeek,
    string MealType,
    int Servings);

public record UpdateClientPlanRequest(
    string? Name = null,
    string? Description = null,
    string? StartDate = null,
    string? EndDate = null);
