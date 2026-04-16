using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

public class PremiumStatusService : IPremiumStatusService
{
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly ILogger<PremiumStatusService> _logger;

    public PremiumStatusService(AuthDbContext authDb, AppDbContext appDb, ILogger<PremiumStatusService> logger)
    {
        _authDb = authDb;
        _appDb = appDb;
        _logger = logger;
    }

    public async Task<PremiumStatusResult> GetPremiumStatusAsync(Guid userAccountId, CancellationToken cancellationToken = default)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == userAccountId, cancellationToken);

        if (user?.LinkedClientId == null)
        {
            _logger.LogDebug("[PREMIUM] UserAccountId={UserId} has no LinkedClientId — free user", userAccountId);
            return new PremiumStatusResult(false, null, null, null);
        }

        var client = await _appDb.Clients.FindAsync(new object[] { user.LinkedClientId.Value }, cancellationToken);
        if (client == null)
        {
            _logger.LogWarning("[PREMIUM] UserAccountId={UserId} LinkedClientId={ClientId} not found in Clients table — treating as free", userAccountId, user.LinkedClientId);
            return new PremiumStatusResult(false, null, null, null);
        }

        var activeLink = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.ClientId == client.Id && l.IsActive, cancellationToken);

        var now = DateTime.UtcNow;
        var isPremium = false;
        Guid? activeDietitianId = null;
        DateTime? premiumUntil = null;

        if (!client.ActiveDietitianId.HasValue)
        {
            _logger.LogDebug("[PREMIUM] ClientId={ClientId} has no ActiveDietitianId — free/unlinked", client.Id);
        }
        else if (activeLink == null)
        {
            _logger.LogWarning(
                "[PREMIUM] ClientId={ClientId} has ActiveDietitianId={DietitianId} but no active DietitianClientLink — premium not granted. " +
                "The client may have been delinked. Check DietitianClientLinks table.",
                client.Id, client.ActiveDietitianId);
        }
        else if (client.ProgramEndDate != null && client.ProgramEndDate <= now)
        {
            _logger.LogWarning(
                "[PREMIUM] ClientId={ClientId} ActiveDietitianId={DietitianId} link is active but ProgramEndDate={EndDate} is in the past (now={Now}) — premium expired",
                client.Id, client.ActiveDietitianId, client.ProgramEndDate, now);
        }
        else
        {
            isPremium = true;
            activeDietitianId = client.ActiveDietitianId;
            premiumUntil = client.ProgramEndDate;
            _logger.LogDebug(
                "[PREMIUM] ClientId={ClientId} is premium | ActiveDietitianId={DietitianId} | ProgramEndDate={EndDate}",
                client.Id, activeDietitianId, premiumUntil);
        }

        return new PremiumStatusResult(isPremium, client, activeDietitianId, premiumUntil);
    }
}

