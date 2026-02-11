using MediatR;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Handlers;

public class GetClientsByDietitianQueryHandler 
    : IRequestHandler<GetClientsByDietitianQuery, GetClientsByDietitianResult>
{
    private readonly AppDbContext _appContext;
    private readonly AuthDbContext _authContext;

    public GetClientsByDietitianQueryHandler(
        AppDbContext appContext,
        AuthDbContext authContext)
    {
        _appContext = appContext;
        _authContext = authContext;
    }

    public async Task<GetClientsByDietitianResult> Handle(
        GetClientsByDietitianQuery request,
        CancellationToken cancellationToken)
    {
        var links = await _appContext.DietitianClientLinks
            .Where(l => l.DietitianId == request.DietitianId)
            .OrderByDescending(l => l.IsActive)
            .ThenByDescending(l => l.LinkedAt)
            .ToListAsync(cancellationToken);

        var clientIds = links.Select(l => l.ClientId).ToList();
        
        var clients = await _appContext.Clients
            .Where(c => clientIds.Contains(c.Id))
            .ToListAsync(cancellationToken);

        var clientSummaries = new List<ClientSummaryDto>();

        foreach (var link in links)
        {
            var client = clients.FirstOrDefault(c => c.Id == link.ClientId);
            if (client == null) continue;

            // Get latest measurement
            var latestMeasurement = await _appContext.UserMeasurements
                .Where(m => m.ClientId == link.ClientId)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            clientSummaries.Add(new ClientSummaryDto
            {
                Id = client.Id, // Client GUID for routing
                PublicUserId = link.PublicUserId,
                FullName = client.FullName,
                IsActive = link.IsActive,
                LastLoginAt = null, // TODO: Track last login
                CurrentWeight = latestMeasurement?.WeightKg,
                LinkedAt = link.LinkedAt
            });
        }

        return new GetClientsByDietitianResult
        {
            Clients = clientSummaries
        };
    }
}
