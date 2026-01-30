using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Interfaces;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using System.Security.Claims;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages dietitian operations: client management, access keys, client health data
/// </summary>
[Authorize]
[ApiController]
[Route("api/dietitian")]
public class DietitianManagementController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AuthDbContext _authDb;
    private readonly AppDbContext _appDb;
    private readonly IUserRepository _userRepo;
    private readonly ILogger<DietitianManagementController> _logger;
    private readonly IWebHostEnvironment _env;

    public DietitianManagementController(
        IMediator mediator,
        AuthDbContext authDb,
        AppDbContext appDb,
        IUserRepository userRepo,
        ILogger<DietitianManagementController> logger,
        IWebHostEnvironment env)
    {
        _mediator = mediator;
        _authDb = authDb;
        _appDb = appDb;
        _userRepo = userRepo;
        _logger = logger;
        _env = env;
    }

    /// <summary>
    /// Get all clients for the authenticated dietitian
    /// </summary>
    [HttpGet("clients")]
    public async Task<IActionResult> GetClients()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var query = new GetClientsByDietitianQuery
        {
            DietitianId = user.LinkedDietitianId.Value
        };

        var result = await _mediator.Send(query);

        return Ok(new { clients = result.Clients });
    }

    /// <summary>
    /// Get specific client's measurements
    /// </summary>
    [HttpGet("clients/{publicUserId}/measurements")]
    public async Task<IActionResult> GetClientMeasurements(string publicUserId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var client = await _userRepo.GetClientByPublicUserIdAsync(publicUserId);
        if (client == null)
            return NotFound($"Client with ID {publicUserId} not found");

        var clientEntity = (Client)client;

        var query = new GetUserMeasurementsQuery
        {
            ClientId = clientEntity.Id,
            LastNDays = null
        };

        var result = await _mediator.Send(query);

        return Ok(new
        {
            publicUserId = publicUserId,
            measurements = result.Measurements,
            latest = result.Latest
        });
    }

    /// <summary>
    /// Get all access keys for authenticated dietitian
    /// </summary>
    [HttpGet("access-keys")]
    public async Task<IActionResult> GetAccessKeys()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { message = "JWT token eksik" });

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
        {
            return BadRequest(new
            {
                message = "Diyetisyen profili bulunamadı. Lütfen profil oluşturun veya destek ile iletişime geçin.",
                code = "DIETITIAN_PROFILE_MISSING",
                requiresSetup = true
            });
        }

        var keys = await _appDb.AccessKeys
            .Where(k => k.DietitianId == user.LinkedDietitianId)
            .OrderByDescending(k => k.StartDate)
            .Select(k => new {
                k.Id,
                k.Key,
                k.StartDate,
                k.EndDate,
                k.ClientId,
                k.IsActive
            })
            .ToListAsync();

        return Ok(new { accessKeys = keys });
    }

    /// <summary>
    /// Create premium access key for a client
    /// </summary>
    [HttpPost("access-keys")]
    public async Task<IActionResult> CreateAccessKey([FromBody] CreateAccessKeyRequest request)
    {
        try
        {
            // DEBUG: Check if user is authenticated
            if (!User.Identity?.IsAuthenticated ?? true)
            {
                _logger.LogWarning("POST access-keys: User not authenticated");
                return Unauthorized(new { message = "Kullanıcı doğrulanmadı" });
            }

            // DEBUG: Log all claims
            var claims = User.Claims.Select(c => $"{c.Type}={c.Value}").ToList();
            _logger.LogInformation("POST access-keys: User claims: {Claims}", string.Join(", ", claims));

            // Robust userId resolution with fallback
            var userId = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub) 
                ?? User.FindFirstValue("sub") 
                ?? User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                _logger.LogWarning("POST access-keys: User ID claim not found in token");
                return Unauthorized(new { 
                    code = "AUTH_MISSING_USERID", 
                    message = "JWT user id claim missing" 
                });
            }

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user == null)
            {
                _logger.LogWarning("POST access-keys: User not found for ID {UserId}", userId);
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });
            }

            if (user.LinkedDietitianId == null)
            {
                return BadRequest(new
                {
                    message = "Diyetisyen profili bulunamadı. Lütfen profil oluşturun veya destek ile iletişime geçin.",
                    code = "DIETITIAN_PROFILE_MISSING",
                    requiresSetup = true
                });
            }

            var dietitian = await _appDb.Dietitians.FindAsync(user.LinkedDietitianId.Value);
            if (dietitian == null)
                return BadRequest(new { message = "Diyetisyen kaydı bulunamadı" });

            if (!dietitian.IsActive)
                return BadRequest(new { message = "Diyetisyen hesabı aktif değil" });

            var client = await _userRepo.GetClientByPublicUserIdAsync(request.ClientId);
            if (client == null)
                return NotFound(new { message = $"Danışan bulunamadı: {request.ClientId}" });

            var clientEntity = (Client)client;

            if (!DateTime.TryParse(request.StartDate, out var startDate) ||
                !DateTime.TryParse(request.EndDate, out var endDate))
            {
                return BadRequest(new { message = "Geçersiz tarih formatı" });
            }

            // Normalize dates to UTC (Npgsql requires DateTimeKind.Utc)
            // Use .Date to get midnight, then specify UTC kind
            var startUtc = DateTime.SpecifyKind(startDate.Date, DateTimeKind.Utc);
            var endUtc = DateTime.SpecifyKind(endDate.Date, DateTimeKind.Utc);

            // Server-side validation: endUtc must be after startUtc
            if (endUtc < startUtc)
            {
                return BadRequest(new 
                { 
                    code = "ACCESSKEY_INVALID_DATE_RANGE",
                    message = "Bitiş tarihi başlangıç tarihinden sonra olmalı" 
                });
            }

            // Check for existing active key (idempotent)
            var existingKey = await _appDb.AccessKeys
                .Where(k => k.DietitianId == user.LinkedDietitianId.Value 
                         && k.ClientId == clientEntity.Id 
                         && k.IsActive 
                         && k.EndDate > DateTime.UtcNow)
                .FirstOrDefaultAsync();

            if (existingKey != null)
            {
                return Ok(new
                {
                    success = true,
                    key = existingKey.Key,
                    clientId = request.ClientId,
                    startDate = existingKey.StartDate.ToString("yyyy-MM-dd"),
                    endDate = existingKey.EndDate.ToString("yyyy-MM-dd"),
                    message = "Mevcut aktif anahtar döndürüldü"
                });
            }

            var keyValue = GenerateAccessKey();
            var accessKey = new AccessKey(
                Guid.NewGuid(),
                keyValue,
                user.LinkedDietitianId.Value,
                clientEntity.Id,
                startUtc,  // Use UTC-normalized date
                endUtc,    // Use UTC-normalized date
                true
            );

            _appDb.AccessKeys.Add(accessKey);

            // FAZ 3: Create permanent binding (only if link doesn't already exist)
            // Check if an active link already exists for this (ClientId, DietitianId) pair
            var existingLink = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => 
                    l.ClientId == clientEntity.Id && 
                    l.DietitianId == user.LinkedDietitianId.Value && 
                    l.IsActive);

            if (existingLink == null)
            {
                // Only create link if it doesn't exist
                var bindCommand = new BindClientToDietitianCommand
                {
                    DietitianId = user.LinkedDietitianId.Value,
                    ClientId = clientEntity.Id,
                    PublicUserId = request.ClientId
                };

                await _mediator.Send(bindCommand);
            }
            // If link exists, no need to update - it's already bound correctly

            await _appDb.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                key = accessKey.Key,
                clientId = request.ClientId,
                startDate = accessKey.StartDate.ToString("yyyy-MM-dd"),
                endDate = accessKey.EndDate.ToString("yyyy-MM-dd")
            });
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
        {
            _logger.LogError(dbEx, "Database update failed during access key creation for client {ClientId}", request.ClientId);
            
            // Extract inner exception message for development
            var innerMessage = dbEx.InnerException?.Message ?? dbEx.Message;
            var detail = _env.IsDevelopment() ? innerMessage : null;

            return StatusCode(500, new 
            { 
                code = "DB_SAVE_FAILED",
                message = "Veritabanı kayıt hatası. Lütfen tekrar deneyin.",
                detail = detail
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Access key creation failed for client {ClientId}", request.ClientId);
            return StatusCode(500, new { message = $"Key oluşturulamadı: {ex.Message}" });
        }
    }

    private static string GenerateAccessKey()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 12)
            .Select(_ => chars[random.Next(chars.Length)])
            .ToArray());
    }
}

// DTOs
public record CreateAccessKeyRequest(string ClientId, string StartDate, string EndDate);
