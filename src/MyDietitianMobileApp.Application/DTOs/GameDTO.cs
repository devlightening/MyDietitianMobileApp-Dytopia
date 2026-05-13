using System.Text.Json;

namespace MyDietitianMobileApp.Application.DTOs;

public class DailyGamePackDTO
{
    public DateOnly Date { get; set; }
    public string Difficulty { get; set; } = "easy";
    public DateTime NextRefreshAt { get; set; }
    public int CompletedCount { get; set; }
    public int TotalCount { get; set; } = 5;
    public int BadgeProgress { get; set; }
    public List<GameChallengeDTO> Challenges { get; set; } = new();
}

public class GameChallengeDTO
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string Difficulty { get; set; } = "easy";
    public int EstimatedSeconds { get; set; }
    public JsonElement Payload { get; set; }
    public string Status { get; set; } = "available";
    public int? LastScore { get; set; }
    public int? MaxScore { get; set; }
}

public class SubmitGameRequestDTO
{
    public JsonElement Answers { get; set; }
    public int Moves { get; set; }
    public int DurationSeconds { get; set; }
}

public class SubmitGameResponseDTO
{
    public int Score { get; set; }
    public int MaxScore { get; set; }
    public bool Perfect { get; set; }
    public int CompletedDailyCount { get; set; }
    public List<string> EarnedBadgeIds { get; set; } = new();
    public string Explanation { get; set; } = string.Empty;
    public JsonElement? Review { get; set; }
}
