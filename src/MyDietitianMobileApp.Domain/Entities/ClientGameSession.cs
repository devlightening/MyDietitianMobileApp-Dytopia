namespace MyDietitianMobileApp.Domain.Entities;

public class ClientGameSession
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid ChallengeId { get; private set; }
    public DateOnly GameDate { get; private set; }
    public string GameType { get; private set; } = string.Empty;
    public DateTime CompletedAtUtc { get; private set; }
    public int Score { get; private set; }
    public int MaxScore { get; private set; }
    public int DurationSeconds { get; private set; }
    public int Moves { get; private set; }
    public int CorrectCount { get; private set; }
    public bool Perfect { get; private set; }
    public string ResultJson { get; private set; } = "{}";

    public Client Client { get; private set; } = null!;
    public DailyGameChallenge Challenge { get; private set; } = null!;

    private ClientGameSession() { }

    public ClientGameSession(
        Guid clientId,
        DailyGameChallenge challenge,
        int score,
        int maxScore,
        int durationSeconds,
        int moves,
        int correctCount,
        bool perfect,
        string resultJson)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        ChallengeId = challenge.Id;
        GameDate = challenge.Date;
        GameType = challenge.GameType;
        CompletedAtUtc = DateTime.UtcNow;
        Score = Math.Max(0, score);
        MaxScore = Math.Max(1, maxScore);
        DurationSeconds = Math.Max(0, durationSeconds);
        Moves = Math.Max(0, moves);
        CorrectCount = Math.Max(0, correctCount);
        Perfect = perfect;
        ResultJson = string.IsNullOrWhiteSpace(resultJson) ? "{}" : resultJson;
        Challenge = challenge;
    }
}
