using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using System.IdentityModel.Tokens.Jwt;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Handles client and dietitian registration/login
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

    public ClientAuthenticationController(
        IMediator mediator,
        AuthDbContext authDb,
        AppDbContext appDb,
        PasswordHasherService hasher,
        IConfiguration config)
    {
        _mediator = mediator;
        _authDb = authDb;
        _appDb = appDb;
        _hasher = hasher;
        _config = config;
    }

    /// <summary>
    /// Client register
    /// Returns JWT token in JSON response (for mobile header-based auth)
    /// Also sets cookie for web panel compatibility
    /// </summary>
    [HttpPost("client/register")]
    public async Task<IActionResult> RegisterClient([FromBody] RegisterClientCommand command)
    {
        var result = await _mediator.Send(command);
        
        if (!result.Success)
            return BadRequest(new { message = result.Message });

        // Parse token to get expiration and userId
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jsonToken = tokenHandler.ReadJwtToken(result.Token);
        var expiresAtUtc = jsonToken.ValidTo;
        var userIdClaim = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub");
        var userId = userIdClaim?.Value ?? string.Empty;

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
            isPremium = result.IsPremium
        });
    }

    /// <summary>
    /// Client login
    /// Returns JWT token in JSON response (for mobile header-based auth)
    /// Also sets cookie for web panel compatibility
    /// </summary>
    [HttpPost("client/login")]
    public async Task<IActionResult> LoginClient([FromBody] LoginClientCommand command)
    {
        var result = await _mediator.Send(command);
        
        if (!result.Success)
            return Unauthorized();

        // Parse token to get expiration
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jsonToken = tokenHandler.ReadJwtToken(result.Token);
        var expiresAtUtc = jsonToken.ValidTo;

        // Extract userId from token claims
        var userIdClaim = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub");
        var userId = userIdClaim?.Value ?? string.Empty;

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
            isPremium = false
        });
    }
}
