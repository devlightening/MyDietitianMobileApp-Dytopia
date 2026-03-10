using System.Net;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Queries;
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
    private readonly ILogger<AlternativeController> _logger;

    public AlternativeController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IMediator mediator,
        ILogger<AlternativeController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _mediator = mediator;
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
}

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

