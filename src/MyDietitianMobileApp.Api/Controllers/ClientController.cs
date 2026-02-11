using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client")]
public class ClientController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IClientActivityWriter _activityWriter;
    private readonly ILogger<ClientController> _logger;

    public ClientController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IClientActivityWriter activityWriter,
        ILogger<ClientController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _activityWriter = activityWriter;
        _logger = logger;
    }

    /// <summary>
    /// Activate premium with access key
    /// </summary>
    [HttpPost("activate-premium")]
    [EnableRateLimiting("activation")]
    public async Task<IActionResult> ActivatePremium([FromBody] ActivatePremiumRequest request)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "JWT token eksik veya geçersiz" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var client = await _appDb.Clients.FindAsync(user.LinkedClientId);
            if (client == null)
                return BadRequest(new { message = "Client kaydı bulunamadı" });

            using var tx = await _appDb.Database.BeginTransactionAsync();

            var now = DateTime.UtcNow;

            // Load access key (including already-used ones for idempotency)
            var accessKey = await _appDb.AccessKeys
                .FirstOrDefaultAsync(k => k.Key == request.AccessKey);

            if (accessKey == null || accessKey.ClientId != client.Id)
                return NotFound(new { message = "Geçersiz erişim anahtarı" });

            // Get dietitian info
            var dietitian = await _appDb.Dietitians.FindAsync(accessKey.DietitianId);
            if (dietitian == null || !dietitian.IsActive)
                return BadRequest(new { message = "Diyetisyen bulunamadı veya aktif değil" });

            // Idempotent: if premium already active for this dietitian and still valid, short-circuit
            if (client.ActiveDietitianId == dietitian.Id &&
                client.ProgramEndDate != null &&
                client.ProgramEndDate >= now)
            {
                await tx.CommitAsync();
                return Ok(new
                {
                    success = true,
                    message = "Premium zaten aktif",
                    dietitianName = dietitian.FullName,
                    isPremium = true
                });
            }

            // Validate key time window only for first activation
            if (!accessKey.IsValid(now))
                return BadRequest(new { message = "Erişim anahtarı geçersiz veya süresi dolmuş" });

            // Update client premium status using domain method
            client.ActivatePremium(dietitian.Id, accessKey.StartDate, accessKey.EndDate);

            // Mark key as used
            accessKey.MarkAsActivated();

            // Create or update binding
            var existingBinding = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.ClientId == client.Id && l.DietitianId == dietitian.Id);

            if (existingBinding == null)
            {
                var binding = new DietitianClientLink(
                    dietitian.Id,
                    client.Id,
                    user.PublicUserId
                );
                _appDb.DietitianClientLinks.Add(binding);
            }
            else if (!existingBinding.IsActive)
            {
                existingBinding.Reactivate();
            }

            // Audit log
            var audit = new PremiumAuditLog(
                Guid.NewGuid(),
                client.Id,
                dietitian.Id,
                "Activated",
                now,
                System.Text.Json.JsonSerializer.Serialize(new
                {
                    accessKeyId = accessKey.Id,
                    accessKey = accessKey.Key,
                    startDate = accessKey.StartDate,
                    endDate = accessKey.EndDate
                }));

            _appDb.PremiumAuditLogs.Add(audit);

            await _appDb.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new
            {
                success = true,
                message = "Premium aktivasyonu başarılı",
                dietitianName = dietitian.FullName,
                isPremium = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Premium activation failed for key {AccessKey}", request.AccessKey);
            return StatusCode(500, new { message = $"Aktivasyon başarısız: {ex.Message}" });
        }
    }

    /// <summary>
    /// Get client pantry items (inventory)
    /// </summary>
    [HttpGet("pantry")]
    [EnableRateLimiting("pantry")]
    public async Task<IActionResult> GetPantry()
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "JWT token eksik veya geçersiz" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedClientId == null)
                return Unauthorized(new { message = "Client hesabı bulunamadı" });

            var clientId = user.LinkedClientId.Value;

            var items = await _appDb.ClientPantryItems
                .Where(p => p.ClientId == clientId)
                .Include(p => p.Ingredient)
                .OrderByDescending(p => p.UpdatedAtUtc)
                .Select(p => new
                {
                    ingredientId = p.IngredientId,
                    ingredientName = p.Ingredient.CanonicalName,
                    quantity = p.Quantity,
                    unit = p.Unit,
                    updatedAtUtc = p.UpdatedAtUtc
                })
                .ToListAsync();

            return Ok(new { items });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get pantry for current client");
            return StatusCode(500, new { message = "Mutfak envanteri alınamadı" });
        }
    }

    /// <summary>
    /// Bulk add/update pantry items for current client
    /// </summary>
    [HttpPost("pantry/items")]
    [EnableRateLimiting("pantry")]
    public async Task<IActionResult> UpsertPantryItems([FromBody] List<UpsertPantryItemRequest> request)
    {
        if (request == null || request.Count == 0)
            return Ok(new { updated = 0 });

        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "JWT token eksik veya geçersiz" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedClientId == null)
                return Unauthorized(new { message = "Client hesabı bulunamadı" });

            var clientId = user.LinkedClientId.Value;

            var ingredientIds = request.Select(r => r.IngredientId).Distinct().ToList();
            var existingItems = await _appDb.ClientPantryItems
                .Where(p => p.ClientId == clientId && ingredientIds.Contains(p.IngredientId))
                .ToListAsync();

            foreach (var itemReq in request)
            {
                var existing = existingItems.FirstOrDefault(p => p.IngredientId == itemReq.IngredientId);
                if (existing != null)
                {
                    existing.SetQuantity(itemReq.Quantity, itemReq.Unit);
                }
                else
                {
                    var pantryItem = new ClientPantryItem(clientId, itemReq.IngredientId, itemReq.Quantity, itemReq.Unit);
                    _appDb.ClientPantryItems.Add(pantryItem);
                }
            }

            var updated = await _appDb.SaveChangesAsync();
            return Ok(new { updated });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upsert pantry items for current client");
            return StatusCode(500, new { message = "Mutfak envanteri güncellenemedi" });
        }
    }

    /// <summary>
    /// Remove a single ingredient from pantry
    /// </summary>
    [HttpDelete("pantry/items/{ingredientId:guid}")]
    [EnableRateLimiting("pantry")]
    public async Task<IActionResult> DeletePantryItem(Guid ingredientId)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "JWT token eksik veya geçersiz" });

            var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
            if (user?.LinkedClientId == null)
                return Unauthorized(new { message = "Client hesabı bulunamadı" });

            var clientId = user.LinkedClientId.Value;

            var item = await _appDb.ClientPantryItems
                .FirstOrDefaultAsync(p => p.ClientId == clientId && p.IngredientId == ingredientId);

            if (item == null)
                return NotFound(new { message = "Mutfak kaydı bulunamadı" });

            _appDb.ClientPantryItems.Remove(item);
            await _appDb.SaveChangesAsync();

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete pantry item {IngredientId} for current client", ingredientId);
            return StatusCode(500, new { message = "Mutfak envanteri güncellenemedi" });
        }
    }

    /// <summary>
    /// Get available recipes for client (public + premium dietitian recipes)
    /// </summary>
    [HttpGet("recipes/available")]
    public async Task<IActionResult> GetAvailableRecipes(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? q = null)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "JWT token eksik veya geçersiz"));

            var userGuid = Guid.Parse(userId);
            var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid);

            page = page <= 0 ? 1 : page;
            pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

            var queryable = _appDb.Recipes.AsQueryable();

            // Filter by premium status
            if (premiumStatus.IsPremium && premiumStatus.ActiveDietitianId.HasValue)
            {
                // Premium: public recipes + own dietitian's recipes
                queryable = queryable.Where(r =>
                    r.IsPublic || (r.DietitianId == premiumStatus.ActiveDietitianId.Value));
            }
            else
            {
                // Free: only public recipes
                queryable = queryable.Where(r => r.IsPublic);
            }

            // Search filter
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                queryable = queryable.Where(r =>
                    EF.Functions.ILike(r.Name, $"%{term}%") ||
                    EF.Functions.ILike(r.Description, $"%{term}%"));
            }

            var total = await queryable.CountAsync();

            var recipes = await queryable
                .OrderBy(r => r.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Include(r => r.MandatoryIngredients)
                .Include(r => r.OptionalIngredients)
                .Include(r => r.ProhibitedIngredients)
                .Select(r => new
                {
                    id = r.Id,
                    name = r.Name,
                    description = r.Description,
                    isPublic = r.IsPublic,
                    mandatoryIngredients = r.MandatoryIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
                    optionalIngredients = r.OptionalIngredients.Select(i => new { id = i.Id, name = i.CanonicalName }),
                    prohibitedIngredients = r.ProhibitedIngredients.Select(i => new { id = i.Id, name = i.CanonicalName })
                })
                .ToListAsync();

            return Ok(new { page, pageSize, total, recipes });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get available recipes for client");
            return StatusCode(500, ApiProblems.InternalServerError("RECIPES_FETCH_FAILED", "Tarifler alınamadı"));
        }
    }


    /// <summary>
    /// Get client's prohibited ingredients (allergies/forbidden)
    /// </summary>
    [HttpGet("prohibitions")]
    public async Task<IActionResult> GetProhibitions()
    {
        var clientId = await GetClientIdAsync();
        if (!clientId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        var prohibited = await _appDb.ClientProhibitedIngredients
            .Where(cp => cp.ClientId == clientId.Value)
            .Include(cp => cp.Ingredient)
            .OrderByDescending(cp => cp.CreatedAtUtc)
            .Select(cp => new { id = cp.IngredientId, name = cp.Ingredient.CanonicalName })
            .ToListAsync();

        return Ok(new
        {
            ingredientIds = prohibited.Select(p => p.id).ToList(),
            items = prohibited
        });
    }

    /// <summary>
    /// Update client's prohibited ingredients (REPLACE semantics)
    /// </summary>
    [HttpPut("prohibitions")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> UpdateProhibitions([FromBody] UpdateProhibitionsRequest request)
    {
        var clientId = await GetClientIdAsync();
        if (!clientId.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

        // Validate ingredient IDs exist
        var ingredientIds = request.IngredientIds.Distinct().ToList();
        if (ingredientIds.Any())
        {
            var existingIngredients = await _appDb.Ingredients
                .Where(i => ingredientIds.Contains(i.Id) && i.IsActive)
                .Select(i => i.Id)
                .ToListAsync();

            var missingIds = ingredientIds.Except(existingIngredients).ToList();
            if (missingIds.Any())
            {
                return BadRequest(ApiProblems.Validation("INGREDIENT_NOT_FOUND",
                    $"Şu malzemeler bulunamadı: {string.Join(", ", missingIds)}"));
            }
        }

        // Transaction: delete existing + insert new
        using var tx = await _appDb.Database.BeginTransactionAsync();
        try
        {
            var existing = await _appDb.ClientProhibitedIngredients
                .Where(cp => cp.ClientId == clientId.Value)
                .ToListAsync();
            _appDb.ClientProhibitedIngredients.RemoveRange(existing);

            foreach (var ingredientId in ingredientIds)
            {
                var prohibited = new ClientProhibitedIngredient(clientId.Value, ingredientId);
                _appDb.ClientProhibitedIngredients.Add(prohibited);
            }

            await _appDb.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new { updatedCount = ingredientIds.Count });
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Apply ingredient pack to client pantry (bulk upsert)
    /// </summary>
    [HttpPost("pantry/packs/{packId:guid}")]
    [EnableRateLimiting("pantry")]
    public async Task<IActionResult> ApplyPack(Guid packId)
    {
        try
        {
            var clientId = await GetClientIdAsync();
            if (!clientId.HasValue)
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

            var pack = await _appDb.IngredientPacks
                .Include(p => p.Items)
                .ThenInclude(i => i.Ingredient)
                .FirstOrDefaultAsync(p => p.Id == packId && p.IsSystem);

            if (pack == null)
                return NotFound(ApiProblems.NotFound("PACK_NOT_FOUND", "Paket bulunamadı"));

            var packIngredientIds = pack.Items.Select(i => i.IngredientId).ToList();
            var existingPantryItems = await _appDb.ClientPantryItems
                .Where(cp => cp.ClientId == clientId.Value && packIngredientIds.Contains(cp.IngredientId))
                .ToListAsync();

            var existingIngredientIds = existingPantryItems.Select(cp => cp.IngredientId).ToHashSet();
            var addedOrUpdated = 0;

            foreach (var packItem in pack.Items)
            {
                if (existingIngredientIds.Contains(packItem.IngredientId))
                {
                    // Update existing (keep existing quantity/unit)
                    addedOrUpdated++;
                }
                else
                {
                    // Insert new
                    var pantryItem = new ClientPantryItem(clientId.Value, packItem.IngredientId, null, null);
                    _appDb.ClientPantryItems.Add(pantryItem);
                    addedOrUpdated++;
                }
            }

            await _appDb.SaveChangesAsync();

            // Write activity
            try
            {
                await _activityWriter.WriteAsync(
                    clientId.Value,
                    null, // Pack apply is not dietitian-specific
                    "PANTRY_PACK_APPLIED",
                    new { packId, addedCount = addedOrUpdated });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to write pack apply activity");
            }

            return Ok(new { addedOrUpdated });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to apply pack to pantry");
            return StatusCode(500, ApiProblems.InternalServerError("PACK_APPLY_FAILED", "Paket uygulanamadı"));
        }
    }

    private async Task<Guid?> GetClientIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return null;

        var user = await _authDb.UserAccounts
            .FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId) && u.Role == "Client");

        return user?.LinkedClientId;
    }
}

public record ActivatePremiumRequest(string AccessKey);

public record UpsertPantryItemRequest(Guid IngredientId, decimal? Quantity, string? Unit);

public record UpdateProhibitionsRequest(List<Guid> IngredientIds);
