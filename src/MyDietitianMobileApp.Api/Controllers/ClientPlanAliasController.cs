using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client plan endpoint (documentation contract alias for premium home)
/// </summary>
[Authorize]
[ApiController]
[Route("api/client")]
public class ClientPlanAliasController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly ILogger<ClientPlanAliasController> _logger;

    public ClientPlanAliasController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IClientIdentityResolver identityResolver,
        ILogger<ClientPlanAliasController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _identityResolver = identityResolver;
        _logger = logger;
    }

    /// <summary>
    /// Get premium home plan summary (alias for /api/client/plans/today with extended response)
    /// </summary>
    [HttpGet("plan")]
    public async Task<IActionResult> GetPlan()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var (userId, clientId, _) = identity.Value;

        // Premium gate
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);
        if (!premiumStatus.IsPremium)
            return StatusCode(403, ApiProblems.PremiumRequired());

        var today = DateTime.UtcNow.Date;
        var dateUtc = DateTime.UtcNow;

        // Get plan (same logic as ClientPlanController.GetTodayPlan)
        var plan = await _appDb.MealPlans
            .Where(p => p.ClientId == clientId && p.Date.Date == today && p.Status == MealPlanStatus.Published)
            .Include(p => p.Items)
            .ThenInclude(i => i.Completion)
            .FirstOrDefaultAsync();

        object? planDto = null;
        if (plan != null)
        {
            planDto = new
            {
                id = plan.Id,
                clientId = plan.ClientId,
                date = plan.Date.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                status = plan.Status.ToString(),
                updatedAt = plan.UpdatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                items = plan.Items.OrderBy(i => i.Time).Select(i => new
                {
                    id = i.Id,
                    time = i.Time.ToString(@"hh\:mm"),
                    title = i.Title,
                    note = i.Note,
                    orderIndex = i.OrderIndex,
                    calories = i.Calories,
                    macros = i.ProteinGrams.HasValue || i.CarbsGrams.HasValue || i.FatGrams.HasValue
                        ? new
                        {
                            proteinGrams = i.ProteinGrams,
                            carbsGrams = i.CarbsGrams,
                            fatGrams = i.FatGrams
                        }
                        : (object?)null,
                    isCompleted = i.Completion != null
                }).ToList()
            };
        }

        // Get dietitian info and branding
        string clinicName = "Klinik";
        object? dietitianPublicInfo = null;

        if (premiumStatus.ActiveDietitianId.HasValue)
        {
            var dietitian = await _appDb.Dietitians
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == premiumStatus.ActiveDietitianId.Value);

            if (dietitian != null)
            {
                clinicName = dietitian.ClinicName ?? dietitian.FullName;

                var branding = await _appDb.DietitianBrandingConfigs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.DietitianId == dietitian.Id);

                dietitianPublicInfo = new
                {
                    fullName = dietitian.FullName,
                    clinicName = dietitian.ClinicName ?? clinicName,
                    branding = branding != null ? new
                    {
                        clinicName = branding.ClinicName,
                        logoUrl = branding.LogoUrl,
                        primaryColorHex = branding.PrimaryColorHex,
                        accentColorHex = branding.AccentColorHex
                    } : new
                    {
                        clinicName = dietitian.ClinicName ?? clinicName,
                        logoUrl = (string?)null,
                        primaryColorHex = "#111111",
                        accentColorHex = "#22C55E"
                    }
                };
            }
        }

        return Ok(new
        {
            dateUtc = dateUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            isPremium = premiumStatus.IsPremium,
            premiumUntilUtc = premiumStatus.PremiumUntilUtc?.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            clinicName,
            dietitianPublicInfo,
            plan = planDto
        });
    }
}
