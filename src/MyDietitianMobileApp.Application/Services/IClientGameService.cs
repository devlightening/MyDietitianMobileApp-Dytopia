using MyDietitianMobileApp.Application.DTOs;

namespace MyDietitianMobileApp.Application.Services;

public interface IClientGameService
{
    Task<DailyGamePackDTO> GetDailyPackAsync(
        Guid clientId,
        string? language,
        CancellationToken ct = default);

    Task<SubmitGameResponseDTO> SubmitAsync(
        Guid clientId,
        bool isPremium,
        Guid? dietitianId,
        Guid challengeId,
        SubmitGameRequestDTO request,
        CancellationToken ct = default);
}

public interface IDailyGameContentGenerator
{
    Task<DailyGameContentPack> GenerateAsync(
        DateOnly date,
        string language,
        CancellationToken ct = default);
}

public sealed class DailyGameContentPack
{
    public string SourceProvider { get; init; } = "fallback";
    public bool IsFallback { get; init; }
    public IReadOnlyList<DailyGameContentChallenge> Challenges { get; init; } = Array.Empty<DailyGameContentChallenge>();
}

public sealed class DailyGameContentChallenge
{
    public string Type { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Subtitle { get; init; } = string.Empty;
    public int EstimatedSeconds { get; init; }
    public string PayloadJson { get; init; } = "{}";
    public string AnswerKeyJson { get; init; } = "{}";
}
