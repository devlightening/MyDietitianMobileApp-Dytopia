using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
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
            .Include(x => x.Items)
                .ThenInclude(x => x.Recipe)
                    .ThenInclude(x => x!.OptionalIngredients)
            .Include(x => x.Items)
                .ThenInclude(x => x.SelectedRecipe)
                    .ThenInclude(x => x!.MandatoryIngredients)
            .Include(x => x.Items)
                .ThenInclude(x => x.SelectedRecipe)
                    .ThenInclude(x => x!.OptionalIngredients)
            .FirstOrDefaultAsync();

        if (plan == null)
        {
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
        }

        var suggestions = await BuildTodayPlanSuggestionsAsync(identity.Value.clientId, plan);
        var recipeCards = await BuildTodayPlanRecipeCardsAsync(identity.Value.clientId, plan);
        await SyncTodayPlanSuggestionsAsync(identity.Value.clientId, plan.Id, suggestions);

        var uniqueIngredientGroups = suggestions
            .GroupBy(x => x.IngredientId)
            .ToList();
        var missingByCategory = BuildCategoryCountsFromSuggestions(suggestions);
        var coveredByCategory = BuildCategoryCountsFromCards(recipeCards, covered: true);

        return Ok(new
        {
            response = await BuildResponseAsync(identity.Value.clientId),
            generation = new
            {
                status = "generated",
                generatedCount = uniqueIngredientGroups.Count,
                planDate = AppTime.LocalToday.ToString("yyyy-MM-dd"),
                recipeCount = plan.Items
                    .Select(GetEffectiveRecipeId)
                    .Where(x => x.HasValue)
                    .Select(x => x!.Value)
                    .Distinct()
                    .Count(),
                mealCount = plan.Items.Count(x => GetEffectiveRecipeId(x).HasValue),
                mandatoryCount = uniqueIngredientGroups.Count(g => g.Any(x => x.Category == IngredientCategoryKeys.Mandatory)),
                optionalCount = uniqueIngredientGroups.Count(g => g.Any(x => x.Category == IngredientCategoryKeys.Optional)),
                flavoringCount = uniqueIngredientGroups.Count(g => g.Any(x => x.Category == IngredientCategoryKeys.Flavoring)),
                pantryCoveredCount = recipeCards.Sum(x => x.PantryCoveredCount),
                missingByCategory,
                coveredByCategory,
                recipeCards,
                message = uniqueIngredientGroups.Count == 0
                    ? "AI kontrol etti, bugünün planı için eksik malzeme görünmüyor."
                    : $"AI, bugünün planından {uniqueIngredientGroups.Count} eksik malzeme çıkardı."
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
        var rawItems = await _appDb.ClientShoppingListItems
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
                sourceMealsJson = x.SourceMealsJson,
                ingredientRoleSummaryJson = x.IngredientRoleSummaryJson,
                primaryMealTitle = x.PrimaryMealTitle,
                primaryMealTime = x.PrimaryMealTime,
                generatedFromSelectedRecipe = x.GeneratedFromSelectedRecipe,
                note = x.Note,
                createdAtUtc = x.CreatedAtUtc,
                updatedAtUtc = x.UpdatedAtUtc,
                ingredientName = x.Ingredient != null ? x.Ingredient.CanonicalName : null
            })
            .ToListAsync();

        var items = rawItems.Select(x => new
        {
            id = x.id,
            ingredientId = x.ingredientId,
            title = x.title,
            quantity = x.quantity,
            unit = x.unit,
            isChecked = x.isChecked,
            sourceType = x.sourceType,
            sourceReferenceId = x.sourceReferenceId,
            note = x.note,
            createdAtUtc = x.createdAtUtc,
            updatedAtUtc = x.updatedAtUtc,
            ingredientName = x.ingredientName,
            sourceMeals = DeserializeOrDefault<List<ShoppingSourceMealDto>>(x.sourceMealsJson) ?? new List<ShoppingSourceMealDto>(),
            primaryMealTitle = x.primaryMealTitle,
            primaryMealTime = x.primaryMealTime,
            ingredientRoleSummary = DeserializeOrDefault<List<string>>(x.ingredientRoleSummaryJson) ?? new List<string>(),
            generatedFromSelectedRecipe = x.generatedFromSelectedRecipe
        }).ToList();

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

    private async Task SyncTodayPlanSuggestionsAsync(
        Guid clientId,
        Guid planId,
        IReadOnlyCollection<ShoppingIngredientSuggestion> suggestions)
    {
        var sourceReferenceId = planId.ToString();
        var groupedSuggestions = suggestions
            .GroupBy(x => x.IngredientId)
            .ToList();
        var ingredientIds = groupedSuggestions.Select(x => x.Key).ToHashSet();

        var existing = await _appDb.ClientShoppingListItems
            .Where(x => x.ClientId == clientId
                && ((x.IngredientId.HasValue && ingredientIds.Contains(x.IngredientId.Value))
                    || (x.SourceType == "TodayPlan" && x.SourceReferenceId == sourceReferenceId)))
            .ToListAsync();

        var staleItems = existing
            .Where(x => x.SourceType == "TodayPlan"
                && x.SourceReferenceId == sourceReferenceId
                && x.IngredientId.HasValue
                && !ingredientIds.Contains(x.IngredientId.Value))
            .ToList();

        if (staleItems.Count > 0)
        {
            _appDb.ClientShoppingListItems.RemoveRange(staleItems);
        }

        foreach (var group in groupedSuggestions)
        {
            var first = group.First();
            var sourceMeals = group
                .Select(x => new ShoppingSourceMealDto(
                    x.MealItemId,
                    x.MealTitle,
                    x.MealTime,
                    x.Category,
                    x.SelectedRecipeName,
                    x.GeneratedFromSelectedRecipe))
                .Distinct()
                .OrderBy(x => x.MealTime)
                .ThenBy(x => x.MealTitle)
                .ToList();
            var ingredientRoleSummary = group
                .Select(x => x.Category)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(GetCategorySortOrder)
                .ToList();
            var primaryMeal = sourceMeals.FirstOrDefault();
            var generatedFromSelectedRecipe = group.Any(x => x.GeneratedFromSelectedRecipe);
            var note = BuildTodayPlanNote(sourceMeals, ingredientRoleSummary);

            var current = existing.FirstOrDefault(x => x.IngredientId == group.Key);
            if (current == null)
            {
                _appDb.ClientShoppingListItems.Add(new ClientShoppingListItem(
                    clientId,
                    group.Key,
                    first.IngredientName,
                    null,
                    null,
                    "TodayPlan",
                    sourceReferenceId,
                    note,
                    JsonSerializer.Serialize(sourceMeals),
                    JsonSerializer.Serialize(ingredientRoleSummary),
                    primaryMeal?.MealTitle,
                    primaryMeal?.MealTime,
                    generatedFromSelectedRecipe));
                continue;
            }

            current.RefreshFromSuggestion(
                first.IngredientName,
                current.Quantity,
                current.Unit,
                "TodayPlan",
                sourceReferenceId,
                note,
                JsonSerializer.Serialize(sourceMeals),
                JsonSerializer.Serialize(ingredientRoleSummary),
                primaryMeal?.MealTitle,
                primaryMeal?.MealTime,
                generatedFromSelectedRecipe);
        }

        await _appDb.SaveChangesAsync();
    }

    private async Task<List<ShoppingIngredientSuggestion>> BuildTodayPlanSuggestionsAsync(Guid clientId, MealPlan plan)
    {
        var recipeIds = plan.Items
            .Select(GetEffectiveRecipeId)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        var pantryIds = (await _appDb.ClientPantryItems
            .Where(x => x.ClientId == clientId)
            .Select(x => x.IngredientId)
            .ToListAsync())
            .ToHashSet();

        var explicitRows = await _appDb.RecipeIngredients
            .AsNoTracking()
            .Where(x => recipeIds.Contains(x.RecipeId))
            .Include(x => x.Ingredient)
            .Where(x => x.Ingredient != null)
            .ToListAsync();

        var explicitLookup = explicitRows
            .GroupBy(x => x.RecipeId)
            .ToDictionary(
                g => g.Key,
                g => new ExplicitRecipeIngredientLookup(
                    g.Where(x => x.Role == RecipeIngredient.MandatoryRole).Select(x => x.Ingredient!).DistinctBy(x => x.Id).ToList(),
                    g.Where(x => x.Role == RecipeIngredient.OptionalRole).Select(x => x.Ingredient!).DistinctBy(x => x.Id).ToList(),
                    g.Where(x => x.Role == RecipeIngredient.FlavoringRole).Select(x => x.Ingredient!).DistinctBy(x => x.Id).ToList()));

        var suggestions = new List<ShoppingIngredientSuggestion>();
        foreach (var mealItem in plan.Items.OrderBy(x => x.Time))
        {
            var selectedRecipeId = GetEffectiveRecipeId(mealItem);
            if (!selectedRecipeId.HasValue)
                continue;

            var recipe = ResolveEffectiveRecipe(mealItem);
            if (recipe == null)
                continue;

            explicitLookup.TryGetValue(selectedRecipeId.Value, out var explicitForRecipe);
            var ingredientGroups = BuildRecipeIngredientGroups(recipe, explicitForRecipe);
            var generatedFromSelectedRecipe = IsGeneratedFromSelectedRecipe(mealItem);
            var selectedRecipeName = generatedFromSelectedRecipe ? recipe.Name : null;
            var mealTime = AppTime.FormatTimeKey(mealItem.Time);

            foreach (var ingredient in ingredientGroups.Mandatory.Where(x => !pantryIds.Contains(x.Id)))
            {
                suggestions.Add(new ShoppingIngredientSuggestion(
                    ingredient.Id,
                    ingredient.CanonicalName,
                    IngredientCategoryKeys.Mandatory,
                    mealItem.Id,
                    mealItem.Title,
                    mealTime,
                    generatedFromSelectedRecipe,
                    selectedRecipeName));
            }

            foreach (var ingredient in ingredientGroups.Optional.Where(x => !pantryIds.Contains(x.Id)))
            {
                suggestions.Add(new ShoppingIngredientSuggestion(
                    ingredient.Id,
                    ingredient.CanonicalName,
                    IngredientCategoryKeys.Optional,
                    mealItem.Id,
                    mealItem.Title,
                    mealTime,
                    generatedFromSelectedRecipe,
                    selectedRecipeName));
            }

            foreach (var ingredient in ingredientGroups.Flavoring.Where(x => !pantryIds.Contains(x.Id)))
            {
                suggestions.Add(new ShoppingIngredientSuggestion(
                    ingredient.Id,
                    ingredient.CanonicalName,
                    IngredientCategoryKeys.Flavoring,
                    mealItem.Id,
                    mealItem.Title,
                    mealTime,
                    generatedFromSelectedRecipe,
                    selectedRecipeName));
            }
        }

        return suggestions;
    }

    private async Task<List<ShoppingPlanRecipeCardDto>> BuildTodayPlanRecipeCardsAsync(Guid clientId, MealPlan plan)
    {
        var recipeIds = plan.Items
            .Select(GetEffectiveRecipeId)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        var pantryIds = (await _appDb.ClientPantryItems
            .Where(x => x.ClientId == clientId)
            .Select(x => x.IngredientId)
            .ToListAsync())
            .ToHashSet();

        var explicitRows = await _appDb.RecipeIngredients
            .AsNoTracking()
            .Where(x => recipeIds.Contains(x.RecipeId))
            .Include(x => x.Ingredient)
            .Where(x => x.Ingredient != null)
            .ToListAsync();

        var explicitLookup = explicitRows
            .GroupBy(x => x.RecipeId)
            .ToDictionary(
                g => g.Key,
                g => new ExplicitRecipeIngredientLookup(
                    g.Where(x => x.Role == RecipeIngredient.MandatoryRole).Select(x => x.Ingredient!).DistinctBy(x => x.Id).ToList(),
                    g.Where(x => x.Role == RecipeIngredient.OptionalRole).Select(x => x.Ingredient!).DistinctBy(x => x.Id).ToList(),
                    g.Where(x => x.Role == RecipeIngredient.FlavoringRole).Select(x => x.Ingredient!).DistinctBy(x => x.Id).ToList()));

        var cards = new List<ShoppingPlanRecipeCardDto>();
        foreach (var mealItem in plan.Items.OrderBy(x => x.Time))
        {
            var selectedRecipeId = GetEffectiveRecipeId(mealItem);
            if (!selectedRecipeId.HasValue)
                continue;

            var recipe = ResolveEffectiveRecipe(mealItem);
            if (recipe == null)
                continue;

            explicitLookup.TryGetValue(selectedRecipeId.Value, out var explicitForRecipe);
            var ingredientGroups = BuildRecipeIngredientGroups(recipe, explicitForRecipe);
            var generatedFromSelectedRecipe = IsGeneratedFromSelectedRecipe(mealItem);
            var missingGroups = BuildShoppingIngredientGroups(ingredientGroups, pantryIds, missing: true);
            var coveredGroups = BuildShoppingIngredientGroups(ingredientGroups, pantryIds, missing: false);
            var missingCount = CountShoppingGroupItems(missingGroups);
            var coveredCount = CountShoppingGroupItems(coveredGroups);

            cards.Add(new ShoppingPlanRecipeCardDto(
                mealItem.Id,
                mealItem.Title,
                AppTime.FormatTimeKey(mealItem.Time),
                recipe.Id,
                recipe.Name,
                mealItem.Recipe?.Name,
                generatedFromSelectedRecipe ? "Alternative" : "Original",
                generatedFromSelectedRecipe,
                missingGroups,
                coveredGroups,
                CalculateWeightedCoveragePercent(ingredientGroups, pantryIds),
                missingCount,
                coveredCount));
        }

        return cards;
    }

    private static ShoppingIngredientGroupDto BuildShoppingIngredientGroups(
        RecipeIngredientGroups groups,
        IReadOnlySet<Guid> pantryIds,
        bool missing)
    {
        bool ShouldInclude(Ingredient ingredient)
            => missing ? !pantryIds.Contains(ingredient.Id) : pantryIds.Contains(ingredient.Id);

        return new ShoppingIngredientGroupDto(
            ToShoppingIngredients(groups.Mandatory.Where(ShouldInclude)),
            ToShoppingIngredients(groups.Optional.Where(ShouldInclude)),
            ToShoppingIngredients(groups.Flavoring.Where(ShouldInclude)));
    }

    private static List<ShoppingPlanIngredientDto> ToShoppingIngredients(IEnumerable<Ingredient> ingredients)
        => ingredients
            .DistinctBy(x => x.Id)
            .Select(x => new ShoppingPlanIngredientDto(x.Id, x.CanonicalName))
            .ToList();

    private static int CountShoppingGroupItems(ShoppingIngredientGroupDto groups)
        => groups.Mandatory.Count + groups.Optional.Count + groups.Flavoring.Count;

    private static int CalculateWeightedCoveragePercent(
        RecipeIngredientGroups groups,
        IReadOnlySet<Guid> pantryIds)
    {
        static decimal Ratio(IReadOnlyCollection<Ingredient> ingredients, IReadOnlySet<Guid> pantryIds)
            => ingredients.Count == 0 ? 1m : (decimal)ingredients.Count(x => pantryIds.Contains(x.Id)) / ingredients.Count;

        var score =
            Ratio(groups.Mandatory, pantryIds) * 70m +
            Ratio(groups.Optional, pantryIds) * 20m +
            Ratio(groups.Flavoring, pantryIds) * 10m;

        return Math.Clamp((int)Math.Round(score), 0, 100);
    }

    private static ShoppingCategoryCountsDto BuildCategoryCountsFromSuggestions(
        IReadOnlyCollection<ShoppingIngredientSuggestion> suggestions)
        => new(
            suggestions.Where(x => x.Category == IngredientCategoryKeys.Mandatory).Select(x => x.IngredientId).Distinct().Count(),
            suggestions.Where(x => x.Category == IngredientCategoryKeys.Optional).Select(x => x.IngredientId).Distinct().Count(),
            suggestions.Where(x => x.Category == IngredientCategoryKeys.Flavoring).Select(x => x.IngredientId).Distinct().Count());

    private static ShoppingCategoryCountsDto BuildCategoryCountsFromCards(
        IReadOnlyCollection<ShoppingPlanRecipeCardDto> cards,
        bool covered)
    {
        var groups = covered
            ? cards.Select(x => x.PantryCoveredGroups)
            : cards.Select(x => x.MissingGroups);

        return new ShoppingCategoryCountsDto(
            groups.SelectMany(x => x.Mandatory).Select(x => x.IngredientId).Distinct().Count(),
            groups.SelectMany(x => x.Optional).Select(x => x.IngredientId).Distinct().Count(),
            groups.SelectMany(x => x.Flavoring).Select(x => x.IngredientId).Distinct().Count());
    }

    private static Recipe? ResolveEffectiveRecipe(PlanMealItem mealItem)
    {
        if (mealItem.SelectedRecipeId.HasValue && mealItem.SelectedRecipeId == mealItem.SelectedRecipe?.Id)
            return mealItem.SelectedRecipe;

        if (mealItem.SelectedRecipeId.HasValue && mealItem.SelectedRecipeId == mealItem.RecipeId)
            return mealItem.Recipe;

        return mealItem.SelectedRecipe ?? mealItem.Recipe;
    }

    private static Guid? GetEffectiveRecipeId(PlanMealItem mealItem)
        => mealItem.SelectedRecipeId ?? mealItem.RecipeId;

    private static bool IsGeneratedFromSelectedRecipe(PlanMealItem mealItem)
        => string.Equals(mealItem.SelectedRecipeSource, "Alternative", StringComparison.OrdinalIgnoreCase)
           && mealItem.SelectedRecipeId.HasValue
           && mealItem.SelectedRecipeId != mealItem.RecipeId;

    private static RecipeIngredientGroups BuildRecipeIngredientGroups(Recipe recipe, ExplicitRecipeIngredientLookup? explicitLookup)
    {
        var explicitMandatory = explicitLookup?.Mandatory ?? new List<Ingredient>();
        var explicitOptional = explicitLookup?.Optional ?? new List<Ingredient>();
        var explicitFlavoring = explicitLookup?.Flavoring ?? new List<Ingredient>();

        var mandatory = explicitMandatory.Count > 0
            ? explicitMandatory
            : recipe.MandatoryIngredients.DistinctBy(x => x.Id).ToList();

        List<Ingredient> optional;
        List<Ingredient> flavoring;
        if (explicitOptional.Count > 0 || explicitFlavoring.Count > 0)
        {
            optional = explicitOptional;
            flavoring = explicitFlavoring;
        }
        else
        {
            flavoring = recipe.OptionalIngredients
                .Where(x => x.IsCondiment)
                .DistinctBy(x => x.Id)
                .ToList();
            optional = recipe.OptionalIngredients
                .Where(x => !x.IsCondiment)
                .DistinctBy(x => x.Id)
                .ToList();
        }

        return new RecipeIngredientGroups(mandatory, optional, flavoring);
    }

    private static string BuildTodayPlanNote(
        IReadOnlyCollection<ShoppingSourceMealDto> sourceMeals,
        IReadOnlyCollection<string> ingredientRoleSummary)
    {
        var primaryMeal = sourceMeals.FirstOrDefault();
        if (primaryMeal == null)
            return "Bugünün planından üretildi.";

        var extraMeals = Math.Max(0, sourceMeals.Select(x => x.MealItemId).Distinct().Count() - 1);
        var roleSummary = string.Join(", ", ingredientRoleSummary.Select(ToRoleDisplayName));
        return extraMeals > 0
            ? $"{primaryMeal.MealTitle} için {roleSummary}. +{extraMeals} öğünde daha kullanılıyor."
            : $"{primaryMeal.MealTitle} için {roleSummary}.";
    }

    private static string ToRoleDisplayName(string category)
        => category switch
        {
            IngredientCategoryKeys.Mandatory => "zorunlu",
            IngredientCategoryKeys.Optional => "opsiyonel",
            IngredientCategoryKeys.Flavoring => "lezzetlendirici",
            _ => category
        };

    private static int GetCategorySortOrder(string category)
        => category switch
        {
            IngredientCategoryKeys.Mandatory => 0,
            IngredientCategoryKeys.Optional => 1,
            IngredientCategoryKeys.Flavoring => 2,
            _ => 99
        };

    private static T? DeserializeOrDefault<T>(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return default;

        try
        {
            return JsonSerializer.Deserialize<T>(value);
        }
        catch
        {
            return default;
        }
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
            return missingFromNavigation;

        var recipeIds = recipes.Select(x => x.Id).ToList();
        var explicitMandatoryIngredients = await _appDb.RecipeIngredients
            .AsNoTracking()
            .Where(x => recipeIds.Contains(x.RecipeId) && x.Role == RecipeIngredient.MandatoryRole)
            .Include(x => x.Ingredient)
            .Select(x => x.Ingredient)
            .ToListAsync();

        return explicitMandatoryIngredients
            .Where(x => x != null)
            .Select(x => x!)
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

internal sealed record ShoppingIngredientSuggestion(
    Guid IngredientId,
    string IngredientName,
    string Category,
    Guid MealItemId,
    string MealTitle,
    string MealTime,
    bool GeneratedFromSelectedRecipe,
    string? SelectedRecipeName);

internal sealed record ShoppingSourceMealDto(
    Guid MealItemId,
    string MealTitle,
    string MealTime,
    string Category,
    string? SelectedRecipeName,
    bool GeneratedFromSelectedRecipe);

internal sealed record ShoppingPlanIngredientDto(
    Guid IngredientId,
    string IngredientName);

internal sealed record ShoppingIngredientGroupDto(
    List<ShoppingPlanIngredientDto> Mandatory,
    List<ShoppingPlanIngredientDto> Optional,
    List<ShoppingPlanIngredientDto> Flavoring);

internal sealed record ShoppingCategoryCountsDto(
    int Mandatory,
    int Optional,
    int Flavoring);

internal sealed record ShoppingPlanRecipeCardDto(
    Guid MealItemId,
    string MealTitle,
    string MealTime,
    Guid RecipeId,
    string RecipeName,
    string? PlannedRecipeName,
    string SelectedRecipeSource,
    bool GeneratedFromSelectedRecipe,
    ShoppingIngredientGroupDto MissingGroups,
    ShoppingIngredientGroupDto PantryCoveredGroups,
    int CoveragePercent,
    int MissingCount,
    int PantryCoveredCount);

internal sealed record ExplicitRecipeIngredientLookup(
    List<Ingredient> Mandatory,
    List<Ingredient> Optional,
    List<Ingredient> Flavoring);

internal sealed record RecipeIngredientGroups(
    List<Ingredient> Mandatory,
    List<Ingredient> Optional,
    List<Ingredient> Flavoring);

internal static class IngredientCategoryKeys
{
    public const string Mandatory = "Mandatory";
    public const string Optional = "Optional";
    public const string Flavoring = "Flavoring";
}
