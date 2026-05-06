using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/client/recipes")]
public class ClientRecipeFavoritesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly ILogger<ClientRecipeFavoritesController> _logger;

    public ClientRecipeFavoritesController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        ILogger<ClientRecipeFavoritesController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _logger = logger;
    }

    [HttpGet("favorites")]
    public async Task<IActionResult> GetFavorites(CancellationToken cancellationToken)
    {
        try
        {
            var context = await GetFavoriteContextAsync(cancellationToken);
            if (!context.SuccessResult)
                return context.ErrorResult!;

            if (!context.IsPremium || !context.ActiveDietitianId.HasValue)
                return Ok(FavoriteRecipesResponse.Empty());

            var response = await BuildFavoritesResponseAsync(
                context.ClientId!.Value,
                context.ActiveDietitianId.Value,
                0,
                cancellationToken);

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load client favorite recipes");
            return StatusCode(500, ApiProblems.InternalServerError("CLIENT_FAVORITES_FETCH_FAILED", "Favori tarifler alınamadı."));
        }
    }

    [HttpGet("favorites/summary")]
    public async Task<IActionResult> GetFavoritesSummary(CancellationToken cancellationToken)
    {
        try
        {
            var context = await GetFavoriteContextAsync(cancellationToken);
            if (!context.SuccessResult)
                return context.ErrorResult!;

            if (!context.IsPremium || !context.ActiveDietitianId.HasValue)
                return Ok(FavoriteRecipesSummaryDto.Empty());

            var response = await BuildFavoritesResponseAsync(
                context.ClientId!.Value,
                context.ActiveDietitianId.Value,
                3,
                cancellationToken);

            return Ok(new FavoriteRecipesSummaryDto(
                TotalFavorites: response.Total,
                RecentFavorites: response.Items.Take(3).ToList(),
                BestMatchedFavorite: response.Items
                    .OrderByDescending(item => item.PantryCoverage.Percent)
                    .ThenByDescending(item => item.LastFavoritedAtUtc)
                    .FirstOrDefault()));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load favorite summary");
            return StatusCode(500, ApiProblems.InternalServerError("CLIENT_FAVORITES_SUMMARY_FAILED", "Favori özeti alınamadı."));
        }
    }

    [HttpPost("{id:guid}/favorite")]
    public async Task<IActionResult> FavoriteRecipe(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var context = await GetFavoriteContextAsync(cancellationToken);
            if (!context.SuccessResult)
                return context.ErrorResult!;

            if (!context.IsPremium || !context.ActiveDietitianId.HasValue)
            {
                var problem = ApiProblems.PremiumRequired("Favoriler yalnızca premium kullanıcılar için kullanılabilir.");
                return StatusCode(problem.Status ?? 403, problem);
            }

            var isAccessible = await IsRecipeAccessibleAsync(id, context.ActiveDietitianId.Value, cancellationToken);
            if (!isAccessible)
                return NotFound(ApiProblems.NotFound("RECIPE_NOT_FOUND", "Tarif bulunamadı veya artık erişilebilir değil."));

            var favorite = await _appDb.ClientRecipeFavorites
                .FirstOrDefaultAsync(item => item.ClientId == context.ClientId!.Value && item.RecipeId == id, cancellationToken);

            if (favorite == null)
            {
                _appDb.ClientRecipeFavorites.Add(new ClientRecipeFavorite(context.ClientId.Value, id));
            }
            else if (!favorite.IsActive)
            {
                favorite.Activate();
            }

            await _appDb.SaveChangesAsync(cancellationToken);

            return Ok(new { isFavorited = true, message = "Tarif favorilerine eklendi." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to favorite recipe {RecipeId}", id);
            return StatusCode(500, ApiProblems.InternalServerError("CLIENT_FAVORITE_SAVE_FAILED", "Tarif favorilere eklenemedi."));
        }
    }

    [HttpDelete("{id:guid}/favorite")]
    public async Task<IActionResult> UnfavoriteRecipe(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var context = await GetFavoriteContextAsync(cancellationToken);
            if (!context.SuccessResult)
                return context.ErrorResult!;

            if (!context.IsPremium)
            {
                var problem = ApiProblems.PremiumRequired("Favoriler yalnızca premium kullanıcılar için kullanılabilir.");
                return StatusCode(problem.Status ?? 403, problem);
            }

            var favorite = await _appDb.ClientRecipeFavorites
                .FirstOrDefaultAsync(item => item.ClientId == context.ClientId!.Value && item.RecipeId == id, cancellationToken);

            if (favorite != null && favorite.IsActive)
            {
                favorite.Deactivate();
                await _appDb.SaveChangesAsync(cancellationToken);
            }

            return Ok(new { isFavorited = false, message = "Tarif favorilerinden çıkarıldı." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to unfavorite recipe {RecipeId}", id);
            return StatusCode(500, ApiProblems.InternalServerError("CLIENT_FAVORITE_REMOVE_FAILED", "Tarif favorilerden çıkarılamadı."));
        }
    }

    [HttpPost("favorites/import")]
    public async Task<IActionResult> ImportLegacyFavorites([FromBody] ImportFavoriteRecipesRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var context = await GetFavoriteContextAsync(cancellationToken);
            if (!context.SuccessResult)
                return context.ErrorResult!;

            if (!context.IsPremium || !context.ActiveDietitianId.HasValue)
            {
                var problem = ApiProblems.PremiumRequired("Favori aktarımı yalnızca premium kullanıcılar için kullanılabilir.");
                return StatusCode(problem.Status ?? 403, problem);
            }

            var requestedIds = (request.RecipeIds ?? new List<Guid>())
                .Distinct()
                .ToList();

            if (requestedIds.Count == 0)
                return Ok(new { importedCount = 0, skippedCount = 0 });

            var accessibleIds = await _appDb.Recipes
                .AsNoTracking()
                .Where(recipe =>
                    requestedIds.Contains(recipe.Id) &&
                    !recipe.IsArchived &&
                    !recipe.IsDraft &&
                    !recipe.IsHiddenFromProduction &&
                    (recipe.IsPublic || recipe.DietitianId == context.ActiveDietitianId.Value))
                .Select(recipe => recipe.Id)
                .ToListAsync(cancellationToken);

            var existing = await _appDb.ClientRecipeFavorites
                .Where(item => item.ClientId == context.ClientId!.Value && accessibleIds.Contains(item.RecipeId))
                .ToListAsync(cancellationToken);

            var existingMap = existing.ToDictionary(item => item.RecipeId);
            var importedCount = 0;

            foreach (var recipeId in accessibleIds)
            {
                if (existingMap.TryGetValue(recipeId, out var current))
                {
                    if (!current.IsActive)
                    {
                        current.Activate();
                        importedCount++;
                    }
                    continue;
                }

                _appDb.ClientRecipeFavorites.Add(new ClientRecipeFavorite(context.ClientId.Value, recipeId));
                importedCount++;
            }

            if (importedCount > 0)
                await _appDb.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                importedCount,
                skippedCount = requestedIds.Count - accessibleIds.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to import legacy favorite recipes");
            return StatusCode(500, ApiProblems.InternalServerError("CLIENT_FAVORITE_IMPORT_FAILED", "Eski favoriler aktarılamadı."));
        }
    }

    private async Task<FavoriteRecipesResponse> BuildFavoritesResponseAsync(
        Guid clientId,
        Guid activeDietitianId,
        int previewCount,
        CancellationToken cancellationToken)
    {
        var activeFavorites = await _appDb.ClientRecipeFavorites
            .AsNoTracking()
            .Where(item => item.ClientId == clientId && item.IsActive)
            .OrderByDescending(item => item.LastFavoritedAtUtc)
            .ToListAsync(cancellationToken);

        if (activeFavorites.Count == 0)
            return FavoriteRecipesResponse.Empty();

        var favoriteMap = activeFavorites.ToDictionary(item => item.RecipeId);
        var favoriteIds = favoriteMap.Keys.ToList();

        var recipes = await _appDb.Recipes
            .AsNoTracking()
            .Include(recipe => recipe.MandatoryIngredients)
            .Include(recipe => recipe.OptionalIngredients)
            .Include(recipe => recipe.ProhibitedIngredients)
            .Where(recipe =>
                favoriteIds.Contains(recipe.Id) &&
                !recipe.IsArchived &&
                !recipe.IsDraft &&
                !recipe.IsHiddenFromProduction &&
                (recipe.IsPublic || recipe.DietitianId == activeDietitianId))
            .ToListAsync(cancellationToken);

        if (recipes.Count == 0)
            return FavoriteRecipesResponse.Empty();

        var explicitRows = await _appDb.RecipeIngredients
            .AsNoTracking()
            .Include(row => row.Ingredient)
            .Where(row => favoriteIds.Contains(row.RecipeId) && row.Ingredient != null)
            .ToListAsync(cancellationToken);

        var pantryIds = (await _appDb.ClientPantryItems
            .AsNoTracking()
            .Where(item => item.ClientId == clientId)
            .Select(item => item.IngredientId)
            .ToListAsync(cancellationToken))
            .ToHashSet();

        var groupedRows = explicitRows
            .GroupBy(row => row.RecipeId)
            .ToDictionary(group => group.Key, group => (IReadOnlyCollection<RecipeIngredient>)group.ToList());

        var items = recipes
            .Select(recipe =>
            {
                var groups = BuildIngredientGroups(recipe, groupedRows.GetValueOrDefault(recipe.Id) ?? Array.Empty<RecipeIngredient>());
                var mandatoryCoverage = BuildCoverageGroup(groups.Mandatory, pantryIds);
                var optionalCoverage = BuildCoverageGroup(groups.Optional, pantryIds);
                var flavoringCoverage = BuildCoverageGroup(groups.Flavoring, pantryIds);
                var favorite = favoriteMap[recipe.Id];
                var coverage = BuildCoverageSummary(mandatoryCoverage, optionalCoverage, flavoringCoverage);

                return new FavoriteRecipeCardDto(
                    RecipeId: recipe.Id,
                    Name: recipe.Name,
                    Slug: recipe.Slug,
                    Description: recipe.Description,
                    SourceType: recipe.DietitianId == activeDietitianId ? "clinic" : "general",
                    IsFavorited: true,
                    LastFavoritedAtUtc: favorite.LastFavoritedAtUtc,
                    CaloriesKcal: recipe.CaloriesKcal,
                    ProteinGrams: recipe.ProteinGrams,
                    CarbsGrams: recipe.CarbsGrams,
                    FatGrams: recipe.FatGrams,
                    Tags: recipe.Tags.ToList(),
                    PantryCoverage: coverage,
                    MissingMandatoryNames: mandatoryCoverage.Missing.Select(item => item.Name).ToList(),
                    MissingOptionalNames: optionalCoverage.Missing.Select(item => item.Name).ToList(),
                    MissingFlavoringNames: flavoringCoverage.Missing.Select(item => item.Name).ToList());
            })
            .OrderByDescending(item => item.LastFavoritedAtUtc)
            .ToList();

        if (previewCount > 0)
            items = items.Take(previewCount).ToList();

        return new FavoriteRecipesResponse(items, recipes.Count);
    }

    private async Task<FavoriteRequestContext> GetFavoriteContextAsync(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
        {
            return FavoriteRequestContext.Fail(
                Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Kimlik doğrulama gerekli")));
        }

        var user = await _authDb.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(account => account.Id == userGuid && account.Role == "Client", cancellationToken);

        if (user?.LinkedClientId == null)
        {
            return FavoriteRequestContext.Fail(
                Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı.")));
        }

        var premiumStatus = await _premiumStatusService.GetPremiumStatusAsync(userGuid, cancellationToken);

        return FavoriteRequestContext.Ok(
            userGuid,
            user.LinkedClientId.Value,
            premiumStatus.ActiveDietitianId,
            premiumStatus.IsPremium);
    }

    private async Task<bool> IsRecipeAccessibleAsync(Guid recipeId, Guid activeDietitianId, CancellationToken cancellationToken)
    {
        return await _appDb.Recipes
            .AsNoTracking()
            .AnyAsync(recipe =>
                recipe.Id == recipeId &&
                !recipe.IsArchived &&
                !recipe.IsDraft &&
                !recipe.IsHiddenFromProduction &&
                (recipe.IsPublic || recipe.DietitianId == activeDietitianId), cancellationToken);
    }

    private static FavoriteIngredientGroups BuildIngredientGroups(
        Recipe recipe,
        IReadOnlyCollection<RecipeIngredient> explicitRows)
    {
        var explicitMandatory = explicitRows
            .Where(row => row.Role == RecipeIngredient.MandatoryRole)
            .Select(ToIngredientLine)
            .DistinctBy(item => item.Id)
            .ToList();

        var explicitOptional = explicitRows
            .Where(row => row.Role == RecipeIngredient.OptionalRole)
            .Select(ToIngredientLine)
            .DistinctBy(item => item.Id)
            .ToList();

        var explicitFlavoring = explicitRows
            .Where(row => row.Role == RecipeIngredient.FlavoringRole)
            .Select(ToIngredientLine)
            .DistinctBy(item => item.Id)
            .ToList();

        if (explicitMandatory.Count > 0 || explicitOptional.Count > 0 || explicitFlavoring.Count > 0)
        {
            return new FavoriteIngredientGroups(
                explicitMandatory,
                explicitOptional,
                explicitFlavoring);
        }

        return new FavoriteIngredientGroups(
            recipe.MandatoryIngredients
                .DistinctBy(item => item.Id)
                .Select(ToIngredientLine)
                .ToList(),
            recipe.OptionalIngredients
                .Where(item => !item.IsCondiment)
                .DistinctBy(item => item.Id)
                .Select(ToIngredientLine)
                .ToList(),
            recipe.OptionalIngredients
                .Where(item => item.IsCondiment)
                .DistinctBy(item => item.Id)
                .Select(ToIngredientLine)
                .ToList());
    }

    private static FavoriteCoverageGroupDto BuildCoverageGroup(
        IReadOnlyCollection<FavoriteIngredientLine> ingredients,
        IReadOnlySet<Guid> pantryIds)
    {
        var matched = ingredients
            .Where(item => pantryIds.Contains(item.Id))
            .Select(ToIngredientSummary)
            .ToList();

        var missing = ingredients
            .Where(item => !pantryIds.Contains(item.Id))
            .Select(ToIngredientSummary)
            .ToList();

        return new FavoriteCoverageGroupDto(
            Matched: matched,
            Missing: missing,
            Total: ingredients.Count,
            MatchedCount: matched.Count,
            MissingCount: missing.Count);
    }

    private static FavoriteCoverageSummaryDto BuildCoverageSummary(
        FavoriteCoverageGroupDto mandatory,
        FavoriteCoverageGroupDto optional,
        FavoriteCoverageGroupDto flavoring)
    {
        static decimal Ratio(FavoriteCoverageGroupDto group)
            => group.Total == 0 ? 1m : (decimal)group.MatchedCount / group.Total;

        var mandatoryRatio = Ratio(mandatory);
        var optionalRatio = Ratio(optional);
        var flavoringRatio = Ratio(flavoring);
        var weightedPercent = (int)Math.Round(
            mandatoryRatio * 70m +
            optionalRatio * 20m +
            flavoringRatio * 10m);

        return new FavoriteCoverageSummaryDto(
            Percent: Math.Clamp(weightedPercent, 0, 100),
            MatchedCount: mandatory.MatchedCount + optional.MatchedCount + flavoring.MatchedCount,
            MissingCount: mandatory.MissingCount + optional.MissingCount + flavoring.MissingCount,
            MandatoryPercent: (int)Math.Round(mandatoryRatio * 100m),
            OptionalPercent: (int)Math.Round(optionalRatio * 100m),
            FlavoringPercent: (int)Math.Round(flavoringRatio * 100m),
            MandatoryWeight: 70,
            OptionalWeight: 20,
            FlavoringWeight: 10,
            Mandatory: mandatory,
            Optional: optional,
            Flavoring: flavoring);
    }

    private static FavoriteIngredientLine ToIngredientLine(RecipeIngredient row)
        => new(
            row.IngredientId,
            row.Ingredient.CanonicalName,
            row.Quantity,
            row.Unit);

    private static FavoriteIngredientLine ToIngredientLine(Ingredient ingredient)
        => new(ingredient.Id, ingredient.CanonicalName, null, null);

    private static FavoriteIngredientSummaryDto ToIngredientSummary(FavoriteIngredientLine ingredient)
        => new(
            Id: ingredient.Id,
            Name: ingredient.Name,
            Quantity: ingredient.Quantity,
            Unit: ingredient.Unit,
            DisplayAmount: FormatDisplayAmount(ingredient.Quantity, ingredient.Unit));

    private static string? FormatDisplayAmount(decimal? quantity, string? unit)
    {
        if (!quantity.HasValue || string.IsNullOrWhiteSpace(unit))
            return null;

        var formatted = quantity.Value % 1 == 0
            ? quantity.Value.ToString("0")
            : quantity.Value.ToString("0.##");
        return $"{formatted} {unit.Trim()}";
    }

    private sealed record FavoriteRequestContext(
        bool SuccessResult,
        IActionResult? ErrorResult,
        Guid? UserId,
        Guid? ClientId,
        Guid? ActiveDietitianId,
        bool IsPremium)
    {
        public static FavoriteRequestContext Ok(Guid userId, Guid clientId, Guid? activeDietitianId, bool isPremium)
            => new(true, null, userId, clientId, activeDietitianId, isPremium);

        public static FavoriteRequestContext Fail(IActionResult errorResult)
            => new(false, errorResult, null, null, null, false);
    }

    private sealed record FavoriteIngredientGroups(
        List<FavoriteIngredientLine> Mandatory,
        List<FavoriteIngredientLine> Optional,
        List<FavoriteIngredientLine> Flavoring);

    private sealed record FavoriteIngredientLine(
        Guid Id,
        string Name,
        decimal? Quantity,
        string? Unit);
}

public record ImportFavoriteRecipesRequest(List<Guid> RecipeIds);

public record FavoriteRecipesResponse(
    List<FavoriteRecipeCardDto> Items,
    int Total)
{
    public static FavoriteRecipesResponse Empty() => new(new List<FavoriteRecipeCardDto>(), 0);
}

public record FavoriteRecipesSummaryDto(
    int TotalFavorites,
    List<FavoriteRecipeCardDto> RecentFavorites,
    FavoriteRecipeCardDto? BestMatchedFavorite)
{
    public static FavoriteRecipesSummaryDto Empty() => new(0, new List<FavoriteRecipeCardDto>(), null);
}

public record FavoriteRecipeCardDto(
    Guid RecipeId,
    string Name,
    string Slug,
    string Description,
    string SourceType,
    bool IsFavorited,
    DateTime LastFavoritedAtUtc,
    int? CaloriesKcal,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    List<string> Tags,
    FavoriteCoverageSummaryDto PantryCoverage,
    List<string> MissingMandatoryNames,
    List<string> MissingOptionalNames,
    List<string> MissingFlavoringNames);

public record FavoriteCoverageSummaryDto(
    int Percent,
    int MatchedCount,
    int MissingCount,
    int MandatoryPercent,
    int OptionalPercent,
    int FlavoringPercent,
    int MandatoryWeight,
    int OptionalWeight,
    int FlavoringWeight,
    FavoriteCoverageGroupDto Mandatory,
    FavoriteCoverageGroupDto Optional,
    FavoriteCoverageGroupDto Flavoring);

public record FavoriteCoverageGroupDto(
    List<FavoriteIngredientSummaryDto> Matched,
    List<FavoriteIngredientSummaryDto> Missing,
    int Total,
    int MatchedCount,
    int MissingCount);

public record FavoriteIngredientSummaryDto(
    Guid Id,
    string Name,
    decimal? Quantity,
    string? Unit,
    string? DisplayAmount);
