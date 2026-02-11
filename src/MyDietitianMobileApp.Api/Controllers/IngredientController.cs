using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MediatR;
using MyDietitianMobileApp.Api.Problems;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages ingredients: search and admin CRUD operations
/// </summary>
[ApiController]
[Route("api")]
public class IngredientController : ControllerBase
{
    private readonly IMediator _mediator;

    public IngredientController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Search ingredients with pagination (public, searches canonicalName and aliases)
    /// </summary>
    [HttpGet("ingredients/search")]
    [AllowAnonymous]
    public async Task<IActionResult> SearchIngredients(
        [FromQuery] string? q = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        if (string.IsNullOrWhiteSpace(q))
        {
            return Ok(new { page, pageSize, total = 0, ingredients = Array.Empty<object>() });
        }

        var query = new MyDietitianMobileApp.Application.Queries.SearchIngredientsQuery(q.Trim(), maxResults: pageSize);
        var result = (MyDietitianMobileApp.Application.Queries.SearchIngredientsResult)await _mediator.Send(query);
        
        // Note: SearchIngredientsQuery currently doesn't support pagination internally,
        // so we'll return all results with pagination metadata
        var total = result.Ingredients.Count();
        var ingredients = result.Ingredients
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return Ok(new { page, pageSize, total, ingredients });
    }

    /// <summary>
    /// List all ingredients (admin)
    /// </summary>
    [HttpGet("admin/ingredients")]
    [Authorize("Admin")]
    public async Task<IActionResult> ListAllIngredients()
    {
        var query = new MyDietitianMobileApp.Application.Queries.ListAllIngredientsQuery();
        var result = (MyDietitianMobileApp.Application.Queries.ListAllIngredientsResult)await _mediator.Send(query);
        return Ok(new { ingredients = result.Ingredients });
    }

    /// <summary>
    /// Create ingredient (admin)
    /// </summary>
    [HttpPost("admin/ingredients")]
    [Authorize("Admin")]
    public async Task<IActionResult> CreateIngredient([FromBody] CreateIngredientRequest request)
    {
        var command = new MyDietitianMobileApp.Application.Commands.CreateIngredientCommand(
            request.CanonicalName,
            request.Aliases,
            request.IsActive
        );

        var result = (MyDietitianMobileApp.Application.Commands.CreateIngredientResult)await _mediator.Send(command);
        return Ok(new { ingredientId = result.IngredientId });
    }

    /// <summary>
    /// Update ingredient (admin)
    /// </summary>
    [HttpPut("admin/ingredients/{id}")]
    [Authorize("Admin")]
    public async Task<IActionResult> UpdateIngredient(Guid id, [FromBody] UpdateIngredientRequest request)
    {
        var command = new MyDietitianMobileApp.Application.Commands.UpdateIngredientCommand(
            id,
            request.CanonicalName,
            request.Aliases,
            request.IsActive
        );

        var result = (MyDietitianMobileApp.Application.Commands.UpdateIngredientResult)await _mediator.Send(command);
        return Ok(new { success = result.Success });
    }

    /// <summary>
    /// Toggle ingredient active status (admin)
    /// </summary>
    [HttpPatch("admin/ingredients/{id}/toggle-active")]
    [Authorize("Admin")]
    public async Task<IActionResult> ToggleActive(Guid id, [FromBody] ToggleIngredientActiveRequest request)
    {
        var command = new MyDietitianMobileApp.Application.Commands.ToggleIngredientActiveCommand(id, request.IsActive);
        var result = (MyDietitianMobileApp.Application.Commands.ToggleIngredientActiveResult)await _mediator.Send(command);
        return Ok(new { success = result.Success });
    }
}

// DTOs
public record CreateIngredientRequest(string CanonicalName, List<string> Aliases, bool IsActive);
public record UpdateIngredientRequest(string CanonicalName, List<string> Aliases, bool IsActive);
public record ToggleIngredientActiveRequest(bool IsActive);
