using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Realtime;

[Authorize]
public sealed class SyncHub : Hub
{
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;

    public SyncHub(AuthDbContext authDb, AppDbContext appDb)
    {
        _authDb = authDb;
        _appDb = appDb;
    }

    public override async Task OnConnectedAsync()
    {
        var userIdValue = Context.User?.FindFirst("sub")?.Value
            ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!Guid.TryParse(userIdValue, out var userId))
        {
            await base.OnConnectedAsync();
            return;
        }

        var userAccount = await _authDb.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId);

        if (userAccount == null)
        {
            await base.OnConnectedAsync();
            return;
        }

        if (string.Equals(userAccount.Role, "Dietitian", StringComparison.OrdinalIgnoreCase) && userAccount.LinkedDietitianId.HasValue)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.Dietitian(userAccount.LinkedDietitianId.Value));
        }

        if (string.Equals(userAccount.Role, "Client", StringComparison.OrdinalIgnoreCase) && userAccount.LinkedClientId.HasValue)
        {
            var clientId = userAccount.LinkedClientId.Value;
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.Client(clientId));

            var activeLinkDietitianIds = await _appDb.DietitianClientLinks
                .AsNoTracking()
                .Where(x => x.ClientId == clientId && x.IsActive && x.UnlinkedAt == null)
                .Select(x => x.DietitianId)
                .Distinct()
                .ToListAsync();

            foreach (var dietitianId in activeLinkDietitianIds)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, GroupNames.Link(dietitianId, clientId));
            }
        }

        await base.OnConnectedAsync();
    }

    public static class GroupNames
    {
        public static string Dietitian(Guid dietitianId) => $"dietitian:{dietitianId:D}";
        public static string Client(Guid clientId) => $"client:{clientId:D}";
        public static string Link(Guid dietitianId, Guid clientId) => $"link:{dietitianId:D}:{clientId:D}";
    }
}
