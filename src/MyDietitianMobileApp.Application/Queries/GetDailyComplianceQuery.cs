using MediatR;
using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Application.Queries
{
    public class GetDailyComplianceQuery : IRequest<GetDailyComplianceResult>
    {
        public Guid DietitianId { get; }
        public Guid ClientId { get; }
        public DateOnly Date { get; }

        public GetDailyComplianceQuery(Guid dietitianId, Guid clientId, DateOnly date)
        {
            DietitianId = dietitianId;
            ClientId = clientId;
            Date = date;
        }
    }

    public class DailyComplianceItemDto
    {
        public Guid MealItemId { get; set; }
        public Guid IngredientId { get; set; }
        public string IngredientName { get; set; } = string.Empty;
        public bool IsMandatory { get; set; }
        public ComplianceStatus? Status { get; set; }
        public DateTime? MarkedAt { get; set; }
        public Guid? AlternativeIngredientId { get; set; }
        public string? AlternativeIngredientName { get; set; }
    }

    public class DailyComplianceMealDto
    {
        public Guid MealId { get; set; }
        public MealType MealType { get; set; }
        public string? MealName { get; set; }
        public decimal CompliancePercentage { get; set; }
        public List<DailyComplianceItemDto> Items { get; set; } = new();
    }

    public class GetDailyComplianceResult
    {
        public Guid ClientId { get; }
        public string ClientName { get; }
        public DateOnly Date { get; }
        public decimal DailyCompliancePercentage { get; }
        public List<DailyComplianceMealDto> Meals { get; }

        public GetDailyComplianceResult(
            Guid clientId,
            string clientName,
            DateOnly date,
            decimal dailyCompliancePercentage,
            List<DailyComplianceMealDto> meals)
        {
            ClientId = clientId;
            ClientName = clientName;
            Date = date;
            DailyCompliancePercentage = dailyCompliancePercentage;
            Meals = meals;
        }
    }

}

