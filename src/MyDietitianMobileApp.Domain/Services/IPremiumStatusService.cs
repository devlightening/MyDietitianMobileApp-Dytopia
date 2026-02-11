using MyDietitianMobileApp.Domain.Entities;

namespace MyDietitianMobileApp.Domain.Services;

public record PremiumStatusResult(
    bool IsPremium,
    Client? Client,
    Guid? ActiveDietitianId,
    DateTime? PremiumUntilUtc);

public interface IPremiumStatusService
{
    /// <summary>
    /// Computes premium status for the client linked to the given user account.
    /// </summary>
    Task<PremiumStatusResult> GetPremiumStatusAsync(Guid userAccountId, CancellationToken cancellationToken = default);
}

