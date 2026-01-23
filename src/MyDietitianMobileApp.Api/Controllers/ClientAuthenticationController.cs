using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;

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
    /// </summary>
    [HttpPost("client/register")]
    public async Task<IActionResult> RegisterClient([FromBody] RegisterClientCommand command)
    {
        var result = await _mediator.Send(command);
        
        if (!result.Success)
            return BadRequest(new { message = result.Message });

        return Ok(new { 
            token = result.Token, 
            role = "Client", 
            publicUserId = result.PublicUserId,
            isPremium = result.IsPremium
        });
    }

    /// <summary>
    /// Client login
    /// </summary>
    [HttpPost("client/login")]
    public async Task<IActionResult> LoginClient([FromBody] LoginClientCommand command)
    {
        var result = await _mediator.Send(command);
        
        if (!result.Success)
            return Unauthorized();

        return Ok(new { 
            token = result.Token, 
            role = "Client",
            publicUserId = result.PublicUserId,
            isPremium = false
        });
    }
}
