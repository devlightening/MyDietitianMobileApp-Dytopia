using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Security.Claims;
using MyDietitianMobileApp.Api.Extensions;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages recipes: creation and listing
/// </summary>
[Authorize]
[ApiController]
[Route("api/recipes")]
public class RecipeController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AuthDbContext _authDb;

    public RecipeController(
        IMediator mediator,
        AuthDbContext authDb)
    {
        _mediator = mediator;
        _authDb = authDb;
    }

    /// <summary>
    /// Create new recipe
    /// </summary>
    [HttpPost]
    [Authorize("Dietitian")]
    public async Task<IActionResult> CreateRecipe([FromBody] CreateRecipeRequest request)
    {
        if (!User.TryGetUserIdAsGuid(out var userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Dietitian");
        if (user?.LinkedDietitianId == null)
            return Unauthorized();

        var ingredients = request.Ingredients.Select(i => new CreateRecipeIngredientDto(
            i.IngredientId,
            i.IsMandatory,
            i.IsProhibited
        )).ToList();

        var command = new CreateRecipeCommand(
            user.LinkedDietitianId.Value,
            request.Name,
            request.Description,
            ingredients
        );

        var result = await _mediator.Send(command);
        return Ok(result);
    }

    /// <summary>
    /// List all recipes for authenticated dietitian
    /// </summary>
    [HttpGet]
    [Authorize("Dietitian")]
    public async Task<IActionResult> ListRecipes()
    {
        if (!User.TryGetUserIdAsGuid(out var userId))
            return Unauthorized();

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Dietitian");
        if (user?.LinkedDietitianId == null)
            return Unauthorized();

        var query = new ListRecipesByActiveDietitianQuery(user.LinkedDietitianId.Value);
        var result = await _mediator.Send(query);
        return Ok(result);
    }
}

// DTOs
public record CreateRecipeRequest(string Name, string Description, List<RecipeIngredientRequest> Ingredients);
public record RecipeIngredientRequest(Guid IngredientId, bool IsMandatory, bool IsProhibited);
