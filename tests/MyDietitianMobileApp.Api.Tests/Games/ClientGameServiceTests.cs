using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Games;

public class ClientGameServiceTests
{
    [Fact]
    public async Task DailyGenerator_WhenOpenAiReturnsInvalidJson_UsesSafeFallbackPack()
    {
        var options = new LlmNormalizationOptions { ApiKey = "test-key", ModelName = "gpt-4o-mini" };
        var generator = new DailyGameContentGenerator(
            new StaticHttpClientFactory("not-json"),
            options,
            NullLogger<DailyGameContentGenerator>.Instance);

        var pack = await generator.GenerateAsync(new DateOnly(2026, 5, 6), "tr", "easy");

        pack.IsFallback.Should().BeTrue();
        pack.SourceProvider.Should().Be("fallback");
        pack.Challenges.Select(challenge => challenge.Type).Should().BeEquivalentTo(["memory", "quiz", "word"]);

        var memory = pack.Challenges.Single(challenge => challenge.Type == "memory");
        using var payload = JsonDocument.Parse(memory.PayloadJson);
        payload.RootElement.GetProperty("gridSize").GetInt32().Should().Be(4);
        payload.RootElement.GetProperty("cards").GetArrayLength().Should().Be(16);
    }

    [Fact]
    public async Task DailyGenerator_FallbackChangesAcrossDaysAndDifficulty()
    {
        var generator = new DailyGameContentGenerator(
            new StaticHttpClientFactory("not-used"),
            new LlmNormalizationOptions(),
            NullLogger<DailyGameContentGenerator>.Instance);

        var easyDayOne = await generator.GenerateAsync(new DateOnly(2026, 5, 6), "tr", "easy");
        var easyDayTwo = await generator.GenerateAsync(new DateOnly(2026, 5, 7), "tr", "easy");
        var hardDayOne = await generator.GenerateAsync(new DateOnly(2026, 5, 6), "tr", "hard");

        easyDayOne.IsFallback.Should().BeTrue();
        easyDayOne.Challenges.Single(x => x.Type == "quiz").PayloadJson
            .Should().NotBe(easyDayTwo.Challenges.Single(x => x.Type == "quiz").PayloadJson);
        easyDayOne.Challenges.Single(x => x.Type == "word").PayloadJson
            .Should().NotBe(hardDayOne.Challenges.Single(x => x.Type == "word").PayloadJson);
    }

    [Fact]
    public async Task SubmitAsync_ScoresMemoryOnServer_AndDoesNotInflateDuplicateAttempts()
    {
        await using var db = CreateDbContext();
        var service = CreateService(db);
        var clientId = Guid.NewGuid();

        var pack = await service.GetDailyPackAsync(clientId, "tr");
        var secondPack = await service.GetDailyPackAsync(clientId, "tr");
        var memory = pack.Challenges.Single(challenge => challenge.Type == "memory");

        secondPack.Challenges.Single(challenge => challenge.Type == "memory").Id.Should().Be(memory.Id);
        pack.Difficulty.Should().Be("easy");
        pack.NextRefreshAt.Should().BeAfter(DateTime.Now.AddHours(-1));

        var firstSubmit = await service.SubmitAsync(
            clientId,
            isPremium: true,
            dietitianId: Guid.NewGuid(),
            memory.Id,
            new SubmitGameRequestDTO
            {
                Answers = Json("""{"matchedPairIds":["p01","p02","p03","p04","p05","p06","p07","p08"]}"""),
                Moves = 8,
                DurationSeconds = 60
            });

        var duplicateSubmit = await service.SubmitAsync(
            clientId,
            isPremium: true,
            dietitianId: Guid.NewGuid(),
            memory.Id,
            new SubmitGameRequestDTO
            {
                Answers = Json("""{"matchedPairIds":[]}"""),
                Moves = 99,
                DurationSeconds = 999
            });

        firstSubmit.Score.Should().Be(100);
        firstSubmit.Perfect.Should().BeTrue();
        duplicateSubmit.Score.Should().Be(firstSubmit.Score);
        duplicateSubmit.EarnedBadgeIds.Should().BeEmpty();
        db.ClientGameSessions.Count(session => session.ClientId == clientId && session.ChallengeId == memory.Id).Should().Be(1);
    }

    [Fact]
    public async Task SubmitAsync_UnlocksGameMonster_WhenThreeDifferentDailyGamesFinish()
    {
        await using var db = CreateDbContext();
        var service = CreateService(db);
        var clientId = Guid.NewGuid();
        var dietitianId = Guid.NewGuid();

        var pack = await service.GetDailyPackAsync(clientId, "tr");
        var memory = pack.Challenges.Single(challenge => challenge.Type == "memory");
        var quiz = pack.Challenges.Single(challenge => challenge.Type == "quiz");
        var word = pack.Challenges.Single(challenge => challenge.Type == "word");

        await service.SubmitAsync(
            clientId,
            isPremium: true,
            dietitianId,
            memory.Id,
            new SubmitGameRequestDTO
            {
                Answers = Json("""{"matchedPairIds":["p01","p02","p03","p04","p05","p06","p07","p08"]}"""),
                Moves = 8,
                DurationSeconds = 60
            });

        await service.SubmitAsync(
            clientId,
            isPremium: true,
            dietitianId,
            quiz.Id,
            new SubmitGameRequestDTO
            {
                Answers = Json("""{"responses":[{"questionId":"q1","optionId":"a"},{"questionId":"q2","optionId":"a"},{"questionId":"q3","optionId":"a"},{"questionId":"q4","optionId":"a"},{"questionId":"q5","optionId":"a"}]}"""),
                DurationSeconds = 45
            });

        var finalSubmit = await service.SubmitAsync(
            clientId,
            isPremium: true,
            dietitianId,
            word.Id,
            new SubmitGameRequestDTO
            {
                Answers = Json("""{"words":[{"wordId":"w1","answer":"elma"},{"wordId":"w2","answer":"yulaf"},{"wordId":"w3","answer":"salata"},{"wordId":"w4","answer":"ceviz"},{"wordId":"w5","answer":"yogurt"}]}"""),
                DurationSeconds = 70
            });

        finalSubmit.CompletedDailyCount.Should().Be(3);
        finalSubmit.EarnedBadgeIds.Should().Contain("game_monster");
        db.ClientAchievementUnlocks.Count(unlock => unlock.ClientId == clientId && unlock.BadgeId == "game_monster").Should().Be(1);
    }

    [Fact]
    public async Task GetDailyPackAsync_ProgressesDifficultyFromUserHistory()
    {
        await using var db = CreateDbContext();
        var clientId = Guid.NewGuid();
        var dietitianId = Guid.NewGuid();

        await SubmitPerfectDailyAsync(db, clientId, dietitianId, new DateTime(2026, 5, 1, 9, 0, 0));
        await SubmitPerfectDailyAsync(db, clientId, dietitianId, new DateTime(2026, 5, 2, 9, 0, 0));

        var mediumPack = await CreateService(db, new DateTime(2026, 5, 3, 9, 0, 0)).GetDailyPackAsync(clientId, "tr");
        mediumPack.Difficulty.Should().Be("medium");

        await SubmitPerfectDailyAsync(db, clientId, dietitianId, new DateTime(2026, 5, 3, 9, 0, 0));

        var hardPack = await CreateService(db, new DateTime(2026, 5, 4, 9, 0, 0)).GetDailyPackAsync(clientId, "tr");
        hardPack.Difficulty.Should().Be("hard");
    }

    [Fact]
    public async Task GetDailyPackAsync_DowngradesDifficultyAfterTwoLowScores()
    {
        await using var db = CreateDbContext();
        var clientId = Guid.NewGuid();
        var dietitianId = Guid.NewGuid();

        await SubmitPerfectDailyAsync(db, clientId, dietitianId, new DateTime(2026, 5, 1, 9, 0, 0));
        await SubmitPerfectDailyAsync(db, clientId, dietitianId, new DateTime(2026, 5, 2, 9, 0, 0));
        await SubmitPerfectDailyAsync(db, clientId, dietitianId, new DateTime(2026, 5, 3, 9, 0, 0));
        await SubmitPerfectDailyAsync(db, clientId, dietitianId, new DateTime(2026, 5, 4, 9, 0, 0));
        await SubmitLowPartialDailyAsync(db, clientId, dietitianId, new DateTime(2026, 5, 5, 9, 0, 0));

        var pack = await CreateService(db, new DateTime(2026, 5, 6, 9, 0, 0)).GetDailyPackAsync(clientId, "tr");
        pack.Difficulty.Should().Be("medium");
    }

    [Fact]
    public async Task GetDailyPackAsync_AllowsDifferentDifficultyPacksOnSameDate()
    {
        await using var db = CreateDbContext();
        var strongClientId = Guid.NewGuid();
        var newClientId = Guid.NewGuid();
        var dietitianId = Guid.NewGuid();

        await SubmitPerfectDailyAsync(db, strongClientId, dietitianId, new DateTime(2026, 5, 1, 9, 0, 0));
        await SubmitPerfectDailyAsync(db, strongClientId, dietitianId, new DateTime(2026, 5, 2, 9, 0, 0));
        await SubmitPerfectDailyAsync(db, strongClientId, dietitianId, new DateTime(2026, 5, 3, 9, 0, 0));

        var date = new DateTime(2026, 5, 4, 9, 0, 0);
        var hardPack = await CreateService(db, date).GetDailyPackAsync(strongClientId, "tr");
        var easyPack = await CreateService(db, date).GetDailyPackAsync(newClientId, "tr");

        hardPack.Difficulty.Should().Be("hard");
        easyPack.Difficulty.Should().Be("easy");
        db.DailyGameChallenges.Count(challenge => challenge.Date == DateOnly.FromDateTime(date)).Should().Be(6);
    }

    private static ClientGameService CreateService(AppDbContext db, DateTime? now = null)
    {
        return new ClientGameService(
            db,
            new FixedDailyGameContentGenerator(),
            new ClientGamificationService(db),
            () => now ?? DateTime.Now);
    }

    private static async Task SubmitPerfectDailyAsync(AppDbContext db, Guid clientId, Guid dietitianId, DateTime now)
    {
        var service = CreateService(db, now);
        var pack = await service.GetDailyPackAsync(clientId, "tr");
        foreach (var challenge in pack.Challenges)
        {
            await service.SubmitAsync(clientId, true, dietitianId, challenge.Id, PerfectRequestFor(challenge.Type));
        }
    }

    private static async Task SubmitLowPartialDailyAsync(AppDbContext db, Guid clientId, Guid dietitianId, DateTime now)
    {
        var service = CreateService(db, now);
        var pack = await service.GetDailyPackAsync(clientId, "tr");
        foreach (var challenge in pack.Challenges.Take(2))
        {
            await service.SubmitAsync(clientId, true, dietitianId, challenge.Id, EmptyRequestFor(challenge.Type));
        }
    }

    private static SubmitGameRequestDTO PerfectRequestFor(string gameType) => gameType switch
    {
        "memory" => new SubmitGameRequestDTO
        {
            Answers = Json("""{"matchedPairIds":["p01","p02","p03","p04","p05","p06","p07","p08"]}"""),
            Moves = 8,
            DurationSeconds = 60
        },
        "quiz" => new SubmitGameRequestDTO
        {
            Answers = Json("""{"responses":[{"questionId":"q1","optionId":"a"},{"questionId":"q2","optionId":"a"},{"questionId":"q3","optionId":"a"},{"questionId":"q4","optionId":"a"},{"questionId":"q5","optionId":"a"}]}"""),
            DurationSeconds = 45
        },
        _ => new SubmitGameRequestDTO
        {
            Answers = Json("""{"words":[{"wordId":"w1","answer":"elma"},{"wordId":"w2","answer":"yulaf"},{"wordId":"w3","answer":"salata"},{"wordId":"w4","answer":"ceviz"},{"wordId":"w5","answer":"yogurt"}]}"""),
            DurationSeconds = 70
        }
    };

    private static SubmitGameRequestDTO EmptyRequestFor(string gameType) => gameType switch
    {
        "memory" => new SubmitGameRequestDTO { Answers = Json("""{"matchedPairIds":[]}"""), Moves = 20, DurationSeconds = 180 },
        "quiz" => new SubmitGameRequestDTO { Answers = Json("""{"responses":[]}"""), DurationSeconds = 120 },
        _ => new SubmitGameRequestDTO { Answers = Json("""{"words":[]}"""), DurationSeconds = 140 }
    };

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        return new AppDbContext(options);
    }

    private static JsonElement Json(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    private sealed class FixedDailyGameContentGenerator : IDailyGameContentGenerator
    {
        public Task<DailyGameContentPack> GenerateAsync(DateOnly date, string language, string difficulty, CancellationToken ct = default)
        {
            var pack = new DailyGameContentPack
            {
                SourceProvider = "test",
                IsFallback = true,
                Challenges =
                [
                    new DailyGameContentChallenge
                    {
                        Type = "memory",
                        Title = "Dolap Eşleri",
                        Subtitle = "12 çift + 1 joker",
                        EstimatedSeconds = 90,
                        PayloadJson = JsonSerializer.Serialize(new
                        {
                            gridSize = 4,
                            cards = BuildMemoryCards()
                        }),
                        AnswerKeyJson = JsonSerializer.Serialize(new
                        {
                            pairs = Enumerable.Range(1, 8).Select(index => new { pairId = $"p{index:00}", label = $"Besin {index}" })
                        })
                    },
                    new DailyGameContentChallenge
                    {
                        Type = "quiz",
                        Title = "Mini Test",
                        Subtitle = "5 kolay soru",
                        EstimatedSeconds = 75,
                        PayloadJson = JsonSerializer.Serialize(new
                        {
                            questions = Enumerable.Range(1, 5).Select(index => new
                            {
                                id = $"q{index}",
                                question = $"Soru {index}",
                                options = new[] { new { id = "a", text = "Doğru" }, new { id = "b", text = "Yanlış" }, new { id = "c", text = "Pas" } }
                            })
                        }),
                        AnswerKeyJson = JsonSerializer.Serialize(new
                        {
                            answers = Enumerable.Range(1, 5).Select(index => new { questionId = $"q{index}", correctOptionId = "a", explanation = "Kısa açıklama." })
                        })
                    },
                    new DailyGameContentChallenge
                    {
                        Type = "word",
                        Title = "Kelime Dolabı",
                        Subtitle = "5 ipucu",
                        EstimatedSeconds = 95,
                        PayloadJson = JsonSerializer.Serialize(new
                        {
                            words = new[]
                            {
                                new { id = "w1", clue = "Meyve", scrambled = "mael", length = 4 },
                                new { id = "w2", clue = "Tahıl", scrambled = "ylauf", length = 5 },
                                new { id = "w3", clue = "Yan tabak", scrambled = "saalta", length = 6 },
                                new { id = "w4", clue = "Tohum", scrambled = "zvcei", length = 5 },
                                new { id = "w5", clue = "Süt ürünü", scrambled = "tryogu", length = 6 }
                            }
                        }),
                        AnswerKeyJson = JsonSerializer.Serialize(new
                        {
                            answers = new[]
                            {
                                new { wordId = "w1", answer = "elma", explanation = "Elma kolay bir meyvedir." },
                                new { wordId = "w2", answer = "yulaf", explanation = "Yulaf kahvaltıda kullanılır." },
                                new { wordId = "w3", answer = "salata", explanation = "Salata ferahlık katar." },
                                new { wordId = "w4", answer = "ceviz", explanation = "Ceviz çıtır bir dokunuştur." },
                                new { wordId = "w5", answer = "yoğurt", explanation = "Yoğurt serin bir seçenektir." }
                            }
                        })
                    }
                ]
            };

            return Task.FromResult(pack);
        }

        private static IReadOnlyList<object> BuildMemoryCards()
        {
            var cards = Enumerable.Range(1, 8)
                .SelectMany(index =>
                {
                    var pairId = $"p{index:00}";
                    return new object[]
                    {
                        new { id = $"{pairId}-a", pairId, label = $"Besin {index}", emoji = "🍎", color = "#F87171", isJoker = false },
                        new { id = $"{pairId}-b", pairId, label = $"Besin {index}", emoji = "🍎", color = "#F87171", isJoker = false }
                    };
                })
                .ToList();

            return cards;
        }
    }

    private sealed class StaticHttpClientFactory : IHttpClientFactory
    {
        private readonly string _responseBody;

        public StaticHttpClientFactory(string responseBody)
        {
            _responseBody = responseBody;
        }

        public HttpClient CreateClient(string name)
        {
            return new HttpClient(new StaticHttpMessageHandler(_responseBody))
            {
                BaseAddress = new Uri("https://example.test/")
            };
        }
    }

    private sealed class StaticHttpMessageHandler : HttpMessageHandler
    {
        private readonly string _responseBody;

        public StaticHttpMessageHandler(string responseBody)
        {
            _responseBody = responseBody;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_responseBody, Encoding.UTF8, "application/json")
            };

            return Task.FromResult(response);
        }
    }
}
