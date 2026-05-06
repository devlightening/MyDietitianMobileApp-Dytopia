using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client")]
public class ClientAnnouncementController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;

    public ClientAnnouncementController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
    }

    [HttpGet("announcements/active")]
    public async Task<IActionResult> GetActiveAnnouncement()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var premium = await _premiumStatusService.GetPremiumStatusAsync(identity.Value.userId, CancellationToken.None);
        if (!premium.IsPremium || !premium.ActiveDietitianId.HasValue)
            return Ok(new { announcement = (object?)null });

        var now = DateTime.UtcNow;
        var announcement = await _appDb.ClientAnnouncements
            .AsNoTracking()
            .Where(a =>
                a.ClientId == identity.Value.clientId &&
                a.DietitianId == premium.ActiveDietitianId.Value &&
                a.StartsAt <= now &&
                now <= a.EndsAt)
            .OrderByDescending(a => a.CreatedAtUtc)
            .Select(a => new
            {
                id = a.Id,
                title = a.Title,
                body = a.Body,
                startsAt = a.StartsAt.ToString("yyyy-MM-dd"),
                endsAt = a.EndsAt.ToString("yyyy-MM-dd"),
            })
            .FirstOrDefaultAsync();

        return Ok(new { announcement });
    }
}
