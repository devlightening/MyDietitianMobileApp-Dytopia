using MediatR;

namespace MyDietitianMobileApp.Application.Queries
{
    public class GetLiveClientsQuery : IRequest<GetLiveClientsResult>
    {
        public Guid DietitianId { get; }

        public GetLiveClientsQuery(Guid dietitianId)
        {
            DietitianId = dietitianId;
        }
    }

    public class LiveClientDto
    {
        public Guid ClientId { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public DateTime? LastActivity { get; set; }
        public decimal TodayCompliancePercentage { get; set; }
        public string? CurrentMeal { get; set; }
        public string? LastMealItem { get; set; }
    }

    public class GetLiveClientsResult
    {
        public List<LiveClientDto> ActiveClients { get; }

        public GetLiveClientsResult(List<LiveClientDto> activeClients)
        {
            ActiveClients = activeClients;
        }
    }
}

