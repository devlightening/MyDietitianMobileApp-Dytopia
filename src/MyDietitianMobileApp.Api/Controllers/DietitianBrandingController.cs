using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using System.Text.RegularExpressions;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Dietitian branding configuration endpoints
/// </summary>
[Authorize("Dietitian")]
[ApiController]
[Route("api/dietitian")]
public class DietitianBrandingController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DietitianBrandingController> _logger;

    public DietitianBrandingController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DietitianBrandingController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    /// <summary>
    /// Get dietitian branding config
    /// </summary>
    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding()
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        var config = await _appDb.DietitianBrandingConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.DietitianId == dietitianId.Value);

        if (config == null)
        {
            // Return defaults
            var dietitian = await _appDb.Dietitians
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == dietitianId.Value);

            return Ok(new
            {
                clinicName = dietitian?.ClinicName ?? "Klinik",
                logoUrl = (string?)null,
                primaryColorHex = "#111111",
                accentColorHex = "#22C55E"
            });
        }

        return Ok(new
        {
            clinicName = config.ClinicName,
            logoUrl = config.LogoUrl,
            primaryColorHex = config.PrimaryColorHex,
            accentColorHex = config.AccentColorHex
        });
    }

    /// <summary>
    /// Update dietitian branding config
    /// </summary>
    [HttpPut("branding")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> UpdateBranding([FromBody] UpdateBrandingRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        // Validation
        if (string.IsNullOrWhiteSpace(request.ClinicName))
            return BadRequest(ApiProblems.Validation("INVALID_CLINIC_NAME", "Klinik adı boş olamaz"));

        if (request.ClinicName.Length > 120)
            return BadRequest(ApiProblems.Validation("INVALID_CLINIC_NAME", "Klinik adı en fazla 120 karakter olabilir"));

        if (!string.IsNullOrEmpty(request.LogoUrl) && request.LogoUrl.Length > 500)
            return BadRequest(ApiProblems.Validation("INVALID_LOGO_URL", "Logo URL en fazla 500 karakter olabilir"));

        var hexPattern = new Regex(@"^#[0-9A-Fa-f]{6}$");
        if (!string.IsNullOrEmpty(request.PrimaryColorHex) && !hexPattern.IsMatch(request.PrimaryColorHex))
            return BadRequest(ApiProblems.Validation("INVALID_COLOR_HEX", "Renk kodu #RRGGBB formatında olmalıdır"));

        if (!string.IsNullOrEmpty(request.AccentColorHex) && !hexPattern.IsMatch(request.AccentColorHex))
            return BadRequest(ApiProblems.Validation("INVALID_COLOR_HEX", "Renk kodu #RRGGBB formatında olmalıdır"));

        var config = await _appDb.DietitianBrandingConfigs
            .FirstOrDefaultAsync(c => c.DietitianId == dietitianId.Value);

        if (config == null)
        {
            config = new DietitianBrandingConfig(
                dietitianId.Value,
                request.ClinicName.Trim(),
                request.LogoUrl?.Trim(),
                request.PrimaryColorHex ?? "#111111",
                request.AccentColorHex ?? "#22C55E");
            _appDb.DietitianBrandingConfigs.Add(config);
        }
        else
        {
            config.Update(
                request.ClinicName.Trim(),
                request.LogoUrl?.Trim(),
                request.PrimaryColorHex ?? config.PrimaryColorHex,
                request.AccentColorHex ?? config.AccentColorHex);
        }

        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            clinicName = config.ClinicName,
            logoUrl = config.LogoUrl,
            primaryColorHex = config.PrimaryColorHex,
            accentColorHex = config.AccentColorHex
        });
    }

    private async Task<Guid?> GetDietitianIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return null;

        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId) && u.Role == "Dietitian");

        return user?.LinkedDietitianId;
    }
}

public record UpdateBrandingRequest(
    string ClinicName,
    string? LogoUrl = null,
    string? PrimaryColorHex = null,
    string? AccentColorHex = null);
