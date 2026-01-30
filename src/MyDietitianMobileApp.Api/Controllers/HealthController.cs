using Microsoft.AspNetCore.Mvc;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Health check endpoint (no authentication required)
/// Used for connectivity testing from mobile devices
/// </summary>
[ApiController]
[Route("api")]
public class HealthController : ControllerBase
{
    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult GetHealth()
    {
        return Ok(new
        {
            ok = true,
            timeUtc = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        });
    }
}
