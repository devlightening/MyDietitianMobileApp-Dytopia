using MediatR;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class GetLiveClientsQueryHandler : IRequestHandler<GetLiveClientsQuery, GetLiveClientsResult>
    {
        private readonly AppDbContext _context;
        private readonly IComplianceCalculationService _calculationService;

        public GetLiveClientsQueryHandler(
            AppDbContext context,
            IComplianceCalculationService calculationService)
        {
            _context = context;
            _calculationService = calculationService;
        }

        public async Task<GetLiveClientsResult> Handle(GetLiveClientsQuery query, CancellationToken cancellationToken)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            // Get active clients for this dietitian
            var clients = await _context.Clients
                .Where(c => c.ActiveDietitianId == query.DietitianId && c.IsActive)
                .ToListAsync();

            var liveClients = new List<LiveClientDto>();

            foreach (var client in clients)
            {
                // Get active diet plan
                var dietPlan = await _context.DietPlans
                    .FirstOrDefaultAsync(p => p.ClientId == client.Id
                        && p.DietitianId == query.DietitianId
                        && p.Status == DietPlanStatus.Active
                        && today >= DateOnly.FromDateTime(p.StartDate)
                        && today <= DateOnly.FromDateTime(p.EndDate));

                if (dietPlan == null)
                    continue;

                // Get today's compliance
                var todayCompliance = await _calculationService.CalculateDailyComplianceAsync(
                    client.Id,
                    dietPlan.Id,
                    today);

                // Get last activity (last 30 minutes)
                var thirtyMinutesAgo = DateTime.UtcNow.AddMinutes(-30);
                var lastCompliance = await _context.MealItemCompliance
                    .Where(c => c.ClientId == client.Id && c.MarkedAt >= thirtyMinutesAgo)
                    .OrderByDescending(c => c.MarkedAt)
                    .FirstOrDefaultAsync();

                // Get current meal (if any meal is in progress today)
                var dietDay = await _context.DietPlanDays
                    .FirstOrDefaultAsync(d => d.DietPlanId == dietPlan.Id && d.Date == today);

                string? currentMeal = null;
                string? lastMealItem = null;

                if (dietDay != null)
                {
                    var meals = await _context.DietPlanMeals
                        .Where(m => m.DietPlanDayId == dietDay.Id)
                        .OrderBy(m => m.Type)
                        .ToListAsync();

                    // Find the current meal based on time (simplified logic)
                    var currentHour = DateTime.UtcNow.Hour;
                    if (currentHour >= 6 && currentHour < 10)
                        currentMeal = "Breakfast";
                    else if (currentHour >= 12 && currentHour < 15)
                        currentMeal = "Lunch";
                    else if (currentHour >= 18 && currentHour < 22)
                        currentMeal = "Dinner";
                    else
                        currentMeal = "Snack";

                    // Get last meal item name
                    if (lastCompliance != null)
                    {
                        var lastMealItemEntity = await _context.MealItems
                            .FirstOrDefaultAsync(mi => mi.Id == lastCompliance.MealItemId);
                        
                        if (lastMealItemEntity != null)
                        {
                            var ingredient = await _context.Ingredients
                                .FirstOrDefaultAsync(i => i.Id == lastMealItemEntity.IngredientId);
                            lastMealItem = ingredient?.Name ?? "Unknown";
                        }
                    }
                }

                liveClients.Add(new LiveClientDto
                {
                    ClientId = client.Id,
                    ClientName = client.FullName,
                    LastActivity = lastCompliance?.MarkedAt,
                    TodayCompliancePercentage = todayCompliance,
                    CurrentMeal = currentMeal,
                    LastMealItem = lastMealItem
                });
            }

            return new GetLiveClientsResult(liveClients);
        }
    }
}

