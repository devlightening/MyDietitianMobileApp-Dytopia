using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Api.Realtime;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client/notification-preferences")]
public class ClientNotificationPreferencesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly ISyncEventPublisher _syncPublisher;

    public ClientNotificationPreferencesController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver,
        ISyncEventPublisher syncPublisher)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
        _syncPublisher = syncPublisher;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var preference = await GetOrCreatePreferenceAsync(identity.Value.clientId);
        return Ok(ToResponse(preference));
    }

    [HttpPut]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> Upsert([FromBody] UpdateNotificationPreferencesRequest request)
    {
        if (request.HydrationIntervalMinutes is < 30 or > 360)
            return BadRequest(ApiProblems.Validation("INVALID_HYDRATION_INTERVAL", "Su hatırlatma aralığı 30 ile 360 dakika arasında olmalıdır."));

        if (request.MealReminderLeadMinutes is < 0 or > 180)
            return BadRequest(ApiProblems.Validation("INVALID_MEAL_LEAD", "Öğün bildirim ön süresi 0 ile 180 dakika arasında olmalıdır."));

        if (request.MeasurementReminderDayOfWeek is < 0 or > 6)
            return BadRequest(ApiProblems.Validation("INVALID_MEASUREMENT_DAY", "Ölçüm hatırlatma günü 0 ile 6 arasında olmalıdır."));

        if (request.ReengagementDelayHours is < 6 or > 168)
            return BadRequest(ApiProblems.Validation("INVALID_REENGAGEMENT_DELAY", "Yeniden hatırlatma gecikmesi 6 ile 168 saat arasında olmalıdır."));

        if (!TimeOnly.TryParse(request.HydrationStartLocalTime, out var hydrationStart))
            return BadRequest(ApiProblems.Validation("INVALID_HYDRATION_START", "Su hatırlatma başlangıç saati geçersiz."));

        if (!TimeOnly.TryParse(request.HydrationEndLocalTime, out var hydrationEnd))
            return BadRequest(ApiProblems.Validation("INVALID_HYDRATION_END", "Su hatırlatma bitiş saati geçersiz."));

        if (!TimeOnly.TryParse(request.MeasurementReminderLocalTime, out var measurementTime))
            return BadRequest(ApiProblems.Validation("INVALID_MEASUREMENT_TIME", "Ölçüm hatırlatma saati geçersiz."));

        if (hydrationEnd <= hydrationStart)
            return BadRequest(ApiProblems.Validation("INVALID_HYDRATION_WINDOW", "Su hatırlatma bitiş saati başlangıç saatinden sonra olmalıdır."));

        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var preference = await GetOrCreatePreferenceAsync(identity.Value.clientId);
        preference.Update(
            request.NotificationsEnabled,
            request.InAppCoachNotificationsEnabled,
            request.AchievementNotificationsEnabled,
            request.PantryActivityNotificationsEnabled,
            request.HydrationRemindersEnabled,
            request.HydrationIntervalMinutes,
            hydrationStart,
            hydrationEnd,
            request.MealPlanRemindersEnabled,
            request.MealReminderLeadMinutes,
            request.MeasurementRemindersEnabled,
            request.MeasurementReminderDayOfWeek,
            measurementTime,
            request.ReengagementRemindersEnabled,
            request.ReengagementDelayHours,
            request.TimeZoneId);

        await _appDb.SaveChangesAsync();
        await PublishNotificationUpdateAsync(identity.Value.clientId, "preferences");
        return Ok(ToResponse(preference));
    }

    [HttpPost("heartbeat")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> Heartbeat()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var preference = await GetOrCreatePreferenceAsync(identity.Value.clientId);
        preference.MarkAppOpened();
        await _appDb.SaveChangesAsync();
        await PublishNotificationUpdateAsync(identity.Value.clientId, "heartbeat");
        return Ok(new
        {
            lastAppOpenAtUtc = preference.LastAppOpenAtUtc,
            updatedAtUtc = preference.UpdatedAtUtc,
        });
    }

    [HttpPost("sync-mark")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> MarkNotificationSync()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var preference = await GetOrCreatePreferenceAsync(identity.Value.clientId);
        preference.MarkNotificationSync();
        await _appDb.SaveChangesAsync();
        await PublishNotificationUpdateAsync(identity.Value.clientId, "sync-mark");
        return Ok(new
        {
            lastNotificationSyncAtUtc = preference.LastNotificationSyncAtUtc,
            updatedAtUtc = preference.UpdatedAtUtc,
        });
    }

    private async Task<ClientNotificationPreference> GetOrCreatePreferenceAsync(Guid clientId)
    {
        var preference = await _appDb.ClientNotificationPreferences
            .FirstOrDefaultAsync(x => x.ClientId == clientId);

        if (preference != null)
            return preference;

        preference = new ClientNotificationPreference(clientId);
        _appDb.ClientNotificationPreferences.Add(preference);
        await _appDb.SaveChangesAsync();
        return preference;
    }

    private static object ToResponse(ClientNotificationPreference preference)
    {
        return new
        {
            notificationsEnabled = preference.NotificationsEnabled,
            inAppCoachNotificationsEnabled = preference.InAppCoachNotificationsEnabled,
            achievementNotificationsEnabled = preference.AchievementNotificationsEnabled,
            pantryActivityNotificationsEnabled = preference.PantryActivityNotificationsEnabled,
            hydrationRemindersEnabled = preference.HydrationRemindersEnabled,
            hydrationIntervalMinutes = preference.HydrationIntervalMinutes,
            hydrationStartLocalTime = preference.HydrationStartLocalTime.ToString("HH':'mm"),
            hydrationEndLocalTime = preference.HydrationEndLocalTime.ToString("HH':'mm"),
            mealPlanRemindersEnabled = preference.MealPlanRemindersEnabled,
            mealReminderLeadMinutes = preference.MealReminderLeadMinutes,
            measurementRemindersEnabled = preference.MeasurementRemindersEnabled,
            measurementReminderDayOfWeek = preference.MeasurementReminderDayOfWeek,
            measurementReminderLocalTime = preference.MeasurementReminderLocalTime.ToString("HH':'mm"),
            reengagementRemindersEnabled = preference.ReengagementRemindersEnabled,
            reengagementDelayHours = preference.ReengagementDelayHours,
            timeZoneId = preference.TimeZoneId,
            lastAppOpenAtUtc = preference.LastAppOpenAtUtc,
            lastNotificationSyncAtUtc = preference.LastNotificationSyncAtUtc,
            updatedAtUtc = preference.UpdatedAtUtc,
        };
    }

    private async Task PublishNotificationUpdateAsync(Guid clientId, string source)
    {
        var activeDietitianId = await _appDb.Clients
            .AsNoTracking()
            .Where(x => x.Id == clientId)
            .Select(x => x.ActiveDietitianId)
            .FirstOrDefaultAsync();

        if (!activeDietitianId.HasValue)
            return;

        await _syncPublisher.PublishToLinkAsync(activeDietitianId.Value, clientId, "notification.preferences.updated", new
        {
            clientId,
            source,
        });
    }
}

public sealed record UpdateNotificationPreferencesRequest(
    bool NotificationsEnabled,
    bool InAppCoachNotificationsEnabled,
    bool AchievementNotificationsEnabled,
    bool PantryActivityNotificationsEnabled,
    bool HydrationRemindersEnabled,
    int HydrationIntervalMinutes,
    string HydrationStartLocalTime,
    string HydrationEndLocalTime,
    bool MealPlanRemindersEnabled,
    int MealReminderLeadMinutes,
    bool MeasurementRemindersEnabled,
    int MeasurementReminderDayOfWeek,
    string MeasurementReminderLocalTime,
    bool ReengagementRemindersEnabled,
    int ReengagementDelayHours,
    string? TimeZoneId);
