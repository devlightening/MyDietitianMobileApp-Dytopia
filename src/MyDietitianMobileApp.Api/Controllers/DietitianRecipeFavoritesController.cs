using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/dietitian")]
public class DietitianRecipeFavoritesController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly ILogger<DietitianRecipeFavoritesController> _logger;

    public DietitianRecipeFavoritesController(
        AppDbContext appDb,
        AuthDbContext authDb,
        ILogger<DietitianRecipeFavoritesController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _logger = logger;
    }

    [HttpGet("recipe-favorites/overview")]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        try
        {
            var dietitianId = await GetDietitianIdAsync(cancellationToken);
            if (!dietitianId.HasValue)
                return Forbid();

            var activeClientIds = await _appDb.DietitianClientLinks
                .AsNoTracking()
                .Where(link => link.DietitianId == dietitianId.Value && link.IsActive)
                .Select(link => link.ClientId)
                .ToListAsync(cancellationToken);

            if (activeClientIds.Count == 0)
                return Ok(DietitianFavoriteOverviewDto.Empty());

            var clients = await _appDb.Clients
                .AsNoTracking()
                .Where(client => activeClientIds.Contains(client.Id))
                .Select(client => new { client.Id, client.FullName, client.IsPremium })
                .ToListAsync(cancellationToken);
            var clientMap = clients.ToDictionary(client => client.Id);

            var favorites = await _appDb.ClientRecipeFavorites
                .AsNoTracking()
                .Where(item => item.IsActive && activeClientIds.Contains(item.ClientId))
                .ToListAsync(cancellationToken);

            if (favorites.Count == 0)
                return Ok(DietitianFavoriteOverviewDto.Empty());

            var recipeIds = favorites.Select(item => item.RecipeId).Distinct().ToList();
            var recipes = await _appDb.Recipes
                .AsNoTracking()
                .Where(recipe => recipeIds.Contains(recipe.Id) && !recipe.IsArchived)
                .Select(recipe => new { recipe.Id, recipe.Name, recipe.Slug, recipe.DietitianId, recipe.IsPublic })
                .ToListAsync(cancellationToken);
            var recipeMap = recipes.ToDictionary(recipe => recipe.Id);

            var topRecipes = favorites
                .Where(item => recipeMap.ContainsKey(item.RecipeId))
                .GroupBy(item => item.RecipeId)
                .Select(group =>
                {
                    var recipe = recipeMap[group.Key];
                    return new DietitianFavoriteTopRecipeDto(
                        RecipeId: recipe.Id,
                        RecipeName: recipe.Name,
                        Slug: recipe.Slug,
                        SourceType: recipe.DietitianId == dietitianId.Value ? "clinic" : "general",
                        FavoriteCount: group.Count(),
                        LastFavoritedAtUtc: group.Max(item => item.LastFavoritedAtUtc));
                })
                .OrderByDescending(item => item.FavoriteCount)
                .ThenByDescending(item => item.LastFavoritedAtUtc)
                .Take(6)
                .ToList();

            var recentActivity = favorites
                .Where(item => recipeMap.ContainsKey(item.RecipeId) && clientMap.ContainsKey(item.ClientId))
                .OrderByDescending(item => item.LastFavoritedAtUtc)
                .Take(10)
                .Select(item =>
                {
                    var recipe = recipeMap[item.RecipeId];
                    var client = clientMap[item.ClientId];
                    return new DietitianFavoriteActivityDto(
                        ClientId: item.ClientId,
                        ClientName: client.FullName,
                        ClientIsPremium: client.IsPremium,
                        RecipeId: recipe.Id,
                        RecipeName: recipe.Name,
                        RecipeSlug: recipe.Slug,
                        SourceType: recipe.DietitianId == dietitianId.Value ? "clinic" : "general",
                        FavoritedAtUtc: item.LastFavoritedAtUtc);
                })
                .ToList();

            return Ok(new DietitianFavoriteOverviewDto(
                TotalActiveFavorites: favorites.Count,
                UniqueClientCount: favorites.Select(item => item.ClientId).Distinct().Count(),
                TopRecipes: topRecipes,
                RecentActivity: recentActivity));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build dietitian recipe favorite overview");
            return StatusCode(500, ApiProblems.InternalServerError("DIETITIAN_FAVORITES_OVERVIEW_FAILED", "Favori özetleri alınamadı."));
        }
    }

    [HttpGet("clients/{clientId:guid}/favorite-recipes")]
    public async Task<IActionResult> GetClientFavoriteRecipes(Guid clientId, CancellationToken cancellationToken)
    {
        try
        {
            var dietitianId = await GetDietitianIdAsync(cancellationToken);
            if (!dietitianId.HasValue)
                return Forbid();

            var client = await _appDb.DietitianClientLinks
                .AsNoTracking()
                .Where(link => link.DietitianId == dietitianId.Value && link.ClientId == clientId && link.IsActive)
                .Select(link => new
                {
                    link.Client.Id,
                    link.Client.FullName,
                    link.Client.IsPremium
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (client == null)
                return NotFound(ApiProblems.NotFound("CLIENT_NOT_FOUND", "Danışan bulunamadı veya erişim yetkiniz yok."));

            var favorites = await _appDb.ClientRecipeFavorites
                .AsNoTracking()
                .Where(item => item.ClientId == clientId && item.IsActive)
                .OrderByDescending(item => item.LastFavoritedAtUtc)
                .ToListAsync(cancellationToken);

            if (favorites.Count == 0)
                return Ok(new DietitianClientFavoriteRecipesDto(client.FullName, client.IsPremium, new List<DietitianClientFavoriteRecipeDto>()));

            var recipeIds = favorites.Select(item => item.RecipeId).Distinct().ToList();
            var recipes = await _appDb.Recipes
                .AsNoTracking()
                .Include(recipe => recipe.MandatoryIngredients)
                .Include(recipe => recipe.OptionalIngredients)
                .Where(recipe => recipeIds.Contains(recipe.Id) && !recipe.IsArchived)
                .ToListAsync(cancellationToken);
            var recipeMap = recipes.ToDictionary(recipe => recipe.Id);

            var explicitRows = await _appDb.RecipeIngredients
                .AsNoTracking()
                .Include(row => row.Ingredient)
                .Where(row => recipeIds.Contains(row.RecipeId) && row.Ingredient != null)
                .ToListAsync(cancellationToken);
            var groupedRows = explicitRows
                .GroupBy(row => row.RecipeId)
                .ToDictionary(group => group.Key, group => (IReadOnlyCollection<RecipeIngredient>)group.ToList());

            var pantryIds = (await _appDb.ClientPantryItems
                .AsNoTracking()
                .Where(item => item.ClientId == clientId)
                .Select(item => item.IngredientId)
                .ToListAsync(cancellationToken))
                .ToHashSet();

            var items = favorites
                .Where(item => recipeMap.ContainsKey(item.RecipeId))
                .Select(item =>
                {
                    var recipe = recipeMap[item.RecipeId];
                    var groups = BuildIngredientGroups(recipe, groupedRows.GetValueOrDefault(recipe.Id) ?? Array.Empty<RecipeIngredient>());
                    var mandatoryCoverage = BuildCoverageGroup(groups.Mandatory, pantryIds);
                    var optionalCoverage = BuildCoverageGroup(groups.Optional, pantryIds);
                    var flavoringCoverage = BuildCoverageGroup(groups.Flavoring, pantryIds);
                    var coveragePercent = BuildCoveragePercent(mandatoryCoverage, optionalCoverage, flavoringCoverage);

                    return new DietitianClientFavoriteRecipeDto(
                        RecipeId: recipe.Id,
                        RecipeName: recipe.Name,
                        RecipeSlug: recipe.Slug,
                        SourceType: recipe.DietitianId == dietitianId.Value ? "clinic" : "general",
                        FavoritedAtUtc: item.LastFavoritedAtUtc,
                        PantryCoveragePercent: coveragePercent,
                        MissingMandatoryNames: mandatoryCoverage.Missing.Select(entry => entry.Name).ToList(),
                        CaloriesKcal: recipe.CaloriesKcal,
                        ProteinGrams: recipe.ProteinGrams,
                        CarbsGrams: recipe.CarbsGrams,
                        FatGrams: recipe.FatGrams);
                })
                .ToList();

            return Ok(new DietitianClientFavoriteRecipesDto(client.FullName, client.IsPremium, items));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load client favorite recipes for client {ClientId}", clientId);
            return StatusCode(500, ApiProblems.InternalServerError("CLIENT_FAVORITES_FETCH_FAILED", "Danışan favorileri alınamadı."));
        }
    }

    private async Task<Guid?> GetDietitianIdAsync(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return null;

        var user = await _authDb.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(account => account.Id == userGuid, cancellationToken);

        return user?.LinkedDietitianId;
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
            return new FavoriteIngredientGroups(explicitMandatory, explicitOptional, explicitFlavoring);

        return new FavoriteIngredientGroups(
            recipe.MandatoryIngredients.DistinctBy(item => item.Id).Select(ToIngredientLine).ToList(),
            recipe.OptionalIngredients.Where(item => !item.IsCondiment).DistinctBy(item => item.Id).Select(ToIngredientLine).ToList(),
            recipe.OptionalIngredients.Where(item => item.IsCondiment).DistinctBy(item => item.Id).Select(ToIngredientLine).ToList());
    }

    private static FavoriteCoverageGroup BuildCoverageGroup(
        IReadOnlyCollection<FavoriteIngredientLine> ingredients,
        IReadOnlySet<Guid> pantryIds)
    {
        var matched = ingredients.Where(item => pantryIds.Contains(item.Id)).ToList();
        var missing = ingredients.Where(item => !pantryIds.Contains(item.Id)).ToList();
        return new FavoriteCoverageGroup(matched, missing, ingredients.Count);
    }

    private static int BuildCoveragePercent(
        FavoriteCoverageGroup mandatory,
        FavoriteCoverageGroup optional,
        FavoriteCoverageGroup flavoring)
    {
        static decimal Ratio(FavoriteCoverageGroup group)
            => group.Total == 0 ? 1m : (decimal)group.Matched.Count / group.Total;

        return Math.Clamp((int)Math.Round(
            Ratio(mandatory) * 70m +
            Ratio(optional) * 20m +
            Ratio(flavoring) * 10m), 0, 100);
    }

    private static FavoriteIngredientLine ToIngredientLine(RecipeIngredient row)
        => new(row.IngredientId, row.Ingredient.CanonicalName, row.Quantity, row.Unit);

    private static FavoriteIngredientLine ToIngredientLine(Ingredient ingredient)
        => new(ingredient.Id, ingredient.CanonicalName, null, null);

    private sealed record FavoriteIngredientGroups(
        List<FavoriteIngredientLine> Mandatory,
        List<FavoriteIngredientLine> Optional,
        List<FavoriteIngredientLine> Flavoring);

    private sealed record FavoriteIngredientLine(
        Guid Id,
        string Name,
        decimal? Quantity,
        string? Unit);

    private sealed record FavoriteCoverageGroup(
        List<FavoriteIngredientLine> Matched,
        List<FavoriteIngredientLine> Missing,
        int Total);
}

public record DietitianFavoriteOverviewDto(
    int TotalActiveFavorites,
    int UniqueClientCount,
    List<DietitianFavoriteTopRecipeDto> TopRecipes,
    List<DietitianFavoriteActivityDto> RecentActivity)
{
    public static DietitianFavoriteOverviewDto Empty()
        => new(0, 0, new List<DietitianFavoriteTopRecipeDto>(), new List<DietitianFavoriteActivityDto>());
}

public record DietitianFavoriteTopRecipeDto(
    Guid RecipeId,
    string RecipeName,
    string Slug,
    string SourceType,
    int FavoriteCount,
    DateTime LastFavoritedAtUtc);

public record DietitianFavoriteActivityDto(
    Guid ClientId,
    string ClientName,
    bool ClientIsPremium,
    Guid RecipeId,
    string RecipeName,
    string RecipeSlug,
    string SourceType,
    DateTime FavoritedAtUtc);

public record DietitianClientFavoriteRecipesDto(
    string ClientName,
    bool ClientIsPremium,
    List<DietitianClientFavoriteRecipeDto> Items);

public record DietitianClientFavoriteRecipeDto(
    Guid RecipeId,
    string RecipeName,
    string RecipeSlug,
    string SourceType,
    DateTime FavoritedAtUtc,
    int PantryCoveragePercent,
    List<string> MissingMandatoryNames,
    int? CaloriesKcal,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams);
