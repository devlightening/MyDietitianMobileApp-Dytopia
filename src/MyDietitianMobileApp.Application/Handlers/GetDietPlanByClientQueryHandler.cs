using MediatR;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class GetDietPlanByClientQueryHandler : IRequestHandler<GetDietPlanByClientQuery, GetDietPlanByClientResult?>
    {
        private readonly AppDbContext _context;

        public GetDietPlanByClientQueryHandler(AppDbContext context)
        {
            _context = context;
        }

        public async Task<GetDietPlanByClientResult?> Handle(GetDietPlanByClientQuery request, CancellationToken cancellationToken)
        {
            // Verify dietitian owns this client
            var client = await _context.Clients
                .FirstOrDefaultAsync(c => c.Id == request.ClientId && c.ActiveDietitianId == request.DietitianId, cancellationToken);

            if (client == null)
                return null;

            // Build query
            var query = _context.DietPlans
                .Where(p => p.ClientId == request.ClientId && p.DietitianId == request.DietitianId);

            if (request.ActiveOnly)
            {
                query = query.Where(p => p.Status == DietPlanStatus.Active);
            }

            // Get the most recent plan
            var dietPlan = await query
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefaultAsync(cancellationToken);

            if (dietPlan == null)
                return null;

            // Load days and meals
            var days = await _context.DietPlanDays
                .Where(d => d.DietPlanId == dietPlan.Id)
                .OrderBy(d => d.Date)
                .ToListAsync(cancellationToken);

            var dayDtos = new List<DietPlanDayDto>();
            foreach (var day in days)
            {
                var meals = await _context.DietPlanMeals
                    .Where(m => m.DietPlanDayId == day.Id)
                    .OrderBy(m => m.Type)
                    .ToListAsync(cancellationToken);

                var mealDtos = new List<DietPlanMealDto>();
                foreach (var meal in meals)
                {
                    string? recipeName = null;
                    if (meal.PlannedRecipeId.HasValue)
                    {
                        var recipe = await _context.Recipes
                            .FirstOrDefaultAsync(r => r.Id == meal.PlannedRecipeId.Value, cancellationToken);
                        recipeName = recipe?.Name;
                    }

                    mealDtos.Add(new DietPlanMealDto
                    {
                        Id = meal.Id,
                        Type = meal.Type,
                        PlannedRecipeId = meal.PlannedRecipeId,
                        PlannedRecipeName = recipeName,
                        CustomName = meal.CustomName,
                        IsMandatory = meal.IsMandatory
                    });
                }

                dayDtos.Add(new DietPlanDayDto
                {
                    Id = day.Id,
                    Date = day.Date,
                    DailyTargetCalories = day.DailyTargetCalories,
                    Meals = mealDtos
                });
            }

            return new GetDietPlanByClientResult
            {
                DietPlanId = dietPlan.Id,
                DietitianId = dietPlan.DietitianId,
                ClientId = dietPlan.ClientId,
                ClientName = client.FullName,
                Name = dietPlan.Name,
                StartDate = dietPlan.StartDate,
                EndDate = dietPlan.EndDate,
                Status = dietPlan.Status,
                Days = dayDtos
            };
        }
    }
}
