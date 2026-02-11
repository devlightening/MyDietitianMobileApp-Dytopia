using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Application.Services;

public record DailyComplianceDto(
    DateOnly Date,
    int PlannedCount,
    int CompletedCount,
    int SkippedCount,
    int Score0_100,
    string Status); // "no-plan" | "on-track" | "needs-attention"

public record RangeComplianceDto(
    DateOnly From,
    DateOnly To,
    List<DailyComplianceDto> Days);

public interface IComplianceService
{
    Task RecordMealCompletionAsync(Guid clientId, Guid dietitianId, Guid dietPlanMealId, MealCompletionStatus status, string? note = null);
    Task<DailyComplianceDto> GetTodayAsync(Guid clientId, Guid dietitianId);
    Task<RangeComplianceDto> GetRangeAsync(Guid clientId, Guid dietitianId, DateOnly from, DateOnly to);
}
