using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Interfaces;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using System.Text.Json.Serialization;
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
    /// Get all clients for the authenticated dietitian with pagination, search, and filtering
    /// </summary>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 25)</param>
    /// <param name="search">Search by name or email</param>
    /// <param name="status">Filter by status: 'premium' or 'free'</param>
    /// <param name="expiringSoon">Filter premium clients expiring within 7 days</param>
    /// <param name="lowCompliance">Filter clients with compliance < 60%</param>
    /// <param name="sortBy">Sort by: 'lastActivity', 'name', or 'endDate'</param>
    /// <param name="sortDir">Sort direction: 'asc' or 'desc'</param>
    [HttpGet("clients")]
    public async Task<IActionResult> GetClients(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] bool? expiringSoon = null,
        [FromQuery] bool? lowCompliance = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // Validate pagination parameters
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 25;

        var query = new GetClientsByDietitianQuery
        {
            DietitianId = user.LinkedDietitianId.Value,
            Page = page,
            PageSize = pageSize,
            Search = search,
            Status = status,
            ExpiringSoon = expiringSoon,
            LowCompliance = lowCompliance,
            SortBy = sortBy,
            SortDir = sortDir
        };

        var result = await _mediator.Send(query);

        return Ok(new 
        { 
            items = result.Items,
            total = result.Total,
            page = result.Page,
            pageSize = result.PageSize
        });
    }

    /// <summary>
    /// Get live/active clients for real-time dashboard monitoring
    /// Returns clients with their current activity status
    /// </summary>
    [HttpGet("live-clients")]
    public async Task<IActionResult> GetLiveClients()
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedDietitianId == null)
                return Forbid();

            var dietitianId = user.LinkedDietitianId.Value;

            // Get active client links with basic client info
            var activeClients = await (from link in _appDb.DietitianClientLinks
                                       join client in _appDb.Clients on link.ClientId equals client.Id
                                       where link.DietitianId == dietitianId && link.IsActive
                                       select new
                                       {
                                           clientId = client.Id,
                                           clientName = client.FullName ?? "Unknown",
                                           lastActivity = (string?)null, // TODO: Implement activity tracking
                                           todayCompliancePercentage = 0, // TODO: Calculate from meal plan completions
                                           currentMeal = (string?)null, // TODO: Get from today's meal plan
                                           lastMealItem = (string?)null // TODO: Get last completed meal
                                       })
                                      .Take(50) // Limit to 50 most recent
                                      .ToListAsync();

            return Ok(new { ActiveClients = activeClients });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting live clients");
            return StatusCode(500, new { message = "Failed to retrieve live clients", traceId = HttpContext.TraceIdentifier });
        }
    }


    /// <summary>
    /// Get dashboard statistics for dietitian web panel
    /// </summary>
    [HttpGet("dashboard/stats")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // Count active client links
        var clientsCount = await _appDb.DietitianClientLinks
            .CountAsync(l => l.DietitianId == dietitianId && l.IsActive);

        // Count active plans (published meal plans for today or future)
        var today = DateTime.UtcNow.Date;
        var activePlans = await _appDb.MealPlans
            .Where(p => p.Date >= today && p.Status == Domain.Entities.MealPlanStatus.Published)
            .Select(p => p.ClientId)
            .Distinct()
            .CountAsync();

        // Count recipes created by this dietitian
        var recipesCount = await _appDb.Recipes
            .CountAsync(r => r.DietitianId == dietitianId);

        // Count pending access keys (active keys that haven't been used yet)
        // Note: When a key is used, it's deactivated, so active keys are unused keys
        var pendingInvites = await _appDb.AccessKeys
            .CountAsync(k => k.DietitianId == dietitianId && k.IsActive);

        return Ok(new
        {
            clientsCount,
            activePlans,
            recipesCount,
            pendingInvites
        });
    }

    /// <summary>
    /// Get recent activity feed for dietitian dashboard
    /// </summary>
    [HttpGet("dashboard/activity")]
    public async Task<IActionResult> GetDashboardActivity([FromQuery] int limit = 15)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        // Get recent client links with client names
        var recentLinks = await (from link in _appDb.DietitianClientLinks
                                 join client in _appDb.Clients on link.ClientId equals client.Id
                                 where link.DietitianId == dietitianId && link.IsActive
                                 orderby link.LinkedAt descending
                                 select new
                                 {
                                     type = "CLIENT_ADDED",
                                     message = "New client linked: " + client.FullName,
                                     occurredAt = link.LinkedAt
                                 })
                                .Take(limit)
                                .ToListAsync();

        return Ok(new { items = recentLinks });
    }


    /// <summary>
    /// Get specific client details by ID (for web panel detail page)
    /// WEB-CLIENT-03: Client detail endpoint with IDOR prevention
    /// </summary>
    [HttpGet("clients/{clientId}")]
    public async Task<IActionResult> GetClientById(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // IDOR Prevention: Verify dietitian owns this client
        var link = await _appDb.DietitianClientLinks
            .Include(l => l.Client)
            .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value 
                                   && l.ClientId == clientId 
                                   && l.IsActive);

        if (link == null)
            return NotFound(new { message = "Danışan bulunamadı veya erişim yetkiniz yok" });

        var client = link.Client;
        
        // Get dietitian info for clinic name
        var dietitian = await _appDb.Dietitians.FindAsync(user.LinkedDietitianId.Value);

        return Ok(new
        {
            id = client.Id,
            fullName = client.FullName,
            email = client.Email,
            isPremium = client.IsPremium,
            isActive = client.IsActive,
            clinicName = dietitian?.ClinicName ?? dietitian?.FullName,
            linkedAt = link.LinkedAt,
            programStartDate = client.ProgramStartDate,
            programEndDate = client.ProgramEndDate
        });
    }


    /// <summary>
    /// Get activities for a specific client (for client detail page)
    /// </summary>
    [HttpGet("clients/{clientId}/activities")]
    public async Task<IActionResult> GetClientActivities(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // IDOR Prevention: Verify this client belongs to this dietitian
        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value && 
                                     l.ClientId == clientId && 
                                     l.IsActive);
        if (link == null)
            return NotFound(new { message = "Client not found or not linked to this dietitian" });

        // TODO: Implement actual activity tracking
        // For now, return empty array
        return Ok(new { items = new object[] { } });
    }

    /// <summary>
    /// Get measurements for a specific client (for client detail page)
    /// </summary>
    [HttpGet("clients/{clientId}/measurements")]
    public async Task<IActionResult> GetClientMeasurements(Guid clientId)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedDietitianId == null)
                return Forbid();

            // IDOR Prevention: Verify this client belongs to this dietitian
            var link = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value && 
                                         l.ClientId == clientId && 
                                         l.IsActive);
            if (link == null)
                return NotFound(new { message = "Client not found or not linked to this dietitian" });

            // TODO: Implement actual measurements retrieval
            // For now, return empty array
            return Ok(new { items = new object[] { } });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting measurements for client {ClientId}", clientId);
            return StatusCode(500, new { message = "Failed to retrieve measurements", traceId = HttpContext.TraceIdentifier });
        }
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
            .OrderByDescending(k => k.CreatedAtUtc)
            .Select(k => new {
                k.Id,
                k.KeyValue,
                k.CreatedAtUtc,
                k.ExpiresAtUtc,
                k.ClientId,
                k.IsActive
            })
            .ToListAsync();

        return Ok(new { accessKeys = keys });
    }

    /// <summary>
    /// Create premium access key for a client using publicUserId route parameter.
    ///
    /// Example:
    /// POST /api/dietitian/clients/MD-FMXI-BLKY-MA/access-key
    /// {
    ///   "startDate": "2026-02-11",
    ///   "endDate": "2026-02-18"
    /// }
    /// </summary>
    [HttpPost("clients/{publicUserId}/access-key")]
    [EnableRateLimiting("keygen")]
    public Task<IActionResult> CreateAccessKeyForClient(string publicUserId, [FromBody] CreateAccessKeyForClientRequest request)
    {
        // Delegate to main access-key flow while keeping Swagger-friendly wrapper
        var inner = new CreateAccessKeyRequest(publicUserId, request.CreatedAtUtc, request.ExpiresAtUtc);
        return CreateAccessKey(inner);
    }

    /// <summary>
    /// Revoke a client's premium access for the authenticated dietitian.
    /// Deactivates the DietitianClientLink and any active AccessKeys, and updates client premium state.
    /// </summary>
    [HttpPost("clients/{clientId:guid}/revoke")]
    [Authorize("Dietitian")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> RevokeClientPremium(Guid clientId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var command = new RevokePremiumCommand
        {
            DietitianId = user.LinkedDietitianId.Value,
            ClientId = clientId
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            // IDOR-safe: do not leak whether client exists, only that link is missing
            if (result.ErrorCode == "LINK_NOT_FOUND")
            {
                var problem = ApiProblems.NotFound("LINK_NOT_FOUND", result.ErrorMessage ?? "Danışan bulunamadı veya erişim yetkiniz yok");
                return StatusCode(problem.Status ?? 404, problem);
            }

            var validation = ApiProblems.Validation(result.ErrorCode ?? "PREMIUM_REVOKE_FAILED", result.ErrorMessage ?? "Premium iptali başarısız");
            return StatusCode(validation.Status ?? 400, validation);
        }

        // Audit log
        var audit = new PremiumAuditLog(
            Guid.NewGuid(),
            result.ClientId,
            user.LinkedDietitianId,
            "Revoke",
            result.RevokedAtUtc,
            null);

        _appDb.PremiumAuditLogs.Add(audit);
        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            clientId = result.ClientId,
            revokedAt = result.RevokedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            wasPremium = result.WasPremium,
            nowPremium = false
        });
    }

    /// <summary>
    /// Revoke a client's premium access using publicUserId (canonical route).
    /// </summary>
    [HttpPost("clients/{publicUserId}/revoke")]
    [Authorize("Dietitian")]
    public async Task<IActionResult> RevokeClientPremiumByPublicUserId(string publicUserId)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var client = await _userRepo.GetClientByPublicUserIdAsync(publicUserId);
        if (client == null)
        {
            var problem = ApiProblems.NotFound("CLIENT_NOT_FOUND", $"Danışan bulunamadı: {publicUserId}");
            return StatusCode(problem.Status ?? 404, problem);
        }

        var clientEntity = (Client)client;

        var command = new RevokePremiumCommand
        {
            DietitianId = user.LinkedDietitianId.Value,
            ClientId = clientEntity.Id
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            if (result.ErrorCode == "LINK_NOT_FOUND")
            {
                var problem = ApiProblems.NotFound("LINK_NOT_FOUND", result.ErrorMessage ?? "Danışan bulunamadı veya erişim yetkiniz yok");
                return StatusCode(problem.Status ?? 404, problem);
            }

            var validation = ApiProblems.Validation(result.ErrorCode ?? "PREMIUM_REVOKE_FAILED", result.ErrorMessage ?? "Premium iptali başarısız");
            return StatusCode(validation.Status ?? 400, validation);
        }

        // Audit log
        var audit = new PremiumAuditLog(
            Guid.NewGuid(),
            result.ClientId,
            user.LinkedDietitianId,
            "Revoke",
            result.RevokedAtUtc,
            System.Text.Json.JsonSerializer.Serialize(new { publicUserId }));

        _appDb.PremiumAuditLogs.Add(audit);
        await _appDb.SaveChangesAsync();

        return Ok(new
        {
            publicUserId,
            clientId = result.ClientId,
            revokedAt = result.RevokedAtUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            wasPremium = result.WasPremium,
            nowPremium = false
        });
    }

    /// <summary>
    /// Create premium access key for a client.
    ///
    /// Preferred payload (public user id based):
    /// {
    ///   "publicUserId": "MD-FMXI-BLKY-MA",
    ///   "startDate": "2026-02-11",
    ///   "endDate": "2026-02-18"
    /// }
    ///
    /// For backward compatibility, legacy clients can still send "clientId"
    /// with the same MD-XXXX-XXXX-XX value; if both are present,
    /// publicUserId takes precedence.
    /// </summary>
    [HttpPost("access-keys")]
    [EnableRateLimiting("keygen")]
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

            // Resolve public user id (new contract) with backward compatibility
            var publicUserId = request.PublicUserId;

            var client = await _userRepo.GetClientByPublicUserIdAsync(publicUserId);
            if (client == null)
                return NotFound(new { message = $"Danışan bulunamadı: {publicUserId}" });

            var clientEntity = (Client)client;

            if (!DateTime.TryParse(request.CreatedAtUtc, out var startDate) ||
                !DateTime.TryParse(request.ExpiresAtUtc, out var endDate))
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
                         && k.ExpiresAtUtc > DateTime.UtcNow)
                .FirstOrDefaultAsync();

            if (existingKey != null)
            {
                return Ok(new
                {
                    success = true,
                    key = existingKey.KeyValue,
                    publicUserId,
                    startDate = existingKey.CreatedAtUtc.ToString("yyyy-MM-dd"),
                    endDate = existingKey.ExpiresAtUtc.ToString("yyyy-MM-dd"),
                    message = "Mevcut aktif anahtar döndürüldü"
                });
            }

            var keyValue = GenerateAccessKey();
            var accessKeyId = Guid.NewGuid();
            var accessKey = new AccessKey(
                accessKeyId,
                keyValue,
                user.LinkedDietitianId.Value,
                clientEntity.Id,
                startUtc,  // Use UTC-normalized date
                endUtc,    // Use UTC-normalized date
                true
            );

            _appDb.AccessKeys.Add(accessKey);

            // Audit log for key generation
            var audit = new PremiumAuditLog(
                Guid.NewGuid(),
                clientEntity.Id,
                user.LinkedDietitianId.Value,
                "KeyGenerated",
                DateTime.UtcNow,
                System.Text.Json.JsonSerializer.Serialize(new
                {
                    accessKeyId,
                    accessKey = keyValue,
                    startDate = startUtc,
                    endDate = endUtc
                }));

            _appDb.PremiumAuditLogs.Add(audit);

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
                    PublicUserId = publicUserId
                };

                await _mediator.Send(bindCommand);
            }
            // If link exists, no need to update - it's already bound correctly

            await _appDb.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                key = accessKey.KeyValue,
                publicUserId,
                startDate = accessKey.CreatedAtUtc.ToString("yyyy-MM-dd"),
                endDate = accessKey.ExpiresAtUtc.ToString("yyyy-MM-dd")
            });
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
        {
        _logger.LogError(dbEx, "Database update failed during access key creation for client {PublicUserId}", request.PublicUserId);
            
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
            _logger.LogError(ex, "Access key creation failed for client {PublicUserId}", request.PublicUserId);
            return StatusCode(500, new { message = $"Key oluşturulamadı: {ex.Message}" });
        }
    }

    /// <summary>
    /// Extend an existing access key's end date
    /// </summary>
    [HttpPost("clients/{clientId:guid}/access-keys/{keyId:guid}/extend")]
    public async Task<IActionResult> ExtendAccessKey(
        Guid clientId,
        Guid keyId,
        [FromBody] ExtendAccessKeyRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        // IDOR Prevention: Verify dietitian owns this client
        var link = await _appDb.DietitianClientLinks
            .FirstOrDefaultAsync(l => l.DietitianId == user.LinkedDietitianId.Value &&
                                     l.ClientId == clientId &&
                                     l.IsActive);

        if (link == null)
            return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Client not found or not linked to this dietitian"));

        // Find the access key
        var accessKey = await _appDb.AccessKeys
            .FirstOrDefaultAsync(k => k.Id == keyId &&
                                     k.DietitianId == user.LinkedDietitianId.Value &&
                                     k.ClientId == clientId);

        if (accessKey == null)
            return NotFound(ApiProblems.NotFound("KEY_NOT_FOUND", "Access key not found"));

        // Parse and validate extension months
        if (request.ExtensionMonths < 1 || request.ExtensionMonths > 12)
        {
            return BadRequest(ApiProblems.Validation("INVALID_EXTENSION",
                "Extension must be between 1 and 12 months"));
        }

        // Calculate new end date
        var newEndDate = accessKey.ExpiresAtUtc.AddMonths(request.ExtensionMonths);

        try
        {
            // Extend the key
            accessKey.Extend(newEndDate);

            // Update client's program end date if this is the active key
            var client = await _appDb.Clients.FindAsync(clientId);
            if (client != null && client.IsPremium && client.ProgramEndDate == accessKey.ExpiresAtUtc)
            {
                client.ActivatePremium(user.LinkedDietitianId.Value, client.ProgramStartDate ?? DateTime.UtcNow, newEndDate);
            }

            // Audit log
            var audit = new PremiumAuditLog(
                Guid.NewGuid(),
                clientId,
                user.LinkedDietitianId,
                "Extended",
                DateTime.UtcNow,
                System.Text.Json.JsonSerializer.Serialize(new
                {
                    keyId,
                    extensionMonths = request.ExtensionMonths,
                    oldEndDate = accessKey.ExpiresAtUtc.AddMonths(-request.ExtensionMonths),
                    newEndDate
                }));

            _appDb.PremiumAuditLogs.Add(audit);
            await _appDb.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                keyId,
                newEndDate = newEndDate.ToString("yyyy-MM-dd"),
                extensionMonths = request.ExtensionMonths
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiProblems.Validation("EXTEND_FAILED", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extend access key {KeyId}", keyId);
            return StatusCode(500, ApiProblems.InternalServerError("EXTEND_FAILED", "Failed to extend access key"));
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
[JsonConverter(typeof(MyDietitianMobileApp.Api.Json.CreateAccessKeyRequestJsonConverter))]
public record CreateAccessKeyRequest(string PublicUserId, string CreatedAtUtc, string ExpiresAtUtc);
public record CreateAccessKeyForClientRequest(string CreatedAtUtc, string ExpiresAtUtc);
public record ExtendAccessKeyRequest(int ExtensionMonths);
public record AddClientNoteRequest(string Text);
