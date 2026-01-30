using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Security.Claims;
using MyDietitianMobileApp.Api.Extensions;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages meal compliance tracking for clients and dietitians
/// </summary>
[Authorize]
[ApiController]
[Route("api/compliance")]
public class ComplianceController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AuthDbContext _authDb;

    public ComplianceController(IMediator mediator, AuthDbContext authDb)
    {
        _mediator = mediator;
        _authDb = authDb;
    }

    /// <summary>
    /// Client marks a meal item
    /// </summary>
    [HttpPost("mark")]
    [Authorize("Client")]
    public async Task<IActionResult> MarkCompliance([FromBody] MarkComplianceRequest request)
    {
        if (!User.TryGetUserIdAsGuid(out var userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Client");
        if (user?.LinkedClientId == null)
            return Unauthorized();

        if (!Enum.TryParse<ComplianceStatus>(request.Status, ignoreCase: true, out var status))
            return BadRequest("Invalid status. Must be: Done, Skipped, or Alternative");

        if (status == ComplianceStatus.Alternative && !request.AlternativeIngredientId.HasValue)
            return BadRequest("AlternativeIngredientId is required when status is Alternative");

        try
        {
            var command = new MarkComplianceCommand(
                user.LinkedClientId.Value,
                request.MealItemId,
                status,
                request.AlternativeIngredientId,
                request.ClientTimezoneOffsetMinutes
            );

            var result = (MyDietitianMobileApp.Application.Commands.MarkComplianceResult)await _mediator.Send(command);
            return Ok(new MarkComplianceResponse
            {
                Success = result.Success,
                DailyCompliancePercentage = result.DailyCompliancePercentage,
                ComplianceId = result.ComplianceId
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Dietitian views client's daily compliance
    /// </summary>
    [HttpGet("daily")]
    [Authorize("Dietitian")]
    public async Task<IActionResult> GetDailyCompliance([FromQuery] Guid clientId, [FromQuery] DateOnly? date)
    {
        if (!User.TryGetUserIdAsGuid(out var userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Dietitian");
        if (user?.LinkedDietitianId == null)
            return Unauthorized();

        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        try
        {
            var query = new GetDailyComplianceQuery(user.LinkedDietitianId.Value, clientId, targetDate);
            var result = await _mediator.Send(query);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
    }

    /// <summary>
    /// Dashboard live view of clients
    /// </summary>
    [HttpGet("~/api/dietitian/live-clients")]
    [Authorize("Dietitian")]
    public async Task<IActionResult> GetLiveClients()
    {
        if (!User.TryGetUserIdAsGuid(out var userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Dietitian");
        if (user?.LinkedDietitianId == null)
            return Unauthorized();

        var query = new GetLiveClientsQuery(user.LinkedDietitianId.Value);
        var result = await _mediator.Send(query);
        return Ok(result);
    }
}

// DTOs
public record MarkComplianceRequest(Guid MealItemId, string Status, Guid? AlternativeIngredientId, int ClientTimezoneOffsetMinutes);
public record MarkComplianceResponse
{
    public bool Success { get; init; }
    public decimal DailyCompliancePercentage { get; init; }
    public Guid ComplianceId { get; init; }
}
