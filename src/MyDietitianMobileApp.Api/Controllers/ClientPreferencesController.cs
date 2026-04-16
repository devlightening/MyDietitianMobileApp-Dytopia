using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client/preferences")]
public class ClientPreferencesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly IClientIdentityResolver _identityResolver;

    public ClientPreferencesController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var preference = await GetOrCreateAsync(identity.Value.clientId);
        return Ok(ToResponse(preference));
    }

    [HttpPut]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> Upsert([FromBody] UpdateClientPreferencesRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        if (string.IsNullOrWhiteSpace(request.PrimaryGoal)
            || string.IsNullOrWhiteSpace(request.DietStyle)
            || string.IsNullOrWhiteSpace(request.CookingTimePreference)
            || string.IsNullOrWhiteSpace(request.ReminderTone))
        {
            return BadRequest(ApiProblems.Validation("INVALID_PREFERENCES", "Tum tercih alanlari doldurulmalidir."));
        }

        var preference = await GetOrCreateAsync(identity.Value.clientId);
        preference.Update(
            request.PrimaryGoal,
            request.DietStyle,
            request.CookingTimePreference,
            request.ReminderTone);

        await _appDb.SaveChangesAsync();
        return Ok(ToResponse(preference));
    }

    private async Task<ClientGoalPreference> GetOrCreateAsync(Guid clientId)
    {
        var current = await _appDb.ClientGoalPreferences.FirstOrDefaultAsync(x => x.ClientId == clientId);
        if (current != null)
            return current;

        current = new ClientGoalPreference(clientId);
        _appDb.ClientGoalPreferences.Add(current);
        await _appDb.SaveChangesAsync();
        return current;
    }

    private static object ToResponse(ClientGoalPreference preference)
    {
        return new
        {
            primaryGoal = preference.PrimaryGoal,
            dietStyle = preference.DietStyle,
            cookingTimePreference = preference.CookingTimePreference,
            reminderTone = preference.ReminderTone,
            updatedAtUtc = preference.UpdatedAtUtc
        };
    }
}

public sealed record UpdateClientPreferencesRequest(
    string PrimaryGoal,
    string DietStyle,
    string CookingTimePreference,
    string ReminderTone);
