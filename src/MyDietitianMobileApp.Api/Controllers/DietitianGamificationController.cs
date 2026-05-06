using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Application.Services;
using System.Text.Json;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/dietitian/gamification")]
public class DietitianGamificationController : ControllerBase
{
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly IClientGamificationService _gamificationService;

    public DietitianGamificationController(
        AuthDbContext authDb,
        AppDbContext appDb,
        IClientGamificationService gamificationService)
    {
        _authDb = authDb;
        _appDb = appDb;
        _gamificationService = gamificationService;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int limit = 8)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return Unauthorized();

        var user = await _authDb.UserAccounts.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userGuid);
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var summary = await _gamificationService.GetDietitianSummaryAsync(user.LinkedDietitianId.Value, limit);
        return Ok(summary);
    }

    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity([FromQuery] int limit = 15)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return Unauthorized();

        var user = await _authDb.UserAccounts.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userGuid);
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var safeLimit = Math.Clamp(limit, 1, 100);
        var linkedClients = await _appDb.DietitianClientLinks
            .AsNoTracking()
            .Where(x => x.DietitianId == user.LinkedDietitianId.Value && x.IsActive)
            .Select(x => new
            {
                x.ClientId,
                x.LinkedAt,
                ClientName = x.Client.FullName ?? "Danisan"
            })
            .ToListAsync();

        var linkedClientIds = linkedClients.Select(x => x.ClientId).ToList();
        var nameMap = linkedClients.ToDictionary(x => x.ClientId, x => x.ClientName);

        var rawActivities = linkedClientIds.Count == 0
            ? []
            : await _appDb.ClientActivities
                .AsNoTracking()
                .Where(x => linkedClientIds.Contains(x.ClientId))
                .OrderByDescending(x => x.AtUtc)
                .Take(safeLimit * 3)
                .ToListAsync();

        var items = rawActivities
            .Select(x => new
            {
                id = x.Id.ToString(),
                type = NormalizeActivityType(x.Type),
                clientId = x.ClientId.ToString(),
                clientName = nameMap.GetValueOrDefault(x.ClientId, "Danisan"),
                timestamp = x.AtUtc,
                metadata = ParseMetadata(x.MetaJson)
            })
            .Where(x => x.type != null)
            .Cast<object>()
            .ToList();

        items.AddRange(linkedClients.Select(link => new
        {
            id = $"{link.ClientId}:linked",
            type = "client_linked",
            clientId = link.ClientId.ToString(),
            clientName = link.ClientName,
            timestamp = link.LinkedAt,
            metadata = new { note = "klinige baglandi" }
        }));

        var activities = items
            .OrderByDescending(x => (DateTime)x.GetType().GetProperty("timestamp")!.GetValue(x)!)
            .Take(safeLimit)
            .ToList();

        return Ok(new { activities });
    }

    [HttpGet("clients/{clientId:guid}")]
    public async Task<IActionResult> GetClientSummary(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return Unauthorized();

        var user = await _authDb.UserAccounts.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userGuid);
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var client = await _appDb.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == clientId && x.ActiveDietitianId == user.LinkedDietitianId.Value);

        if (client == null)
            return NotFound();

        var summary = await _gamificationService.GetSummaryAsync(clientId, client.IsPremium, user.LinkedDietitianId.Value);
        return Ok(summary);
    }

    private static string? NormalizeActivityType(string type) => type switch
    {
        "app_open"                 => "login",
        "meal_done"                => "meal_logged",
        "meal_recipe_selected"     => "meal_selection",
        "meal_feedback_saved"      => "meal_feedback",
        "meal_alternative"         => "meal_alternative",
        "meal_skipped"             => "meal_skipped",
        "shopping_list_generated"  => "shopping_list",
        "shopping_items_added"     => "shopping_list",
        "shopping_item_added"      => "shopping_list",
        "shopping_item_checked"    => "shopping_list",
        "shopping_item_removed"    => "shopping_list",
        "shopping_checked_cleared" => "shopping_list",
        "pantry_updated"           => "pantry",
        "pantry_item_removed"      => "pantry",
        "notification_preferences_updated" => "notification_preferences",
        "kitchen_recipe_generated" => "kitchen_used",
        "KITCHEN_MERGE_DONE"       => "kitchen_used",
        "water_goal_hit"           => "water_goal_hit",
        "measurement_logged"       => "measurement_logged",
        "care_message_sent"        => null,
        _                          => type
    };

    private static object? ParseMetadata(string? metaJson)
    {
        if (string.IsNullOrWhiteSpace(metaJson))
            return null;

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(metaJson);
        }
        catch
        {
            return null;
        }
    }
}
