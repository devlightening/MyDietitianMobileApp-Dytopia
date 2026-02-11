using MediatR;

namespace MyDietitianMobileApp.Application.Commands;

public class RevokePremiumCommand : IRequest<RevokePremiumResult>
{
    public Guid DietitianId { get; init; }
    public Guid ClientId { get; init; }
}

public class RevokePremiumResult
{
    public bool Success { get; init; }
    public Guid ClientId { get; init; }
    public DateTime RevokedAtUtc { get; init; }
    public bool WasPremium { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
}

