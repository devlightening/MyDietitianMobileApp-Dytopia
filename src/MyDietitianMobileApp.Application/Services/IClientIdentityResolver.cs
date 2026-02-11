using System.Security.Claims;

namespace MyDietitianMobileApp.Application.Services;

public interface IClientIdentityResolver
{
    Task<(Guid userId, Guid clientId, string publicUserId)?> ResolveClientAsync(ClaimsPrincipal user);
}
