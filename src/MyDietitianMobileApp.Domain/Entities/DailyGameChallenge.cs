namespace MyDietitianMobileApp.Domain.Entities;

public class DailyGameChallenge
{
    public Guid Id { get; private set; }
    public DateOnly Date { get; private set; }
    public string Language { get; private set; } = "tr";
    public string GameType { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Subtitle { get; private set; } = string.Empty;
    public string Difficulty { get; private set; } = "easy";
    public int EstimatedSeconds { get; private set; }
    public string PayloadJson { get; private set; } = "{}";
    public string AnswerKeyJson { get; private set; } = "{}";
    public string SourceProvider { get; private set; } = "fallback";
    public bool IsFallback { get; private set; }
    public DateTime GeneratedAtUtc { get; private set; }

    public ICollection<ClientGameSession> Sessions { get; private set; } = new List<ClientGameSession>();

    private DailyGameChallenge() { }

    public DailyGameChallenge(
        DateOnly date,
        string language,
        string gameType,
        string title,
        string subtitle,
        string difficulty,
        int estimatedSeconds,
        string payloadJson,
        string answerKeyJson,
        string sourceProvider,
        bool isFallback)
    {
        Id = Guid.NewGuid();
        Date = date;
        Language = NormalizeLanguage(language);
        GameType = NormalizeGameType(gameType);
        Title = string.IsNullOrWhiteSpace(title) ? GameType : title.Trim();
        Subtitle = string.IsNullOrWhiteSpace(subtitle) ? string.Empty : subtitle.Trim();
        Difficulty = NormalizeDifficulty(difficulty);
        EstimatedSeconds = Math.Clamp(estimatedSeconds, 20, 360);
        PayloadJson = string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson;
        AnswerKeyJson = string.IsNullOrWhiteSpace(answerKeyJson) ? "{}" : answerKeyJson;
        SourceProvider = string.IsNullOrWhiteSpace(sourceProvider) ? "fallback" : sourceProvider.Trim();
        IsFallback = isFallback;
        GeneratedAtUtc = DateTime.UtcNow;
    }

    public static string NormalizeLanguage(string? language)
    {
        var normalized = string.IsNullOrWhiteSpace(language) ? "tr" : language.Trim().ToLowerInvariant();
        return normalized is "tr" or "en" ? normalized : "tr";
    }

    public static string NormalizeGameType(string? gameType)
    {
        var normalized = string.IsNullOrWhiteSpace(gameType) ? string.Empty : gameType.Trim().ToLowerInvariant();
        return normalized switch
        {
            "memory" => "memory",
            "quiz" => "quiz",
            "word" => "word",
            "guess" => "guess",
            "market" => "market",
            _ => normalized
        };
    }

    public static string NormalizeDifficulty(string? difficulty)
    {
        var normalized = string.IsNullOrWhiteSpace(difficulty) ? "easy" : difficulty.Trim().ToLowerInvariant();
        return normalized switch
        {
            "medium" => "medium",
            "hard" => "hard",
            _ => "easy"
        };
    }
}
