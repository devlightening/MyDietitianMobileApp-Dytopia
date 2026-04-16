using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Problems;
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

    public ClientPantryController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
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
