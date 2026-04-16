using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace MyDietitianMobileApp.Infrastructure.Services;

public static class JwtTokenGenerator
{
    public static string GenerateToken(
        string userId,
        string role,
        string secret,
        string issuer,
        string audience,
        int expiresMinutes,
        string? securityStamp = null,
        IEnumerable<Claim>? additionalClaims = null)
    {
        var claims = new List<Claim>
        {
            // JWT STANDARD CLAIM - Required for User.FindFirst("sub")
            new Claim(JwtRegisteredClaimNames.Sub, userId),
            // Backward compatibility: also include NameIdentifier
            new Claim(ClaimTypes.NameIdentifier, userId),
            // Role claims (double-write for robustness)
            new Claim("role", role),
            new Claim(ClaimTypes.Role, role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (!string.IsNullOrWhiteSpace(securityStamp))
        {
            claims.Add(new Claim("sst", securityStamp));
        }

        if (additionalClaims is not null)
        {
            claims.AddRange(additionalClaims);
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
