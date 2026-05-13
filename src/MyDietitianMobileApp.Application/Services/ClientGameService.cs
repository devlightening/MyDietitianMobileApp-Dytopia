using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Services;

public sealed class ClientGameService : IClientGameService
{
    private const int DailyGameTarget = 5;
    private static readonly string[] RequiredDailyGameTypes = ["memory", "quiz", "word", "guess", "market"];
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true
    };

    private readonly AppDbContext _appDb;
    private readonly IDailyGameContentGenerator _contentGenerator;
    private readonly IClientGamificationService _gamificationService;
    private readonly Func<DateTime> _nowLocal;

    public ClientGameService(
        AppDbContext appDb,
        IDailyGameContentGenerator contentGenerator,
        IClientGamificationService gamificationService,
        Func<DateTime>? nowLocal = null)
    {
        _appDb = appDb;
        _contentGenerator = contentGenerator;
        _gamificationService = gamificationService;
        _nowLocal = nowLocal ?? (() => DateTime.Now);
    }

    public async Task<DailyGamePackDTO> GetDailyPackAsync(
        Guid clientId,
        string? language,
        CancellationToken ct = default)
    {
        var normalizedLanguage = DailyGameChallenge.NormalizeLanguage(language);
        var now = _nowLocal();
        var date = DateOnly.FromDateTime(now);
        var difficulty = await ResolveDailyDifficultyAsync(clientId, date, ct);
        var challenges = await EnsureDailyChallengesAsync(date, normalizedLanguage, difficulty, ct);
        var challengeIds = challenges.Select(x => x.Id).ToList();
        var sessions = await _appDb.ClientGameSessions
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && challengeIds.Contains(x.ChallengeId))
            .ToDictionaryAsync(x => x.ChallengeId, ct);

        var completedCount = sessions.Values
            .Select(x => x.GameType)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        return new DailyGamePackDTO
        {
            Date = date,
            Difficulty = difficulty,
            NextRefreshAt = now.Date.AddDays(1),
            CompletedCount = completedCount,
            TotalCount = DailyGameTarget,
            BadgeProgress = Math.Min(completedCount, DailyGameTarget),
            Challenges = challenges
                .OrderBy(x => GameSortOrder(x.GameType))
                .Select(challenge => ToDto(challenge, sessions.GetValueOrDefault(challenge.Id)))
                .ToList()
        };
    }

    public async Task<SubmitGameResponseDTO> SubmitAsync(
        Guid clientId,
        bool isPremium,
        Guid? dietitianId,
        Guid challengeId,
        SubmitGameRequestDTO request,
        CancellationToken ct = default)
    {
        var challenge = await _appDb.DailyGameChallenges
            .FirstOrDefaultAsync(x => x.Id == challengeId, ct);

        if (challenge is null)
            throw new InvalidOperationException("GAME_NOT_FOUND");

        var existing = await _appDb.ClientGameSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.ClientId == clientId && x.ChallengeId == challengeId, ct);

        if (existing is not null)
        {
            return new SubmitGameResponseDTO
            {
                Score = existing.Score,
                MaxScore = existing.MaxScore,
                Perfect = existing.Perfect,
                CompletedDailyCount = await GetCompletedDailyCountAsync(clientId, challenge.Date, ct),
                EarnedBadgeIds = [],
                Explanation = "Bu oyun bugün zaten tamamlandı; skor tekrar yazılmadı.",
                Review = JsonDocument.Parse(existing.ResultJson).RootElement.Clone()
            };
        }

        var result = ScoreChallenge(challenge, request);
        var session = new ClientGameSession(
            clientId,
            challenge,
            result.Score,
            result.MaxScore,
            request.DurationSeconds,
            request.Moves,
            result.CorrectCount,
            result.Perfect,
            result.Review.GetRawText());

        _appDb.ClientGameSessions.Add(session);
        await _appDb.SaveChangesAsync(ct);

        var beforeUnlocks = await _appDb.ClientAchievementUnlocks
            .AsNoTracking()
            .Where(x => x.ClientId == clientId)
            .Select(x => x.BadgeId)
            .ToListAsync(ct);

        await _gamificationService.TrackEventAsync(
            clientId,
            isPremium,
            dietitianId,
            ClientGamificationService.EventTypes.GameCompleted,
            new { challengeId, gameType = challenge.GameType, score = result.Score, perfect = result.Perfect },
            ct);

        var completedDailyCount = await GetCompletedDailyCountAsync(clientId, challenge.Date, ct);
        if (completedDailyCount >= DailyGameTarget)
        {
            await _gamificationService.TrackEventAsync(
                clientId,
                isPremium,
                dietitianId,
                ClientGamificationService.EventTypes.DailyGamesCompleted,
                new { date = challenge.Date.ToString("yyyy-MM-dd"), completedDailyCount },
                ct);
        }

        var afterUnlocks = await _appDb.ClientAchievementUnlocks
            .AsNoTracking()
            .Where(x => x.ClientId == clientId)
            .Select(x => x.BadgeId)
            .ToListAsync(ct);

        var beforeSet = beforeUnlocks.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var earnedBadgeIds = afterUnlocks
            .Where(id => !beforeSet.Contains(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new SubmitGameResponseDTO
        {
            Score = result.Score,
            MaxScore = result.MaxScore,
            Perfect = result.Perfect,
            CompletedDailyCount = completedDailyCount,
            EarnedBadgeIds = earnedBadgeIds,
            Explanation = result.Explanation,
            Review = result.Review
        };
    }

    private async Task<List<DailyGameChallenge>> EnsureDailyChallengesAsync(
        DateOnly date,
        string language,
        string difficulty,
        CancellationToken ct)
    {
        var normalizedDifficulty = DailyGameChallenge.NormalizeDifficulty(difficulty);
        var existing = await _appDb.DailyGameChallenges
            .Where(x => x.Date == date && x.Language == language && x.Difficulty == normalizedDifficulty)
            .ToListAsync(ct);

        var staleChallenges = existing
            .Where(RequiresRegeneration)
            .ToList();
        if (staleChallenges.Count > 0)
        {
            _appDb.DailyGameChallenges.RemoveRange(staleChallenges);
            await _appDb.SaveChangesAsync(CancellationToken.None);
            existing = existing.Except(staleChallenges).ToList();
        }

        var existingTypes = existing.Select(x => x.GameType).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (existingTypes.Count >= DailyGameTarget &&
            RequiredDailyGameTypes.All(existingTypes.Contains))
        {
            return existing;
        }

        var generated = await _contentGenerator.GenerateAsync(date, language, normalizedDifficulty, ct);
        foreach (var item in generated.Challenges)
        {
            var type = DailyGameChallenge.NormalizeGameType(item.Type);
            if (existingTypes.Contains(type))
                continue;

            _appDb.DailyGameChallenges.Add(new DailyGameChallenge(
                date,
                language,
                type,
                item.Title,
                item.Subtitle,
                normalizedDifficulty,
                item.EstimatedSeconds,
                item.PayloadJson,
                item.AnswerKeyJson,
                generated.SourceProvider,
                generated.IsFallback));
        }

        var persistenceToken = ct.IsCancellationRequested ? CancellationToken.None : ct;
        try
        {
            await _appDb.SaveChangesAsync(persistenceToken);
        }
        catch (DbUpdateException ex) when (IsDailyChallengeUniqueConflict(ex))
        {
            _appDb.ChangeTracker.Clear();
        }

        return await _appDb.DailyGameChallenges
            .Where(x => x.Date == date && x.Language == language && x.Difficulty == normalizedDifficulty)
            .ToListAsync(persistenceToken);
    }

    private async Task<string> ResolveDailyDifficultyAsync(Guid clientId, DateOnly date, CancellationToken ct)
    {
        var since = date.AddDays(-5);
        var recentSessions = await _appDb.ClientGameSessions
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && x.GameDate >= since && x.GameDate < date)
            .OrderByDescending(x => x.CompletedAtUtc)
            .Select(x => new
            {
                x.GameDate,
                x.Score,
                x.MaxScore,
                x.Perfect,
                x.CompletedAtUtc
            })
            .ToListAsync(ct);

        if (recentSessions.Count == 0)
            return "easy";

        var lastFiveDayGroups = recentSessions
            .GroupBy(x => x.GameDate)
            .ToList();

        var lastThreeStart = date.AddDays(-3);
        var lastThreeCompletedDays = lastFiveDayGroups
            .Count(group => group.Key >= lastThreeStart && group.Count() >= DailyGameTarget);

        var averagePercent = recentSessions.Average(x => ScorePercent(x.Score, x.MaxScore));
        var perfectRate = recentSessions.Count(x => x.Perfect) / (double)Math.Max(1, recentSessions.Count);

        var difficulty =
            lastFiveDayGroups.Count >= 3 && averagePercent >= 85 && perfectRate >= 0.40
                ? "hard"
                : lastThreeCompletedDays >= 2 || (recentSessions.Count >= DailyGameTarget && averagePercent >= 70)
                    ? "medium"
                    : "easy";

        var lastTwo = recentSessions
            .OrderByDescending(x => x.CompletedAtUtc)
            .Take(2)
            .ToList();
        if (lastTwo.Count == 2 && lastTwo.Average(x => ScorePercent(x.Score, x.MaxScore)) < 55)
            difficulty = DowngradeDifficulty(difficulty);

        return difficulty;
    }

    private static double ScorePercent(int score, int maxScore)
        => Math.Clamp(score / (double)Math.Max(1, maxScore) * 100, 0, 100);

    private static string DowngradeDifficulty(string difficulty) => difficulty switch
    {
        "hard" => "medium",
        "medium" => "easy",
        _ => "easy"
    };

    private async Task<int> GetCompletedDailyCountAsync(Guid clientId, DateOnly date, CancellationToken ct)
    {
        return await _appDb.ClientGameSessions
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && x.GameDate == date)
            .Select(x => x.GameType)
            .Distinct()
            .CountAsync(ct);
    }

    private static GameChallengeDTO ToDto(DailyGameChallenge challenge, ClientGameSession? session)
    {
        return new GameChallengeDTO
        {
            Id = challenge.Id,
            Type = challenge.GameType,
            Title = challenge.Title,
            Subtitle = challenge.Subtitle,
            Difficulty = challenge.Difficulty,
            EstimatedSeconds = challenge.EstimatedSeconds,
            Payload = JsonDocument.Parse(challenge.PayloadJson).RootElement.Clone(),
            Status = session is null ? "available" : "completed",
            LastScore = session?.Score,
            MaxScore = session?.MaxScore
        };
    }

    private static ScoreResult ScoreChallenge(DailyGameChallenge challenge, SubmitGameRequestDTO request)
    {
        return challenge.GameType switch
        {
            "memory" => ScoreMemory(challenge, request),
            "quiz" => ScoreQuiz(challenge, request),
            "word" => ScoreWord(challenge, request),
            "guess" => ScoreGuess(challenge, request),
            "market" => ScoreMarket(challenge, request),
            _ => new ScoreResult(0, 100, 0, false, "Bu oyun tipi henüz desteklenmiyor.", ToJsonElement(new { reason = "unsupported" }))
        };
    }

    private static ScoreResult ScoreMemory(DailyGameChallenge challenge, SubmitGameRequestDTO request)
    {
        using var answerDoc = JsonDocument.Parse(challenge.AnswerKeyJson);
        var expectedPairs = answerDoc.RootElement
            .GetProperty("pairs")
            .EnumerateArray()
            .Select(x => x.GetProperty("pairId").GetString() ?? string.Empty)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var matchedPairIds = ReadStringArray(request.Answers, "matchedPairIds")
            .Where(expectedPairs.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var correct = matchedPairIds.Count;
        var maxScore = 100;
        var baseScore = (int)Math.Round((correct / (double)Math.Max(1, expectedPairs.Count)) * 78);
        var moveBonus = correct == expectedPairs.Count
            ? Math.Max(0, 14 - Math.Max(0, request.Moves - expectedPairs.Count))
            : 0;
        var timeBonus = correct == expectedPairs.Count
            ? Math.Max(0, 8 - Math.Max(0, request.DurationSeconds - challenge.EstimatedSeconds) / 20)
            : 0;
        var score = Math.Clamp(baseScore + moveBonus + timeBonus, 0, maxScore);
        var perfect = correct == expectedPairs.Count && request.Moves <= expectedPairs.Count + 6;
        var review = ToJsonElement(new
        {
            matchedPairs = correct,
            totalPairs = expectedPairs.Count,
            moves = Math.Max(0, request.Moves),
            durationSeconds = Math.Max(0, request.DurationSeconds)
        });

        var explanation = correct == expectedPairs.Count
            ? "Harika eşleştirme! Tüm kart çiftlerini tamamladın."
            : $"{correct}/{expectedPairs.Count} çift doğru eşleşti. Yarın çok daha akıcı olur.";

        return new ScoreResult(score, maxScore, correct, perfect, explanation, review);
    }

    private static ScoreResult ScoreQuiz(DailyGameChallenge challenge, SubmitGameRequestDTO request)
    {
        using var answerDoc = JsonDocument.Parse(challenge.AnswerKeyJson);
        var expected = answerDoc.RootElement
            .GetProperty("answers")
            .EnumerateArray()
            .Select(x => new QuizAnswer(
                x.GetProperty("questionId").GetString() ?? string.Empty,
                x.GetProperty("correctOptionId").GetString() ?? string.Empty,
                x.TryGetProperty("explanation", out var explanation) ? explanation.GetString() ?? string.Empty : string.Empty))
            .Where(x => !string.IsNullOrWhiteSpace(x.QuestionId))
            .ToDictionary(x => x.QuestionId, StringComparer.OrdinalIgnoreCase);

        var responses = ReadResponsePairs(request.Answers, "responses", "questionId", "optionId");
        var correct = responses.Count(response =>
            expected.TryGetValue(response.Key, out var answer) &&
            string.Equals(response.Value, answer.CorrectOptionId, StringComparison.OrdinalIgnoreCase));

        var reviewItems = expected.Values.Select(answer =>
        {
            responses.TryGetValue(answer.QuestionId, out var selectedOptionId);
            var isCorrect = string.Equals(selectedOptionId, answer.CorrectOptionId, StringComparison.OrdinalIgnoreCase);
            return new
            {
                questionId = answer.QuestionId,
                selectedOptionId,
                correctOptionId = answer.CorrectOptionId,
                isCorrect,
                answer.Explanation
            };
        }).ToList();

        var maxScore = 100;
        var score = Math.Clamp(correct * 20, 0, maxScore);
        var perfect = correct == expected.Count;
        var explanation = perfect
            ? "Beşte beş! Mini beslenme turunu kusursuz kapattın."
            : $"{correct}/{expected.Count} doğru. Cevap açıklamaları küçük ama işe yarar ipuçları bıraktı.";

        return new ScoreResult(score, maxScore, correct, perfect, explanation, ToJsonElement(new { answers = reviewItems }));
    }

    private static ScoreResult ScoreWord(DailyGameChallenge challenge, SubmitGameRequestDTO request)
    {
        using var answerDoc = JsonDocument.Parse(challenge.AnswerKeyJson);
        var expected = answerDoc.RootElement
            .GetProperty("answers")
            .EnumerateArray()
            .Select(x => new WordAnswer(
                x.GetProperty("wordId").GetString() ?? string.Empty,
                x.GetProperty("answer").GetString() ?? string.Empty,
                x.TryGetProperty("explanation", out var explanation) ? explanation.GetString() ?? string.Empty : string.Empty))
            .Where(x => !string.IsNullOrWhiteSpace(x.WordId))
            .ToDictionary(x => x.WordId, StringComparer.OrdinalIgnoreCase);

        var responses = ReadResponsePairs(request.Answers, "words", "wordId", "answer");
        var correct = responses.Count(response =>
            expected.TryGetValue(response.Key, out var answer) &&
            NormalizeWord(response.Value) == NormalizeWord(answer.Answer));

        var reviewItems = expected.Values.Select(answer =>
        {
            responses.TryGetValue(answer.WordId, out var selectedAnswer);
            var isCorrect = NormalizeWord(selectedAnswer) == NormalizeWord(answer.Answer);
            return new
            {
                wordId = answer.WordId,
                selectedAnswer,
                correctAnswer = answer.Answer,
                isCorrect,
                answer.Explanation
            };
        }).ToList();

        var maxScore = 100;
        var score = Math.Clamp(correct * 20, 0, maxScore);
        var perfect = correct == expected.Count;
        var explanation = perfect
            ? "Kelime dolabı tertemiz! Beş kelimenin tamamını buldun."
            : $"{correct}/{expected.Count} kelime doğru. İpuçlarıyla birkaç kelime daha yakalanır.";

        return new ScoreResult(score, maxScore, correct, perfect, explanation, ToJsonElement(new { words = reviewItems }));
    }

    private static ScoreResult ScoreGuess(DailyGameChallenge challenge, SubmitGameRequestDTO request)
    {
        using var answerDoc = JsonDocument.Parse(challenge.AnswerKeyJson);
        var expected = answerDoc.RootElement
            .GetProperty("answers")
            .EnumerateArray()
            .Select(x => new GuessAnswer(
                x.GetProperty("itemId").GetString() ?? string.Empty,
                x.GetProperty("correctOptionId").GetString() ?? string.Empty,
                x.TryGetProperty("explanation", out var explanation) ? explanation.GetString() ?? string.Empty : string.Empty))
            .Where(x => !string.IsNullOrWhiteSpace(x.ItemId))
            .ToDictionary(x => x.ItemId, StringComparer.OrdinalIgnoreCase);

        var responses = ReadGuessResponses(request.Answers);
        var correct = responses.Count(response =>
            expected.TryGetValue(response.ItemId, out var answer) &&
            string.Equals(response.OptionId, answer.CorrectOptionId, StringComparison.OrdinalIgnoreCase));

        var usedHints = responses.Sum(response => Math.Clamp(response.RevealedHints, 1, 3));
        var reviewItems = expected.Values.Select(answer =>
        {
            var selected = responses.LastOrDefault(response =>
                string.Equals(response.ItemId, answer.ItemId, StringComparison.OrdinalIgnoreCase));
            var selectedOptionId = selected?.OptionId;
            var revealedHints = selected?.RevealedHints ?? 0;
            var isCorrect = string.Equals(selectedOptionId, answer.CorrectOptionId, StringComparison.OrdinalIgnoreCase);
            return new
            {
                itemId = answer.ItemId,
                selectedOptionId = string.IsNullOrWhiteSpace(selectedOptionId) ? null : selectedOptionId,
                correctOptionId = answer.CorrectOptionId,
                revealedHints,
                isCorrect,
                answer.Explanation
            };
        }).ToList();

        var maxScore = 100;
        var baseScore = correct * 20;
        var hintBonus = correct > 0
            ? Math.Max(0, 20 - Math.Max(0, usedHints - correct) * 4)
            : 0;
        var score = Math.Clamp(baseScore + hintBonus, 0, maxScore);
        var perfect = correct == expected.Count && responses.All(response => response.RevealedHints <= 2);
        var explanation = perfect
            ? "Besin dedektifi harika çalıştı! İpuçlarını erken yakaladın."
            : $"{correct}/{expected.Count} besini doğru tahmin ettin. İpuçları arttıkça seçenekler daha netleşir.";

        return new ScoreResult(score, maxScore, correct, perfect, explanation, ToJsonElement(new { guesses = reviewItems }));
    }

    private static ScoreResult ScoreMarket(DailyGameChallenge challenge, SubmitGameRequestDTO request)
    {
        using var answerDoc = JsonDocument.Parse(challenge.AnswerKeyJson);
        var targetIds = answerDoc.RootElement
            .GetProperty("targets")
            .EnumerateArray()
            .Select(x => x.GetString() ?? string.Empty)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var hazardIds = answerDoc.RootElement.TryGetProperty("hazards", out var hazardsElement) &&
                        hazardsElement.ValueKind == JsonValueKind.Array
            ? hazardsElement
                .EnumerateArray()
                .Select(x => x.GetString() ?? string.Empty)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToHashSet(StringComparer.OrdinalIgnoreCase)
            : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var collected = ReadStringArray(request.Answers, "collectedItemIds")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var hitHazards = ReadStringArray(request.Answers, "hitHazardIds")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var correctCollected = collected
            .Where(targetIds.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var wrongCollected = collected
            .Where(id => hazardIds.Contains(id) || !targetIds.Contains(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var missedTargets = targetIds
            .Where(id => !correctCollected.Contains(id, StringComparer.OrdinalIgnoreCase))
            .ToList();

        var maxScore = 100;
        var baseScore = (int)Math.Round(correctCollected.Count / (double)Math.Max(1, targetIds.Count) * 82);
        var cleanBonus = hitHazards.Count == 0 && wrongCollected.Count == 0 ? 12 : 0;
        var timeBonus = correctCollected.Count == targetIds.Count
            ? Math.Max(0, 6 - Math.Max(0, request.DurationSeconds - challenge.EstimatedSeconds) / 8)
            : 0;
        var penalty = Math.Min(32, hitHazards.Count * 10 + wrongCollected.Count * 7 + missedTargets.Count * 3);
        var score = Math.Clamp(baseScore + cleanBonus + timeBonus - penalty, 0, maxScore);
        var perfect = correctCollected.Count == targetIds.Count && hitHazards.Count == 0 && wrongCollected.Count == 0;

        var review = ToJsonElement(new
        {
            collectedTargets = correctCollected.Count,
            totalTargets = targetIds.Count,
            hitHazards = hitHazards.Count,
            wrongCollected = wrongCollected.Count,
            missedTargets = missedTargets.Count,
            durationSeconds = Math.Max(0, request.DurationSeconds)
        });

        var explanation = perfect
            ? "Market kosusu kusursuz! Listedeki tum urunleri topladin, tuzaklardan kactin."
            : $"{correctCollected.Count}/{targetIds.Count} liste urunu toplandi. Tuzak urunlerden kacininca puan daha hizli yukselir.";

        return new ScoreResult(score, maxScore, correctCollected.Count, perfect, explanation, review);
    }

    private static List<string> ReadStringArray(JsonElement root, string propertyName)
    {
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty(propertyName, out var value) ||
            value.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return value.EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToList();
    }

    private static Dictionary<string, string> ReadResponsePairs(
        JsonElement root,
        string collectionName,
        string keyName,
        string valueName)
    {
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty(collectionName, out var value) ||
            value.ValueKind != JsonValueKind.Array)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        return value.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.Object)
            .Select(item => new
            {
                Key = item.TryGetProperty(keyName, out var key) ? key.GetString() ?? string.Empty : string.Empty,
                Value = item.TryGetProperty(valueName, out var selected) ? selected.GetString() ?? string.Empty : string.Empty
            })
            .Where(item => !string.IsNullOrWhiteSpace(item.Key))
            .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Last().Value, StringComparer.OrdinalIgnoreCase);
    }

    private static List<GuessResponse> ReadGuessResponses(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("guesses", out var value) ||
            value.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return value.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.Object)
            .Select(item => new GuessResponse(
                item.TryGetProperty("itemId", out var itemId) ? itemId.GetString() ?? string.Empty : string.Empty,
                item.TryGetProperty("optionId", out var optionId) ? optionId.GetString() ?? string.Empty : string.Empty,
                item.TryGetProperty("revealedHints", out var hints) && hints.TryGetInt32(out var hintCount) ? hintCount : 3))
            .Where(item => !string.IsNullOrWhiteSpace(item.ItemId))
            .GroupBy(item => item.ItemId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Last())
            .ToList();
    }

    private static JsonElement ToJsonElement(object value)
    {
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(value, JsonOptions));
        return document.RootElement.Clone();
    }

    private static string NormalizeWord(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var lowered = value.Trim().ToLower(new CultureInfo("tr-TR"));
        var normalized = lowered.Normalize(NormalizationForm.FormD);
        var builder = new System.Text.StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                builder.Append(ch);
        }

        return builder
            .ToString()
            .Normalize(NormalizationForm.FormC)
            .Replace("ı", "i", StringComparison.Ordinal)
            .Replace("ğ", "g", StringComparison.Ordinal)
            .Replace("ü", "u", StringComparison.Ordinal)
            .Replace("ş", "s", StringComparison.Ordinal)
            .Replace("ö", "o", StringComparison.Ordinal)
            .Replace("ç", "c", StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal);
    }

    private static int GameSortOrder(string type) => type switch
    {
        "memory" => 0,
        "quiz" => 1,
        "word" => 2,
        "guess" => 3,
        "market" => 4,
        _ => 99
    };

    private static bool RequiresRegeneration(DailyGameChallenge challenge)
    {
        if (challenge.GameType != "memory")
            return false;

        try
        {
            using var payload = JsonDocument.Parse(challenge.PayloadJson);
            using var answerKey = JsonDocument.Parse(challenge.AnswerKeyJson);
            return !payload.RootElement.TryGetProperty("gridSize", out var gridSize) ||
                   gridSize.GetInt32() != 4 ||
                   !payload.RootElement.TryGetProperty("cards", out var cards) ||
                   cards.ValueKind != JsonValueKind.Array ||
                   cards.GetArrayLength() != 16 ||
                   !answerKey.RootElement.TryGetProperty("pairs", out var pairs) ||
                   pairs.ValueKind != JsonValueKind.Array ||
                   pairs.GetArrayLength() != 8;
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException)
        {
            return true;
        }
    }

    private static bool IsDailyChallengeUniqueConflict(DbUpdateException ex)
    {
        var message = ex.InnerException?.Message ?? ex.Message;
        return message.Contains("IX_DailyGameChallenges_Date_Language_GameType_Difficulty", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("IX_DailyGameChallenges_Date_Language_GameType", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("DailyGameChallenges", StringComparison.OrdinalIgnoreCase) &&
               message.Contains("duplicate", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record ScoreResult(int Score, int MaxScore, int CorrectCount, bool Perfect, string Explanation, JsonElement Review);
    private sealed record QuizAnswer(string QuestionId, string CorrectOptionId, string Explanation);
    private sealed record WordAnswer(string WordId, string Answer, string Explanation);
    private sealed record GuessAnswer(string ItemId, string CorrectOptionId, string Explanation);
    private sealed record GuessResponse(string ItemId, string OptionId, int RevealedHints);
}
