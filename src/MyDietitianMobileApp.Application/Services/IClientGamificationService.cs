using MyDietitianMobileApp.Application.DTOs;

namespace MyDietitianMobileApp.Application.Services;

public interface IClientGamificationService
{
    Task<ClientGamificationSummaryDTO> GetSummaryAsync(
        Guid clientId,
        bool isPremium,
        Guid? dietitianId,
        CancellationToken ct = default);

    Task TrackEventAsync(
        Guid clientId,
        bool isPremium,
        Guid? dietitianId,
        string eventType,
        object? metadata = null,
        CancellationToken ct = default);

    Task<DietitianGamificationSummaryDTO> GetDietitianSummaryAsync(
        Guid dietitianId,
        int limit = 8,
        CancellationToken ct = default);
}
