using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

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

        // Generate JWT with minimal identity claims and PublicUserId
        var token = GenerateJwtToken(userAccount.Id, client.Id, userAccount.PublicUserId);

        return new LoginClientResult
        {
            Success = true,
            Token = token,
            PublicUserId = userAccount.PublicUserId,
            Message = "Giriş başarılı"
        };
    }

    private string GenerateJwtToken(Guid userId, Guid clientId, string publicUserId)
    {
        var secret = _config["Jwt:SecretKey"];
        var issuer = _config["Jwt:Issuer"];
        var audience = _config["Jwt:Audience"];

        // CRITICAL: Fail fast with clear error
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("JWT_SECRET_IS_NULL - Check appsettings.json");
        if (string.IsNullOrWhiteSpace(issuer))
            throw new InvalidOperationException("JWT_ISSUER_IS_NULL - Check appsettings.json");
        if (string.IsNullOrWhiteSpace(audience))
            throw new InvalidOperationException("JWT_AUDIENCE_IS_NULL - Check appsettings.json");

        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var key = System.Text.Encoding.UTF8.GetBytes(secret);

        var claims = new List<System.Security.Claims.Claim>
        {
            new("sub", userId.ToString()),
            // Role claims (double-write for robustness)
            new("role", "Client"),
            new(System.Security.Claims.ClaimTypes.Role, "Client"),
            new("clientId", clientId.ToString()),
            new("publicUserId", publicUserId)
        };

        var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Subject = new System.Security.Claims.ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(30),
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
