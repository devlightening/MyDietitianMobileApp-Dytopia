using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Dietitian endpoints for managing reusable meal plan templates.
/// Templates can be applied to any client's plan on a target date.
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian/plan-templates")]
public class MealPlanTemplateController : ControllerBase
{
    private readonly MealPlanTemplateService _templateService;
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;

    public MealPlanTemplateController(
        MealPlanTemplateService templateService,
        AuthDbContext authDb,
        AppDbContext appDb)
    {
        _templateService = templateService;
        _authDb = authDb;
        _appDb = appDb;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

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

    // ── GET /api/dietitian/plan-templates ─────────────────────────────────────

    /// <summary>List all templates owned by the current dietitian.</summary>
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var templates = await _templateService.ListAsync(dietitianId, ct);
        return Ok(new { templates });
    }

    // ── GET /api/dietitian/plan-templates/{id} ────────────────────────────────

    /// <summary>Get a single template with full item detail.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var template = await _templateService.GetAsync(dietitianId, id, ct);
        if (template == null)
            return NotFound(ApiProblems.NotFound("TEMPLATE_NOT_FOUND", "Template not found."));

        return Ok(template);
    }

    // ── POST /api/dietitian/plan-templates ────────────────────────────────────

    /// <summary>Create a new template from scratch.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTemplateDto dto, CancellationToken ct)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var req = new CreateTemplateRequest(
            dto.Name,
            dto.Description,
            (dto.Items ?? []).Select(i => new TemplateItemInput(
                i.Time, i.MealType, i.Title, i.Note,
                i.Calories, i.ProteinGrams, i.CarbsGrams, i.FatGrams,
                i.RecipeId, i.OrderIndex)).ToList());

        var result = await _templateService.CreateAsync(dietitianId, req, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    // ── POST /api/dietitian/plan-templates/from-plan ──────────────────────────

    /// <summary>Create a template by copying all meals from an existing daily plan.</summary>
    [HttpPost("from-plan")]
    public async Task<IActionResult> CreateFromPlan([FromBody] CreateFromPlanDto dto, CancellationToken ct)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var req = new CreateFromPlanRequest(dto.PlanId, dto.Name, dto.Description);
        var result = await _templateService.CreateFromPlanAsync(dietitianId, req, ct);

        if (result == null)
            return NotFound(ApiProblems.NotFound("PLAN_NOT_FOUND", "Plan not found or not owned by you."));

        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    // ── DELETE /api/dietitian/plan-templates/{id} ─────────────────────────────

    /// <summary>Delete a template (cascade deletes its items).</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        var deleted = await _templateService.DeleteAsync(dietitianId, id, ct);
        if (!deleted)
            return NotFound(ApiProblems.NotFound("TEMPLATE_NOT_FOUND", "Template not found."));

        return NoContent();
    }

    // ── POST /api/dietitian/daily-plans/clients/{clientId}/apply-template ────
    //   (registered on a separate route to live alongside DietitianDailyPlanController)

    /// <summary>
    /// Apply a template to a client's plan on a target date.
    /// Creates a Draft plan; returns 409 if a plan already exists on that date.
    /// </summary>
    [HttpPost("/api/dietitian/daily-plans/clients/{clientId:guid}/apply-template")]
    public async Task<IActionResult> Apply(Guid clientId, [FromBody] ApplyTemplateDto dto, CancellationToken ct)
    {
        var (dietitianId, err) = await GetDietitianIdAsync();
        if (err != null) return err;

        if (!await OwnsClientAsync(dietitianId, clientId))
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found or not linked."));

        var req = new ApplyTemplateRequest(dto.TemplateId, dto.TargetDate);
        var (error, plan) = await _templateService.ApplyAsync(dietitianId, clientId, req, ct);

        return error switch
        {
            "invalid_date" => BadRequest(ApiProblems.Validation("INVALID_DATE", "targetDate must be yyyy-MM-dd.")),
            "not_found"    => NotFound(ApiProblems.NotFound("TEMPLATE_NOT_FOUND", "Template not found.")),
            "conflict"     => Conflict(new { code = "PLAN_EXISTS", message = $"A plan already exists for {dto.TargetDate}." }),
            _              => Ok(plan),
        };
    }
}

// ── Request DTOs ────────────────────────────────────────────────────────────

public record CreateTemplateDto(
    [Required, MaxLength(100)] string Name,
    [MaxLength(300)] string? Description,
    List<TemplateItemDto>? Items);

public record TemplateItemDto(
    [Required] string Time,
    [Required] string MealType,
    [Required, MaxLength(200)] string Title,
    [MaxLength(1000)] string? Note,
    int? Calories,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    Guid? RecipeId,
    int OrderIndex);

public record CreateFromPlanDto(
    [Required] Guid PlanId,
    [Required, MaxLength(100)] string Name,
    [MaxLength(300)] string? Description);

public record ApplyTemplateDto(
    [Required] Guid TemplateId,
    [Required] string TargetDate);
