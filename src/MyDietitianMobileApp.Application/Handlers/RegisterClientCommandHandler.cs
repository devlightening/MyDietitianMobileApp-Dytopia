using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MyDietitianMobileApp.Application.Services;

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
        var token = GenerateJwtToken(userId, clientId, publicUserId);

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
