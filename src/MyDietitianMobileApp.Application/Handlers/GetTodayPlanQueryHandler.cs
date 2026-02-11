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

    public GetTodayPlanQueryHandler(
        AppDbContext context, 
        AuthDbContext authDb)
    {
        _context = context;
        _authDb = authDb;
    }

    public async Task<GetTodayPlanResult?> Handle(GetTodayPlanQuery request, CancellationToken cancellationToken)
    {
        // ClientId is resolved in API layer (DietPlanController) from AuthDb.UserAccounts.LinkedClientId
        var clientId = request.ClientId;

        // Use UTC DateTime range to be robust against time zone / kind issues
        var todayStartUtc = DateTime.UtcNow.Date;           // Kind = Utc
        var tomorrowStartUtc = todayStartUtc.AddDays(1);

        // Get active diet plan for this client
        var plan = await _context.DietPlans
            .Where(p => p.ClientId == clientId && p.Status == DietPlanStatus.Active)
            .Include(p => p.Days.Where(d => d.Date >= DateOnly.FromDateTime(todayStartUtc) && d.Date < DateOnly.FromDateTime(tomorrowStartUtc)))
                .ThenInclude(d => d.Meals)
            .AsSplitQuery()
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
            Date = DateOnly.FromDateTime(todayStartUtc),
            DailyTargetCalories = todayDay.DailyTargetCalories,
            Meals = meals
        };
    }
}
