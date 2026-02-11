using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using System.Security.Claims;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client compliance endpoints (premium required)
/// </summary>
[Authorize]
[ApiController]
[Route("api/client")]
public class ClientComplianceController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IComplianceService _complianceService;
    private readonly IClientActivityWriter _activityWriter;
    private readonly ILogger<ClientComplianceController> _logger;

    public ClientComplianceController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService,
        IComplianceService complianceService,
        IClientActivityWriter activityWriter,
        ILogger<ClientComplianceController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
        _complianceService = complianceService;
        _activityWriter = activityWriter;
        _logger = logger;
    }

    /// <summary>
    /// Mark meal as done
    /// </summary>
    [HttpPost("plan/meals/{dietPlanMealId:guid}/done")]
    [EnableRateLimiting("telemetry-write")]
    public async Task<IActionResult> MarkMealDone(Guid dietPlanMealId, [FromBody] MealNoteRequest? request = null)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (userId, clientId, _) = identity.Value;

        // Premium gate
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
        if (!premiumStatus.IsPremium || !premiumStatus.ActiveDietitianId.HasValue)
            return StatusCode(403, ApiProblems.PremiumRequired("Bu özellik premium üyelik gerektirir"));

        try
        {
            await _complianceService.RecordMealCompletionAsync(
                clientId,
                premiumStatus.ActiveDietitianId.Value,
                dietPlanMealId,
                MealCompletionStatus.Done,
                request?.Note);

            // Write activity
            await _activityWriter.WriteAsync(
                clientId,
                premiumStatus.ActiveDietitianId,
                "MEAL_DONE",
                new { dietPlanMealId, note = request?.Note });

            return Ok(new { success = true, message = "Öğün tamamlandı olarak işaretlendi" });
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiProblems.NotFound("MEAL_NOT_FOUND", ex.Message));
        }
    }

    /// <summary>
    /// Mark meal as skipped
    /// </summary>
    [HttpPost("plan/meals/{dietPlanMealId:guid}/skip")]
    [EnableRateLimiting("telemetry-write")]
    public async Task<IActionResult> MarkMealSkipped(Guid dietPlanMealId, [FromBody] MealNoteRequest? request = null)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (userId, clientId, _) = identity.Value;

        // Premium gate
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
        if (!premiumStatus.IsPremium || !premiumStatus.ActiveDietitianId.HasValue)
            return StatusCode(403, ApiProblems.PremiumRequired("Bu özellik premium üyelik gerektirir"));

        try
        {
            await _complianceService.RecordMealCompletionAsync(
                clientId,
                premiumStatus.ActiveDietitianId.Value,
                dietPlanMealId,
                MealCompletionStatus.Skipped,
                request?.Note);

            // Write activity
            await _activityWriter.WriteAsync(
                clientId,
                premiumStatus.ActiveDietitianId,
                "MEAL_SKIPPED",
                new { dietPlanMealId, note = request?.Note });

            return Ok(new { success = true, message = "Öğün atlandı olarak işaretlendi" });
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiProblems.NotFound("MEAL_NOT_FOUND", ex.Message));
        }
    }

    /// <summary>
    /// Get today's compliance
    /// </summary>
    [HttpGet("compliance/today")]
    public async Task<IActionResult> GetTodayCompliance()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (userId, clientId, _) = identity.Value;

        // Premium gate
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
        if (!premiumStatus.IsPremium || !premiumStatus.ActiveDietitianId.HasValue)
            return StatusCode(403, ApiProblems.PremiumRequired("Bu özellik premium üyelik gerektirir"));

        var compliance = await _complianceService.GetTodayAsync(clientId, premiumStatus.ActiveDietitianId.Value);

        return Ok(new
        {
            date = compliance.Date.ToString("yyyy-MM-dd"),
            plannedCount = compliance.PlannedCount,
            completedCount = compliance.CompletedCount,
            skippedCount = compliance.SkippedCount,
            score0_100 = compliance.Score0_100,
            status = compliance.Status
        });
    }

    /// <summary>
    /// Get compliance range
    /// </summary>
    [HttpGet("compliance/range")]
    public async Task<IActionResult> GetComplianceRange(
        [FromQuery] string from,
        [FromQuery] string to)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (userId, clientId, _) = identity.Value;

        // Premium gate
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
        if (!premiumStatus.IsPremium || !premiumStatus.ActiveDietitianId.HasValue)
            return StatusCode(403, ApiProblems.PremiumRequired("Bu özellik premium üyelik gerektirir"));

        if (!DateOnly.TryParse(from, out var fromDate) || !DateOnly.TryParse(to, out var toDate))
            return BadRequest(ApiProblems.Validation("INVALID_DATE_RANGE", "Geçerli tarih aralığı giriniz (YYYY-MM-DD)"));

        var compliance = await _complianceService.GetRangeAsync(clientId, premiumStatus.ActiveDietitianId.Value, fromDate, toDate);

        return Ok(new
        {
            from = compliance.From.ToString("yyyy-MM-dd"),
            to = compliance.To.ToString("yyyy-MM-dd"),
            days = compliance.Days.Select(d => new
            {
                date = d.Date.ToString("yyyy-MM-dd"),
                plannedCount = d.PlannedCount,
                completedCount = d.CompletedCount,
                skippedCount = d.SkippedCount,
                score0_100 = d.Score0_100,
                status = d.Status
            })
        });
    }
}

public record MealNoteRequest(string? Note);
