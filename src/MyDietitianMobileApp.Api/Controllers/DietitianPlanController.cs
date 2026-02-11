using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Dietitian endpoints for managing client meal plans
/// API-PLAN-02: Dietitian CRUD operations
/// </summary>
[Authorize(Roles = "Dietitian")]
[ApiController]
[Route("api/dietitian")]
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
    /// Get meal plans for a specific client and date
    /// </summary>
    [HttpGet("clients/{clientId}/plans")]
    public async Task<IActionResult> GetClientPlans(Guid clientId, [FromQuery] DateTime? date = null)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Unauthorized();

        // IDOR Prevention: Verify dietitian owns this client
        var hasAccess = await _appDb.DietitianClientLinks
            .AnyAsync(l => l.DietitianId == dietitianId.Value && l.ClientId == clientId && l.IsActive);

        if (!hasAccess)
            return Forbid(); // 403: Dietitian doesn't have access to this client

        var targetDate = date?.Date ?? DateTime.UtcNow.Date;

        var plans = await _appDb.MealPlans
            .Where(p => p.ClientId == clientId && p.Date.Date == targetDate)
            .Include(p => p.Items)
            .ThenInclude(i => i.Completion)
            .OrderByDescending(p => p.UpdatedAt)
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

        return Ok(plans);
    }

    /// <summary>
    /// Create a new draft meal plan for a client
    /// </summary>
    [HttpPost("clients/{clientId}/plans")]
    public async Task<IActionResult> CreatePlan(Guid clientId, [FromBody] CreateMealPlanRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Unauthorized();

        // IDOR Prevention
        var hasAccess = await _appDb.DietitianClientLinks
            .AnyAsync(l => l.DietitianId == dietitianId.Value && l.ClientId == clientId && l.IsActive);

        if (!hasAccess)
            return Forbid();

        var plan = new MealPlan
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            Date = request.Date.Date,
            Status = MealPlanStatus.Draft,
            CreatedBy = dietitianId.Value,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _appDb.MealPlans.Add(plan);
        await _appDb.SaveChangesAsync();

        return CreatedAtAction(nameof(GetClientPlans), new { clientId, date = request.Date }, new { id = plan.Id });
    }

    /// <summary>
    /// Bulk upsert meal items in a plan
    /// </summary>
    [HttpPut("plans/{planId}/items")]
    public async Task<IActionResult> UpsertMealItems(Guid planId, [FromBody] BulkUpsertMealItemsRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Unauthorized();

        var plan = await _appDb.MealPlans
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == planId);

        if (plan == null)
            return NotFound(new { message = "Plan bulunamadı" });

        // IDOR Prevention: Verify dietitian owns the client
        var hasAccess = await _appDb.DietitianClientLinks
            .AnyAsync(l => l.DietitianId == dietitianId.Value && l.ClientId == plan.ClientId && l.IsActive);

        if (!hasAccess)
            return Forbid();

        // Remove items not in the request
        var requestItemIds = request.Items.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToList();
        var itemsToRemove = plan.Items.Where(i => !requestItemIds.Contains(i.Id)).ToList();
        foreach (var item in itemsToRemove)
        {
            _appDb.PlanMealItems.Remove(item);
        }

        // Upsert items
        foreach (var itemDto in request.Items)
        {
            if (itemDto.Id.HasValue)
            {
                // Update existing
                var existing = plan.Items.FirstOrDefault(i => i.Id == itemDto.Id.Value);
                if (existing != null)
                {
                    existing.Time = TimeSpan.Parse(itemDto.Time);
                    existing.Title = itemDto.Title;
                    existing.Note = itemDto.Note;
                    existing.OrderIndex = itemDto.OrderIndex;
                    existing.Calories = itemDto.Calories;
                    existing.ProteinGrams = itemDto.Macros?.ProteinGrams;
                    existing.CarbsGrams = itemDto.Macros?.CarbsGrams;
                    existing.FatGrams = itemDto.Macros?.FatGrams;
                }
            }
            else
            {
                // Create new
                var newItem = new PlanMealItem
                {
                    Id = Guid.NewGuid(),
                    PlanId = planId,
                    Time = TimeSpan.Parse(itemDto.Time),
                    Title = itemDto.Title,
                    Note = itemDto.Note,
                    OrderIndex = itemDto.OrderIndex,
                    Calories = itemDto.Calories,
                    ProteinGrams = itemDto.Macros?.ProteinGrams,
                    CarbsGrams = itemDto.Macros?.CarbsGrams,
                    FatGrams = itemDto.Macros?.FatGrams,
                    CreatedAt = DateTime.UtcNow
                };
                _appDb.PlanMealItems.Add(newItem);
            }
        }

        plan.UpdatedAt = DateTime.UtcNow;
        await _appDb.SaveChangesAsync();

        return Ok(new { message = "Öğünler güncellendi" });
    }

    /// <summary>
    /// Publish a meal plan (make it visible to client)
    /// </summary>
    [HttpPost("plans/{planId}/publish")]
    public async Task<IActionResult> PublishPlan(Guid planId)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Unauthorized();

        var plan = await _appDb.MealPlans.FindAsync(planId);
        if (plan == null)
            return NotFound(new { message = "Plan bulunamadı" });

        // IDOR Prevention
        var hasAccess = await _appDb.DietitianClientLinks
            .AnyAsync(l => l.DietitianId == dietitianId.Value && l.ClientId == plan.ClientId && l.IsActive);

        if (!hasAccess)
            return Forbid();

        // Unpublish any other published plans for the same date
        var otherPublishedPlans = await _appDb.MealPlans
            .Where(p => p.ClientId == plan.ClientId && p.Date.Date == plan.Date.Date && p.Id != planId && p.Status == MealPlanStatus.Published)
            .ToListAsync();

        foreach (var otherPlan in otherPublishedPlans)
        {
            otherPlan.Status = MealPlanStatus.Draft;
        }

        plan.Status = MealPlanStatus.Published;
        plan.UpdatedAt = DateTime.UtcNow;
        await _appDb.SaveChangesAsync();

        return Ok(new { message = "Plan yayınlandı" });
    }

    /// <summary>
    /// Duplicate a meal plan to another date
    /// </summary>
    [HttpPost("plans/{planId}/duplicate")]
    public async Task<IActionResult> DuplicatePlan(Guid planId, [FromQuery] DateTime toDate)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Unauthorized();

        var sourcePlan = await _appDb.MealPlans
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == planId);

        if (sourcePlan == null)
            return NotFound(new { message = "Plan bulunamadı" });

        // IDOR Prevention
        var hasAccess = await _appDb.DietitianClientLinks
            .AnyAsync(l => l.DietitianId == dietitianId.Value && l.ClientId == sourcePlan.ClientId && l.IsActive);

        if (!hasAccess)
            return Forbid();

        var newPlan = new MealPlan
        {
            Id = Guid.NewGuid(),
            ClientId = sourcePlan.ClientId,
            Date = toDate.Date,
            Status = MealPlanStatus.Draft,
            CreatedBy = dietitianId.Value,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _appDb.MealPlans.Add(newPlan);

        // Copy items
        foreach (var sourceItem in sourcePlan.Items)
        {
            var newItem = new PlanMealItem
            {
                Id = Guid.NewGuid(),
                PlanId = newPlan.Id,
                Time = sourceItem.Time,
                Title = sourceItem.Title,
                Note = sourceItem.Note,
                OrderIndex = sourceItem.OrderIndex,
                Calories = sourceItem.Calories,
                ProteinGrams = sourceItem.ProteinGrams,
                CarbsGrams = sourceItem.CarbsGrams,
                FatGrams = sourceItem.FatGrams,
                CreatedAt = DateTime.UtcNow
            };
            _appDb.PlanMealItems.Add(newItem);
        }

        await _appDb.SaveChangesAsync();

        return CreatedAtAction(nameof(GetClientPlans), new { clientId = sourcePlan.ClientId, date = toDate }, new { id = newPlan.Id });
    }

    /// <summary>
    /// Delete a meal plan
    /// </summary>
    [HttpDelete("plans/{planId}")]
    public async Task<IActionResult> DeletePlan(Guid planId)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == null)
            return Unauthorized();

        var plan = await _appDb.MealPlans.FindAsync(planId);
        if (plan == null)
            return NotFound(new { message = "Plan bulunamadı" });

        // IDOR Prevention
        var hasAccess = await _appDb.DietitianClientLinks
            .AnyAsync(l => l.DietitianId == dietitianId.Value && l.ClientId == plan.ClientId && l.IsActive);

        if (!hasAccess)
            return Forbid();

        _appDb.MealPlans.Remove(plan);
        await _appDb.SaveChangesAsync();

        return Ok(new { message = "Plan silindi" });
    }

    private async Task<Guid?> GetDietitianIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return null;

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user == null)
            return null;

        return user.LinkedDietitianId;
    }
}
