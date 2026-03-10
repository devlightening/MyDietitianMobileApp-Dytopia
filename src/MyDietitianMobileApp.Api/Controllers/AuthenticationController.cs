using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.DTOs;
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
    [EnableRateLimiting("auth-strict")]
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
    /// Dietitian register for web panel
    /// </summary>
    /// <remarks>
    /// Contract used by web-panel:
    /// POST /api/auth/dietitian/register
    /// {
    ///   "fullName": "Dr. Example",
    ///   "clinicName": "Example Clinic",
    ///   "email": "example@example.com",
    ///   "password": "Strong123"
    /// }
    /// </remarks>
    [HttpPost("dietitian/register")]
    [EnableRateLimiting("auth-strict")]
    public async Task<IActionResult> RegisterDietitian([FromBody] DietitianRegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password required" });

        var exists = await _authDb.UserAccounts
            .AnyAsync(u => u.Email == request.Email && u.Role == "Dietitian");

        if (exists)
            return Conflict(new { message = "Email already in use" });

        if (request.Password.Length < 8 ||
            !request.Password.Any(char.IsUpper) ||
            !request.Password.Any(char.IsDigit))
        {
            return BadRequest(new { message = "Password must be 8+ chars, include 1 uppercase and 1 digit." });
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
                PasswordHash = _hasher.HashPassword(request.Password)
            };

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
    /// Get current authenticated user information
    /// </summary>
    /// <remarks>
    /// Returns user info based on JWT claims from HttpOnly cookie.
    /// Used by web panel AuthGuard for session verification and RBAC.
    /// </remarks>
    [HttpGet("me")]
    [Authorize] // Requires valid JWT token
    public async Task<IActionResult> GetCurrentUser()
    {
        try
        {
            // Extract claims from authenticated user
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)
                ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
            
            var roleClaim = User.FindFirst("role")
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Role);

            // If no user ID claim, authentication is invalid
            if (userIdClaim == null)
            {
                return Unauthorized(new { message = "Invalid authentication token" });
            }

            // If no role claim, user cannot access protected resources
            if (roleClaim == null)
            {
                return StatusCode(403, new { message = "User role not found" });
            }

            var userId = userIdClaim.Value;
            var role = roleClaim.Value;

            // Build response based on role
            if (role == "Dietitian")
            {
                // Fetch dietitian details
                var userAccount = await _authDb.UserAccounts
                    .FirstOrDefaultAsync(u => u.Id.ToString() == userId);

                if (userAccount == null)
                {
                    return Unauthorized(new { message = "User account not found" });
                }

                var dietitian = await _appDb.Dietitians
                    .FirstOrDefaultAsync(d => d.Id == userAccount.LinkedDietitianId);

                if (dietitian == null || !dietitian.IsActive)
                {
                    return StatusCode(403, new { message = "Dietitian account not active" });
                }

                return Ok(new
                {
                    userId = userId,
                    email = userAccount.Email,
                    fullName = dietitian.FullName,
                    role = "dietitian", // Lowercase for frontend consistency
                    dietitianId = dietitian.Id.ToString(),
                    clinicName = dietitian.ClinicName
                });
            }
            else if (role == "Admin")
            {
                var userAccount = await _authDb.UserAccounts
                    .FirstOrDefaultAsync(u => u.Id.ToString() == userId);

                if (userAccount == null)
                {
                    return Unauthorized(new { message = "User account not found" });
                }

                return Ok(new
                {
                    userId = userId,
                    email = userAccount.Email,
                    role = "admin" // Lowercase for frontend consistency
                });
            }
            else if (role == "Client")
            {
                // Clients should not access web panel
                return StatusCode(403, new { message = "Access denied. This area is for dietitians only." });
            }
            else
            {
                // Unknown role
                return StatusCode(403, new { message = "Unknown user role" });
            }
        }
        catch (Exception ex)
        {
            // Log error but don't expose internal details
            Console.Error.WriteLine($"Error in /api/auth/me: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred while retrieving user information" });
        }
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
