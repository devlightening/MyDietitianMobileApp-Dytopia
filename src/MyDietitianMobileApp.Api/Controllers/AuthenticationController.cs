using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    [EnableRateLimiting("auth")]
    [ApiExplorerSettings(IgnoreApi = true)] // Hidden from Swagger (use /api/dietitian/login instead)
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

        // Environment-aware cookie configuration
        // Development: Use Lax (works with same-origin requests, no HTTPS required)
        // Production: Use None + Secure (required for cross-origin requests)
        var isDevelopment = _env.IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment, // Only require HTTPS in production
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None,
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
    [EnableRateLimiting("auth")]
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

        // Environment-aware cookie configuration (same as dietitian login)
        var isDevelopment = _env.IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None,
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
        // Delete cookie using same Path/SameSite/Secure options as login
        // Use both Delete and overwrite with expired cookie for maximum reliability
        var isDevelopment = _env.IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Path = "/",
            Secure = !isDevelopment, // MUST match login cookie settings
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None // MUST match login
        };
        
        // First, try to delete the cookie
        Response.Cookies.Delete("access_token", cookieOptions);
        
        // Then, overwrite with expired cookie (Unix epoch) to ensure it's cleared
        cookieOptions.Expires = DateTimeOffset.UnixEpoch.UtcDateTime;
        Response.Cookies.Append("access_token", "", cookieOptions);
        
        return Ok(new { ok = true });
    }
}

// DTOs
public record DietitianLoginRequest(string Email, string Password);
public record AdminLoginRequest(string Email, string Password);
