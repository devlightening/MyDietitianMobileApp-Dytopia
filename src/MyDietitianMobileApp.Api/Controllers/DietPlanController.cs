using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Security.Claims;
using MyDietitianMobileApp.Api.Extensions;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages diet plans: creation, retrieval, and alternative meal decisions
/// </summary>
[Authorize]
[ApiController]
[Route("api/diet-plans")]
public class DietPlanController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;

    public DietPlanController(IMediator mediator, AuthDbContext authDb, AppDbContext appDb)
    {
        _mediator = mediator;
        _authDb = authDb;
        _appDb = appDb;
    }

    /// <summary>
    /// Create new diet plan
    /// </summary>
    [HttpPost]
    [Authorize("Dietitian")]
    public async Task<IActionResult> CreateDietPlan([FromBody] CreateDietPlanCommand command)
    {
        if (!User.TryGetUserIdAsGuid(out var userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Dietitian");
        if (user?.LinkedDietitianId == null)
            return Unauthorized();

        var createCommand = new CreateDietPlanCommand(
            user.LinkedDietitianId.Value,
            command.ClientId,
            command.Name,
            command.StartDate,
            command.EndDate,
            command.Days);

        var result = await _mediator.Send(createCommand);
        return result.Success ? Ok(result) : BadRequest(result.ErrorMessage);
    }

    /// <summary>
    /// Get diet plan for a client
    /// </summary>
    [HttpGet("{clientId}")]
    [Authorize("Dietitian")]
    public async Task<IActionResult> GetDietPlan(Guid clientId)
    {
        if (!User.TryGetUserIdAsGuid(out var userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Dietitian");
        if (user?.LinkedDietitianId == null)
            return Unauthorized();

        var query = new GetDietPlanByClientQuery(user.LinkedDietitianId.Value, clientId);
        var result = await _mediator.Send(query);
        
        return result != null 
            ? Ok(result) 
            : NotFound("No active diet plan found for this client.");
    }

    /// <summary>
    /// Get alternative meal recommendation
    /// </summary>
    [HttpPost("decide-alternative")]
    [Authorize("Dietitian")]
    public async Task<IActionResult> DecideAlternative([FromBody] DecideAlternativeMealQuery query)
    {
        if (!User.TryGetUserIdAsGuid(out var userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Dietitian");
        if (user?.LinkedDietitianId == null)
            return Unauthorized();

        var decisionQuery = new DecideAlternativeMealQuery(
            user.LinkedDietitianId.Value,
            query.PlannedRecipeId,
            query.MealType,
            query.ClientAvailableIngredients);

        var result = await _mediator.Send(decisionQuery);
        return Ok(result);
    }

    /// <summary>
    /// Get today's plan for mobile client (Premium only)
    /// </summary>
    [HttpGet("today")]
    [Authorize("Client")]
    public async Task<IActionResult> GetTodayPlan()
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { 
                    message = "JWT token eksik",
                    code = "AUTH_REQUIRED"
                });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user == null)
                return Unauthorized(new { 
                    message = "Kullanıcı bulunamadı",
                    code = "AUTH_REQUIRED"
                });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return NotFound(new { 
                    message = "Client kaydı bulunamadı",
                    code = "CLIENT_NOT_FOUND"
                });

            // Check premium status
            var activeLink = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.ClientId == client.Id && l.IsActive);

            bool isPremium = false;
            if (client.ActiveDietitianId.HasValue && activeLink != null)
            {
                var now = DateTime.UtcNow;
                if (client.ProgramEndDate == null || client.ProgramEndDate > now)
                {
                    isPremium = true;
                }
            }

            if (!isPremium)
            {
                return StatusCode(403, new { 
                    code = "PREMIUM_REQUIRED",
                    message = "Bu özellik premium üyelik gerektirir"
                });
            }

            // Get today's plan
            var query = new GetTodayPlanQuery();
            var result = await _mediator.Send(query);
            
            // If no plan exists, return 404
            if (result == null)
            {
                return NotFound(new { 
                    message = "Bugün için plan bulunamadı",
                    code = "PLAN_NOT_FOUND"
                });
            }

            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { 
                message = "Yetkilendirme hatası",
                code = "AUTH_REQUIRED"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { 
                message = "Plan alınırken bir hata oluştu",
                code = "INTERNAL_ERROR"
            });
        }
    }
}
