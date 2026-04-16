using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.DTOs.Settings;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace MyDietitianMobileApp.Api.Controllers;

[ApiController]
[Route("api/dietitian/settings")]
[Authorize(Policy = "DietitianOnly")]
public class DietitianSettingsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuthDbContext _authContext;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<DietitianSettingsController> _logger;

    public DietitianSettingsController(
        AppDbContext context,
        AuthDbContext authContext,
        IWebHostEnvironment env,
        ILogger<DietitianSettingsController> logger)
    {
        _context = context;
        _authContext = authContext;
        _env = env;
        _logger = logger;
    }

    /// <summary>
    /// Get current dietitian's settings
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<DietitianSettingsDto>> GetSettings()
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == Guid.Empty)
        {
            return Unauthorized(new { error = "Invalid dietitian ID" });
        }

        var settings = await _context.DietitianSettings
            .FirstOrDefaultAsync(s => s.DietitianId == dietitianId);

        // If no settings exist, create default settings
        if (settings == null)
        {
            var dietitian = await _context.Dietitians.FindAsync(dietitianId);
            if (dietitian == null)
            {
                return NotFound(new { error = "Dietitian not found" });
            }

            settings = new DietitianSettings
            {
                Id = Guid.NewGuid(),
                DietitianId = dietitianId,
                ClinicName = dietitian.ClinicName ?? "My Clinic",
                DietitianDisplayName = dietitian.FullName,
                PrimaryColorHex = "#4A7C59", // Sage
                AccentColorHex = "#8FBC8F", // Forest
                ThemePresetKey = "sage",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.DietitianSettings.Add(settings);
            await _context.SaveChangesAsync();
        }

        return Ok(new DietitianSettingsDto
        {
            ClinicName = settings.ClinicName,
            DietitianDisplayName = settings.DietitianDisplayName,
            PrimaryColorHex = settings.PrimaryColorHex,
            AccentColorHex = settings.AccentColorHex,
            ThemePresetKey = settings.ThemePresetKey,
            LogoUrl = settings.LogoUrl,
            PhoneNumber = settings.PhoneNumber,
            Bio = settings.Bio,
            WebsiteUrl = settings.WebsiteUrl,
            UpdatedAt = settings.UpdatedAt
        });
    }

    /// <summary>
    /// Update dietitian settings
    /// </summary>
    [HttpPut]
    public async Task<ActionResult<DietitianSettingsDto>> UpdateSettings([FromBody] UpdateDietitianSettingsDto dto)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == Guid.Empty)
        {
            return Unauthorized(new { error = "Invalid dietitian ID" });
        }

        // Validate hex colors
        if (!IsValidHexColor(dto.PrimaryColorHex))
        {
            return BadRequest(new { error = "Invalid primary color format. Must be #RRGGBB" });
        }
        if (!IsValidHexColor(dto.AccentColorHex))
        {
            return BadRequest(new { error = "Invalid accent color format. Must be #RRGGBB" });
        }

        // Validate lengths
        if (string.IsNullOrWhiteSpace(dto.ClinicName) || dto.ClinicName.Length > 100)
        {
            return BadRequest(new { error = "Clinic name is required and must be <= 100 characters" });
        }
        if (string.IsNullOrWhiteSpace(dto.DietitianDisplayName) || dto.DietitianDisplayName.Length > 100)
        {
            return BadRequest(new { error = "Dietitian display name is required and must be <= 100 characters" });
        }

        var settings = await _context.DietitianSettings
            .FirstOrDefaultAsync(s => s.DietitianId == dietitianId);

        if (settings == null)
        {
            // Create new settings
            settings = new DietitianSettings
            {
                Id = Guid.NewGuid(),
                DietitianId = dietitianId,
                CreatedAt = DateTime.UtcNow
            };
            _context.DietitianSettings.Add(settings);
        }

        // Validate optional profile fields
        if (!string.IsNullOrEmpty(dto.PhoneNumber) && dto.PhoneNumber.Length > 30)
            return BadRequest(new { error = "Phone number must be <= 30 characters" });
        if (!string.IsNullOrEmpty(dto.Bio) && dto.Bio.Length > 500)
            return BadRequest(new { error = "Bio must be <= 500 characters" });
        if (!string.IsNullOrEmpty(dto.WebsiteUrl) && dto.WebsiteUrl.Length > 255)
            return BadRequest(new { error = "Website URL must be <= 255 characters" });

        // Update settings
        settings.ClinicName = dto.ClinicName.Trim();
        settings.DietitianDisplayName = dto.DietitianDisplayName.Trim();
        settings.PrimaryColorHex = dto.PrimaryColorHex.ToUpperInvariant();
        settings.AccentColorHex = dto.AccentColorHex.ToUpperInvariant();
        settings.ThemePresetKey = dto.ThemePresetKey;
        settings.PhoneNumber = string.IsNullOrWhiteSpace(dto.PhoneNumber) ? null : dto.PhoneNumber.Trim();
        settings.Bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();
        settings.WebsiteUrl = string.IsNullOrWhiteSpace(dto.WebsiteUrl) ? null : dto.WebsiteUrl.Trim();
        settings.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Dietitian {DietitianId} updated settings", dietitianId);

        return Ok(new DietitianSettingsDto
        {
            ClinicName = settings.ClinicName,
            DietitianDisplayName = settings.DietitianDisplayName,
            PrimaryColorHex = settings.PrimaryColorHex,
            AccentColorHex = settings.AccentColorHex,
            ThemePresetKey = settings.ThemePresetKey,
            LogoUrl = settings.LogoUrl,
            PhoneNumber = settings.PhoneNumber,
            Bio = settings.Bio,
            WebsiteUrl = settings.WebsiteUrl,
            UpdatedAt = settings.UpdatedAt
        });
    }

    /// <summary>
    /// Upload clinic logo
    /// </summary>
    [HttpPost("logo")]
    public async Task<ActionResult<DietitianSettingsDto>> UploadLogo(IFormFile file)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == Guid.Empty)
        {
            return Unauthorized(new { error = "Invalid dietitian ID" });
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        // Validate file size (2MB max)
        if (file.Length > 2 * 1024 * 1024)
        {
            return BadRequest(new { error = "File size must be less than 2MB" });
        }

        // Validate content type
        var allowedTypes = new[] { "image/png", "image/jpeg", "image/jpg", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
        {
            return BadRequest(new { error = "Only PNG, JPG, and WebP images are allowed" });
        }

        var settings = await _context.DietitianSettings
            .FirstOrDefaultAsync(s => s.DietitianId == dietitianId);

        if (settings == null)
        {
            return NotFound(new { error = "Settings not found. Please create settings first." });
        }

        // Get WebRootPath with fallback (prevents null reference)
        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        
        // Create uploads directory if it doesn't exist
        var uploadsDir = Path.Combine(webRoot, "uploads", "dietitian-logos");
        Directory.CreateDirectory(uploadsDir);

        // Delete old logo if exists
        if (!string.IsNullOrEmpty(settings.LogoUrl))
        {
            var oldLogoPath = Path.Combine(webRoot, settings.LogoUrl.TrimStart('/'));
            if (System.IO.File.Exists(oldLogoPath))
            {
                System.IO.File.Delete(oldLogoPath);
            }
        }

        // Save new logo with dietitianId as filename
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = file.ContentType switch
            {
                "image/png" => ".png",
                "image/webp" => ".webp",
                _ => ".jpg"
            };
        }
        
        var fileName = $"{dietitianId}{extension}";
        var filePath = Path.Combine(uploadsDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Update settings with logo URL
        settings.LogoUrl = $"/uploads/dietitian-logos/{fileName}";
        settings.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Dietitian {DietitianId} uploaded logo", dietitianId);

        return Ok(new DietitianSettingsDto
        {
            ClinicName = settings.ClinicName,
            DietitianDisplayName = settings.DietitianDisplayName,
            PrimaryColorHex = settings.PrimaryColorHex,
            AccentColorHex = settings.AccentColorHex,
            ThemePresetKey = settings.ThemePresetKey,
            LogoUrl = settings.LogoUrl,
            PhoneNumber = settings.PhoneNumber,
            Bio = settings.Bio,
            WebsiteUrl = settings.WebsiteUrl,
            UpdatedAt = settings.UpdatedAt
        });
    }

    /// <summary>
    /// Delete clinic logo
    /// </summary>
    [HttpDelete("logo")]
    public async Task<ActionResult<DietitianSettingsDto>> DeleteLogo()
    {
        var dietitianId = await GetDietitianIdAsync();
        if (dietitianId == Guid.Empty)
        {
            return Unauthorized(new { error = "Invalid dietitian ID" });
        }

        var settings = await _context.DietitianSettings
            .FirstOrDefaultAsync(s => s.DietitianId == dietitianId);

        if (settings == null)
        {
            return NotFound(new { error = "Settings not found" });
        }

        // Delete logo file if exists
        if (!string.IsNullOrEmpty(settings.LogoUrl))
        {
            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var logoPath = Path.Combine(webRoot, settings.LogoUrl.TrimStart('/'));
            if (System.IO.File.Exists(logoPath))
            {
                System.IO.File.Delete(logoPath);
            }
        }

        // Update settings
        settings.LogoUrl = null;
        settings.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Dietitian {DietitianId} deleted logo", dietitianId);

        return Ok(new DietitianSettingsDto
        {
            ClinicName = settings.ClinicName,
            DietitianDisplayName = settings.DietitianDisplayName,
            PrimaryColorHex = settings.PrimaryColorHex,
            AccentColorHex = settings.AccentColorHex,
            ThemePresetKey = settings.ThemePresetKey,
            LogoUrl = settings.LogoUrl,
            PhoneNumber = settings.PhoneNumber,
            Bio = settings.Bio,
            WebsiteUrl = settings.WebsiteUrl,
            UpdatedAt = settings.UpdatedAt
        });
    }

    private async Task<Guid> GetDietitianIdAsync()
    {
        // JWT token contains UserAccount.Id, not DietitianId
        // We need to look up the LinkedDietitianId from UserAccount
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                       ?? User.FindFirst("sub")?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Guid.Empty;
        }

        var userAccount = await _authContext.UserAccounts
            .Where(u => u.Id == userId && u.Role == "Dietitian")
            .Select(u => new { u.LinkedDietitianId })
            .FirstOrDefaultAsync();

        if (userAccount == null || userAccount.LinkedDietitianId == null)
        {
            return Guid.Empty;
        }

        return userAccount.LinkedDietitianId.Value;
    }

    private static bool IsValidHexColor(string hex)
    {
        if (string.IsNullOrWhiteSpace(hex))
            return false;

        return Regex.IsMatch(hex, @"^#[0-9A-Fa-f]{6}$");
    }
}
