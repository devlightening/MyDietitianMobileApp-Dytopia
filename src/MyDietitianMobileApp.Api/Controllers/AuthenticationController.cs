using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;

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

    public AuthenticationController(
        AuthDbContext authDb,
        AppDbContext appDb,
        PasswordHasherService hasher,
        IConfiguration config)
    {
        _authDb = authDb;
        _appDb = appDb;
        _hasher = hasher;
        _config = config;
    }

    /// <summary>
    /// Dietitian login
    /// </summary>
    [HttpPost("dietitian/login")]
    public async Task<IActionResult> DietitianLogin([FromBody] DietitianLoginRequest request)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.Role == "Dietitian");

        if (user == null)
            return Unauthorized(new { message = "Invalid credentials" });

        // Handle legacy password hashes that aren't Identity-compatible
        try
        {
            if (!_hasher.VerifyPassword(user.PasswordHash, request.Password))
                return Unauthorized(new { message = "Invalid credentials" });
        }
        catch (FormatException)
        {
            // Legacy hash format - user needs password reset
            return Unauthorized(new { message = "Invalid credentials. Please contact admin for password reset." });
        }

        var dietitian = await _appDb.Dietitians.FindAsync(user.LinkedDietitianId);
        if (dietitian == null || !dietitian.IsActive)
            return Unauthorized(new { message = "Dietitian account not active" });

        var jwtSecret = _config["Jwt:SecretKey"] ?? throw new InvalidOperationException("JWT Secret missing");
        var jwtIssuer = _config["Jwt:Issuer"] ?? "MyDietitian.Api";
        var jwtAudience = _config["Jwt:Audience"] ?? "MyDietitian.Mobile";
        var expiresMinutes = int.Parse(_config["Jwt:ExpiresMinutes"] ?? "43200");

        var token = MyDietitianMobileApp.Infrastructure.Services.JwtTokenGenerator.GenerateToken(
            user.Id.ToString(),
            "Dietitian",
            jwtSecret,
            jwtIssuer,
            jwtAudience,
            expiresMinutes
        );

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            // CRITICAL: SameSite=None REQUIRES Secure=true
            // Use HTTPS endpoint (https://localhost:7154) for this to work
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTime.UtcNow.AddMinutes(expiresMinutes),
            Path = "/"
        };

        Response.Cookies.Append("access_token", token, cookieOptions);
        return Ok(new { ok = true });
    }

    /// <summary>
    /// Admin login
    /// </summary>
    [HttpPost("admin/login")]
    public async Task<IActionResult> AdminLogin([FromBody] AdminLoginRequest request)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.Role == "Admin");

        if (user == null)
            return Unauthorized(new { message = "Invalid credentials" });

        // Handle legacy password hashes
        try
        {
            if (!_hasher.VerifyPassword(user.PasswordHash, request.Password))
                return Unauthorized(new { message = "Invalid credentials" });
        }
        catch (FormatException)
        {
            return Unauthorized(new { message = "Invalid credentials. Please contact admin for password reset." });
        }

        var jwtSecret = _config["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret missing");
        var jwtIssuer = _config["Jwt:Issuer"] ?? "MyDietitian.Api";
        var jwtAudience = _config["Jwt:Audience"] ?? "MyDietitian.Mobile";
        var expiresMinutes = int.Parse(_config["Jwt:ExpiresMinutes"] ?? "43200");

        var token = MyDietitianMobileApp.Infrastructure.Services.JwtTokenGenerator.GenerateToken(
            user.Id.ToString(),
            "Admin",
            jwtSecret,
            jwtIssuer,
            jwtAudience,
            expiresMinutes
        );

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            // CRITICAL: SameSite=None REQUIRES Secure=true
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTime.UtcNow.AddMinutes(expiresMinutes),
            Path = "/"
        };

        Response.Cookies.Append("access_token", token, cookieOptions);
        return Ok(new { ok = true });
    }

    /// <summary>
    /// Logout (all user types)
    /// </summary>
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // Overwrite cookie with empty value instead of Delete
        // This ensures SameSite=None cookies are properly cleared
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Path = "/",
            SameSite = SameSiteMode.None,
            Secure = true,  // MUST match login cookie settings
            Expires = DateTime.UtcNow.AddDays(-1)
        };
        
        Response.Cookies.Append("access_token", "", cookieOptions);
        return Ok(new { ok = true });
    }
}

// DTOs
public record DietitianLoginRequest(string Email, string Password);
public record AdminLoginRequest(string Email, string Password);
