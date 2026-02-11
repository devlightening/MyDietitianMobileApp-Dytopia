using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

public class PremiumStatusService : IPremiumStatusService
{
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;

    public PremiumStatusService(AuthDbContext authDb, AppDbContext appDb)
    {
        _authDb = authDb;
        _appDb = appDb;
    }

    public async Task<PremiumStatusResult> GetPremiumStatusAsync(Guid userAccountId, CancellationToken cancellationToken = default)
    {
        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == userAccountId, cancellationToken);

        if (user?.LinkedClientId == null)
        {
            return new PremiumStatusResult(false, null, null, null);
        }

        var client = await _appDb.Clients.FindAsync(new object[] { user.LinkedClientId.Value }, cancellationToken);
        if (client == null)
        {
            return new PremiumStatusResult(false, null, null, null);
        }

        var activeLink = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.ClientId == client.Id && l.IsActive, cancellationToken);

        var now = DateTime.UtcNow;
        var isPremium = false;
        Guid? activeDietitianId = null;
        DateTime? premiumUntil = null;

        if (client.ActiveDietitianId.HasValue && activeLink != null)
        {
            if (client.ProgramEndDate == null || client.ProgramEndDate > now)
            {
                isPremium = true;
                activeDietitianId = client.ActiveDietitianId;
                premiumUntil = client.ProgramEndDate;
            }
        }

        return new PremiumStatusResult(isPremium, client, activeDietitianId, premiumUntil);
    }
}

