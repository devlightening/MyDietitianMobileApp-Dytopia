using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Api.Time;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client/shopping-list")]
public class ClientShoppingListController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly IClientIdentityResolver _identityResolver;
    private readonly IPremiumStatusService _premiumStatusService;

    public ClientShoppingListController(
        AppDbContext appDb,
        IClientIdentityResolver identityResolver,
        IPremiumStatusService premiumStatusService)
    {
        _appDb = appDb;
        _identityResolver = identityResolver;
        _premiumStatusService = premiumStatusService;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        return Ok(await BuildResponseAsync(identity.Value.clientId));
    }

    [HttpPost]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> Add([FromBody] CreateShoppingListItemRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        Ingredient? ingredient = null;
        if (request.IngredientId.HasValue)
        {
            ingredient = await _appDb.Ingredients.FirstOrDefaultAsync(x => x.Id == request.IngredientId.Value);
            if (ingredient == null)
                return BadRequest(ApiProblems.Validation("INGREDIENT_NOT_FOUND", "Secilen malzeme bulunamadi."));
        }

        var title = string.IsNullOrWhiteSpace(request.Title)
            ? ingredient?.CanonicalName
            : request.Title.Trim();

        if (string.IsNullOrWhiteSpace(title))
            return BadRequest(ApiProblems.Validation("TITLE_REQUIRED", "Liste maddesi basligi gereklidir."));

        await UpsertManualItemAsync(identity.Value.clientId, ingredient, title!, request.Quantity, request.Unit, request.Note);
        return Ok(await BuildResponseAsync(identity.Value.clientId));
    }

    [HttpPost("ingredients")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> AddIngredients([FromBody] AddShoppingListIngredientsRequest request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var ingredientIds = (request.IngredientIds ?? Array.Empty<Guid>())
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList();

        if (ingredientIds.Count == 0)
            return BadRequest(ApiProblems.Validation("NO_INGREDIENTS", "Listeye eklenecek malzeme bulunamadi."));

        var ingredients = await _appDb.Ingredients
            .Where(x => ingredientIds.Contains(x.Id))
            .ToListAsync();

        if (ingredients.Count != ingredientIds.Count)
            return BadRequest(ApiProblems.Validation("INGREDIENT_NOT_FOUND", "Listeye eklenen malzemelerden biri bulunamadi."));

        await UpsertIngredientSuggestionsAsync(
            identity.Value.clientId,
            ingredients,
            string.IsNullOrWhiteSpace(request.SourceType) ? "Kitchen" : request.SourceType.Trim(),
            request.SourceReferenceId,
            request.Note);

        return Ok(await BuildResponseAsync(identity.Value.clientId));
    }

    [HttpPost("generate/today-plan")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> GenerateFromTodayPlan()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var (today, tomorrow) = AppTime.ToStoredDayRange(AppTime.LocalToday);
        var plan = await _appDb.MealPlans
            .AsNoTracking()
            .Where(x => x.ClientId == identity.Value.clientId
                && x.Date >= today
                && x.Date < tomorrow
                && x.Status == MealPlanStatus.Published)
            .Include(x => x.Items)
                .ThenInclude(x => x.Recipe)
                    .ThenInclude(x => x!.MandatoryIngredients)
            .FirstOrDefaultAsync();

        if (plan == null)
            return Ok(new
            {
                response = await BuildResponseAsync(identity.Value.clientId),
                generation = new
                {
                    status = "empty",
                    generatedCount = 0,
                    planDate = AppTime.LocalToday.ToString("yyyy-MM-dd"),
                    message = "Bugün için yayınlanmış plan bulunamadı."
                }
            });

        var missingIngredients = await GetMissingMandatoryIngredientsAsync(
            identity.Value.clientId,
            plan.Items.Where(x => x.Recipe != null).Select(x => x.Recipe!).ToList());

        await UpsertIngredientSuggestionsAsync(
            identity.Value.clientId,
            missingIngredients,
            "TodayPlan",
            plan.Id.ToString(),
            "AI, bugünün planındaki tariflerden eksik malzemeleri topladı.");

        return Ok(new
        {
            response = await BuildResponseAsync(identity.Value.clientId),
            generation = new
            {
                status = "generated",
                generatedCount = missingIngredients.Count,
                planDate = AppTime.LocalToday.ToString("yyyy-MM-dd"),
                recipeCount = plan.Items.Count(x => x.RecipeId.HasValue),
                message = missingIngredients.Count == 0
                    ? "AI kontrol etti, bugünün planı için eksik zorunlu malzeme görünmüyor."
                    : $"AI, bugünün planından {missingIngredients.Count} eksik malzeme çıkardı."
            }
        });
    }

    [HttpPost("generate/recipe/{recipeId:guid}")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> GenerateFromRecipe(Guid recipeId)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var recipe = await LoadAccessibleRecipeAsync(identity.Value.userId, recipeId);
        if (recipe == null)
            return NotFound(ApiProblems.NotFound("RECIPE_NOT_FOUND", "Tarif bulunamadi."));

        var missingIngredients = await GetMissingMandatoryIngredientsAsync(
            identity.Value.clientId,
            new List<Recipe> { recipe });

        await UpsertIngredientSuggestionsAsync(
            identity.Value.clientId,
            missingIngredients,
            "Recipe",
            recipe.Id.ToString(),
            $"Generated from recipe: {recipe.Name}");

        return Ok(await BuildResponseAsync(identity.Value.clientId));
    }

    [HttpPatch("{itemId:guid}/toggle")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> Toggle(Guid itemId, [FromBody] ToggleShoppingListItemRequest? request)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var item = await _appDb.ClientShoppingListItems
            .FirstOrDefaultAsync(x => x.Id == itemId && x.ClientId == identity.Value.clientId);

        if (item == null)
            return NotFound(ApiProblems.NotFound("SHOPPING_ITEM_NOT_FOUND", "Liste maddesi bulunamadi."));

        item.SetChecked(request?.IsChecked ?? !item.IsChecked);
        await _appDb.SaveChangesAsync();
        return Ok(await BuildResponseAsync(identity.Value.clientId));
    }

    [HttpDelete("{itemId:guid}")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> Delete(Guid itemId)
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var item = await _appDb.ClientShoppingListItems
            .FirstOrDefaultAsync(x => x.Id == itemId && x.ClientId == identity.Value.clientId);

        if (item == null)
            return NotFound(ApiProblems.NotFound("SHOPPING_ITEM_NOT_FOUND", "Liste maddesi bulunamadi."));

        _appDb.ClientShoppingListItems.Remove(item);
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("checked")]
    [EnableRateLimiting("profile-write")]
    public async Task<IActionResult> ClearChecked()
    {
        var identity = await _identityResolver.ResolveClientAsync(User);
        if (!identity.HasValue)
            return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabi bulunamadi."));

        var checkedItems = await _appDb.ClientShoppingListItems
            .Where(x => x.ClientId == identity.Value.clientId && x.IsChecked)
            .ToListAsync();

        _appDb.ClientShoppingListItems.RemoveRange(checkedItems);
        await _appDb.SaveChangesAsync();
        return Ok(await BuildResponseAsync(identity.Value.clientId));
    }

    private async Task<object> BuildResponseAsync(Guid clientId)
    {
        var items = await _appDb.ClientShoppingListItems
            .AsNoTracking()
            .Where(x => x.ClientId == clientId)
            .Include(x => x.Ingredient)
            .OrderBy(x => x.IsChecked)
            .ThenByDescending(x => x.UpdatedAtUtc)
            .Select(x => new
            {
                id = x.Id,
                ingredientId = x.IngredientId,
                title = x.Title,
                quantity = x.Quantity,
                unit = x.Unit,
                isChecked = x.IsChecked,
                sourceType = x.SourceType,
                sourceReferenceId = x.SourceReferenceId,
                note = x.Note,
                createdAtUtc = x.CreatedAtUtc,
                updatedAtUtc = x.UpdatedAtUtc,
                ingredientName = x.Ingredient != null ? x.Ingredient.CanonicalName : null
            })
            .ToListAsync();

        return new
        {
            items,
            summary = new
            {
                total = items.Count,
                checkedCount = items.Count(x => x.isChecked),
                activeCount = items.Count(x => !x.isChecked)
            }
        };
    }

    private async Task UpsertManualItemAsync(
        Guid clientId,
        Ingredient? ingredient,
        string title,
        decimal? quantity,
        string? unit,
        string? note)
    {
        var current = ingredient == null
            ? null
            : await _appDb.ClientShoppingListItems
                .FirstOrDefaultAsync(x => x.ClientId == clientId && x.IngredientId == ingredient.Id);

        if (current == null)
        {
            _appDb.ClientShoppingListItems.Add(new ClientShoppingListItem(
                clientId,
                ingredient?.Id,
                title,
                quantity,
                unit,
                "Manual",
                null,
                note));
        }
        else
        {
            current.RefreshFromSuggestion(title, quantity, unit, "Manual", null, note);
        }

        await _appDb.SaveChangesAsync();
    }

    private async Task UpsertIngredientSuggestionsAsync(
        Guid clientId,
        IReadOnlyCollection<Ingredient> ingredients,
        string sourceType,
        string? sourceReferenceId,
        string? note)
    {
        if (ingredients.Count == 0)
            return;

        var ingredientIds = ingredients.Select(x => x.Id).ToList();
        var existing = await _appDb.ClientShoppingListItems
            .Where(x => x.ClientId == clientId && x.IngredientId.HasValue && ingredientIds.Contains(x.IngredientId.Value))
            .ToListAsync();

        foreach (var ingredient in ingredients)
        {
            var current = existing.FirstOrDefault(x => x.IngredientId == ingredient.Id);
            if (current == null)
            {
                _appDb.ClientShoppingListItems.Add(new ClientShoppingListItem(
                    clientId,
                    ingredient.Id,
                    ingredient.CanonicalName,
                    null,
                    null,
                    sourceType,
                    sourceReferenceId,
                    note));
                continue;
            }

            current.RefreshFromSuggestion(
                ingredient.CanonicalName,
                current.Quantity,
                current.Unit,
                sourceType,
                sourceReferenceId,
                note);
        }

        await _appDb.SaveChangesAsync();
    }

    private async Task<List<Ingredient>> GetMissingMandatoryIngredientsAsync(Guid clientId, IReadOnlyCollection<Recipe> recipes)
    {
        if (recipes.Count == 0)
            return new List<Ingredient>();

        var pantryIds = (await _appDb.ClientPantryItems
            .Where(x => x.ClientId == clientId)
            .Select(x => x.IngredientId)
            .ToListAsync())
            .ToHashSet();

        var missingFromNavigation = recipes
            .SelectMany(x => x.MandatoryIngredients)
            .GroupBy(x => x.Id)
            .Select(x => x.First())
            .Where(x => !pantryIds.Contains(x.Id))
            .ToList();

        if (missingFromNavigation.Count > 0)
        {
            return missingFromNavigation;
        }

        var recipeIds = recipes.Select(x => x.Id).ToList();
        var explicitMandatoryIngredients = await _appDb.RecipeIngredients
            .AsNoTracking()
            .Where(x => recipeIds.Contains(x.RecipeId) && x.Role == "Mandatory")
            .Include(x => x.Ingredient)
            .Select(x => x.Ingredient)
            .ToListAsync();

        return explicitMandatoryIngredients
            .GroupBy(x => x.Id)
            .Select(x => x.First())
            .Where(x => !pantryIds.Contains(x.Id))
            .ToList();
    }

    private async Task<Recipe?> LoadAccessibleRecipeAsync(Guid userId, Guid recipeId)
    {
        var premium = await _premiumStatusService.GetPremiumStatusAsync(userId, CancellationToken.None);

        var query = _appDb.Recipes
            .AsNoTracking()
            .Where(x => x.Id == recipeId)
            .Where(x => !x.IsDemo && !x.IsDraft && !x.IsHiddenFromProduction)
            .Include(x => x.MandatoryIngredients);

        if (!premium.IsPremium)
            return await query.FirstOrDefaultAsync(x => x.IsPublic);

        return await query.FirstOrDefaultAsync(x => x.IsPublic || x.DietitianId == premium.ActiveDietitianId);
    }
}

public sealed record CreateShoppingListItemRequest(
    string? Title,
    Guid? IngredientId,
    decimal? Quantity,
    string? Unit,
    string? Note);

public sealed record AddShoppingListIngredientsRequest(
    IReadOnlyList<Guid> IngredientIds,
    string? SourceType,
    string? SourceReferenceId,
    string? Note);

public sealed record ToggleShoppingListItemRequest(bool IsChecked);
