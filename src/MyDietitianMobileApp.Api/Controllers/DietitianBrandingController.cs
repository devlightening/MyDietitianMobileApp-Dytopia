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
    private readonly IWebHostEnvironment _environment;

    public DietitianBrandingController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DietitianBrandingController> logger,
        IWebHostEnvironment environment)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
        _environment = environment;
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

    /// <summary>
    /// Upload clinic logo
    /// </summary>
    [HttpPost("branding/logo")]
    [RequestSizeLimit(2 * 1024 * 1024)] // 2 MB max
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> UploadLogo(IFormFile file)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        // Validate file
        if (file == null || file.Length == 0)
            return BadRequest(ApiProblems.Validation("NO_FILE", "Dosya yüklenmedi"));

        // Validate file type
        var allowedTypes = new[] { "image/png", "image/jpeg", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(ApiProblems.Validation("INVALID_FILE_TYPE", "Sadece PNG, JPEG ve WebP formatları desteklenir"));

        // Validate file size (2 MB)
        if (file.Length > 2 * 1024 * 1024)
            return BadRequest(ApiProblems.Validation("FILE_TOO_LARGE", "Dosya boyutu 2 MB'ı aşamaz"));

        try
        {
            // Create upload directory
            var uploadDir = Path.Combine(_environment.WebRootPath, "uploads", "branding", dietitianId.Value.ToString());
            Directory.CreateDirectory(uploadDir);

            // Generate unique filename
            var extension = Path.GetExtension(file.FileName);
            var timestamp = DateTime.UtcNow.Ticks;
            var filename = $"logo-{timestamp}{extension}";
            var filePath = Path.Combine(uploadDir, filename);

            // Save file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Generate URL
            var logoUrl = $"/uploads/branding/{dietitianId.Value}/{filename}";

            // Update branding config
            var config = await _appDb.DietitianBrandingConfigs
                .FirstOrDefaultAsync(c => c.DietitianId == dietitianId.Value);

            if (config == null)
            {
                // Create with defaults
                config = new DietitianBrandingConfig(dietitianId.Value, null, logoUrl);
                _appDb.DietitianBrandingConfigs.Add(config);
            }
            else
            {
                // Delete old logo file if exists
                if (!string.IsNullOrEmpty(config.LogoUrl))
                {
                    var oldFilePath = Path.Combine(_environment.WebRootPath, config.LogoUrl.TrimStart('/'));
                    if (System.IO.File.Exists(oldFilePath))
                    {
                        try { System.IO.File.Delete(oldFilePath); } catch { /* Ignore */ }
                    }
                }

                // Update with new logo
                config.Update(
                    config.ClinicName,
                    logoUrl,
                    config.PrimaryColorHex,
                    config.AccentColorHex
                );
            }

            await _appDb.SaveChangesAsync();

            return Ok(new { logoUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading logo for dietitian {DietitianId}", dietitianId.Value);
            return StatusCode(500, ApiProblems.InternalServerError("UPLOAD_ERROR", "Logo yüklenirken hata oluştu"));
        }
    }

    /// <summary>
    /// Reset branding to defaults
    /// </summary>
    [HttpDelete("branding")]
    [EnableRateLimiting("dietitian-write")]
    public async Task<IActionResult> ResetBranding()
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Dietitian hesabı bulunamadı"));

        try
        {
            var config = await _appDb.DietitianBrandingConfigs
                .FirstOrDefaultAsync(c => c.DietitianId == dietitianId.Value);

            if (config != null)
            {
                // Delete logo file if exists
                if (!string.IsNullOrEmpty(config.LogoUrl))
                {
                    var filePath = Path.Combine(_environment.WebRootPath, config.LogoUrl.TrimStart('/'));
                    if (System.IO.File.Exists(filePath))
                    {
                        try { System.IO.File.Delete(filePath); } catch { /* Ignore */ }
                    }
                }

                // Remove branding config
                _appDb.DietitianBrandingConfigs.Remove(config);
                await _appDb.SaveChangesAsync();
            }

            // Return defaults
            return Ok(new
            {
                clinicName = (string?)null,
                logoUrl = (string?)null,
                primaryColorHex = "#4A7C59",
                accentColorHex = "#FF8C61"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting branding for dietitian {DietitianId}", dietitianId.Value);
            return StatusCode(500, ApiProblems.InternalServerError("RESET_ERROR", "Branding sıfırlanırken hata oluştu"));
        }
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
