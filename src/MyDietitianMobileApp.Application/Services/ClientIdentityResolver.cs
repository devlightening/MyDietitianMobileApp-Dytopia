using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Services;

public class ClientIdentityResolver : IClientIdentityResolver
{
    private readonly AuthDbContext _authDb;

    public ClientIdentityResolver(AuthDbContext authDb)
    {
        _authDb = authDb;
    }

    public async Task<(Guid userId, Guid clientId, string publicUserId)?> ResolveClientAsync(ClaimsPrincipal user)
    {
        // Extract user ID from claims (same logic as Api.Extensions.ClaimsPrincipalExtensions.GetUserId)
        var userIdStr = user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                     ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? user.FindFirst("sub")?.Value;
        
        if (string.IsNullOrEmpty(userIdStr))
            return null;

        if (!Guid.TryParse(userIdStr, out var userId))
            return null;

        var userAccount = await _authDb.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Client");

        if (userAccount == null || !userAccount.LinkedClientId.HasValue)
            return null;

        return (userId, userAccount.LinkedClientId.Value, userAccount.PublicUserId ?? string.Empty);
    }
}
