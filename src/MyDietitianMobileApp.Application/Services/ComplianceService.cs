using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Services;

public class ComplianceService : IComplianceService
{
    private readonly AppDbContext _appDb;

    public ComplianceService(AppDbContext appDb)
    {
        _appDb = appDb;
    }

    public async Task RecordMealCompletionAsync(Guid clientId, Guid dietitianId, Guid dietPlanMealId, MealCompletionStatus status, string? note = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Verify DietPlanMealId belongs to today's active plan for this client and dietitian
        var meal = await _appDb.PlanMealItems
            .Include(pmi => pmi.Plan)
            .FirstOrDefaultAsync(pmi =>
                pmi.Id == dietPlanMealId &&
                pmi.Plan.ClientId == clientId &&
                pmi.Plan.CreatedBy == dietitianId &&
                DateOnly.FromDateTime(pmi.Plan.Date) == today &&
                pmi.Plan.Status == MealPlanStatus.Published);

        if (meal == null)
            throw new InvalidOperationException($"DietPlanMeal {dietPlanMealId} not found for today's plan");

        // Upsert MealCompletion
        var existing = await _appDb.MealCompletions
            .FirstOrDefaultAsync(mc => mc.ClientId == clientId && mc.DietPlanMealId == dietPlanMealId);

        if (existing != null)
        {
            existing.Update(status, note);
        }
        else
        {
            var completion = new MealCompletion(clientId, dietitianId, dietPlanMealId, status, note);
            _appDb.MealCompletions.Add(completion);
        }

        // Recalculate and update DailyComplianceSnapshot
        await UpdateSnapshotAsync(clientId, dietitianId, today);

        await _appDb.SaveChangesAsync();
    }

    public async Task<DailyComplianceDto> GetTodayAsync(Guid clientId, Guid dietitianId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var snapshot = await _appDb.DailyComplianceSnapshots
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ClientId == clientId && s.Date == today);

        if (snapshot != null)
        {
            return new DailyComplianceDto(
                snapshot.Date,
                snapshot.PlannedCount,
                snapshot.CompletedCount,
                snapshot.SkippedCount,
                snapshot.Score0_100,
                CalculateStatus(snapshot.PlannedCount, snapshot.Score0_100));
        }

        // Compute on-the-fly if snapshot missing
        return await ComputeDailyComplianceAsync(clientId, dietitianId, today);
    }

    public async Task<RangeComplianceDto> GetRangeAsync(Guid clientId, Guid dietitianId, DateOnly from, DateOnly to)
    {
        var snapshots = await _appDb.DailyComplianceSnapshots
            .AsNoTracking()
            .Where(s => s.ClientId == clientId && s.Date >= from && s.Date <= to)
            .OrderBy(s => s.Date)
            .ToListAsync();

        var days = new List<DailyComplianceDto>();
        var currentDate = from;

        while (currentDate <= to)
        {
            var snapshot = snapshots.FirstOrDefault(s => s.Date == currentDate);
            if (snapshot != null)
            {
                days.Add(new DailyComplianceDto(
                    snapshot.Date,
                    snapshot.PlannedCount,
                    snapshot.CompletedCount,
                    snapshot.SkippedCount,
                    snapshot.Score0_100,
                    CalculateStatus(snapshot.PlannedCount, snapshot.Score0_100)));
            }
            else
            {
                // Compute missing day
                var computed = await ComputeDailyComplianceAsync(clientId, dietitianId, currentDate);
                days.Add(computed);
            }

            currentDate = currentDate.AddDays(1);
        }

        return new RangeComplianceDto(from, to, days);
    }

    private async Task UpdateSnapshotAsync(Guid clientId, Guid dietitianId, DateOnly date)
    {
        // Get planned meals for this day
        var plannedMeals = await _appDb.PlanMealItems
            .Include(pmi => pmi.Plan)
            .Where(pmi =>
                pmi.Plan.ClientId == clientId &&
                pmi.Plan.CreatedBy == dietitianId &&
                DateOnly.FromDateTime(pmi.Plan.Date) == date &&
                pmi.Plan.Status == MealPlanStatus.Published)
            .CountAsync();

        // Get completions
        var mealIds = await _appDb.PlanMealItems
            .Include(pmi => pmi.Plan)
            .Where(pmi =>
                pmi.Plan.ClientId == clientId &&
                pmi.Plan.CreatedBy == dietitianId &&
                DateOnly.FromDateTime(pmi.Plan.Date) == date &&
                pmi.Plan.Status == MealPlanStatus.Published)
            .Select(pmi => pmi.Id)
            .ToListAsync();

        var completions = await _appDb.MealCompletions
            .Where(mc => mc.ClientId == clientId && mealIds.Contains(mc.DietPlanMealId))
            .ToListAsync();

        var doneCount = completions.Count(c => c.Status == MealCompletionStatus.Done);
        var skippedCount = completions.Count(c => c.Status == MealCompletionStatus.Skipped);
        var score = plannedMeals > 0 ? (int)Math.Round((double)doneCount / plannedMeals * 100) : 0;

        var snapshot = await _appDb.DailyComplianceSnapshots
            .FirstOrDefaultAsync(s => s.ClientId == clientId && s.Date == date);

        if (snapshot != null)
        {
            snapshot.Update(plannedMeals, doneCount, skippedCount, score);
        }
        else
        {
            snapshot = new DailyComplianceSnapshot(clientId, date, plannedMeals, doneCount, skippedCount, score);
            _appDb.DailyComplianceSnapshots.Add(snapshot);
        }
    }

    private async Task<DailyComplianceDto> ComputeDailyComplianceAsync(Guid clientId, Guid dietitianId, DateOnly date)
    {
        var plannedMeals = await _appDb.PlanMealItems
            .Include(pmi => pmi.Plan)
            .Where(pmi =>
                pmi.Plan.ClientId == clientId &&
                pmi.Plan.CreatedBy == dietitianId &&
                DateOnly.FromDateTime(pmi.Plan.Date) == date &&
                pmi.Plan.Status == MealPlanStatus.Published)
            .CountAsync();

        if (plannedMeals == 0)
        {
            return new DailyComplianceDto(date, 0, 0, 0, 0, "no-plan");
        }

        var mealIds = await _appDb.PlanMealItems
            .Include(pmi => pmi.Plan)
            .Where(pmi =>
                pmi.Plan.ClientId == clientId &&
                pmi.Plan.CreatedBy == dietitianId &&
                DateOnly.FromDateTime(pmi.Plan.Date) == date &&
                pmi.Plan.Status == MealPlanStatus.Published)
            .Select(pmi => pmi.Id)
            .ToListAsync();

        var completions = await _appDb.MealCompletions
            .Where(mc => mc.ClientId == clientId && mealIds.Contains(mc.DietPlanMealId))
            .ToListAsync();

        var doneCount = completions.Count(c => c.Status == MealCompletionStatus.Done);
        var skippedCount = completions.Count(c => c.Status == MealCompletionStatus.Skipped);
        var score = (int)Math.Round((double)doneCount / plannedMeals * 100);

        return new DailyComplianceDto(date, plannedMeals, doneCount, skippedCount, score, CalculateStatus(plannedMeals, score));
    }

    private static string CalculateStatus(int plannedCount, int score)
    {
        if (plannedCount == 0)
            return "no-plan";
        if (score >= 80)
            return "on-track";
        return "needs-attention";
    }
}
