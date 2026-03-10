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
        // Start with base query: all active links for this dietitian
        var query = _appContext.DietitianClientLinks
            .Where(l => l.DietitianId == request.DietitianId && l.IsActive)
            .Include(l => l.Client)
            .AsQueryable();

        // Apply search filter (name or email)
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchLower = request.Search.ToLower();
            query = query.Where(l => 
                l.Client.FullName.ToLower().Contains(searchLower) ||
                l.Client.Email.ToLower().Contains(searchLower));
        }

        // Apply status filter
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (request.Status.ToLower() == "premium")
            {
                query = query.Where(l => l.Client.IsPremium);
            }
            else if (request.Status.ToLower() == "free")
            {
                query = query.Where(l => !l.Client.IsPremium);
            }
        }

        // Apply expiring soon filter (premium expiring within 7 days)
        if (request.ExpiringSoon == true)
        {
            var sevenDaysFromNow = DateTime.UtcNow.AddDays(7);
            query = query.Where(l => 
                l.Client.IsPremium && 
                l.Client.ProgramEndDate != null &&
                l.Client.ProgramEndDate <= sevenDaysFromNow &&
                l.Client.ProgramEndDate > DateTime.UtcNow);
        }

        // Get total count before pagination
        var total = await query.CountAsync(cancellationToken);

        // Apply sorting
        var sortBy = request.SortBy?.ToLower() ?? "lastactivity";
        var sortDir = request.SortDir?.ToLower() ?? "desc";

        query = sortBy switch
        {
            "name" => sortDir == "asc" 
                ? query.OrderBy(l => l.Client.FullName)
                : query.OrderByDescending(l => l.Client.FullName),
            "enddate" => sortDir == "asc"
                ? query.OrderBy(l => l.Client.ProgramEndDate ?? DateTime.MaxValue)
                : query.OrderByDescending(l => l.Client.ProgramEndDate ?? DateTime.MinValue),
            "lastactivity" or _ => sortDir == "asc"
                ? query.OrderBy(l => l.LinkedAt) // TODO: Use actual last activity when available
                : query.OrderByDescending(l => l.LinkedAt)
        };

        // Apply pagination
        var skip = (request.Page - 1) * request.PageSize;
        var links = await query
            .Skip(skip)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        // Ensure uniqueness by client ID (in case of data inconsistencies)
        var uniqueLinks = links
            .DistinctBy(l => l.ClientId)
            .ToList();

        // Get client IDs for batch queries
        var clientIds = uniqueLinks.Select(l => l.ClientId).ToList();
        
        // Batch query: Get last activity for all clients
        var lastActivities = await _appContext.ClientActivities
            .Where(a => clientIds.Contains(a.ClientId))
            .GroupBy(a => a.ClientId)
            .Select(g => new { ClientId = g.Key, LastActivity = g.Max(a => a.AtUtc) })
            .ToDictionaryAsync(x => x.ClientId, x => x.LastActivity, cancellationToken);
        
        // Batch query: Check for active meal plans
        var now = DateTime.UtcNow;
        var activePlans = await _appContext.ClientMealPlans
            .Where(p => clientIds.Contains(p.ClientId) && 
                       p.StartDate <= now && 
                       (p.EndDate == null || p.EndDate >= now))
            .Select(p => p.ClientId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var activePlanSet = activePlans.ToHashSet();
        
        // Batch query: Calculate compliance for all clients
        // Compliance = (completed meals / total planned meals) in last 30 days
        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
        var complianceData = await _appContext.ClientMealPlans
            .Where(p => clientIds.Contains(p.ClientId) && p.StartDate >= thirtyDaysAgo)
            .SelectMany(p => p.Meals)
            .GroupBy(m => m.ClientMealPlan.ClientId)
            .Select(g => new
            {
                ClientId = g.Key,
                TotalMeals = g.Count(),
                CompletedMeals = g.Count(m => m.CompletedAt != null)
            })
            .ToDictionaryAsync(x => x.ClientId, cancellationToken);
        
        // Batch query: Get PublicUserId for all clients from UserAccounts
        var publicUserIds = await _authContext.UserAccounts
            .Where(u => u.LinkedClientId != null && clientIds.Contains(u.LinkedClientId.Value))
            .ToDictionaryAsync(u => u.LinkedClientId!.Value, u => u.PublicUserId, cancellationToken);
        
        // Build result DTOs
        var items = new List<ClientRowDto>();
        
        foreach (var link in uniqueLinks)
        {
            var client = link.Client;
            
            // Calculate compliance
            decimal compliancePercent = 0;
            if (complianceData.TryGetValue(client.Id, out var compliance) && compliance.TotalMeals > 0)
            {
                compliancePercent = Math.Round((decimal)compliance.CompletedMeals / compliance.TotalMeals * 100, 1);
            }
            
            // Apply low compliance filter if requested
            if (request.LowCompliance == true && compliancePercent >= 60)
            {
                continue; // Skip this client
            }
            
            // Calculate days remaining
            int? daysRemaining = null;
            if (client.IsPremium && client.ProgramEndDate.HasValue)
            {
                var timeSpan = client.ProgramEndDate.Value - DateTime.UtcNow;
                daysRemaining = Math.Max(0, (int)Math.Ceiling(timeSpan.TotalDays));
            }
            
            // Get last activity
            var lastActivity = lastActivities.TryGetValue(client.Id, out var activity) 
                ? activity 
                : (DateTime?)link.LinkedAt;
            
            // Check for active plan
            var hasActivePlan = activePlanSet.Contains(client.Id);

            items.Add(new ClientRowDto
            {
                ClientId = client.Id,
                PublicUserId = publicUserIds.TryGetValue(client.Id, out var pId) ? pId : "MD-UNKNOWN",
                FullName = client.FullName,
                Email = client.Email,
                IsPremium = client.IsPremium,
                PremiumEndDate = client.ProgramEndDate,
                DaysRemaining = daysRemaining,
                CompliancePercent = compliancePercent,
                LastActivityAt = lastActivity,
                HasActivePlan = hasActivePlan,
                LinkedAt = link.LinkedAt
            });
        }

        // Adjust total if low compliance filter was applied
        if (request.LowCompliance == true)
        {
            total = items.Count; // Recalculate since we filtered in memory
        }

        return new GetClientsByDietitianResult
        {
            Items = items,
            Total = total,
            Page = request.Page,
            PageSize = request.PageSize
        };
    }
}
