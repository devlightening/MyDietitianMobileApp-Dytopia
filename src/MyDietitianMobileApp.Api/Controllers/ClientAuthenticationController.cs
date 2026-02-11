using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Infrastructure.Services;
using MyDietitianMobileApp.Api.Services;
using MyDietitianMobileApp.Api.Models;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using System.IdentityModel.Tokens.Jwt;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Handles client registration/login.
///
/// Canonical routes:
///   POST /api/client/register
///   POST /api/client/login
///
/// Legacy compat routes (hidden from Swagger):
///   POST /api/auth/client/register
///   POST /api/auth/client/login
/// </summary>
[ApiController]
[Route("api/auth")]
public class ClientAuthenticationController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly PasswordHasherService _hasher;
    private readonly IConfiguration _config;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly ILoginLockoutService _lockoutService;

    public ClientAuthenticationController(
        IMediator mediator,
        AuthDbContext authDb,
        AppDbContext appDb,
        PasswordHasherService hasher,
        IConfiguration config,
        IPremiumStatusService premiumStatusService,
        ILoginLockoutService lockoutService)
    {
        _mediator = mediator;
        _authDb = authDb;
        _appDb = appDb;
        _hasher = hasher;
        _config = config;
        _premiumStatusService = premiumStatusService;
        _lockoutService = lockoutService;
    }

    /// <summary>
    /// Client register (canonical route: POST /api/client/register)
    /// </summary>
    [HttpPost("~/api/client/register")]
    [EnableRateLimiting("auth-strict")]
    public Task<IActionResult> RegisterClient([FromBody] RegisterClientCommand command)
        => RegisterClientCore(command);

    /// <summary>
    /// Client register (legacy compat route: POST /api/auth/client/register)
    /// </summary>
    [HttpPost("client/register")]
    [EnableRateLimiting("auth-strict")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public Task<IActionResult> RegisterClientCompat([FromBody] RegisterClientCommand command)
        => RegisterClientCore(command);

    private async Task<IActionResult> RegisterClientCore(RegisterClientCommand command)
    {
        var result = await _mediator.Send(command);
        
        if (!result.Success)
        {
            // Map known business errors to ProblemDetails with proper status codes
            if (string.Equals(result.ErrorCode, "EMAIL_DOMAIN_NOT_ALLOWED", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(ApiProblems.Validation("EMAIL_DOMAIN_NOT_ALLOWED", result.Message));
            }

            if (string.Equals(result.ErrorCode, "INVALID_EMAIL", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(ApiProblems.Validation("INVALID_EMAIL", result.Message));
            }

            if (string.Equals(result.ErrorCode, "REGISTRATION_NOT_ALLOWED", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(ApiProblems.Validation("REGISTRATION_NOT_ALLOWED", result.Message));
            }

            return BadRequest(ApiProblems.Validation("REGISTER_FAILED", result.Message));
        }

        // Parse token to get expiration and userId
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jsonToken = tokenHandler.ReadJwtToken(result.Token);
        var expiresAtUtc = jsonToken.ValidTo;
        var userIdClaim = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub");
        var userId = userIdClaim?.Value ?? string.Empty;

        // Resolve premium status from database for consistency
        bool isPremium = result.IsPremium;
        string? premiumUntilUtc = null;
        string? activeDietitianId = null;

        if (Guid.TryParse(userId, out var userGuid))
        {
            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid);
            isPremium = premiumStatus.IsPremium;
            premiumUntilUtc = premiumStatus.PremiumUntilUtc?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            activeDietitianId = premiumStatus.ActiveDietitianId?.ToString();
        }

        // Set cookie for web panel (optional, for backward compatibility)
        var isDevelopment = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None,
            Expires = expiresAtUtc,
            Path = "/"
        };
        Response.Cookies.Append("access_token", result.Token, cookieOptions);

        return Ok(new { 
            token = result.Token,
            expiresAtUtc = expiresAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            role = "Client",
            userId = userId,
            publicUserId = result.PublicUserId,
            isPremium = isPremium,
            premiumUntilUtc,
            activeDietitianId
        });
    }

    /// <summary>
    /// Client login (canonical route: POST /api/client/login)
    /// </summary>
    [HttpPost("~/api/client/login")]
    [EnableRateLimiting("auth")]
    public Task<IActionResult> LoginClient([FromBody] LoginClientCommand command)
        => LoginClientCore(command);

    /// <summary>
    /// Client login (legacy compat route: POST /api/auth/client/login)
    /// </summary>
    [HttpPost("client/login")]
    [EnableRateLimiting("auth")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public Task<IActionResult> LoginClientCompat([FromBody] LoginClientCommand command)
        => LoginClientCore(command);

    private async Task<IActionResult> LoginClientCore(LoginClientCommand command)
    {
        // Per-account lockout (in-memory, email-based, no account enumeration)
        if (await _lockoutService.IsLockedOutAsync(command.Email))
        {
            return StatusCode(StatusCodes.Status429TooManyRequests,
                ApiProblems.TooManyRequests("ACCOUNT_LOCKED", "Çok sayıda hatalı giriş denemesi. Lütfen birkaç dakika sonra tekrar deneyin."));
        }

        var result = await _mediator.Send(command);
        
        if (!result.Success)
        {
            await _lockoutService.RegisterFailureAsync(command.Email);

            if (await _lockoutService.IsLockedOutAsync(command.Email))
            {
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    ApiProblems.TooManyRequests("ACCOUNT_LOCKED", "Çok sayıda hatalı giriş denemesi. Lütfen birkaç dakika sonra tekrar deneyin."));
            }

            return Unauthorized();
        }

        // Successful login → reset lockout state
        await _lockoutService.ResetAsync(command.Email);

        // Parse token to get expiration
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jsonToken = tokenHandler.ReadJwtToken(result.Token);
        var expiresAtUtc = jsonToken.ValidTo;

        // Extract userId from token claims
        var userIdClaim = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub");
        var userId = userIdClaim?.Value ?? string.Empty;

        // Resolve premium status from database for consistency
        bool isPremium = false;
        string? premiumUntilUtc = null;
        string? activeDietitianId = null;

        if (Guid.TryParse(userId, out var userGuid))
        {
            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid);
            isPremium = premiumStatus.IsPremium;
            premiumUntilUtc = premiumStatus.PremiumUntilUtc?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            activeDietitianId = premiumStatus.ActiveDietitianId?.ToString();
        }

        // Set cookie for web panel (optional, for backward compatibility)
        var isDevelopment = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None,
            Expires = expiresAtUtc,
            Path = "/"
        };
        Response.Cookies.Append("access_token", result.Token, cookieOptions);

        return Ok(new { 
            token = result.Token,
            expiresAtUtc = expiresAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            role = "Client",
            userId = userId,
            publicUserId = result.PublicUserId,
            isPremium = isPremium,
            premiumUntilUtc,
            activeDietitianId
        });
    }

    /// <summary>
    /// Client login/register with Google ID token
    /// Mobile sends Google idToken, backend verifies and issues own JWT.
    /// </summary>
    [HttpPost("~/api/client/login/google")]
    [EnableRateLimiting("auth")]
    [AllowAnonymous]
    public async Task<IActionResult> LoginWithGoogle([FromBody] GoogleLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
        {
            return BadRequest(ApiProblems.Validation("GOOGLE_ID_TOKEN_REQUIRED", "Google idToken zorunludur."));
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var googleClientId = _config["Authentication:Google:ClientId"];
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = string.IsNullOrWhiteSpace(googleClientId)
                    ? null
                    : new[] { googleClientId }
            };

            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
        }
        catch (InvalidJwtException)
        {
            return Unauthorized(ApiProblems.Validation("GOOGLE_ID_TOKEN_INVALID", "Google kimlik doğrulaması başarısız."));
        }

        var email = payload.Email;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(ApiProblems.Validation("GOOGLE_EMAIL_MISSING", "Google hesabında geçerli bir email bulunamadı."));
        }

        // Normalize + allowlist check (same as register flow)
        var emailCheck = MyDietitianMobileApp.Application.Services.EmailPolicy.ValidateAllowedDomain(
            email ?? string.Empty,
            _config);

        email = emailCheck.NormalizedEmail;

        if (!emailCheck.IsAllowed)
        {
            return BadRequest(ApiProblems.Validation(emailCheck.ErrorCode ?? "EMAIL_DOMAIN_NOT_ALLOWED",
                emailCheck.ErrorMessage ?? "Bu email uzantısı desteklenmiyor."));
        }

        // Find existing user by email
        var existingUser = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Email == email && u.Role == "Client");

        Guid userId;
        Guid clientId;
        string publicUserId;

        if (existingUser != null && existingUser.LinkedClientId.HasValue)
        {
            userId = existingUser.Id;
            clientId = existingUser.LinkedClientId.Value;
            publicUserId = existingUser.PublicUserId;
        }
        else
        {
            // Auto-provision new Client + UserAccount
            using var tx = await _appDb.Database.BeginTransactionAsync();
            try
            {
                clientId = Guid.NewGuid();
                var fullName = string.IsNullOrWhiteSpace(payload.Name) ? email : payload.Name;
                // Gender/BirthDate unknown for Google sign-in, use defaults
                var client = new Client(
                    clientId,
                    fullName,
                    email,
                    Domain.Enums.Gender.Other,
                    new DateOnly(2000, 1, 1),
                    isActive: true
                );
                _appDb.Clients.Add(client);

                userId = Guid.NewGuid();
                // No local password for Google accounts – store random string
                var randomPassword = Guid.NewGuid().ToString("N");
                var hashedPassword = _hasher.HashPassword(randomPassword);

                var userAccount = new UserAccount(
                    userId,
                    email,
                    hashedPassword,
                    "Client"
                );
                userAccount.LinkedClientId = clientId;

                // Generate unique PublicUserId
                do
                {
                    publicUserId = PublicUserIdGenerator.Generate();
                } while (await _authDb.UserAccounts.AnyAsync(u => u.PublicUserId == publicUserId));

                userAccount.SetPublicUserId(publicUserId);

                _authDb.UserAccounts.Add(userAccount);

                await _authDb.SaveChangesAsync();
                await _appDb.SaveChangesAsync();
                await tx.CommitAsync();
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        }

        // Generate JWT (same shape as normal client login)
        var secret = _config["Jwt:SecretKey"];
        var issuer = _config["Jwt:Issuer"] ?? "MyDietitian.Api";
        var audience = _config["Jwt:Audience"] ?? "MyDietitian.Mobile";

        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("JWT_SECRET_IS_NULL - Check appsettings.json");

        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var key = System.Text.Encoding.UTF8.GetBytes(secret);

        var claims = new List<System.Security.Claims.Claim>
        {
            new("sub", userId.ToString()),
            new("role", "Client"),
            new(System.Security.Claims.ClaimTypes.Role, "Client"),
            new("clientId", clientId.ToString()),
            new("publicUserId", publicUserId)
        };

        var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Subject = new System.Security.Claims.ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(30),
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var jwt = tokenHandler.WriteToken(token);
        var expiresAtUtc = token.ValidTo;

        // Resolve premium status
        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userId);

        var isDevelopment = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None,
            Expires = expiresAtUtc,
            Path = "/"
        };
        Response.Cookies.Append("access_token", jwt, cookieOptions);

        return Ok(new
        {
            token = jwt,
            expiresAtUtc = expiresAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            role = "Client",
            userId = userId.ToString(),
            publicUserId,
            isPremium = premiumStatus.IsPremium,
            premiumUntilUtc = premiumStatus.PremiumUntilUtc?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            activeDietitianId = premiumStatus.ActiveDietitianId?.ToString()
        });
    }
}
