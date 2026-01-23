using MediatR;

namespace MyDietitianMobileApp.Application.Queries;

public class ListAccessKeysByDietitianQuery : IRequest<ListAccessKeysByDietitianResult>
{
    public Guid DietitianId { get; }
    public ListAccessKeysByDietitianQuery(Guid dietitianId)
    {
        DietitianId = dietitianId;
    }
}

public class AccessKeyDto
{
    public Guid Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public Guid DietitianId { get; set; }
    public Guid ClientId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; }
}

public class ListAccessKeysByDietitianResult
{
    public IEnumerable<AccessKeyDto> AccessKeys { get; }
    public ListAccessKeysByDietitianResult(IEnumerable<AccessKeyDto> accessKeys)
    {
        AccessKeys = accessKeys;
    }
}

