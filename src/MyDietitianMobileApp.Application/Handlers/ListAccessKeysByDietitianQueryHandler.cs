using MediatR;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MyDietitianMobileApp.Application.Handlers;

public class ListAccessKeysByDietitianQueryHandler 
    : IRequestHandler<ListAccessKeysByDietitianQuery, ListAccessKeysByDietitianResult>
{
    private readonly AppDbContext _context;

    public ListAccessKeysByDietitianQueryHandler(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ListAccessKeysByDietitianResult> Handle(
        ListAccessKeysByDietitianQuery query, 
        CancellationToken cancellationToken)
    {
        var accessKeys = await _context.AccessKeys
            .Where(ak => ak.DietitianId == query.DietitianId)
            .Select(ak => new AccessKeyDto
            {
                Id = ak.Id,
                Key = ak.KeyValue,
                DietitianId = ak.DietitianId,
                ClientId = ak.ClientId,
                StartDate = ak.CreatedAtUtc,
                EndDate = ak.ExpiresAtUtc,
                IsActive = ak.IsActive
            })
            .ToListAsync(cancellationToken);

        return new ListAccessKeysByDietitianResult(accessKeys);
    }
}

