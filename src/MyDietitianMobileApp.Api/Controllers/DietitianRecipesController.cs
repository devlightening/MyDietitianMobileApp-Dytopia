using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/dietitian/recipes")]
public class DietitianRecipesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly RecipeMatchService _matchService;
    private readonly ILogger<DietitianRecipesController> _logger;
    private static readonly HashSet<string> AllowedRecipeUnits = new(StringComparer.OrdinalIgnoreCase)
    {
        "g",
        "kg",
        "mg",
        "ml",
        "L",
        "adet",
        "dilim",
        "bardak",
        "su bardağı",
        "çay bardağı",
        "yemek kaşığı",
        "tatlı kaşığı",
        "çay kaşığı",
        "kase",
        "avuç",
        "tutam",
        "paket",
        "porsiyon",
        "demet"
    };

    public DietitianRecipesController(
        AppDbContext appDb,
        AuthDbContext authDb,
        RecipeMatchService matchService,
        ILogger<DietitianRecipesController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _matchService = matchService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetRecipes(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? visibility = null,
        [FromQuery] string? tag = null,
        [FromQuery] string? q = null,
        [FromQuery] string? source = "all",
        [FromQuery] string? status = "active",
        [FromQuery] string? range = "30d")
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 200);

        var recipes = await LoadAccessibleRecipesAsync(dietitianId.Value, source, status, visibility, q);
        var ingredientBuckets = await BuildRecipeIngredientBucketsMapAsync(recipes);
        if (!string.IsNullOrWhiteSpace(tag))
        {
            recipes = recipes
                .Where(recipe => recipe.Tags.Any(recipeTag =>
                    string.Equals(recipeTag, tag.Trim(), StringComparison.OrdinalIgnoreCase)))
                .ToList();
        }

        var favoriteIds = await GetFavoriteRecipeIdsAsync(dietitianId.Value);
        var analyticsMap = await BuildRecipeAnalyticsMapAsync(
            dietitianId.Value,
            recipes.Select(recipe => recipe.Id).ToHashSet(),
            range);
        var activePlanCounts = await GetActivePlanCountsAsync(dietitianId.Value, recipes.Select(recipe => recipe.Id).ToHashSet());

        var items = recipes
            .Select(recipe => MapRecipeListItem(
                recipe,
                dietitianId.Value,
                favoriteIds.Contains(recipe.Id),
                analyticsMap.GetValueOrDefault(recipe.Id) ?? RecipeAnalyticsAggregate.Empty(recipe.Id),
                activePlanCounts.GetValueOrDefault(recipe.Id),
                ingredientBuckets.GetValueOrDefault(recipe.Id) ?? RecipeIngredientBuckets.FromRecipe(recipe)))
            .OrderByDescending(item => item.IsFavorited)
            .ThenBy(item => item.IsArchived)
            .ThenByDescending(item => item.AnalyticsPreview.PreferenceScore)
            .ThenBy(item => item.Name)
            .ToList();

        var total = items.Count;
        var pagedItems = items
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return Ok(new
        {
            items = pagedItems,
            total,
            page,
            pageSize
        });
    }

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview([FromQuery] string? range = "30d")
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var recipes = await LoadAccessibleRecipesAsync(dietitianId.Value, "clinic", "all", null, null);
        var ingredientBuckets = await BuildRecipeIngredientBucketsMapAsync(recipes);
        var favoriteIds = await GetFavoriteRecipeIdsAsync(dietitianId.Value);
        var analyticsMap = await BuildRecipeAnalyticsMapAsync(
            dietitianId.Value,
            recipes.Select(recipe => recipe.Id).ToHashSet(),
            range);
        var activePlanCounts = await GetActivePlanCountsAsync(dietitianId.Value, recipes.Select(recipe => recipe.Id).ToHashSet());

        var items = recipes
            .Select(recipe => MapRecipeListItem(
                recipe,
                dietitianId.Value,
                favoriteIds.Contains(recipe.Id),
                analyticsMap.GetValueOrDefault(recipe.Id) ?? RecipeAnalyticsAggregate.Empty(recipe.Id),
                activePlanCounts.GetValueOrDefault(recipe.Id),
                ingredientBuckets.GetValueOrDefault(recipe.Id) ?? RecipeIngredientBuckets.FromRecipe(recipe)))
            .ToList();

        var activeItems = items.Where(item => !item.IsArchived).ToList();

        return Ok(new RecipeOverviewDto(
            Summary: new RecipeOverviewSummaryDto(
                TotalRecipes: activeItems.Count,
                ArchivedRecipes: items.Count(item => item.IsArchived),
                FavoriteRecipes: activeItems.Count(item => item.IsFavorited),
                ActivePlanRecipes: activeItems.Count(item => item.IsActiveInPlans)),
            Favorites: activeItems.Where(item => item.IsFavorited)
                .OrderByDescending(item => item.AnalyticsPreview.PreferenceScore)
                .ThenByDescending(item => item.AnalyticsPreview.AssignmentCount)
                .Take(6).ToList(),
            MostCompleted: activeItems.Where(item => item.AnalyticsPreview.AssignmentCount >= 3)
                .OrderByDescending(item => item.AnalyticsPreview.PlannedCompletionCount)
                .ThenByDescending(item => item.AnalyticsPreview.PlannedCompletionRate)
                .Take(6).ToList(),
            MostPreferred: activeItems.Where(item => item.AnalyticsPreview.AssignmentCount >= 3)
                .OrderByDescending(item => item.AnalyticsPreview.PreferenceScore)
                .ThenByDescending(item => item.AnalyticsPreview.AlternativeSelectedCount)
                .Take(6).ToList(),
            Rising: activeItems.Where(item => item.AnalyticsPreview.RecentTrendDelta > 0)
                .OrderByDescending(item => item.AnalyticsPreview.RecentTrendDelta)
                .ThenByDescending(item => item.AnalyticsPreview.PreferenceScore)
                .Take(6).ToList()));
    }

    [HttpGet("popular")]
    public async Task<IActionResult> GetPopularRecipes([FromQuery] string range = "week")
    {
        var normalizedRange = range.ToLowerInvariant() switch
        {
            "week" => "7d",
            "month" => "30d",
            _ => "all"
        };

        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var recipes = await LoadAccessibleRecipesAsync(dietitianId.Value, "clinic", "active", null, null);
        var analyticsMap = await BuildRecipeAnalyticsMapAsync(
            dietitianId.Value,
            recipes.Select(recipe => recipe.Id).ToHashSet(),
            normalizedRange);

        var items = recipes
            .Select(recipe =>
            {
                var analytics = analyticsMap.GetValueOrDefault(recipe.Id) ?? RecipeAnalyticsAggregate.Empty(recipe.Id);
                return new PopularRecipeDto(recipe.Id, recipe.Name, analytics.PlannedCompletionCount);
            })
            .OrderByDescending(item => item.CompletionCount)
            .Take(10)
            .ToList();

        return Ok(new { items });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetRecipe(Guid id, [FromQuery] string? range = "30d")
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var recipe = await LoadRecipeByIdAsync(dietitianId.Value, id);
        if (recipe == null)
            return NotFound(new { message = "Tarif bulunamadı veya erişim izniniz yok." });

        var analyticsMap = await BuildRecipeAnalyticsMapAsync(dietitianId.Value, new HashSet<Guid> { recipe.Id }, range);
        var favoriteIds = await GetFavoriteRecipeIdsAsync(dietitianId.Value);
        var activePlanCounts = await GetActivePlanCountsAsync(dietitianId.Value, new HashSet<Guid> { recipe.Id });
        var deleteMode = await ResolveDeleteModeAsync(dietitianId.Value, recipe);

        return Ok(MapRecipeDetailDto(
            recipe,
            dietitianId.Value,
            favoriteIds.Contains(recipe.Id),
            analyticsMap.GetValueOrDefault(recipe.Id) ?? RecipeAnalyticsAggregate.Empty(recipe.Id),
            activePlanCounts.GetValueOrDefault(recipe.Id),
            deleteMode,
            (await BuildRecipeIngredientBucketsMapAsync(new[] { recipe })).GetValueOrDefault(recipe.Id) ?? RecipeIngredientBuckets.FromRecipe(recipe)));
    }

    [HttpGet("slug/{slug}")]
    public async Task<IActionResult> GetRecipeBySlug(string slug, [FromQuery] string? range = "30d")
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        if (string.IsNullOrWhiteSpace(slug))
            return NotFound(new { message = "Tarif bulunamadı veya erişim izniniz yok." });

        var recipe = await LoadRecipeBySlugAsync(dietitianId.Value, slug.Trim());
        if (recipe == null)
            return NotFound(new { message = "Tarif bulunamadı veya erişim izniniz yok." });

        var analyticsMap = await BuildRecipeAnalyticsMapAsync(dietitianId.Value, new HashSet<Guid> { recipe.Id }, range);
        var favoriteIds = await GetFavoriteRecipeIdsAsync(dietitianId.Value);
        var activePlanCounts = await GetActivePlanCountsAsync(dietitianId.Value, new HashSet<Guid> { recipe.Id });
        var deleteMode = await ResolveDeleteModeAsync(dietitianId.Value, recipe);

        return Ok(MapRecipeDetailDto(
            recipe,
            dietitianId.Value,
            favoriteIds.Contains(recipe.Id),
            analyticsMap.GetValueOrDefault(recipe.Id) ?? RecipeAnalyticsAggregate.Empty(recipe.Id),
            activePlanCounts.GetValueOrDefault(recipe.Id),
            deleteMode,
            (await BuildRecipeIngredientBucketsMapAsync(new[] { recipe })).GetValueOrDefault(recipe.Id) ?? RecipeIngredientBuckets.FromRecipe(recipe)));
    }

    [HttpGet("{id:guid}/analytics")]
    public async Task<IActionResult> GetRecipeAnalytics(Guid id, [FromQuery] string? range = "30d")
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var recipe = await LoadRecipeByIdAsync(dietitianId.Value, id);
        if (recipe == null)
            return NotFound(new { message = "Tarif bulunamadı veya erişim izniniz yok." });

        var analyticsMap = await BuildRecipeAnalyticsMapAsync(dietitianId.Value, new HashSet<Guid> { recipe.Id }, range);
        var analytics = analyticsMap.GetValueOrDefault(recipe.Id) ?? RecipeAnalyticsAggregate.Empty(recipe.Id);
        var clientPreferences = await BuildClientPreferenceListAsync(dietitianId.Value, recipe.Id, range);

        return Ok(new RecipeAnalyticsDto(
            RecipeId: recipe.Id,
            AssignmentCount: analytics.AssignmentCount,
            PlannedCompletionCount: analytics.PlannedCompletionCount,
            PlannedCompletionRate: analytics.PlannedCompletionRate,
            AlternativeSelectedCount: analytics.AlternativeSelectedCount,
            RecommendationPickCount: analytics.RecommendationPickCount,
            UniqueClientCount: analytics.UniqueClientCount,
            LastUsedAt: analytics.LastUsedAt,
            LastCompletedAt: analytics.LastCompletedAt,
            RecentTrendDelta: analytics.RecentTrendDelta,
            PreferenceScore: analytics.PreferenceScore,
            StrengthReasons: BuildStrengthReasons(analytics),
            ClientPreferences: clientPreferences));
    }

    [HttpPost]
    public async Task<IActionResult> CreateRecipe([FromBody] SaveRecipeRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var validationError = ValidateRecipeRequest(request);
        if (validationError != null)
            return BadRequest(new { message = validationError });

        var ingredientMapResult = await ResolveIngredientMapAsync(request);
        if (!ingredientMapResult.Success)
            return BadRequest(new { message = ingredientMapResult.ErrorMessage });

        var recipe = new Recipe(Guid.NewGuid(), dietitianId.Value, request.Name.Trim(), request.Description?.Trim() ?? string.Empty, false);
        ApplyRecipeMetadata(recipe, request);

        _appDb.Recipes.Add(recipe);
        ApplyRecipeIngredients(recipe, ingredientMapResult.Value!, request);
        await SyncExplicitRecipeIngredientsAsync(recipe.Id, request);

        await _appDb.SaveChangesAsync();

        return Ok(MapRecipeDetailDto(
            recipe,
            dietitianId.Value,
            false,
            RecipeAnalyticsAggregate.Empty(recipe.Id),
            0,
            RecipeDeleteMode.Delete,
            (await BuildRecipeIngredientBucketsMapAsync(new[] { recipe })).GetValueOrDefault(recipe.Id) ?? RecipeIngredientBuckets.FromRecipe(recipe)));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateRecipe(Guid id, [FromBody] SaveRecipeRequest request)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var validationError = ValidateRecipeRequest(request);
        if (validationError != null)
            return BadRequest(new { message = validationError });

        var recipe = await _appDb.Recipes
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .FirstOrDefaultAsync(r => r.Id == id && r.DietitianId == dietitianId.Value);

        if (recipe == null)
            return NotFound(new { message = "Tarif bulunamadı veya düzenleme yetkiniz yok." });

        var ingredientMapResult = await ResolveIngredientMapAsync(request);
        if (!ingredientMapResult.Success)
            return BadRequest(new { message = ingredientMapResult.ErrorMessage });

        recipe.UpdateName(request.Name.Trim());
        recipe.UpdateDescription(request.Description?.Trim() ?? string.Empty);
        recipe.UpdateVisibility(false);
        ApplyRecipeMetadata(recipe, request);

        recipe.ClearMandatoryIngredients();
        recipe.ClearOptionalIngredients();
        recipe.ClearProhibitedIngredients();
        ApplyRecipeIngredients(recipe, ingredientMapResult.Value!, request);
        await ReplaceExplicitRecipeIngredientsAsync(recipe.Id, request);

        await _appDb.SaveChangesAsync();

        var analyticsMap = await BuildRecipeAnalyticsMapAsync(dietitianId.Value, new HashSet<Guid> { recipe.Id }, "30d");
        var favoriteIds = await GetFavoriteRecipeIdsAsync(dietitianId.Value);
        var activePlanCounts = await GetActivePlanCountsAsync(dietitianId.Value, new HashSet<Guid> { recipe.Id });
        var deleteMode = await ResolveDeleteModeAsync(dietitianId.Value, recipe);

        return Ok(MapRecipeDetailDto(
            recipe,
            dietitianId.Value,
            favoriteIds.Contains(recipe.Id),
            analyticsMap.GetValueOrDefault(recipe.Id) ?? RecipeAnalyticsAggregate.Empty(recipe.Id),
            activePlanCounts.GetValueOrDefault(recipe.Id),
            deleteMode,
            (await BuildRecipeIngredientBucketsMapAsync(new[] { recipe })).GetValueOrDefault(recipe.Id) ?? RecipeIngredientBuckets.FromRecipe(recipe)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteRecipe(Guid id)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var recipe = await _appDb.Recipes
            .FirstOrDefaultAsync(r => r.Id == id && r.DietitianId == dietitianId.Value);

        if (recipe == null)
            return NotFound(new { message = "Tarif bulunamadı veya silme yetkiniz yok." });

        var deleteMode = await ResolveDeleteModeAsync(dietitianId.Value, recipe);
        if (deleteMode == RecipeDeleteMode.Archive)
        {
            recipe.Archive();
            var favorite = await _appDb.DietitianRecipeFavorites
                .FirstOrDefaultAsync(item => item.DietitianId == dietitianId.Value && item.RecipeId == recipe.Id);
            if (favorite != null)
                _appDb.DietitianRecipeFavorites.Remove(favorite);

            await _appDb.SaveChangesAsync();
            return Ok(new { mode = "archived", message = "Tarif geçmiş kullanım kayıtları nedeniyle arşive alındı." });
        }

        var explicitIngredients = await _appDb.RecipeIngredients
            .Where(item => item.RecipeId == recipe.Id)
            .ToListAsync();
        if (explicitIngredients.Count > 0)
            _appDb.RecipeIngredients.RemoveRange(explicitIngredients);

        _appDb.Recipes.Remove(recipe);
        await _appDb.SaveChangesAsync();

        return Ok(new { mode = "deleted", message = "Tarif kalıcı olarak silindi." });
    }

    [HttpPost("{id:guid}/favorite")]
    public async Task<IActionResult> FavoriteRecipe(Guid id)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var recipe = await LoadRecipeByIdAsync(dietitianId.Value, id);
        if (recipe == null)
            return NotFound(new { message = "Tarif bulunamadı veya erişim izniniz yok." });

        if (recipe.IsArchived)
            return BadRequest(new { message = "Arşivlenen tarifler favorilere eklenemez." });

        var existing = await _appDb.DietitianRecipeFavorites
            .FirstOrDefaultAsync(item => item.DietitianId == dietitianId.Value && item.RecipeId == id);
        if (existing == null)
        {
            _appDb.DietitianRecipeFavorites.Add(new DietitianRecipeFavorite(dietitianId.Value, id));
            await _appDb.SaveChangesAsync();
        }

        return Ok(new { isFavorited = true, message = "Tarif klinik favorilerine eklendi." });
    }

    [HttpDelete("{id:guid}/favorite")]
    public async Task<IActionResult> UnfavoriteRecipe(Guid id)
    {
        var dietitianId = await GetDietitianIdAsync();
        if (!dietitianId.HasValue)
            return Forbid();

        var favorite = await _appDb.DietitianRecipeFavorites
            .FirstOrDefaultAsync(item => item.DietitianId == dietitianId.Value && item.RecipeId == id);
        if (favorite != null)
        {
            _appDb.DietitianRecipeFavorites.Remove(favorite);
            await _appDb.SaveChangesAsync();
        }

        return Ok(new { isFavorited = false, message = "Tarif klinik favorilerinden çıkarıldı." });
    }

    [HttpPost("match")]
    public async Task<IActionResult> MatchRecipes([FromBody] RecipeMatchRequest request)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user?.LinkedDietitianId == null)
            return Forbid();

        var dietitianId = user.LinkedDietitianId.Value;

        var clientProhibitedIngredients = new List<Guid>();
        if (request.ClientId.HasValue)
        {
            var link = await _appDb.DietitianClientLinks
                .FirstOrDefaultAsync(l => l.DietitianId == dietitianId &&
                                         l.ClientId == request.ClientId.Value &&
                                         l.IsActive);

            if (link == null)
                return NotFound(new { message = "Danışan bulunamadı veya size bağlı değil." });

            clientProhibitedIngredients = await _appDb.ClientProhibitedIngredients
                .Where(p => p.ClientId == request.ClientId.Value)
                .Select(p => p.IngredientId)
                .ToListAsync();
        }

        var recipePool = await _appDb.Recipes
            .Where(r => r.DietitianId == dietitianId &&
                        !r.IsArchived &&
                        !r.IsDemo &&
                        !r.IsDraft &&
                        !r.IsHiddenFromProduction)
            .Include(r => r.ProhibitedIngredients)
            .ToListAsync();

        var recipeIds = recipePool.Select(r => r.Id).ToList();

        var allRecipeIngredients = await _appDb.RecipeIngredients
            .Where(ri => recipeIds.Contains(ri.RecipeId))
            .ToListAsync();

        var matches = _matchService.MatchRecipes(
            request.BasketIngredientIds,
            clientProhibitedIngredients,
            recipePool,
            allRecipeIngredients);

        var allMissingIds = matches
            .SelectMany(m => m.MissingMandatoryIngredientIds)
            .Distinct()
            .ToList();

        var ingredientNames = await _appDb.Ingredients
            .Where(i => allMissingIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, i => i.CanonicalName);

        var response = matches.Select(m => new
        {
            recipeId = m.RecipeId,
            recipeName = m.RecipeName,
            score = m.Score,
            isFullMatch = m.IsFullMatch,
            mandatoryIngredients = new
            {
                total = m.MandatoryIngredientsCount,
                matched = m.MatchedMandatoryCount,
                missing = m.MissingMandatoryIngredientIds.Count
            },
            optionalIngredients = new
            {
                total = m.OptionalIngredientsCount,
                matched = m.MatchedOptionalCount
            },
            missingIngredients = m.MissingMandatoryIngredientIds
                .Select(missingId => new
                {
                    id = missingId,
                    name = ingredientNames.GetValueOrDefault(missingId, "Bilinmeyen")
                })
                .ToList()
        }).ToList();

        return Ok(new
        {
            clientId = request.ClientId,
            basketSize = request.BasketIngredientIds.Count,
            totalMatches = response.Count,
            fullMatches = response.Count(r => r.isFullMatch),
            matches = response
        });
    }

    private async Task<Guid?> GetDietitianIdAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId))
            return null;

        var user = await _authDb.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));

        return user?.LinkedDietitianId;
    }

    private async Task<List<Recipe>> LoadAccessibleRecipesAsync(
        Guid dietitianId,
        string? source,
        string? status,
        string? visibility,
        string? q)
    {
        var query = _appDb.Recipes
            .AsNoTracking()
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .Where(r => !r.IsDemo && !r.IsDraft && !r.IsHiddenFromProduction)
            .Where(r => r.DietitianId == dietitianId);

        var normalizedStatus = status?.Trim().ToLowerInvariant();
        if (normalizedStatus == "archived")
            query = query.Where(r => r.IsArchived);
        else if (normalizedStatus != "all")
            query = query.Where(r => !r.IsArchived);

        if (!string.IsNullOrWhiteSpace(visibility))
        {
            var normalizedVisibility = visibility.Trim().ToLowerInvariant();
            if (normalizedVisibility == "public")
                query = query.Where(r => r.IsPublic);
            else if (normalizedVisibility == "private")
                query = query.Where(r => !r.IsPublic);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var searchTerm = q.Trim();
            query = query.Where(r =>
                EF.Functions.ILike(r.Name, $"%{searchTerm}%") ||
                EF.Functions.ILike(r.Description, $"%{searchTerm}%"));
        }

        return await query
            .OrderBy(r => r.Name)
            .ToListAsync();
    }

    private async Task<Recipe?> LoadRecipeByIdAsync(Guid dietitianId, Guid recipeId)
    {
        return await _appDb.Recipes
            .AsNoTracking()
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .FirstOrDefaultAsync(r =>
                r.Id == recipeId &&
                !r.IsDemo &&
                !r.IsDraft &&
                !r.IsHiddenFromProduction &&
                r.DietitianId == dietitianId);
    }

    private async Task<Recipe?> LoadRecipeBySlugAsync(Guid dietitianId, string recipeSlug)
    {
        return await _appDb.Recipes
            .AsNoTracking()
            .Include(r => r.MandatoryIngredients)
            .Include(r => r.OptionalIngredients)
            .Include(r => r.ProhibitedIngredients)
            .FirstOrDefaultAsync(r =>
                r.Slug == recipeSlug &&
                !r.IsDemo &&
                !r.IsDraft &&
                !r.IsHiddenFromProduction &&
                r.DietitianId == dietitianId);
    }

    private async Task<HashSet<Guid>> GetFavoriteRecipeIdsAsync(Guid dietitianId)
    {
        var ids = await _appDb.DietitianRecipeFavorites
            .Where(item => item.DietitianId == dietitianId)
            .Select(item => item.RecipeId)
            .ToListAsync();

        return ids.ToHashSet();
    }

    private static List<SaveRecipeIngredientRequest> GetRecipeIngredientInputs(SaveRecipeRequest request)
    {
        if (request.Ingredients is { Count: > 0 })
        {
            return request.Ingredients
                .Select(item => item with
                {
                    Role = NormalizeRole(item.Role),
                    Unit = NormalizeUnit(item.Unit)
                })
                .ToList();
        }

        var result = new List<SaveRecipeIngredientRequest>();
        result.AddRange((request.MandatoryIngredients ?? new List<Guid>())
            .Select(id => new SaveRecipeIngredientRequest(id, RecipeIngredient.MandatoryRole, null, null)));
        result.AddRange((request.OptionalIngredients ?? new List<Guid>())
            .Select(id => new SaveRecipeIngredientRequest(id, RecipeIngredient.OptionalRole, null, null)));
        result.AddRange((request.FlavoringIngredients ?? new List<Guid>())
            .Select(id => new SaveRecipeIngredientRequest(id, RecipeIngredient.FlavoringRole, null, null)));
        result.AddRange((request.Prohibitions ?? new List<Guid>())
            .Select(id => new SaveRecipeIngredientRequest(id, RecipeIngredient.ProhibitedRole, null, null)));

        return result;
    }

    private static string NormalizeRole(string? role)
        => role?.Trim().ToLowerInvariant() switch
        {
            "mandatory" or "zorunlu" => RecipeIngredient.MandatoryRole,
            "optional" or "opsiyonel" => RecipeIngredient.OptionalRole,
            "flavoring" or "lezzetlendirici" => RecipeIngredient.FlavoringRole,
            "prohibited" or "yasak" or "yasaklı" => RecipeIngredient.ProhibitedRole,
            _ => RecipeIngredient.OptionalRole
        };

    private static string? NormalizeUnit(string? unit)
        => unit?.Trim().ToLowerInvariant() switch
        {
            null or "" => null,
            "gram" or "gr" => "g",
            "litre" or "liter" or "lt" => "L",
            var value => unit.Trim()
        };

    private static string? FormatDisplayAmount(decimal? quantity, string? unit)
    {
        if (!quantity.HasValue || string.IsNullOrWhiteSpace(unit))
            return null;

        var formatted = quantity.Value % 1 == 0
            ? quantity.Value.ToString("0")
            : quantity.Value.ToString("0.##");

        return $"{formatted} {unit.Trim()}";
    }

    private static string? ValidateRecipeRequest(SaveRecipeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length < 4)
            return "Tarif adı en az 4 karakter olmalıdır.";

        var ingredientInputs = GetRecipeIngredientInputs(request);

        if (!ingredientInputs.Any(item => item.Role == RecipeIngredient.MandatoryRole))
            return "En az 1 zorunlu malzeme seçilmelidir.";

        if (ingredientInputs.Any(item => item.IngredientId == Guid.Empty))
            return "Lütfen tüm malzemeleri seçin.";

        var allIds = ingredientInputs.Select(item => item.IngredientId).ToList();

        if (allIds.Count != allIds.Distinct().Count())
            return "Aynı malzeme birden fazla rolde kullanılamaz.";

        if (request.Ingredients is { Count: > 0 })
        {
            foreach (var input in ingredientInputs.Where(item => item.Role != RecipeIngredient.ProhibitedRole))
            {
                if (!input.Quantity.HasValue || input.Quantity.Value <= 0)
                    return "Zorunlu, opsiyonel ve lezzetlendirici malzemeler için miktar girilmelidir.";

                if (string.IsNullOrWhiteSpace(input.Unit))
                    return "Zorunlu, opsiyonel ve lezzetlendirici malzemeler için birim seçilmelidir.";

                if (!AllowedRecipeUnits.Contains(input.Unit.Trim()))
                    return $"Geçersiz birim seçildi: {input.Unit}";
            }
        }

        if (request.CaloriesKcal.HasValue && request.CaloriesKcal.Value < 0)
            return "Kalori değeri negatif olamaz.";
        if (request.ProteinGrams.HasValue && request.ProteinGrams.Value < 0)
            return "Protein değeri negatif olamaz.";
        if (request.CarbsGrams.HasValue && request.CarbsGrams.Value < 0)
            return "Karbonhidrat değeri negatif olamaz.";
        if (request.FatGrams.HasValue && request.FatGrams.Value < 0)
            return "Yağ değeri negatif olamaz.";

        return null;
    }

    private async Task<IngredientMapResult> ResolveIngredientMapAsync(SaveRecipeRequest request)
    {
        var allIngredientIds = GetRecipeIngredientInputs(request)
            .Select(item => item.IngredientId)
            .Distinct()
            .ToList();

        var ingredientMap = await _appDb.Ingredients
            .Where(ingredient => allIngredientIds.Contains(ingredient.Id) && ingredient.IsActive)
            .ToDictionaryAsync(ingredient => ingredient.Id);

        var missingIds = allIngredientIds.Except(ingredientMap.Keys).ToList();
        if (missingIds.Any())
        {
            return IngredientMapResult.Fail(
                $"Bazı malzemeler bulunamadı veya pasif durumda: {string.Join(", ", missingIds)}");
        }

        return IngredientMapResult.Ok(ingredientMap);
    }

    private static void ApplyRecipeMetadata(Recipe recipe, SaveRecipeRequest request)
    {
        recipe.SetSteps(GetInstructionSteps(request));
        recipe.SetTags(request.Tags);
        recipe.SetMetadata(request.PrepTimeMinutes, request.CookTimeMinutes, request.Servings);
        recipe.SetNutrition(request.CaloriesKcal, request.ProteinGrams, request.CarbsGrams, request.FatGrams);
    }

    private static List<string> GetInstructionSteps(SaveRecipeRequest request) =>
        (request.Steps ?? request.Instructions ?? new List<string>())
            .Where(step => !string.IsNullOrWhiteSpace(step))
            .Select(step => step.Trim())
            .ToList();

    private static void ApplyRecipeIngredients(
        Recipe recipe,
        IReadOnlyDictionary<Guid, Ingredient> ingredientMap,
        SaveRecipeRequest request)
    {
        var ingredientInputs = GetRecipeIngredientInputs(request);

        foreach (var ingredientId in ingredientInputs.Where(item => item.Role == RecipeIngredient.MandatoryRole).Select(item => item.IngredientId).Distinct())
            recipe.AddMandatoryIngredient(ingredientMap[ingredientId]);

        foreach (var ingredientId in ingredientInputs.Where(item => item.Role == RecipeIngredient.OptionalRole).Select(item => item.IngredientId).Distinct())
            recipe.AddOptionalIngredient(ingredientMap[ingredientId]);
        foreach (var ingredientId in ingredientInputs.Where(item => item.Role == RecipeIngredient.FlavoringRole).Select(item => item.IngredientId).Distinct())
            recipe.AddOptionalIngredient(ingredientMap[ingredientId]);

        foreach (var ingredientId in ingredientInputs.Where(item => item.Role == RecipeIngredient.ProhibitedRole).Select(item => item.IngredientId).Distinct())
            recipe.AddProhibitedIngredient(ingredientMap[ingredientId]);
    }

    private async Task SyncExplicitRecipeIngredientsAsync(Guid recipeId, SaveRecipeRequest request)
    {
        foreach (var input in GetRecipeIngredientInputs(request))
        {
            _appDb.RecipeIngredients.Add(new RecipeIngredient(
                recipeId,
                input.IngredientId,
                input.Role,
                input.Role == RecipeIngredient.ProhibitedRole ? null : input.Quantity,
                input.Role == RecipeIngredient.ProhibitedRole ? null : NormalizeUnit(input.Unit)));
        }

        await Task.CompletedTask;
    }

    private async Task ReplaceExplicitRecipeIngredientsAsync(Guid recipeId, SaveRecipeRequest request)
    {
        var existing = await _appDb.RecipeIngredients
            .Where(item => item.RecipeId == recipeId)
            .ToListAsync();
        if (existing.Count > 0)
            _appDb.RecipeIngredients.RemoveRange(existing);

        await SyncExplicitRecipeIngredientsAsync(recipeId, request);
    }

    private async Task<Dictionary<Guid, RecipeIngredientBuckets>> BuildRecipeIngredientBucketsMapAsync(IEnumerable<Recipe> recipes)
    {
        var recipeList = recipes.ToList();
        if (recipeList.Count == 0)
            return new Dictionary<Guid, RecipeIngredientBuckets>();

        var recipeIds = recipeList.Select(recipe => recipe.Id).ToHashSet();

        var rows = await _appDb.RecipeIngredients
            .AsNoTracking()
            .Where(item => recipeIds.Contains(item.RecipeId))
            .Join(
                _appDb.Ingredients.AsNoTracking(),
                item => item.IngredientId,
                ingredient => ingredient.Id,
                (item, ingredient) => new RecipeIngredientRow(
                    item.RecipeId,
                    ingredient.Id,
                    ingredient.CanonicalName,
                    item.Role,
                    item.Quantity,
                    item.Unit))
            .ToListAsync();

        var rowsByRecipe = rows
            .GroupBy(row => row.RecipeId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var result = new Dictionary<Guid, RecipeIngredientBuckets>();
        foreach (var recipe in recipeList)
        {
            result[recipe.Id] = rowsByRecipe.TryGetValue(recipe.Id, out var explicitRows) && explicitRows.Count > 0
                ? RecipeIngredientBuckets.FromExplicitRows(explicitRows)
                : RecipeIngredientBuckets.FromRecipe(recipe);
        }

        return result;
    }

    private async Task<Dictionary<Guid, int>> GetActivePlanCountsAsync(Guid dietitianId, IReadOnlyCollection<Guid> recipeIds)
    {
        if (recipeIds.Count == 0)
            return new Dictionary<Guid, int>();

        return await _appDb.ClientMeals
            .Where(meal => recipeIds.Contains(meal.RecipeId) &&
                           meal.ClientMealPlan.DietitianId == dietitianId &&
                           meal.ClientMealPlan.IsActive)
            .GroupBy(meal => meal.RecipeId)
            .Select(group => new { group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Key, item => item.Count);
    }

    private async Task<RecipeDeleteMode> ResolveDeleteModeAsync(Guid dietitianId, Recipe recipe)
    {
        var hasClientMealUsage = await _appDb.ClientMeals
            .AnyAsync(meal => meal.RecipeId == recipe.Id && meal.ClientMealPlan.DietitianId == dietitianId);
        if (hasClientMealUsage)
            return RecipeDeleteMode.Archive;

        var hasLegacyUsage = await _appDb.DietPlanMeals
            .AnyAsync(meal => meal.PlannedRecipeId == recipe.Id && meal.DietPlanDay.DietPlan.DietitianId == dietitianId);
        if (hasLegacyUsage)
            return RecipeDeleteMode.Archive;

        var hasAlternativeUsage = await _appDb.MealCompletions
            .AnyAsync(item => item.AlternativeRecipeId == recipe.Id && item.DietitianId == dietitianId);
        if (hasAlternativeUsage)
            return RecipeDeleteMode.Archive;

        var hasRecommendationHistory = await _appDb.RecipeRecommendationLogs
            .AnyAsync(item =>
                item.DietitianId == dietitianId &&
                (item.SelectedRecipeId == recipe.Id || item.PlannedRecipeId == recipe.Id));
        if (hasRecommendationHistory)
            return RecipeDeleteMode.Archive;

        return RecipeDeleteMode.Delete;
    }

    private async Task<Dictionary<Guid, RecipeAnalyticsAggregate>> BuildRecipeAnalyticsMapAsync(
        Guid dietitianId,
        IReadOnlyCollection<Guid> recipeIds,
        string? range)
    {
        if (recipeIds.Count == 0)
            return new Dictionary<Guid, RecipeAnalyticsAggregate>();

        var rangeStartUtc = ResolveRangeStart(range);
        var nowUtc = DateTime.UtcNow;
        var recentWindowStart = nowUtc.AddDays(-14);
        var previousWindowStart = nowUtc.AddDays(-28);

        var clientMealSignals = await _appDb.ClientMeals
            .Where(meal => recipeIds.Contains(meal.RecipeId) && meal.ClientMealPlan.DietitianId == dietitianId)
            .Select(meal => new ClientMealSignal(meal.RecipeId, meal.ClientMealPlan.ClientId, meal.CreatedAtUtc, meal.CompletedAt))
            .ToListAsync();

        var legacyAssignmentsRaw = await _appDb.DietPlanMeals
            .Where(meal => meal.PlannedRecipeId.HasValue &&
                           recipeIds.Contains(meal.PlannedRecipeId.Value) &&
                           meal.DietPlanDay.DietPlan.DietitianId == dietitianId)
            .Select(meal => new LegacyAssignmentRaw(meal.Id, meal.PlannedRecipeId!.Value, meal.DietPlanDay.DietPlan.ClientId, meal.DietPlanDay.Date))
            .ToListAsync();

        var legacyAssignments = legacyAssignmentsRaw
            .Select(item => new LegacyAssignmentSignal(
                item.MealId,
                item.RecipeId,
                item.ClientId,
                DateTime.SpecifyKind(item.Date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc)))
            .ToList();

        var mealCompletionSignals = await _appDb.MealCompletions
            .Where(item => item.DietitianId == dietitianId)
            .Select(item => new MealCompletionSignal(item.DietPlanMealId, item.ClientId, item.Status, item.AlternativeRecipeId, item.AtUtc))
            .ToListAsync();

        var recommendationSignals = await _appDb.RecipeRecommendationLogs
            .Where(item => item.DietitianId == dietitianId && item.SelectedRecipeId.HasValue && recipeIds.Contains(item.SelectedRecipeId.Value))
            .Select(item => new RecommendationSignal(item.SelectedRecipeId!.Value, item.ClientId, item.CreatedAtUtc))
            .ToListAsync();

        var legacyAssignmentsByMealId = legacyAssignments.ToDictionary(item => item.MealId);
        var aggregates = recipeIds.ToDictionary(recipeId => recipeId, RecipeAnalyticsAggregate.Empty);

        foreach (var recipeId in recipeIds)
        {
            var aggregate = aggregates[recipeId];

            var recipeClientMeals = clientMealSignals.Where(item => item.RecipeId == recipeId).ToList();
            var recipeLegacyAssignments = legacyAssignments.Where(item => item.RecipeId == recipeId).ToList();
            var recipeLegacyCompletions = mealCompletionSignals
                .Where(item =>
                    item.Status == MealCompletionStatus.Done &&
                    legacyAssignmentsByMealId.TryGetValue(item.DietPlanMealId, out var assignment) &&
                    assignment.RecipeId == recipeId)
                .ToList();
            var recipeAlternatives = mealCompletionSignals
                .Where(item => item.Status == MealCompletionStatus.Alternative && item.AlternativeRecipeId == recipeId)
                .ToList();
            var recipeRecommendations = recommendationSignals.Where(item => item.RecipeId == recipeId).ToList();

            aggregate.AssignmentCount =
                recipeClientMeals.Count(item => InRange(item.AssignedAtUtc, rangeStartUtc)) +
                recipeLegacyAssignments.Count(item => InRange(item.AssignedAtUtc, rangeStartUtc));

            aggregate.PlannedCompletionCount =
                recipeClientMeals.Count(item => item.CompletedAtUtc.HasValue && InRange(item.CompletedAtUtc.Value, rangeStartUtc)) +
                recipeLegacyCompletions.Count(item => InRange(item.AtUtc, rangeStartUtc));

            aggregate.AlternativeSelectedCount = recipeAlternatives.Count(item => InRange(item.AtUtc, rangeStartUtc));
            aggregate.RecommendationPickCount = recipeRecommendations.Count(item => InRange(item.AtUtc, rangeStartUtc));

            aggregate.UniqueClientCount = recipeClientMeals
                .Where(item => InRange(item.AssignedAtUtc, rangeStartUtc))
                .Select(item => item.ClientId)
                .Concat(recipeLegacyAssignments.Where(item => InRange(item.AssignedAtUtc, rangeStartUtc)).Select(item => item.ClientId))
                .Concat(recipeAlternatives.Where(item => InRange(item.AtUtc, rangeStartUtc)).Select(item => item.ClientId))
                .Concat(recipeRecommendations.Where(item => item.ClientId.HasValue && InRange(item.AtUtc, rangeStartUtc)).Select(item => item.ClientId!.Value))
                .Distinct()
                .Count();

            aggregate.LastUsedAt = new[]
            {
                recipeClientMeals.Where(item => InRange(item.AssignedAtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AssignedAtUtc).DefaultIfEmpty().Max(),
                recipeClientMeals.Where(item => item.CompletedAtUtc.HasValue && InRange(item.CompletedAtUtc.Value, rangeStartUtc)).Select(item => (DateTime?)item.CompletedAtUtc).DefaultIfEmpty().Max(),
                recipeLegacyAssignments.Where(item => InRange(item.AssignedAtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AssignedAtUtc).DefaultIfEmpty().Max(),
                recipeLegacyCompletions.Where(item => InRange(item.AtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AtUtc).DefaultIfEmpty().Max(),
                recipeAlternatives.Where(item => InRange(item.AtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AtUtc).DefaultIfEmpty().Max(),
                recipeRecommendations.Where(item => InRange(item.AtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AtUtc).DefaultIfEmpty().Max()
            }.Where(item => item.HasValue).Max();

            aggregate.LastCompletedAt = new[]
            {
                recipeClientMeals.Where(item => item.CompletedAtUtc.HasValue && InRange(item.CompletedAtUtc.Value, rangeStartUtc)).Select(item => (DateTime?)item.CompletedAtUtc).DefaultIfEmpty().Max(),
                recipeLegacyCompletions.Where(item => InRange(item.AtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AtUtc).DefaultIfEmpty().Max()
            }.Where(item => item.HasValue).Max();

            var currentInteractionCount =
                recipeClientMeals.Count(item => item.AssignedAtUtc >= recentWindowStart) +
                recipeClientMeals.Count(item => item.CompletedAtUtc.HasValue && item.CompletedAtUtc.Value >= recentWindowStart) +
                recipeLegacyAssignments.Count(item => item.AssignedAtUtc >= recentWindowStart) +
                recipeLegacyCompletions.Count(item => item.AtUtc >= recentWindowStart) +
                recipeAlternatives.Count(item => item.AtUtc >= recentWindowStart) +
                recipeRecommendations.Count(item => item.AtUtc >= recentWindowStart);

            var previousInteractionCount =
                recipeClientMeals.Count(item => item.AssignedAtUtc >= previousWindowStart && item.AssignedAtUtc < recentWindowStart) +
                recipeClientMeals.Count(item => item.CompletedAtUtc.HasValue && item.CompletedAtUtc.Value >= previousWindowStart && item.CompletedAtUtc.Value < recentWindowStart) +
                recipeLegacyAssignments.Count(item => item.AssignedAtUtc >= previousWindowStart && item.AssignedAtUtc < recentWindowStart) +
                recipeLegacyCompletions.Count(item => item.AtUtc >= previousWindowStart && item.AtUtc < recentWindowStart) +
                recipeAlternatives.Count(item => item.AtUtc >= previousWindowStart && item.AtUtc < recentWindowStart) +
                recipeRecommendations.Count(item => item.AtUtc >= previousWindowStart && item.AtUtc < recentWindowStart);

            aggregate.RecentTrendDelta = currentInteractionCount - previousInteractionCount;
            aggregate.PlannedCompletionRate = aggregate.AssignmentCount == 0
                ? 0
                : Math.Round((decimal)aggregate.PlannedCompletionCount / aggregate.AssignmentCount, 4);
        }

        var maxAssignments = Math.Max(aggregates.Values.Max(item => item.AssignmentCount), 1);
        var maxAlternatives = Math.Max(aggregates.Values.Max(item => item.AlternativeSelectedCount), 1);
        var maxRecommendations = Math.Max(aggregates.Values.Max(item => item.RecommendationPickCount), 1);
        var maxPositiveTrend = Math.Max(aggregates.Values.Max(item => Math.Max(item.RecentTrendDelta, 0)), 1);

        foreach (var aggregate in aggregates.Values)
        {
            var alternativeScore = (decimal)aggregate.AlternativeSelectedCount / maxAlternatives;
            var assignmentScore = (decimal)aggregate.AssignmentCount / maxAssignments;
            var recommendationScore = (decimal)aggregate.RecommendationPickCount / maxRecommendations;
            var trendScore = aggregate.RecentTrendDelta <= 0 ? 0 : (decimal)aggregate.RecentTrendDelta / maxPositiveTrend;

            aggregate.PreferenceScore = Math.Round(
                (aggregate.PlannedCompletionRate * 35m) +
                (alternativeScore * 25m) +
                (assignmentScore * 20m) +
                (recommendationScore * 10m) +
                (trendScore * 10m),
                1);
        }

        return aggregates;
    }

    private async Task<List<RecipeClientPreferenceDto>> BuildClientPreferenceListAsync(Guid dietitianId, Guid recipeId, string? range)
    {
        var rangeStartUtc = ResolveRangeStart(range);

        var clientMealSignals = await _appDb.ClientMeals
            .Where(meal => meal.RecipeId == recipeId && meal.ClientMealPlan.DietitianId == dietitianId)
            .Select(meal => new ClientMealSignal(meal.RecipeId, meal.ClientMealPlan.ClientId, meal.CreatedAtUtc, meal.CompletedAt))
            .ToListAsync();

        var legacyAssignmentsRaw = await _appDb.DietPlanMeals
            .Where(meal => meal.PlannedRecipeId == recipeId && meal.DietPlanDay.DietPlan.DietitianId == dietitianId)
            .Select(meal => new LegacyAssignmentRaw(meal.Id, meal.PlannedRecipeId!.Value, meal.DietPlanDay.DietPlan.ClientId, meal.DietPlanDay.Date))
            .ToListAsync();

        var legacyAssignments = legacyAssignmentsRaw
            .Select(item => new LegacyAssignmentSignal(
                item.MealId,
                item.RecipeId,
                item.ClientId,
                DateTime.SpecifyKind(item.Date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc)))
            .ToList();

        var legacyAssignmentIds = legacyAssignments.ToDictionary(item => item.MealId);
        var mealCompletions = await _appDb.MealCompletions
            .Where(item => item.DietitianId == dietitianId &&
                           (item.AlternativeRecipeId == recipeId || legacyAssignmentIds.Keys.Contains(item.DietPlanMealId)))
            .Select(item => new MealCompletionSignal(item.DietPlanMealId, item.ClientId, item.Status, item.AlternativeRecipeId, item.AtUtc))
            .ToListAsync();

        var clientIds = clientMealSignals.Select(item => item.ClientId)
            .Concat(legacyAssignments.Select(item => item.ClientId))
            .Concat(mealCompletions.Select(item => item.ClientId))
            .Distinct()
            .ToList();

        var clientNameMap = await _appDb.Clients
            .Where(client => clientIds.Contains(client.Id))
            .ToDictionaryAsync(client => client.Id, client => client.FullName);

        return clientIds.Select(clientId =>
            {
                var assignmentCount = clientMealSignals.Count(item => item.ClientId == clientId && InRange(item.AssignedAtUtc, rangeStartUtc))
                    + legacyAssignments.Count(item => item.ClientId == clientId && InRange(item.AssignedAtUtc, rangeStartUtc));

                var completionCount = clientMealSignals.Count(item => item.ClientId == clientId && item.CompletedAtUtc.HasValue && InRange(item.CompletedAtUtc.Value, rangeStartUtc))
                    + mealCompletions.Count(item =>
                        item.ClientId == clientId &&
                        item.Status == MealCompletionStatus.Done &&
                        legacyAssignmentIds.TryGetValue(item.DietPlanMealId, out var assignment) &&
                        assignment.RecipeId == recipeId &&
                        InRange(item.AtUtc, rangeStartUtc));

                var alternativeCount = mealCompletions.Count(item =>
                    item.ClientId == clientId &&
                    item.Status == MealCompletionStatus.Alternative &&
                    item.AlternativeRecipeId == recipeId &&
                    InRange(item.AtUtc, rangeStartUtc));

                var lastInteractionAt = new[]
                {
                    clientMealSignals.Where(item => item.ClientId == clientId && InRange(item.AssignedAtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AssignedAtUtc).DefaultIfEmpty().Max(),
                    clientMealSignals.Where(item => item.ClientId == clientId && item.CompletedAtUtc.HasValue && InRange(item.CompletedAtUtc.Value, rangeStartUtc)).Select(item => (DateTime?)item.CompletedAtUtc).DefaultIfEmpty().Max(),
                    legacyAssignments.Where(item => item.ClientId == clientId && InRange(item.AssignedAtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AssignedAtUtc).DefaultIfEmpty().Max(),
                    mealCompletions.Where(item => item.ClientId == clientId && InRange(item.AtUtc, rangeStartUtc)).Select(item => (DateTime?)item.AtUtc).DefaultIfEmpty().Max()
                }.Where(item => item.HasValue).Max();

                return new RecipeClientPreferenceDto(
                    ClientId: clientId,
                    ClientName: clientNameMap.GetValueOrDefault(clientId, "Bilinmeyen danışan"),
                    AssignmentCount: assignmentCount,
                    CompletionCount: completionCount,
                    AlternativeSelectionCount: alternativeCount,
                    LastInteractionAt: lastInteractionAt);
            })
            .Where(item => item.AssignmentCount > 0 || item.CompletionCount > 0 || item.AlternativeSelectionCount > 0)
            .OrderByDescending(item => item.AlternativeSelectionCount)
            .ThenByDescending(item => item.CompletionCount)
            .ThenByDescending(item => item.AssignmentCount)
            .ThenByDescending(item => item.LastInteractionAt)
            .ToList();
    }

    private static bool InRange(DateTime value, DateTime? rangeStartUtc)
    {
        return !rangeStartUtc.HasValue || value >= rangeStartUtc.Value;
    }

    private static DateTime? ResolveRangeStart(string? range)
    {
        return range?.Trim().ToLowerInvariant() switch
        {
            "7d" => DateTime.UtcNow.AddDays(-7),
            "30d" => DateTime.UtcNow.AddDays(-30),
            "week" => DateTime.UtcNow.AddDays(-7),
            "month" => DateTime.UtcNow.AddDays(-30),
            "all" or null or "" => null,
            _ => DateTime.UtcNow.AddDays(-30)
        };
    }

    private static List<string> BuildStrengthReasons(RecipeAnalyticsAggregate analytics)
    {
        var reasons = new List<string>();

        if (analytics.PlannedCompletionRate >= 0.75m && analytics.AssignmentCount >= 3)
            reasons.Add("Planlandığında yüksek tamamlama oranı gösteriyor.");
        if (analytics.AlternativeSelectedCount >= 2)
            reasons.Add("Danışanlar bu tarifi alternatif seçimlerde tekrar tercih ediyor.");
        if (analytics.RecentTrendDelta > 0)
            reasons.Add("Son 14 günde kullanım ivmesi yükselişte.");
        if (analytics.UniqueClientCount >= 3)
            reasons.Add("Birden fazla danışan segmentinde karşılık buluyor.");
        if (analytics.RecommendationPickCount > 0)
            reasons.Add("Tarif eşleştirme akışlarında görünürlük alıyor.");

        if (reasons.Count == 0)
            reasons.Add("Henüz güçlü bir kullanım paterni oluşmadı.");

        return reasons;
    }

    private static RecipeListItemDto MapRecipeListItem(
        Recipe recipe,
        Guid dietitianId,
        bool isFavorited,
        RecipeAnalyticsAggregate analytics,
        int activePlanCount,
        RecipeIngredientBuckets ingredientBuckets)
    {
        return new RecipeListItemDto(
            Id: recipe.Id,
            Name: recipe.Name,
            Slug: recipe.Slug,
            Description: recipe.Description,
            IsPublic: recipe.IsPublic,
            IsArchived: recipe.IsArchived,
            IsFavorited: isFavorited,
            SourceType: "clinic",
            MandatoryIngredientCount: ingredientBuckets.MandatoryIngredients.Count,
            OptionalIngredientCount: ingredientBuckets.OptionalIngredients.Count,
            ProhibitedIngredientCount: ingredientBuckets.ProhibitedIngredients.Count,
            PrepTimeMinutes: recipe.PrepTimeMinutes,
            CookTimeMinutes: recipe.CookTimeMinutes,
            Servings: recipe.Servings,
            CaloriesKcal: recipe.CaloriesKcal,
            ProteinGrams: recipe.ProteinGrams,
            CarbsGrams: recipe.CarbsGrams,
            FatGrams: recipe.FatGrams,
            Tags: recipe.Tags.ToList(),
            IsActiveInPlans: activePlanCount > 0,
            AnalyticsPreview: new RecipeAnalyticsPreviewDto(
                AssignmentCount: analytics.AssignmentCount,
                PlannedCompletionCount: analytics.PlannedCompletionCount,
                PlannedCompletionRate: analytics.PlannedCompletionRate,
                AlternativeSelectedCount: analytics.AlternativeSelectedCount,
                RecommendationPickCount: analytics.RecommendationPickCount,
                UniqueClientCount: analytics.UniqueClientCount,
                LastUsedAt: analytics.LastUsedAt,
                LastCompletedAt: analytics.LastCompletedAt,
                RecentTrendDelta: analytics.RecentTrendDelta,
                PreferenceScore: analytics.PreferenceScore));
    }

    private static RecipeDetailDto MapRecipeDetailDto(
        Recipe recipe,
        Guid dietitianId,
        bool isFavorited,
        RecipeAnalyticsAggregate analytics,
        int activePlanCount,
        RecipeDeleteMode deleteMode,
        RecipeIngredientBuckets ingredientBuckets)
    {
        return new RecipeDetailDto(
            Id: recipe.Id,
            Name: recipe.Name,
            Slug: recipe.Slug,
            Description: recipe.Description,
            IsPublic: recipe.IsPublic,
            IsArchived: recipe.IsArchived,
            IsFavorited: isFavorited,
            SourceType: "clinic",
            Tags: recipe.Tags.ToList(),
            Steps: recipe.Steps.ToList(),
            PrepTimeMinutes: recipe.PrepTimeMinutes,
            CookTimeMinutes: recipe.CookTimeMinutes,
            Servings: recipe.Servings,
            CaloriesKcal: recipe.CaloriesKcal,
            ProteinGrams: recipe.ProteinGrams,
            CarbsGrams: recipe.CarbsGrams,
            FatGrams: recipe.FatGrams,
            MandatoryIngredients: ingredientBuckets.MandatoryIngredients,
            OptionalIngredients: ingredientBuckets.OptionalIngredients,
            FlavoringIngredients: ingredientBuckets.FlavoringIngredients,
            ProhibitedIngredients: ingredientBuckets.ProhibitedIngredients,
            CanEdit: true,
            CanDelete: true,
            CanArchive: true,
            DeleteMode: deleteMode == RecipeDeleteMode.Archive ? "archive" : "delete",
            IsActiveInPlans: activePlanCount > 0,
            AnalyticsPreview: new RecipeAnalyticsPreviewDto(
                AssignmentCount: analytics.AssignmentCount,
                PlannedCompletionCount: analytics.PlannedCompletionCount,
                PlannedCompletionRate: analytics.PlannedCompletionRate,
                AlternativeSelectedCount: analytics.AlternativeSelectedCount,
                RecommendationPickCount: analytics.RecommendationPickCount,
                UniqueClientCount: analytics.UniqueClientCount,
                LastUsedAt: analytics.LastUsedAt,
                LastCompletedAt: analytics.LastCompletedAt,
                RecentTrendDelta: analytics.RecentTrendDelta,
                PreferenceScore: analytics.PreferenceScore));
    }

    private sealed class IngredientMapResult
    {
        public bool Success { get; }
        public string? ErrorMessage { get; }
        public IReadOnlyDictionary<Guid, Ingredient>? Value { get; }

        private IngredientMapResult(bool success, string? errorMessage, IReadOnlyDictionary<Guid, Ingredient>? value)
        {
            Success = success;
            ErrorMessage = errorMessage;
            Value = value;
        }

        public static IngredientMapResult Ok(IReadOnlyDictionary<Guid, Ingredient> value) => new(true, null, value);
        public static IngredientMapResult Fail(string errorMessage) => new(false, errorMessage, null);
    }

    private sealed class RecipeAnalyticsAggregate
    {
        public Guid RecipeId { get; }
        public int AssignmentCount { get; set; }
        public int PlannedCompletionCount { get; set; }
        public decimal PlannedCompletionRate { get; set; }
        public int AlternativeSelectedCount { get; set; }
        public int RecommendationPickCount { get; set; }
        public int UniqueClientCount { get; set; }
        public DateTime? LastUsedAt { get; set; }
        public DateTime? LastCompletedAt { get; set; }
        public int RecentTrendDelta { get; set; }
        public decimal PreferenceScore { get; set; }

        private RecipeAnalyticsAggregate(Guid recipeId)
        {
            RecipeId = recipeId;
        }

        public static RecipeAnalyticsAggregate Empty(Guid recipeId) => new(recipeId);
    }

    private enum RecipeDeleteMode
    {
        Delete,
        Archive
    }

    private sealed record RecipeIngredientRow(
        Guid RecipeId,
        Guid IngredientId,
        string IngredientName,
        string Role,
        decimal? Quantity,
        string? Unit);

    private sealed record RecipeIngredientBuckets(
        List<RecipeIngredientDto> MandatoryIngredients,
        List<RecipeIngredientDto> OptionalIngredients,
        List<RecipeIngredientDto> FlavoringIngredients,
        List<RecipeIngredientDto> ProhibitedIngredients)
    {
        public static RecipeIngredientBuckets FromExplicitRows(IEnumerable<RecipeIngredientRow> rows)
        {
            var distinctRows = rows
                .GroupBy(row => new { row.Role, row.IngredientId })
                .Select(group => group.First())
                .OrderBy(row => row.IngredientName, StringComparer.CurrentCultureIgnoreCase)
                .ToList();

            return new RecipeIngredientBuckets(
                MandatoryIngredients: MapRows(distinctRows, RecipeIngredient.MandatoryRole),
                OptionalIngredients: MapRows(distinctRows, RecipeIngredient.OptionalRole),
                FlavoringIngredients: MapRows(distinctRows, RecipeIngredient.FlavoringRole),
                ProhibitedIngredients: MapRows(distinctRows, RecipeIngredient.ProhibitedRole));
        }

        public static RecipeIngredientBuckets FromRecipe(Recipe recipe)
        {
            var fallbackFlavoring = recipe.OptionalIngredients
                .Where(item => item.IsCondiment)
                .OrderBy(item => item.CanonicalName, StringComparer.CurrentCultureIgnoreCase)
                .Select(item => new RecipeIngredientDto(item.Id, item.CanonicalName))
                .ToList();

            var fallbackOptional = recipe.OptionalIngredients
                .Where(item => !item.IsCondiment)
                .OrderBy(item => item.CanonicalName, StringComparer.CurrentCultureIgnoreCase)
                .Select(item => new RecipeIngredientDto(item.Id, item.CanonicalName))
                .ToList();

            return new RecipeIngredientBuckets(
                MandatoryIngredients: recipe.MandatoryIngredients
                    .OrderBy(item => item.CanonicalName, StringComparer.CurrentCultureIgnoreCase)
                    .Select(item => new RecipeIngredientDto(item.Id, item.CanonicalName))
                    .ToList(),
                OptionalIngredients: fallbackOptional,
                FlavoringIngredients: fallbackFlavoring,
                ProhibitedIngredients: recipe.ProhibitedIngredients
                    .OrderBy(item => item.CanonicalName, StringComparer.CurrentCultureIgnoreCase)
                    .Select(item => new RecipeIngredientDto(item.Id, item.CanonicalName))
                    .ToList());
        }

        private static List<RecipeIngredientDto> MapRows(IEnumerable<RecipeIngredientRow> rows, string role)
        {
            return rows
                .Where(row => string.Equals(row.Role, role, StringComparison.OrdinalIgnoreCase))
                .Select(row => new RecipeIngredientDto(
                    row.IngredientId,
                    row.IngredientName,
                    row.Quantity,
                    row.Unit,
                    FormatDisplayAmount(row.Quantity, row.Unit)))
                .ToList();
        }
    }
}

public record RecipeMatchRequest(
    Guid? ClientId,
    List<Guid> BasketIngredientIds);

public record SaveRecipeRequest(
    string Name,
    string? Description,
    bool IsPublic,
    List<SaveRecipeIngredientRequest>? Ingredients,
    List<Guid>? MandatoryIngredients,
    List<Guid>? OptionalIngredients,
    List<Guid>? FlavoringIngredients,
    List<Guid>? Prohibitions,
    List<string>? Tags,
    List<string>? Steps,
    List<string>? Instructions,
    int? PrepTimeMinutes,
    int? CookTimeMinutes,
    int? Servings,
    int? CaloriesKcal,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams);

public record SaveRecipeIngredientRequest(
    Guid IngredientId,
    string Role,
    decimal? Quantity,
    string? Unit);

public record RecipeIngredientDto(
    Guid Id,
    string Name,
    decimal? Quantity = null,
    string? Unit = null,
    string? DisplayAmount = null);

public record RecipeAnalyticsPreviewDto(
    int AssignmentCount,
    int PlannedCompletionCount,
    decimal PlannedCompletionRate,
    int AlternativeSelectedCount,
    int RecommendationPickCount,
    int UniqueClientCount,
    DateTime? LastUsedAt,
    DateTime? LastCompletedAt,
    int RecentTrendDelta,
    decimal PreferenceScore);

public record RecipeListItemDto(
    Guid Id,
    string Name,
    string Slug,
    string Description,
    bool IsPublic,
    bool IsArchived,
    bool IsFavorited,
    string SourceType,
    int MandatoryIngredientCount,
    int OptionalIngredientCount,
    int ProhibitedIngredientCount,
    int? PrepTimeMinutes,
    int? CookTimeMinutes,
    int? Servings,
    int? CaloriesKcal,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    List<string> Tags,
    bool IsActiveInPlans,
    RecipeAnalyticsPreviewDto AnalyticsPreview);

public record RecipeDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string Description,
    bool IsPublic,
    bool IsArchived,
    bool IsFavorited,
    string SourceType,
    List<string> Tags,
    List<string> Steps,
    int? PrepTimeMinutes,
    int? CookTimeMinutes,
    int? Servings,
    int? CaloriesKcal,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    List<RecipeIngredientDto> MandatoryIngredients,
    List<RecipeIngredientDto> OptionalIngredients,
    List<RecipeIngredientDto> FlavoringIngredients,
    List<RecipeIngredientDto> ProhibitedIngredients,
    bool CanEdit,
    bool CanDelete,
    bool CanArchive,
    string DeleteMode,
    bool IsActiveInPlans,
    RecipeAnalyticsPreviewDto AnalyticsPreview);

public record RecipeOverviewSummaryDto(
    int TotalRecipes,
    int ArchivedRecipes,
    int FavoriteRecipes,
    int ActivePlanRecipes);

public record RecipeOverviewDto(
    RecipeOverviewSummaryDto Summary,
    List<RecipeListItemDto> Favorites,
    List<RecipeListItemDto> MostCompleted,
    List<RecipeListItemDto> MostPreferred,
    List<RecipeListItemDto> Rising);

public record RecipeAnalyticsDto(
    Guid RecipeId,
    int AssignmentCount,
    int PlannedCompletionCount,
    decimal PlannedCompletionRate,
    int AlternativeSelectedCount,
    int RecommendationPickCount,
    int UniqueClientCount,
    DateTime? LastUsedAt,
    DateTime? LastCompletedAt,
    int RecentTrendDelta,
    decimal PreferenceScore,
    List<string> StrengthReasons,
    List<RecipeClientPreferenceDto> ClientPreferences);

public record RecipeClientPreferenceDto(
    Guid ClientId,
    string ClientName,
    int AssignmentCount,
    int CompletionCount,
    int AlternativeSelectionCount,
    DateTime? LastInteractionAt);

public record PopularRecipeDto(
    Guid RecipeId,
    string RecipeName,
    int CompletionCount);

internal sealed record ClientMealSignal(
    Guid RecipeId,
    Guid ClientId,
    DateTime AssignedAtUtc,
    DateTime? CompletedAtUtc);

internal sealed record LegacyAssignmentRaw(
    Guid MealId,
    Guid RecipeId,
    Guid ClientId,
    DateOnly Date);

internal sealed record LegacyAssignmentSignal(
    Guid MealId,
    Guid RecipeId,
    Guid ClientId,
    DateTime AssignedAtUtc);

internal sealed record MealCompletionSignal(
    Guid DietPlanMealId,
    Guid ClientId,
    MealCompletionStatus Status,
    Guid? AlternativeRecipeId,
    DateTime AtUtc);

internal sealed record RecommendationSignal(
    Guid RecipeId,
    Guid? ClientId,
    DateTime AtUtc);
