using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MyDietitianMobileApp.Infrastructure.Services;

namespace MyDietitianMobileApp.Application.Handlers;

public class LoginClientCommandHandler : IRequestHandler<LoginClientCommand, LoginClientResult>
{
    private readonly AuthDbContext _authContext;
    private readonly AppDbContext _appContext;
    private readonly PasswordHasherService _passwordHasher;
    private readonly IConfiguration _config;

    public LoginClientCommandHandler(
        AuthDbContext authContext,
        AppDbContext appContext,
        PasswordHasherService passwordHasher,
        IConfiguration config)
    {
        _authContext = authContext;
        _appContext = appContext;
        _passwordHasher = passwordHasher;
        _config = config;
    }

    public async Task<LoginClientResult> Handle(LoginClientCommand request, CancellationToken cancellationToken)
    {
        // Find user
        var userAccount = await _authContext.UserAccounts
            .FirstOrDefaultAsync(u => u.Email == request.Email, cancellationToken);

        if (userAccount == null || userAccount.Role != "Client")
        {
            return new LoginClientResult
            {
                Success = false,
                Message = "Email veya şifre hatalı"
            };
        }

        // Verify password with proper error handling
        try
        {
            if (!_passwordHasher.VerifyPassword(userAccount.PasswordHash, request.Password))
            {
                return new LoginClientResult
                {
                    Success = false,
                    Message = "Email veya şifre hatalı"
                };
            }
        }
        catch (FormatException)
        {
            // Legacy password hash - incompatible with Identity hasher
            return new LoginClientResult
            {
                Success = false,
                Message = "Geçersiz kimlik bilgileri. Şifrenizi sıfırlayın."
            };
        }

        // Get client info using LinkedClientId from UserAccount
        Guid clientId;
        if (userAccount.LinkedClientId.HasValue)
        {
            clientId = userAccount.LinkedClientId.Value;
        }
        else
        {
            return new LoginClientResult
            {
                Success = false,
                Message = "Client bilgisi bulunamadı"
            };
        }

        var client = await _appContext.Clients
            .FirstOrDefaultAsync(c => c.Id == clientId, cancellationToken);

        if (client == null)
        {
            return new LoginClientResult
            {
                Success = false,
                Message = "Client bilgisi bulunamadı"
            };
        }

        userAccount.EnsureSecurityStamp();
        userAccount.LastLoginAtUtc = DateTime.UtcNow;
        await _authContext.SaveChangesAsync(cancellationToken);

        // Generate JWT with minimal identity claims and PublicUserId
        var token = GenerateJwtToken(userAccount.Id, client.Id, userAccount.PublicUserId, userAccount.SecurityStamp);

        return new LoginClientResult
        {
            Success = true,
            Token = token,
            PublicUserId = userAccount.PublicUserId,
            Message = "Giriş başarılı"
        };
    }

    private string GenerateJwtToken(Guid userId, Guid clientId, string publicUserId, string securityStamp)
    {
        var secret = _config["Jwt:SecretKey"] ?? _config["Jwt:Secret"];
        var issuer = _config["Jwt:Issuer"];
        var audience = _config["Jwt:Audience"];

        // CRITICAL: Fail fast with clear error
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("JWT_SECRET_IS_NULL - Check appsettings.json");
        if (string.IsNullOrWhiteSpace(issuer))
            throw new InvalidOperationException("JWT_ISSUER_IS_NULL - Check appsettings.json");
        if (string.IsNullOrWhiteSpace(audience))
            throw new InvalidOperationException("JWT_AUDIENCE_IS_NULL - Check appsettings.json");

        var claims = new List<System.Security.Claims.Claim>
        {
            new("clientId", clientId.ToString()),
            new("publicUserId", publicUserId)
        };

        return JwtTokenGenerator.GenerateToken(
            userId.ToString(),
            "Client",
            secret,
            issuer,
            audience,
            expiresMinutes: 60 * 24 * 30,
            securityStamp: securityStamp,
            additionalClaims: claims);
    }
}
