using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Interfaces;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages client profile, measurements, and health data
/// </summary>
[Authorize]
[ApiController]
[Route("api/profile")]
public class ClientProfileController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly IPremiumStatusService _premiumStatusService;

    public ClientProfileController(
        IMediator mediator,
        AuthDbContext authDb,
        AppDbContext appDb,
        IPremiumStatusService premiumStatusService)
    {
        _mediator = mediator;
        _authDb = authDb;
        _appDb = appDb;
        _premiumStatusService = premiumStatusService;
    }

    /// <summary>
    /// Get current user profile
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetProfile()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return Unauthorized();

        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == userGuid);

        if (user == null)
            return NotFound();

        var client = user.LinkedClientId.HasValue
            ? await _appDb.Clients.FindAsync(user.LinkedClientId.Value)
            : null;

        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid);

        return Ok(new
        {
            fullName = client?.FullName ?? user.Email,
            email = user.Email,
            publicUserId = user.PublicUserId,
            isPremium = premiumStatus.IsPremium,
            createdAt = user.Id.ToString()
        });
    }

    /// <summary>
    /// Add new measurement (weight/height)
    /// </summary>
    [HttpPost("measurements")]
    public async Task<IActionResult> AddMeasurement([FromBody] AddUserMeasurementRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedClientId == null)
            return BadRequest("User is not a client");

        var client = await _appDb.Clients.FindAsync(user.LinkedClientId.Value);
        if (client == null)
            return NotFound("Client not found");

        var command = new AddUserMeasurementCommand
        {
            ClientId = user.LinkedClientId.Value,
            WeightKg = request.WeightKg,
            HeightCm = request.HeightCm,
            Age = client.Age,
            Gender = client.Gender.ToString()
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
            return BadRequest(result.Message);

        return Ok(new
        {
            message = "Güncel ölçümünü ekledin 👏",
            bmi = result.Bmi,
            bmr = result.Bmr,
            bmiCategory = GetBmiCategory(result.Bmi),
            createdAt = result.CreatedAt
        });
    }

    /// <summary>
    /// Get measurement history
    /// </summary>
    [HttpGet("measurements")]
    public async Task<IActionResult> GetMeasurements([FromQuery] int? lastNDays)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedClientId == null)
            return BadRequest("User is not a client");

        var query = new GetUserMeasurementsQuery
        {
            ClientId = user.LinkedClientId.Value,
            LastNDays = lastNDays
        };

        var result = await _mediator.Send(query);

        return Ok(new
        {
            measurements = result.Measurements,
            latest = result.Latest
        });
    }

    private static string GetBmiCategory(decimal bmi)
    {
        return bmi switch
        {
            < 18.5m => "Zayıf",
            < 25m => "Normal",
            < 30m => "Fazla Kilolu",
            < 35m => "Obez (Sınıf I)",
            < 40m => "Obez (Sınıf II)",
            _ => "Obez (Sınıf III)"
        };
    }
}

// DTOs
public record AddUserMeasurementRequest(decimal WeightKg, int HeightCm);
