using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Interfaces;
using MyDietitianMobileApp.Infrastructure.Persistence;

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

    public DietitianManagementController(
        IMediator mediator,
        AuthDbContext authDb,
        AppDbContext appDb,
        IUserRepository userRepo,
        ILogger<DietitianManagementController> logger)
    {
        _mediator = mediator;
        _authDb = authDb;
        _appDb = appDb;
        _userRepo = userRepo;
        _logger = logger;
    }

    /// <summary>
    /// Get all clients for the authenticated dietitian
    /// </summary>
    [HttpGet("clients")]
    public async Task<IActionResult> GetClients()
    {
        var userId = User.FindFirst("sub")?.Value;
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
        var userId = User.FindFirst("sub")?.Value;
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
        var userId = User.FindFirst("sub")?.Value;
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

            var userId = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("POST access-keys: 'sub' claim not found in token");
                return Unauthorized(new { message = "JWT token eksik veya geçersiz (sub claim missing)" });
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

            if (endDate <= startDate)
                return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden sonra olmalı" });

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
                startDate,
                endDate,
                true
            );

            _appDb.AccessKeys.Add(accessKey);

            // FAZ 3: Create permanent binding
            var bindCommand = new BindClientToDietitianCommand
            {
                DietitianId = user.LinkedDietitianId.Value,
                ClientId = clientEntity.Id,
                PublicUserId = request.ClientId
            };

            await _mediator.Send(bindCommand);
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
