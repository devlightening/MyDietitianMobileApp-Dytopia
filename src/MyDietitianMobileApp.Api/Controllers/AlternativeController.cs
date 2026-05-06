using System.Net;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Alternative meal decision endpoint for clients.
/// </summary>
[Authorize(Roles = "Client")]
[ApiController]
[Route("api/alternative")]
public class AlternativeController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IMediator _mediator;
    private readonly IRecipeRepository _recipeRepository;
    private readonly ILogger<AlternativeController> _logger;

    public AlternativeController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IMediator mediator,
        IRecipeRepository recipeRepository,
        ILogger<AlternativeController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _mediator = mediator;
        _recipeRepository = recipeRepository;
        _logger = logger;
    }

    /// <summary>
    /// Decide whether the client can cook the planned recipe or needs an alternative.
    /// </summary>
    /// <remarks>
    /// This endpoint is intended for the mobile app and uses the client's linked dietitian
    /// as the source of truth for alternative recipe candidates.
    /// </remarks>
    [HttpPost("decide")]
    [ProducesResponseType(typeof(DecideAlternativeMealResult), (int)HttpStatusCode.OK)]
    public async Task<IActionResult> Decide([FromBody] AlternativeDecisionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            {
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Kimlik doğrulama gerekli"));
            }

            var user = await _authDb.UserAccounts
                .FirstOrDefaultAsync(u => u.Id == userGuid && u.Role == "Client", cancellationToken);

            if (user?.LinkedClientId == null)
            {
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));
            }

            var clientId = user.LinkedClientId.Value;

            // Determine the client's active dietitian from the binding table.
            var link = await _appDb.DietitianClientLinks
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.ClientId == clientId && l.IsActive, cancellationToken);

            if (link == null)
            {
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Active dietitian required",
                    Detail = "Aktif bir diyetisyen bağlantısı bulunamadı"
                };
                problem.Extensions["code"] = "NO_ACTIVE_DIETITIAN";
                return StatusCode((int)HttpStatusCode.Forbidden, problem);
            }

            // Validate and parse meal type (integer enum value from client)
            if (!Enum.IsDefined(typeof(Domain.Entities.MealType), request.MealType))
            {
                return BadRequest(ApiProblems.Validation("INVALID_MEAL_TYPE", "Geçersiz öğün tipi"));
            }

            var mealType = (Domain.Entities.MealType)request.MealType;

            var ingredientIds = request.ClientAvailableIngredients?.Distinct().ToList() ?? new List<Guid>();

            var query = new DecideAlternativeMealQuery(
                dietitianId: link.DietitianId,
                plannedRecipeId: request.PlannedRecipeId,
                mealType: mealType,
                clientAvailableIngredients: ingredientIds);

            var result = await _mediator.Send(query, cancellationToken);

            // Enrich with human-readable ingredient names for mobile display
            if (result.MissingIngredients.Count > 0)
            {
                var ids = result.MissingIngredients.ToHashSet();
                var nameMap = await _appDb.Ingredients
                    .Where(i => ids.Contains(i.Id))
                    .Select(i => new { i.Id, i.CanonicalName })
                    .ToListAsync(cancellationToken);
                result.MissingIngredientNames = result.MissingIngredients
                    .Select(id => nameMap.FirstOrDefault(n => n.Id == id)?.CanonicalName ?? string.Empty)
                    .Where(n => !string.IsNullOrEmpty(n))
                    .ToList();
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Alternative meal decision failed");
            return StatusCode(
                (int)HttpStatusCode.InternalServerError,
                ApiProblems.InternalServerError("ALTERNATIVE_DECISION_FAILED", "Alternatif kararlandırma başarısız"));
        }
    }

    /// <summary>
    /// Alias route for documentation and future canonicalization.
    /// </summary>
    [HttpPost("~/api/recipes/decide-alternative")]
    [ProducesResponseType(typeof(DecideAlternativeMealResult), (int)HttpStatusCode.OK)]
    public Task<IActionResult> DecideAlias([FromBody] AlternativeDecisionRequest request, CancellationToken cancellationToken)
        => Decide(request, cancellationToken);

    /// <summary>
    /// Returns the full ingredient list and recipe detail for a planned recipe.
    /// Used by the mobile CheckIngredientsScreen and PlanRecipeDetail flow.
    /// </summary>
    [HttpGet("~/api/client/recipes/{recipeId:guid}/plan-context")]
    [ProducesResponseType(typeof(RecipePlanContextResult), (int)HttpStatusCode.OK)]
    public async Task<IActionResult> GetRecipePlanContext(Guid recipeId, CancellationToken cancellationToken)
    {
        try
        {
            var userId = User.GetUserId();
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Kimlik doğrulama gerekli"));

            var user = await _authDb.UserAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userGuid && u.Role == "Client", cancellationToken);

            if (user?.LinkedClientId == null)
                return Unauthorized(ApiProblems.Unauthorized("AUTH_REQUIRED", "Client hesabı bulunamadı"));

            // Load all recipes with ingredients (uses proven, cached repository path)
            var allRecipes = await _recipeRepository.GetAllWithIngredientsAsync(cancellationToken);
            var recipe = allRecipes.FirstOrDefault(r => r.Id == recipeId);

            if (recipe == null)
                return NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Recipe not found",
                    Detail = "Tarif bulunamadı"
                });

            var explicitRows = await _appDb.RecipeIngredients
                .AsNoTracking()
                .Where(x => x.RecipeId == recipeId)
                .Include(x => x.Ingredient)
                .Where(x => x.Ingredient != null)
                .ToListAsync(cancellationToken);

            var groups = BuildPlanContextIngredientGroups(recipe, explicitRows);
            var pantryIds = (await _appDb.ClientPantryItems
                .AsNoTracking()
                .Where(x => x.ClientId == user.LinkedClientId.Value)
                .Select(x => x.IngredientId)
                .ToListAsync(cancellationToken))
                .ToHashSet();
            var isFavorited = await _appDb.ClientRecipeFavorites
                .AsNoTracking()
                .AnyAsync(
                    item => item.ClientId == user.LinkedClientId.Value &&
                            item.RecipeId == recipeId &&
                            item.IsActive,
                    cancellationToken);

            var mandatoryCoverage = BuildCoverageGroup(groups.Mandatory, pantryIds);
            var optionalCoverage = BuildCoverageGroup(groups.Optional, pantryIds);
            var flavoringCoverage = BuildCoverageGroup(groups.Flavoring, pantryIds);

            var result = new RecipePlanContextResult
            {
                RecipeId = recipe.Id,
                RecipeName = recipe.Name,
                Description = recipe.Description,
                Steps = recipe.Steps.ToList(),
                CaloriesKcal = recipe.CaloriesKcal,
                ProteinGrams = recipe.ProteinGrams,
                CarbsGrams = recipe.CarbsGrams,
                FatGrams = recipe.FatGrams,
                IsFavorited = isFavorited,
                Ingredients = new RecipeIngredientGroupsDto
                {
                    Mandatory = ToIngredientInfo(groups.Mandatory),
                    Optional = ToIngredientInfo(groups.Optional),
                    Flavoring = ToIngredientInfo(groups.Flavoring)
                },
                MatchedGroups = new RecipeIngredientGroupsDto
                {
                    Mandatory = mandatoryCoverage.Matched,
                    Optional = optionalCoverage.Matched,
                    Flavoring = flavoringCoverage.Matched
                },
                MissingGroups = new RecipeIngredientGroupsDto
                {
                    Mandatory = mandatoryCoverage.Missing,
                    Optional = optionalCoverage.Missing,
                    Flavoring = flavoringCoverage.Missing
                },
                Coverage = BuildCoverageSummary(mandatoryCoverage, optionalCoverage, flavoringCoverage)
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Recipe plan context fetch failed for recipeId={RecipeId}", recipeId);
            return StatusCode(
                (int)HttpStatusCode.InternalServerError,
                ApiProblems.InternalServerError("PLAN_CONTEXT_FAILED", "Tarif detayı alınamadı"));
        }
    }

    private static PlanContextIngredientGroups BuildPlanContextIngredientGroups(
        Recipe recipe,
        IReadOnlyCollection<RecipeIngredient> explicitRows)
    {
        var explicitMandatory = explicitRows
            .Where(x => x.Role == RecipeIngredient.MandatoryRole)
            .Select(ToPlanContextIngredient)
            .DistinctBy(x => x.Id)
            .ToList();
        var explicitOptional = explicitRows
            .Where(x => x.Role == RecipeIngredient.OptionalRole)
            .Select(ToPlanContextIngredient)
            .DistinctBy(x => x.Id)
            .ToList();
        var explicitFlavoring = explicitRows
            .Where(x => x.Role == RecipeIngredient.FlavoringRole)
            .Select(ToPlanContextIngredient)
            .DistinctBy(x => x.Id)
            .ToList();

        var mandatory = explicitMandatory.Count > 0
            ? explicitMandatory
            : recipe.MandatoryIngredients.DistinctBy(x => x.Id).Select(ToPlanContextIngredient).ToList();

        if (explicitOptional.Count > 0 || explicitFlavoring.Count > 0)
            return new PlanContextIngredientGroups(mandatory, explicitOptional, explicitFlavoring);

        return new PlanContextIngredientGroups(
            mandatory,
            recipe.OptionalIngredients.Where(x => !x.IsCondiment).DistinctBy(x => x.Id).Select(ToPlanContextIngredient).ToList(),
            recipe.OptionalIngredients.Where(x => x.IsCondiment).DistinctBy(x => x.Id).Select(ToPlanContextIngredient).ToList());
    }

    private static RecipeCoverageGroupDto BuildCoverageGroup(
        IReadOnlyCollection<PlanContextIngredient> ingredients,
        IReadOnlySet<Guid> pantryIds)
    {
        var matched = ingredients
            .Where(x => pantryIds.Contains(x.Id))
            .Select(ToIngredientInfo)
            .ToList();
        var missing = ingredients
            .Where(x => !pantryIds.Contains(x.Id))
            .Select(ToIngredientInfo)
            .ToList();

        return new RecipeCoverageGroupDto
        {
            Matched = matched,
            Missing = missing,
            Total = ingredients.Count,
            MatchedCount = matched.Count,
            MissingCount = missing.Count
        };
    }

    private static RecipeCoverageSummaryDto BuildCoverageSummary(
        RecipeCoverageGroupDto mandatory,
        RecipeCoverageGroupDto optional,
        RecipeCoverageGroupDto flavoring)
    {
        static decimal Ratio(RecipeCoverageGroupDto group)
            => group.Total == 0 ? 1m : (decimal)group.MatchedCount / group.Total;

        var weightedPercent = (int)Math.Round(
            Ratio(mandatory) * 70m +
            Ratio(optional) * 20m +
            Ratio(flavoring) * 10m);

        return new RecipeCoverageSummaryDto
        {
            Percent = Math.Clamp(weightedPercent, 0, 100),
            MatchedCount = mandatory.MatchedCount + optional.MatchedCount + flavoring.MatchedCount,
            MissingCount = mandatory.MissingCount + optional.MissingCount + flavoring.MissingCount,
            Mandatory = mandatory,
            Optional = optional,
            Flavoring = flavoring,
            MandatoryPercent = (int)Math.Round(Ratio(mandatory) * 100m),
            OptionalPercent = (int)Math.Round(Ratio(optional) * 100m),
            FlavoringPercent = (int)Math.Round(Ratio(flavoring) * 100m),
            MandatoryWeight = 70,
            OptionalWeight = 20,
            FlavoringWeight = 10
        };
    }

    private static List<IngredientInfoDto> ToIngredientInfo(IEnumerable<PlanContextIngredient> ingredients)
        => ingredients
            .DistinctBy(x => x.Id)
            .Select(ToIngredientInfo)
            .ToList();

    private static PlanContextIngredient ToPlanContextIngredient(RecipeIngredient row)
        => new(
            row.IngredientId,
            row.Ingredient!.CanonicalName,
            row.Quantity,
            row.Unit);

    private static PlanContextIngredient ToPlanContextIngredient(Ingredient ingredient)
        => new(ingredient.Id, ingredient.CanonicalName, null, null);

    private static IngredientInfoDto ToIngredientInfo(PlanContextIngredient ingredient)
        => new()
        {
            Id = ingredient.Id,
            Name = ingredient.Name,
            Quantity = ingredient.Quantity,
            Unit = ingredient.Unit,
            DisplayAmount = FormatDisplayAmount(ingredient.Quantity, ingredient.Unit)
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
}

/// <summary>
/// Plan context for a recipe — used by the mobile ingredient checklist and recipe detail screens.
/// </summary>
public class RecipePlanContextResult
{
    public Guid RecipeId { get; set; }
    public string RecipeName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Steps { get; set; } = new();
    public int? CaloriesKcal { get; set; }
    public decimal? ProteinGrams { get; set; }
    public decimal? CarbsGrams { get; set; }
    public decimal? FatGrams { get; set; }
    public bool IsFavorited { get; set; }
    public RecipeIngredientGroupsDto Ingredients { get; set; } = new();
    public RecipeIngredientGroupsDto MatchedGroups { get; set; } = new();
    public RecipeIngredientGroupsDto MissingGroups { get; set; } = new();
    public RecipeCoverageSummaryDto Coverage { get; set; } = new();
}

public class RecipeIngredientGroupsDto
{
    public List<IngredientInfoDto> Mandatory { get; set; } = new();
    public List<IngredientInfoDto> Optional { get; set; } = new();
    public List<IngredientInfoDto> Flavoring { get; set; } = new();
}

public class RecipeCoverageGroupDto
{
    public List<IngredientInfoDto> Matched { get; set; } = new();
    public List<IngredientInfoDto> Missing { get; set; } = new();
    public int Total { get; set; }
    public int MatchedCount { get; set; }
    public int MissingCount { get; set; }
}

public class RecipeCoverageSummaryDto
{
    public int Percent { get; set; }
    public int MatchedCount { get; set; }
    public int MissingCount { get; set; }
    public int MandatoryPercent { get; set; }
    public int OptionalPercent { get; set; }
    public int FlavoringPercent { get; set; }
    public int MandatoryWeight { get; set; }
    public int OptionalWeight { get; set; }
    public int FlavoringWeight { get; set; }
    public RecipeCoverageGroupDto Mandatory { get; set; } = new();
    public RecipeCoverageGroupDto Optional { get; set; } = new();
    public RecipeCoverageGroupDto Flavoring { get; set; } = new();
}

public class IngredientInfoDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string? DisplayAmount { get; set; }
}

internal sealed record PlanContextIngredient(
    Guid Id,
    string Name,
    decimal? Quantity,
    string? Unit);

internal sealed record PlanContextIngredientGroups(
    List<PlanContextIngredient> Mandatory,
    List<PlanContextIngredient> Optional,
    List<PlanContextIngredient> Flavoring);

/// <summary>
/// Request payload for alternative meal decision.
/// </summary>
public class AlternativeDecisionRequest
{
    /// <summary>
    /// Identifier of the planned recipe (from the client's plan or selection).
    /// </summary>
    public Guid PlannedRecipeId { get; set; }

    /// <summary>
    /// Meal type as integer enum (1 = Breakfast, 2 = Lunch, 3 = Dinner, 4 = Snack).
    /// </summary>
    public int MealType { get; set; }

    /// <summary>
    /// Ingredient IDs currently available to the client.
    /// </summary>
    public List<Guid> ClientAvailableIngredients { get; set; } = new();
}

