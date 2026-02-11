using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Dietitian login alias endpoint (documentation contract)
/// </summary>
[ApiController]
[Route("api/dietitian")]
public class DietitianLoginAliasController : ControllerBase
{
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly PasswordHasherService _hasher;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public DietitianLoginAliasController(
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
    /// Dietitian login (alias for /api/auth/dietitian/login)
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] DietitianLoginRequest request)
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
        var isDevelopment = _env.IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None,
            Expires = DateTimeOffset.UtcNow.AddMinutes(expiresMinutes),
            Path = "/"
        };

        Response.Cookies.Append("access_token", token, cookieOptions);
        return Ok(new { ok = true });
    }
}
