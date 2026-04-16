using MediatR;

namespace MyDietitianMobileApp.Application.Queries;

public class GetClientsByDietitianQuery : IRequest<GetClientsByDietitianResult>
{
    public Guid DietitianId { get; set; }
    
    // Pagination
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
    
    // Search
    public string? Search { get; set; }
    
    // Filters
    public string? Status { get; set; } // "premium" | "free" | null (all)
    public bool? ExpiringSoon { get; set; } // Premium expiring within 7 days
    public bool? LowCompliance { get; set; } // Compliance < 60%
    
    // Sorting
    public string? SortBy { get; set; } // "lastActivity" | "name" | "endDate"
    public string? SortDir { get; set; } // "asc" | "desc"
}

public class GetClientsByDietitianResult
{
    public List<ClientRowDto> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class ClientRowDto
{
    public Guid ClientId { get; set; }
    public string PublicUserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsPremium { get; set; }
    public DateTime? PremiumEndDate { get; set; }
    public int? DaysRemaining { get; set; } // Days until premium expires
    public decimal CompliancePercent { get; set; }
    public DateTime? LastActivityAt { get; set; }
    public bool HasActivePlan { get; set; } // Has an active meal plan assigned
    public DateTime LinkedAt { get; set; }
}

// Legacy DTO for backward compatibility (if needed)
public class ClientSummaryDto
{
    public Guid Id { get; set; } // Client GUID for routing
    public string PublicUserId { get; set; } = string.Empty; // AccessKey code for display
    public string FullName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public decimal? CurrentWeight { get; set; }
    public DateTime LinkedAt { get; set; }
}
