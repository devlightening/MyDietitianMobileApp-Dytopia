using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Security.Claims;

namespace MyDietitianMobileApp.Application.Queries;

public class GetTodayPlanQueryHandler : IRequestHandler<GetTodayPlanQuery, GetTodayPlanResult?>
{
    private readonly AppDbContext _context;
    private readonly AuthDbContext _authDb;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public GetTodayPlanQueryHandler(
        AppDbContext context, 
        AuthDbContext authDb,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _authDb = authDb;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<GetTodayPlanResult?> Handle(GetTodayPlanQuery request, CancellationToken cancellationToken)
    {
        // Extract userId from JWT claims
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? _httpContextAccessor.HttpContext?.User.FindFirst("sub")?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedAccessException("User ID not found in token");
        }

        // Get user and client
        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null || !user.LinkedClientId.HasValue)
        {
            throw new UnauthorizedAccessException("Client not found for user");
        }

        var clientId = user.LinkedClientId.Value;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Get active diet plan for this client
        var plan = await _context.DietPlans
            .Where(p => p.ClientId == clientId && p.Status == DietPlanStatus.Active)
            .Include(p => p.Days.Where(d => d.Date == today))
                .ThenInclude(d => d.Meals)
            .FirstOrDefaultAsync(cancellationToken);

        if (plan == null)
        {
            // No active plan - return null so controller can return 404
            return null!;
        }

        var todayDay = plan.Days.FirstOrDefault();

        if (todayDay == null)
        {
            // Plan exists but no meals for today - return null so controller can return 404
            return null;
        }

        // Get recipe names for planned meals
        var recipeIds = todayDay.Meals
            .Where(m => m.PlannedRecipeId.HasValue)
            .Select(m => m.PlannedRecipeId!.Value)
            .ToList();

        var recipes = await _context.Recipes
            .Where(r => recipeIds.Contains(r.Id))
            .Select(r => new { r.Id, r.Name })
            .ToListAsync(cancellationToken);

        var recipeDict = recipes.ToDictionary(r => r.Id, r => r.Name);

        // Map to DTOs
        var meals = todayDay.Meals.Select(m => new TodayMealDto
        {
            Id = m.Id,
            Type = m.Type,
            PlannedRecipeName = m.PlannedRecipeId.HasValue && recipeDict.ContainsKey(m.PlannedRecipeId.Value)
                ? recipeDict[m.PlannedRecipeId.Value]
                : null,
            CustomName = m.CustomName,
            IsMandatory = m.IsMandatory
        }).ToList();

        return new GetTodayPlanResult
        {
            Date = today,
            DailyTargetCalories = todayDay.DailyTargetCalories,
            Meals = meals
        };
    }
}
