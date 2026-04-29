using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MediatR;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client/pantry")]
public class ClientPantryController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IMediator _mediator;

    public ClientPantryController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver,
        IMediator mediator)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var items = await QueryPantryAsync(identity.Value.clientId);
        return Ok(new { items });
    }

    /// <summary>
    /// Returns the most recently used ingredients from the client's pantry.
    /// Ordered by UpdatedAtUtc descending — powers the "Son Kullandıklarım" quick-add row.
    /// </summary>
    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent([FromQuery] int limit = 8)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var safeLimit = Math.Clamp(limit, 1, 20);

        var items = await _appDb.ClientPantryItems
            .AsNoTracking()
            .Where(x => x.ClientId == identity.Value.clientId)
            .Include(x => x.Ingredient)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Take(safeLimit)
            .Select(x => new { id = x.IngredientId, name = x.Ingredient.CanonicalName })
            .ToListAsync();

        return Ok(new { items });
    }

    [HttpPut]
    [EnableRateLimiting("pantry")]
    public async Task<IActionResult> Replace([FromBody] ReplacePantryRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var incoming = (request.Items ?? Array.Empty<PantryItemRequest>())
            .GroupBy(x => x.IngredientId)
            .Select(g => g.Last())
            .ToList();

        if (incoming.Count > 60)
            return BadRequest(ApiProblems.Validation("PANTRY_LIMIT", "Pantry en fazla 60 malzeme tutabilir."));

        var ingredientIds = incoming.Select(x => x.IngredientId).ToList();
        var validIds = ingredientIds.Count == 0
            ? new HashSet<Guid>()
            : (await _appDb.Ingredients
                .Where(x => ingredientIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync())
                .ToHashSet();

        var invalidId = ingredientIds.FirstOrDefault(x => !validIds.Contains(x));
        if (invalidId != Guid.Empty)
            return BadRequest(ApiProblems.Validation("INGREDIENT_NOT_FOUND", "Gecersiz pantry malzemesi gonderildi."));

        var existing = await _appDb.ClientPantryItems
            .Where(x => x.ClientId == identity.Value.clientId)
            .ToListAsync();

        var incomingByIngredient = incoming.ToDictionary(x => x.IngredientId, x => x);
        foreach (var stale in existing.Where(x => !incomingByIngredient.ContainsKey(x.IngredientId)).ToList())
            _appDb.ClientPantryItems.Remove(stale);

        foreach (var item in incoming)
        {
            var current = existing.FirstOrDefault(x => x.IngredientId == item.IngredientId);
            if (current == null)
            {
                _appDb.ClientPantryItems.Add(new ClientPantryItem(
                    identity.Value.clientId,
                    item.IngredientId,
                    item.Quantity,
                    item.Unit));
                continue;
            }

            current.SetQuantity(item.Quantity, item.Unit);
        }

        await _appDb.SaveChangesAsync();
        var items = await QueryPantryAsync(identity.Value.clientId);
        return Ok(new { items });
    }

    [HttpPost("analyze-receipt")]
    [EnableRateLimiting("kitchen-vision")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> AnalyzeReceipt(
        [FromBody] AnalyzeReceiptRequest request,
        CancellationToken cancellationToken)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        if (string.IsNullOrWhiteSpace(request.Base64Image))
            return BadRequest(ApiProblems.Validation("BASE64_REQUIRED", "base64Image alani bos olamaz."));

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
        var mediaType = (request.MediaType ?? "image/jpeg").ToLowerInvariant();
        if (!allowedTypes.Contains(mediaType))
            return BadRequest(ApiProblems.Validation("UNSUPPORTED_MEDIA", "Desteklenmeyen goruntu turu."));

        var command = new AnalyzeIngredientImageCommand(
            request.Base64Image,
            mediaType,
            VisionScanKind.Receipt);
        var result = await _mediator.Send(command, cancellationToken);

        return Ok(new
        {
            sessionId = result.SessionId,
            featureStatus = result.FeatureStatus,
            totalDetected = result.TotalDetected,
            promptTokens = result.PromptTokens,
            completionTokens = result.CompletionTokens,
            matched = result.Matched.Select(m => new
            {
                ingredientId = m.IngredientId,
                canonicalName = m.CanonicalName,
                confidence = m.Confidence,
                detectedName = m.DetectedName,
                normalizedLabel = m.NormalizedLabel,
                matchedBy = m.MatchedBy,
                mappingType = m.MappingType,
                isAutoSelected = m.IsAutoSelected,
                requiresConfirmation = m.RequiresConfirmation,
            }),
            unmatched = result.Unmatched,
        });
    }

    [HttpDelete("{ingredientId:guid}")]
    [EnableRateLimiting("pantry")]
    public async Task<IActionResult> Delete(Guid ingredientId)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var current = await _appDb.ClientPantryItems
            .FirstOrDefaultAsync(x => x.ClientId == identity.Value.clientId && x.IngredientId == ingredientId);

        if (current == null)
            return NotFound(ApiProblems.NotFound("PANTRY_ITEM_NOT_FOUND", "Pantry malzemesi bulunamadi."));

        _appDb.ClientPantryItems.Remove(current);
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    private async Task<List<object>> QueryPantryAsync(Guid clientId)
    {
        var items = await _appDb.ClientPantryItems
            .AsNoTracking()
            .Where(x => x.ClientId == clientId)
            .Include(x => x.Ingredient)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Select(x => new
            {
                ingredientId = x.IngredientId,
                ingredientName = x.Ingredient.CanonicalName,
                quantity = x.Quantity,
                unit = x.Unit,
                updatedAtUtc = x.UpdatedAtUtc
            })
            .ToListAsync();

        return items.Cast<object>().ToList();
    }
}

public sealed record PantryItemRequest(Guid IngredientId, decimal? Quantity, string? Unit);

public sealed record ReplacePantryRequest(IReadOnlyList<PantryItemRequest> Items);

public sealed record AnalyzeReceiptRequest(string? Base64Image, string? MediaType = "image/jpeg");
