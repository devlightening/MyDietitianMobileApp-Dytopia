using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Handles authentication operations for all user types (Dietitian, Client, Admin)
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthenticationController : ControllerBase
{
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly PasswordHasherService _hasher;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public AuthenticationController(
        AuthDbContext authDb,
        AppDbContext appDb,
        PasswordHasherService hasher,
        IConfiguration config,
        IWebHostEnvironment env)
    {
        _authDb = authDb;
        _appDb = appDb;
        _hasher = hasher;
        _config = config;
        _env = env;
    }

    /// <summary>
    /// Dietitian login (legacy route, use /api/dietitian/login instead)
    /// </summary>
    [HttpPost("dietitian/login")]
    [EnableRateLimiting("auth-strict")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> DietitianLogin([FromBody] DietitianLoginRequest request)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.Role == "Dietitian");

        if (user == null)
            return Unauthorized(new { message = "Geçersiz giriş bilgileri." });

        try
        {
            if (!_hasher.VerifyPassword(user.PasswordHash, request.Password))
                return Unauthorized(new { message = "Geçersiz giriş bilgileri." });
        }
        catch (FormatException)
        {
            return Unauthorized(new { message = "Şifre doğrulanamadı. Lütfen yöneticinizle iletişime geçin." });
        }

        var dietitian = await _appDb.Dietitians.FindAsync(user.LinkedDietitianId);
        if (dietitian == null || !dietitian.IsActive)
            return Unauthorized(new { message = "Diyetisyen hesabı aktif değil." });

        user.EnsureSecurityStamp();
        user.LastLoginAtUtc = DateTime.UtcNow;
        await _authDb.SaveChangesAsync();

        var expiresMinutes = GetJwtExpiresMinutes();
        var token = GenerateTokenForUser(user, expiresMinutes);
        AppendAccessTokenCookie(token, DateTime.UtcNow.AddMinutes(expiresMinutes));

        return Ok(new { ok = true, token });
    }

    /// <summary>
    /// Admin login
    /// </summary>
    [HttpPost("admin/login")]
    [EnableRateLimiting("auth-strict")]
    public async Task<IActionResult> AdminLogin([FromBody] AdminLoginRequest request)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.Role == "Admin");

        if (user == null)
            return Unauthorized(new { message = "Geçersiz giriş bilgileri." });

        try
        {
            if (!_hasher.VerifyPassword(user.PasswordHash, request.Password))
                return Unauthorized(new { message = "Geçersiz giriş bilgileri." });
        }
        catch (FormatException)
        {
            return Unauthorized(new { message = "Şifre doğrulanamadı. Lütfen yöneticinizle iletişime geçin." });
        }

        user.EnsureSecurityStamp();
        user.LastLoginAtUtc = DateTime.UtcNow;
        await _authDb.SaveChangesAsync();

        var expiresMinutes = GetJwtExpiresMinutes();
        var token = GenerateTokenForUser(user, expiresMinutes);
        AppendAccessTokenCookie(token, DateTime.UtcNow.AddMinutes(expiresMinutes));

        return Ok(new { ok = true, token });
    }

    /// <summary>
    /// Dietitian register for web panel
    /// </summary>
    [HttpPost("dietitian/register")]
    [EnableRateLimiting("auth-strict")]
    public async Task<IActionResult> RegisterDietitian([FromBody] DietitianRegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "E-posta ve şifre zorunludur." });

        var exists = await _authDb.UserAccounts
            .AnyAsync(u => u.Email == request.Email && u.Role == "Dietitian");

        if (exists)
            return Conflict(new { message = "Bu e-posta zaten kullanımda." });

        var passwordValidation = PasswordPolicy.Validate(request.Password);
        if (!passwordValidation.IsValid)
        {
            return BadRequest(new { message = passwordValidation.ErrorMessage ?? "Şifre gereksinimleri karşılanmadı." });
        }

        var dietitian = new MyDietitianMobileApp.Domain.Entities.Dietitian(
            Guid.NewGuid(),
            request.FullName,
            request.ClinicName,
            true
        );

        _appDb.Dietitians.Add(dietitian);
        await _appDb.SaveChangesAsync();

        try
        {
            var user = new UserAccount
            {
                Id = Guid.NewGuid(),
                Email = request.Email,
                Role = "Dietitian",
                LinkedDietitianId = dietitian.Id,
                PasswordHash = _hasher.HashPassword(request.Password),
                PasswordChangedAtUtc = DateTime.UtcNow
            };
            user.EnsureSecurityStamp();

            _authDb.UserAccounts.Add(user);
            await _authDb.SaveChangesAsync();
        }
        catch
        {
            _appDb.Dietitians.Remove(dietitian);
            await _appDb.SaveChangesAsync();
            throw;
        }

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Change current account password and optionally invalidate other sessions.
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    [EnableRateLimiting("auth-strict")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Mevcut şifre ve yeni şifre zorunludur." });
        }

        var user = await GetAuthenticatedUserAccountAsync();
        if (user == null)
        {
            return Unauthorized(new { message = "Kullanıcı oturumu doğrulanamadı." });
        }

        try
        {
            if (!_hasher.VerifyPassword(user.PasswordHash, request.CurrentPassword))
            {
                return BadRequest(new { message = "Mevcut şifre hatalı." });
            }
        }
        catch (FormatException)
        {
            return BadRequest(new { message = "Şifre doğrulanamadı. Lütfen destek ile iletişime geçin." });
        }

        if (_hasher.VerifyPassword(user.PasswordHash, request.NewPassword))
        {
            return BadRequest(new { message = "Yeni şifre mevcut şifreyle aynı olamaz." });
        }

        var passwordValidation = PasswordPolicy.Validate(request.NewPassword);
        if (!passwordValidation.IsValid)
        {
            return BadRequest(new { message = passwordValidation.ErrorMessage ?? "Yeni şifre gereksinimleri karşılanmadı." });
        }

        user.EnsureSecurityStamp();
        if (request.SignOutOtherSessions)
        {
            user.RotateSecurityStamp();
        }

        user.PasswordHash = _hasher.HashPassword(request.NewPassword);
        user.PasswordChangedAtUtc = DateTime.UtcNow;
        await _authDb.SaveChangesAsync();

        var expiresMinutes = GetJwtExpiresMinutes();
        var token = GenerateTokenForUser(user, expiresMinutes);
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(expiresMinutes);
        AppendAccessTokenCookie(token, expiresAtUtc);

        return Ok(new
        {
            ok = true,
            token,
            expiresAtUtc = expiresAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            message = request.SignOutOtherSessions
                ? "Şifreniz güncellendi ve diğer cihazlardaki oturumlar kapatıldı."
                : "Şifreniz güncellendi."
        });
    }

    /// <summary>
    /// Get current authenticated user information
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        try
        {
            var user = await GetAuthenticatedUserAccountAsync();
            if (user == null)
            {
                return Unauthorized(new { message = "Kullanıcı hesabı bulunamadı." });
            }

            if (user.Role == "Dietitian")
            {
                var dietitian = await _appDb.Dietitians
                    .FirstOrDefaultAsync(d => d.Id == user.LinkedDietitianId);

                if (dietitian == null || !dietitian.IsActive)
                {
                    return StatusCode(403, new { message = "Diyetisyen hesabı aktif değil." });
                }

                return Ok(new
                {
                    userId = user.Id.ToString(),
                    email = user.Email,
                    fullName = dietitian.FullName,
                    role = "dietitian",
                    dietitianId = dietitian.Id.ToString(),
                    clinicName = dietitian.ClinicName,
                    lastPasswordChangedAtUtc = user.PasswordChangedAtUtc,
                    lastLoginAtUtc = user.LastLoginAtUtc
                });
            }

            if (user.Role == "Admin")
            {
                return Ok(new
                {
                    userId = user.Id.ToString(),
                    email = user.Email,
                    role = "admin",
                    lastPasswordChangedAtUtc = user.PasswordChangedAtUtc,
                    lastLoginAtUtc = user.LastLoginAtUtc
                });
            }

            if (user.Role == "Client")
            {
                return Ok(new
                {
                    userId = user.Id.ToString(),
                    email = user.Email,
                    role = "client",
                    clientId = user.LinkedClientId?.ToString(),
                    publicUserId = user.PublicUserId,
                    lastPasswordChangedAtUtc = user.PasswordChangedAtUtc,
                    lastLoginAtUtc = user.LastLoginAtUtc
                });
            }

            return StatusCode(403, new { message = "Bilinmeyen kullanıcı rolü." });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error in /api/auth/me: {ex.Message}");
            return StatusCode(500, new { message = "Kullanıcı bilgileri alınırken bir hata oluştu." });
        }
    }

    /// <summary>
    /// Logout (all user types)
    /// </summary>
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var isDevelopment = _env.IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Path = "/",
            Secure = !isDevelopment,
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None
        };

        Response.Cookies.Delete("access_token", cookieOptions);
        cookieOptions.Expires = DateTimeOffset.UnixEpoch.UtcDateTime;
        Response.Cookies.Append("access_token", "", cookieOptions);

        return Ok(new { ok = true });
    }

    private async Task<UserAccount?> GetAuthenticatedUserAccountAsync()
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            return null;
        }

        return await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == parsedUserId);
    }

    private string GenerateTokenForUser(UserAccount user, int expiresMinutes)
    {
        user.EnsureSecurityStamp();

        var additionalClaims = new List<Claim>();
        if (user.Role == "Client")
        {
            if (user.LinkedClientId.HasValue)
            {
                additionalClaims.Add(new Claim("clientId", user.LinkedClientId.Value.ToString()));
            }

            if (!string.IsNullOrWhiteSpace(user.PublicUserId))
            {
                additionalClaims.Add(new Claim("publicUserId", user.PublicUserId));
            }
        }

        return JwtTokenGenerator.GenerateToken(
            user.Id.ToString(),
            user.Role,
            GetJwtSecret(),
            GetJwtIssuer(),
            GetJwtAudience(),
            expiresMinutes,
            securityStamp: user.SecurityStamp,
            additionalClaims: additionalClaims);
    }

    private void AppendAccessTokenCookie(string token, DateTime expiresAtUtc)
    {
        var isDevelopment = _env.IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None,
            Expires = expiresAtUtc,
            Path = "/"
        };

        Response.Cookies.Append("access_token", token, cookieOptions);
    }

    private string GetJwtSecret()
        => _config["Jwt:SecretKey"]
           ?? _config["Jwt:Secret"]
           ?? throw new InvalidOperationException("JWT Secret missing");

    private string GetJwtIssuer() => _config["Jwt:Issuer"] ?? "MyDietitian.Api";

    private string GetJwtAudience() => _config["Jwt:Audience"] ?? "MyDietitian.Mobile";

    private int GetJwtExpiresMinutes() => int.Parse(_config["Jwt:ExpiresMinutes"] ?? "43200");
}

// DTOs
public record DietitianLoginRequest(string Email, string Password);
public record AdminLoginRequest(string Email, string Password);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword, bool SignOutOtherSessions = true);
