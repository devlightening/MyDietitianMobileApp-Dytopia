using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace MyDietitianMobileApp.Api.Extensions;

/// <summary>
/// Extension methods for ClaimsPrincipal to reliably extract user ID from JWT tokens
/// Handles both "sub" (JWT standard) and ClaimTypes.NameIdentifier (legacy) claims
/// </summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Extracts user ID from JWT claims with fallback strategy:
    /// 1. Try "sub" claim (JWT standard, set by JwtRegisteredClaimNames.Sub)
    /// 2. Fallback to ClaimTypes.NameIdentifier (legacy compatibility)
    /// </summary>
    /// <param name="principal">The ClaimsPrincipal</param>
    /// <returns>User ID as string, or null if not found</returns>
    public static string? GetUserId(this ClaimsPrincipal principal)
    {
        // Primary: Try "sub" claim (JWT standard)
        var subClaim = principal.FindFirst(JwtRegisteredClaimNames.Sub);
        if (subClaim != null && !string.IsNullOrEmpty(subClaim.Value))
            return subClaim.Value;

        // Fallback: Try ClaimTypes.NameIdentifier (maps to http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier)
        var nameIdentifierClaim = principal.FindFirst(ClaimTypes.NameIdentifier);
        if (nameIdentifierClaim != null && !string.IsNullOrEmpty(nameIdentifierClaim.Value))
            return nameIdentifierClaim.Value;

        // Also try direct "sub" string lookup (in case claim type mapping differs)
        var subStringClaim = principal.FindFirst("sub");
        if (subStringClaim != null && !string.IsNullOrEmpty(subStringClaim.Value))
            return subStringClaim.Value;

        return null;
    }

    /// <summary>
    /// Extracts user ID as Guid from JWT claims with fallback strategy
    /// </summary>
    /// <param name="principal">The ClaimsPrincipal</param>
    /// <param name="userId">Output parameter for the parsed Guid</param>
    /// <returns>True if user ID was found and parsed successfully, false otherwise</returns>
    public static bool TryGetUserIdAsGuid(this ClaimsPrincipal principal, out Guid userId)
    {
        userId = Guid.Empty;
        var userIdString = principal.GetUserId();
        
        if (string.IsNullOrEmpty(userIdString))
            return false;

        return Guid.TryParse(userIdString, out userId);
    }
}
