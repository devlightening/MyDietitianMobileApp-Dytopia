using MediatR;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class GetDailyComplianceQueryHandler 
        : IRequestHandler<GetDailyComplianceQuery, GetDailyComplianceResult>
    {
        private readonly AppDbContext _context;
        private readonly IComplianceCalculationService _calculationService;

        public GetDailyComplianceQueryHandler(
            AppDbContext context,
            IComplianceCalculationService calculationService)
        {
            _context = context;
            _calculationService = calculationService;
        }

        public async Task<GetDailyComplianceResult> Handle(
            GetDailyComplianceQuery query, 
            CancellationToken cancellationToken)
        {
            // Verify dietitian owns this client
            var client = await _context.Clients
                .FirstOrDefaultAsync(c => c.Id == query.ClientId && c.ActiveDietitianId == query.DietitianId);

            if (client == null)
                throw new UnauthorizedAccessException("Dietitian does not have access to this client.");

            // Get active diet plan for this client
            var dietPlan = await _context.DietPlans
                .FirstOrDefaultAsync(p => p.ClientId == query.ClientId 
                    && p.DietitianId == query.DietitianId 
                    && p.Status == DietPlanStatus.Active
                    && query.Date >= DateOnly.FromDateTime(p.StartDate)
                    && query.Date <= DateOnly.FromDateTime(p.EndDate));

            if (dietPlan == null)
            {
                // Return empty result if no plan
                return new GetDailyComplianceResult(
                    query.ClientId,
                    client.FullName,
                    query.Date,
                    0m,
                    new List<DailyComplianceMealDto>()
                );
            }

            // Get diet day
            var dietDay = await _context.DietPlanDays
                .FirstOrDefaultAsync(d => d.DietPlanId == dietPlan.Id && d.Date == query.Date);

            if (dietDay == null)
            {
                return new GetDailyComplianceResult(
                    query.ClientId,
                    client.FullName,
                    query.Date,
                    0m,
                    new List<DailyComplianceMealDto>()
                );
            }

            // Get all meals for this day
            var meals = await _context.DietPlanMeals
                .Where(m => m.DietPlanDayId == dietDay.Id)
                .OrderBy(m => m.Type)
                .ToListAsync();

            var mealDtos = new List<DailyComplianceMealDto>();

            foreach (var meal in meals)
            {
                // Get meal items
                var mealItems = await _context.MealItems
                    .Where(mi => mi.MealId == meal.Id)
                    .ToListAsync();

                // Get compliance records
                var complianceRecords = await _context.MealItemCompliance
                    .Where(c => c.ClientId == query.ClientId
                        && c.DietDayId == dietDay.Id
                        && mealItems.Select(mi => mi.Id).Contains(c.MealItemId))
                    .ToListAsync();

                // Get ingredients
                var ingredientIds = mealItems.Select(mi => mi.IngredientId).Distinct().ToList();
                var ingredients = await _context.Ingredients
                    .Where(i => ingredientIds.Contains(i.Id))
                    .ToDictionaryAsync(i => i.Id, i => i.CanonicalName);

                // Build item DTOs
                var itemDtos = mealItems.Select(mi =>
                {
                    var compliance = complianceRecords.FirstOrDefault(c => c.MealItemId == mi.Id);
                    var alternativeIngredientName = compliance?.AlternativeIngredientId != null
                        ? ingredients.GetValueOrDefault(compliance.AlternativeIngredientId.Value, "Unknown")
                        : null;

                    return new DailyComplianceItemDto
                    {
                        MealItemId = mi.Id,
                        IngredientId = mi.IngredientId,
                        IngredientName = ingredients.GetValueOrDefault(mi.IngredientId, "Unknown"),
                        IsMandatory = mi.IsMandatory,
                        Status = compliance?.Status,
                        MarkedAt = compliance?.MarkedAt,
                        AlternativeIngredientId = compliance?.AlternativeIngredientId,
                        AlternativeIngredientName = alternativeIngredientName
                    };
                }).ToList();

                // Calculate meal compliance
                var mealCompliance = await _calculationService.CalculateMealComplianceAsync(
                    query.ClientId,
                    meal.Id,
                    query.Date);

                mealDtos.Add(new DailyComplianceMealDto
                {
                    MealId = meal.Id,
                    MealType = meal.Type,
                    MealName = meal.CustomName ?? (meal.PlannedRecipeId != null ? "Recipe" : "Custom"),
                    CompliancePercentage = mealCompliance,
                    Items = itemDtos
                });
            }

            // Calculate daily compliance
            var dailyCompliance = await _calculationService.CalculateDailyComplianceAsync(
                query.ClientId,
                dietPlan.Id,
                query.Date);

            return new GetDailyComplianceResult(
                query.ClientId,
                client.FullName,
                query.Date,
                dailyCompliance,
                mealDtos
            );
        }
    }
}

