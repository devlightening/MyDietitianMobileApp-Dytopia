using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Infrastructure.Services;

namespace MyDietitianMobileApp.Application.Handlers;

public class RegisterClientCommandHandler : IRequestHandler<RegisterClientCommand, RegisterClientResult>
{
    private readonly AuthDbContext _authContext;
    private readonly AppDbContext _appContext;
    private readonly PasswordHasherService _passwordHasher;
    private readonly IConfiguration _config;

    public RegisterClientCommandHandler(
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

    public async Task<RegisterClientResult> Handle(RegisterClientCommand request, CancellationToken cancellationToken)
    {
        // Normalize and validate email domain (allowlist from configuration)
        var emailCheck = EmailPolicy.ValidateAllowedDomain(request.Email ?? string.Empty, _config);
        request.Email = emailCheck.NormalizedEmail;

        if (!emailCheck.IsAllowed)
        {
            return new RegisterClientResult
            {
                Success = false,
                ErrorCode = emailCheck.ErrorCode,
                Message = emailCheck.ErrorMessage ?? "Email doğrulaması başarısız."
            };
        }

        // Check if email already exists
        var existingUser = await _authContext.UserAccounts
            .FirstOrDefaultAsync(u => u.Email == request.Email, cancellationToken);

        if (existingUser != null)
        {
            return new RegisterClientResult
            {
                Success = false,
                ErrorCode = "REGISTRATION_NOT_ALLOWED",
                Message = "Bu email ile kayıt olunamıyor."
            };
        }

        var passwordValidation = PasswordPolicy.Validate(request.Password);
        if (!passwordValidation.IsValid)
        {
            return new RegisterClientResult
            {
                Success = false,
                ErrorCode = "WEAK_PASSWORD",
                Message = passwordValidation.ErrorMessage ?? "Şifre gereksinimleri karşılanmadı."
            };
        }

        // Create Client entity first
        var clientId = Guid.NewGuid();
        var client = new Client(
            clientId, 
            request.FullName, 
            request.Email,
            request.Gender,
            request.BirthDate,
            isActive: true
        );
        _appContext.Clients.Add(client);

        // Create UserAccount with link to client
        var userId = Guid.NewGuid();
        var hashedPassword = _passwordHasher.HashPassword(request.Password);
        
        var userAccount = new UserAccount(
            userId,
            request.Email,
            hashedPassword,
            "Client"
        );
        userAccount.LinkedClientId = clientId;
        userAccount.EnsureSecurityStamp();
        userAccount.PasswordChangedAtUtc = DateTime.UtcNow;
        userAccount.LastLoginAtUtc = DateTime.UtcNow;

        // Generate unique PublicUserId
        string publicUserId;
        do
        {
            publicUserId = PublicUserIdGenerator.Generate();
        } while (await _authContext.UserAccounts.AnyAsync(u => u.PublicUserId == publicUserId, cancellationToken));

        userAccount.SetPublicUserId(publicUserId);

        _authContext.UserAccounts.Add(userAccount);

        // Save both contexts
        await _authContext.SaveChangesAsync(cancellationToken);
        await _appContext.SaveChangesAsync(cancellationToken);

        // Generate JWT with minimal identity claims
        var token = GenerateJwtToken(userId, clientId, publicUserId, userAccount.SecurityStamp);

        return new RegisterClientResult
        {
            Success = true,
            Token = token,
            PublicUserId = publicUserId,
            ClientId = clientId,
            IsPremium = false,
            Message = "Kayıt başarılı"
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
