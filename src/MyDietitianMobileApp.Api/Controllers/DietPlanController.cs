using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Security.Claims;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;

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
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly ILogger<DietPlanController> _logger;

    public DietPlanController(
        IMediator mediator,
        AuthDbContext authDb,
        AppDbContext appDb,
        IPremiumStatusService premiumStatusService,
        ILogger<DietPlanController> logger)
    {
        _mediator = mediator;
        _authDb = authDb;
        _appDb = appDb;
        _premiumStatusService = premiumStatusService;
        _logger = logger;
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
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
                return Unauthorized(new { 
                    message = "JWT token eksik",
                    code = "AUTH_REQUIRED"
                });

            // Resolve clientId from AuthDb to avoid trusting claims
            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userGuid);
            if (user == null || !user.LinkedClientId.HasValue)
            {
                return NotFound(new
                {
                    message = "Client kaydı bulunamadı",
                    code = "CLIENT_NOT_FOUND"
                });
            }

            var clientId = user.LinkedClientId.Value;

            var premium = await _premiumStatusService.GetPremiumStatusAsync(userGuid);
            if (!premium.IsPremium)
            {
                var problem = ApiProblems.PremiumRequired();
                return StatusCode(problem.Status ?? 403, problem);
            }

            // Get today's plan for this client
            var query = new GetTodayPlanQuery(clientId);
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
            _logger.LogWarning("Unauthorized access when getting today's plan for diet client. TraceId={TraceId}", HttpContext.TraceIdentifier);
            return Unauthorized(new { 
                message = "Yetkilendirme hatası",
                code = "AUTH_REQUIRED"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while getting today's diet plan. TraceId={TraceId}", HttpContext.TraceIdentifier);
            return StatusCode(500, new { 
                message = "Plan alınırken bir hata oluştu",
                code = "INTERNAL_ERROR",
                traceId = HttpContext.TraceIdentifier
            });
        }
    }
}
