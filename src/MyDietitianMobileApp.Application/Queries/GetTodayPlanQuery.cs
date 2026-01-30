using MediatR;
using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Application.Queries;

public class GetTodayPlanQuery : IRequest<GetTodayPlanResult?>
{
    // ClientId will be extracted from JWT claims in the handler
}

public class GetTodayPlanResult
{
    public DateOnly Date { get; set; }
    public int? DailyTargetCalories { get; set; }
    public List<TodayMealDto> Meals { get; set; } = new();
}

public class TodayMealDto
{
    public Guid Id { get; set; }
    public MealType Type { get; set; }
    public string? PlannedRecipeName { get; set; }
    public string? CustomName { get; set; }
    public bool IsMandatory { get; set; }
}
