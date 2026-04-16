using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Services;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record TemplateItemInput(
    string Time,           // "HH:mm"
    string MealType,       // PlanMealItemType string
    string Title,
    string? Note,
    int? Calories,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    Guid? RecipeId,
    int OrderIndex);

public record CreateTemplateRequest(
    string Name,
    string? Description,
    List<TemplateItemInput> Items);

public record CreateFromPlanRequest(
    Guid PlanId,
    string Name,
    string? Description);

public record ApplyTemplateRequest(
    Guid TemplateId,
    string TargetDate);   // "yyyy-MM-dd"

public record TemplateSummary(
    Guid Id,
    string Name,
    string? Description,
    int ItemCount,
    DateTime CreatedAtUtc);

public record TemplateDetail(
    Guid Id,
    string Name,
    string? Description,
    List<TemplateItemDetail> Items,
    DateTime CreatedAtUtc);

public record TemplateItemDetail(
    Guid Id,
    string Time,
    string MealType,
    string Title,
    string? Note,
    int? Calories,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    Guid? RecipeId,
    int OrderIndex);

// ── Service ─────────────────────────────────────────────────────────────────

public class MealPlanTemplateService
{
    private readonly AppDbContext _db;

    public MealPlanTemplateService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>List all templates owned by the dietitian (summary only).</summary>
    public async Task<List<TemplateSummary>> ListAsync(Guid dietitianId, CancellationToken ct = default)
    {
        return await _db.MealPlanTemplates
            .Where(t => t.DietitianId == dietitianId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Select(t => new TemplateSummary(
                t.Id,
                t.Name,
                t.Description,
                t.Items.Count,
                t.CreatedAtUtc))
            .ToListAsync(ct);
    }

    /// <summary>Get a single template with full item detail.</summary>
    public async Task<TemplateDetail?> GetAsync(Guid dietitianId, Guid templateId, CancellationToken ct = default)
    {
        var t = await _db.MealPlanTemplates
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == templateId && x.DietitianId == dietitianId, ct);

        if (t == null) return null;

        return MapDetail(t);
    }

    /// <summary>Create a new template from scratch.</summary>
    public async Task<TemplateDetail> CreateAsync(Guid dietitianId, CreateTemplateRequest req, CancellationToken ct = default)
    {
        var template = new MealPlanTemplate
        {
            Id           = Guid.NewGuid(),
            DietitianId  = dietitianId,
            Name         = req.Name.Trim(),
            Description  = req.Description?.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        template.Items = req.Items.Select((item, idx) => BuildItem(template.Id, item, idx)).ToList();

        _db.MealPlanTemplates.Add(template);
        await _db.SaveChangesAsync(ct);

        return MapDetail(template);
    }

    /// <summary>
    /// Create a template by copying all meal items from an existing MealPlan.
    /// Only plans owned by the dietitian are accepted.
    /// </summary>
    public async Task<TemplateDetail?> CreateFromPlanAsync(
        Guid dietitianId,
        CreateFromPlanRequest req,
        CancellationToken ct = default)
    {
        var plan = await _db.MealPlans
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == req.PlanId && p.CreatedBy == dietitianId, ct);

        if (plan == null) return null;

        var template = new MealPlanTemplate
        {
            Id           = Guid.NewGuid(),
            DietitianId  = dietitianId,
            Name         = req.Name.Trim(),
            Description  = req.Description?.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        template.Items = plan.Items
            .OrderBy(i => i.OrderIndex)
            .Select((item, idx) => new MealPlanTemplateItem
            {
                Id           = Guid.NewGuid(),
                TemplateId   = template.Id,
                Time         = item.Time,
                MealType     = item.MealType,
                Title        = item.Title,
                Note         = item.Note,
                Calories     = item.Calories,
                ProteinGrams = item.ProteinGrams,
                CarbsGrams   = item.CarbsGrams,
                FatGrams     = item.FatGrams,
                RecipeId     = item.RecipeId,
                OrderIndex   = idx,
            })
            .ToList();

        _db.MealPlanTemplates.Add(template);
        await _db.SaveChangesAsync(ct);

        return MapDetail(template);
    }

    /// <summary>Delete a template. Returns false if not found.</summary>
    public async Task<bool> DeleteAsync(Guid dietitianId, Guid templateId, CancellationToken ct = default)
    {
        var template = await _db.MealPlanTemplates
            .FirstOrDefaultAsync(t => t.Id == templateId && t.DietitianId == dietitianId, ct);

        if (template == null) return false;

        _db.MealPlanTemplates.Remove(template);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Apply a template to a client's plan on targetDate.
    /// Creates a Draft plan if none exists; returns 409 if a plan already exists.
    /// Returns null if template not found.
    /// Returns ("conflict", null) if target date already has a plan.
    /// Returns (null, detail) on success.
    /// </summary>
    public async Task<(string? error, object? plan)> ApplyAsync(
        Guid dietitianId,
        Guid clientId,
        ApplyTemplateRequest req,
        CancellationToken ct = default)
    {
        if (!DateOnly.TryParse(req.TargetDate, out var targetDate))
            return ("invalid_date", null);

        var template = await _db.MealPlanTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == req.TemplateId && t.DietitianId == dietitianId, ct);

        if (template == null)
            return ("not_found", null);

        var targetDt = targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var exists = await _db.MealPlans
            .AnyAsync(p => p.ClientId  == clientId
                        && p.CreatedBy == dietitianId
                        && p.Date      >= targetDt
                        && p.Date      <  targetDt.AddDays(1), ct);

        if (exists)
            return ("conflict", null);

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

        newPlan.Items = template.Items
            .OrderBy(i => i.OrderIndex)
            .Select((item, idx) => new PlanMealItem
            {
                Id           = Guid.NewGuid(),
                PlanId       = newPlan.Id,
                Time         = item.Time,
                MealType     = item.MealType,
                Title        = item.Title,
                Note         = item.Note,
                Calories     = item.Calories,
                ProteinGrams = item.ProteinGrams,
                CarbsGrams   = item.CarbsGrams,
                FatGrams     = item.FatGrams,
                RecipeId     = item.RecipeId,
                OrderIndex   = idx,
                CreatedAt    = DateTime.UtcNow,
            })
            .ToList();

        _db.MealPlans.Add(newPlan);
        await _db.SaveChangesAsync(ct);

        return (null, new
        {
            id       = newPlan.Id,
            date     = targetDate.ToString("yyyy-MM-dd"),
            status   = newPlan.Status.ToString(),
            meals    = newPlan.Items.OrderBy(i => i.Time).Select(MapMealItem).ToList(),
            updatedAt = newPlan.UpdatedAt,
        });
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static MealPlanTemplateItem BuildItem(Guid templateId, TemplateItemInput input, int fallbackIdx)
    {
        if (!TimeSpan.TryParse(input.Time, out var time))
            time = TimeSpan.Zero;

        if (!Enum.TryParse<PlanMealItemType>(input.MealType, ignoreCase: true, out var mealType))
            mealType = PlanMealItemType.Snack;

        return new MealPlanTemplateItem
        {
            Id           = Guid.NewGuid(),
            TemplateId   = templateId,
            Time         = time,
            MealType     = mealType,
            Title        = input.Title.Trim(),
            Note         = input.Note?.Trim(),
            Calories     = input.Calories,
            ProteinGrams = input.ProteinGrams,
            CarbsGrams   = input.CarbsGrams,
            FatGrams     = input.FatGrams,
            RecipeId     = input.RecipeId,
            OrderIndex   = input.OrderIndex >= 0 ? input.OrderIndex : fallbackIdx,
        };
    }

    private static TemplateDetail MapDetail(MealPlanTemplate t) => new(
        t.Id,
        t.Name,
        t.Description,
        t.Items.OrderBy(i => i.OrderIndex).Select(MapItem).ToList(),
        t.CreatedAtUtc);

    private static TemplateItemDetail MapItem(MealPlanTemplateItem i) => new(
        i.Id,
        i.Time.ToString(@"hh\:mm"),
        i.MealType.ToString(),
        i.Title,
        i.Note,
        i.Calories,
        i.ProteinGrams,
        i.CarbsGrams,
        i.FatGrams,
        i.RecipeId,
        i.OrderIndex);

    private static object MapMealItem(PlanMealItem item) => new
    {
        id           = item.Id,
        time         = item.Time.ToString(@"hh\:mm"),
        mealType     = item.MealType.ToString(),
        title        = item.Title,
        note         = item.Note,
        orderIndex   = item.OrderIndex,
        calories     = item.Calories,
        proteinGrams = item.ProteinGrams,
        carbsGrams   = item.CarbsGrams,
        fatGrams     = item.FatGrams,
        recipeId     = item.RecipeId,
    };
}
