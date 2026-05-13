using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Application.Services;

public sealed class DailyGameContentGenerator : IDailyGameContentGenerator
{
    private static readonly TimeSpan AiGenerationBudget = TimeSpan.FromSeconds(4);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true
    };

    private static readonly string[] RequiredTypes = ["memory", "quiz", "word", "guess", "market"];
    private static readonly string[] BannedSafetyTerms =
    [
        "tedavi", "hastalık", "hastalik", "diyabet", "tansiyon", "kanser", "ilaç", "ilac",
        "zayıflat", "zayiflat", "kilo verdir", "garanti", "mucize", "detoks"
    ];

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly LlmNormalizationOptions _options;
    private readonly ILogger<DailyGameContentGenerator> _logger;

    public DailyGameContentGenerator(
        IHttpClientFactory httpClientFactory,
        LlmNormalizationOptions options,
        ILogger<DailyGameContentGenerator> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
        _logger = logger;
    }

    public async Task<DailyGameContentPack> GenerateAsync(
        DateOnly date,
        string language,
        string difficulty,
        CancellationToken ct = default)
    {
        var normalizedDifficulty = DailyGameChallenge.NormalizeDifficulty(difficulty);
        var apiKey = _options.ApiKey ?? Environment.GetEnvironmentVariable(_options.ApiKeyEnvVar);
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            using var aiTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            aiTimeout.CancelAfter(AiGenerationBudget);
            var aiPack = await TryGenerateWithOpenAiAsync(date, language, normalizedDifficulty, apiKey, aiTimeout.Token);
            if (aiPack is not null)
                return aiPack;
        }

        return BuildFallbackPack(date, language, normalizedDifficulty);
    }

    private async Task<DailyGameContentPack?> TryGenerateWithOpenAiAsync(
        DateOnly date,
        string language,
        string difficulty,
        string apiKey,
        CancellationToken ct)
    {
        try
        {
            var requestBody = new
            {
                model = string.IsNullOrWhiteSpace(_options.ModelName) ? "gpt-4o-mini" : _options.ModelName,
                response_format = new { type = "json_object" },
                temperature = 0.35,
                max_tokens = 2600,
                messages = new[]
                {
                    new { role = "system", content = BuildSystemPrompt(language, difficulty) },
                    new { role = "user", content = $"Tarih: {date:yyyy-MM-dd}. Dil: {language}. Bugün için tek JSON paketini üret." }
                }
            };

            var client = _httpClientFactory.CreateClient("openai-games");
            var request = new HttpRequestMessage(HttpMethod.Post, "v1/chat/completions")
            {
                Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await client.SendAsync(request, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Daily game OpenAI request failed with {Status}: {Body}", response.StatusCode, responseBody);
                return null;
            }

            using var doc = JsonDocument.Parse(responseBody);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
                return null;

            var parsed = JsonSerializer.Deserialize<AiGamePackResponse>(content, JsonOptions);
            if (parsed?.Challenges is null)
                return null;

            var challenges = parsed.Challenges
                .Select(ToContentChallenge)
                .Where(x => x is not null)
                .Select(x => x!)
                .ToList();

            if (!ValidateChallenges(challenges))
                return null;

            return new DailyGameContentPack
            {
                SourceProvider = "openai",
                IsFallback = false,
                Challenges = challenges
            };
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Daily game OpenAI generation timed out or was canceled. Falling back to static content.");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Daily game OpenAI generation failed. Falling back to static content.");
            return null;
        }
    }

    private static string BuildSystemPrompt(string language, string difficulty)
    {
        var locale = language == "en" ? "English" : "Turkish";
        var difficultyRules = difficulty switch
        {
            "hard" => "Hard: use closer distractors, more thoughtful clues, 6-8 letter words when possible, and slightly tighter estimated times. Keep it safe and fair.",
            "medium" => "Medium: use moderately close distractors, 5-6 letter words, and explanations that teach one compact nutrition habit.",
            _ => "Easy: use simple everyday foods, obvious distractors, short words, and friendly beginner clues."
        };
        return $$"""
        You create safe, easy nutrition mini-game content for a dietitian mobile app.
        Language: {{locale}}.
        Difficulty: {{difficulty}}.
        Difficulty rules: {{difficultyRules}}

        Return only JSON object with this shape:
        {
          "challenges": [
            {
              "type": "memory|quiz|word|guess|market",
              "title": "short friendly title",
              "subtitle": "short friendly subtitle",
              "estimatedSeconds": 60,
              "payload": {},
              "answerKey": {}
            }
          ]
        }

        Mandatory game rules:
        - Exactly 5 challenges: one "memory", one "quiz", one "word", one "guess", one "market".
        - Respect the requested difficulty while keeping the games short and approachable.
        - No medical claims, no disease/treatment advice, no guaranteed weight-loss statements.
        - memory payload: { "schemaVersion": 2, "gridSize": 4, "cards": 16 cards, "hint": "..." }.
          Cards must be 8 healthy food pairs. Use food labels that fit the difficulty. Each card has pairId, label, emoji, color, imagePrompt, isJoker=false.
          imagePrompt should describe a cute pastel fruit/vegetable card illustration, but do not include medical claims.
          answerKey: { "pairs": 8 objects with pairId and label }.
        - quiz payload: { "questions": 5 questions }. Each question has id, question, options[3] with id/text.
          The correct option must not always be the first option.
          answerKey: { "answers": 5 objects with questionId, correctOptionId, explanation }.
        - word payload: { "words": 5 items }. Each item has id, clue, scrambled, length.
          answerKey: { "answers": 5 objects with wordId, answer, explanation }.
        - guess payload: { "items": 4 items }. Each item has id, maskedName, category, color, emoji, clues[3], options[3].
          The first clue should be broad, the second practical, the third highly specific. Options have id/text/emoji.
          answerKey: { "answers": 4 objects with itemId, correctOptionId, explanation }.
        - market payload: { "missionTitle": "...", "missionSubtitle": "...", "timeLimitSeconds": 45, "targetCount": 6, "items": 14-18 items }.
          It is a 3-lane grocery runner game. Each item has id, label, emoji, lane (-1|0|1), spawnTick integer, speed 0.055-0.09, isTarget boolean, category, color.
          Include exactly 6 target items and 8-12 hazard/distractor items. Keep spawnTick spaced so the game is fair.
          answerKey: { "targets": 6 item ids, "hazards": all non-target item ids, "explanation": "..." }.
        """;
    }

    private static DailyGameContentChallenge? ToContentChallenge(AiGameChallenge challenge)
    {
        if (string.IsNullOrWhiteSpace(challenge.Type))
            return null;

        var type = challenge.Type.Trim().ToLowerInvariant();
        if (!RequiredTypes.Contains(type))
            return null;

        return new DailyGameContentChallenge
        {
            Type = type,
            Title = challenge.Title?.Trim() ?? type,
            Subtitle = challenge.Subtitle?.Trim() ?? string.Empty,
            EstimatedSeconds = Math.Clamp(challenge.EstimatedSeconds, 30, 240),
            PayloadJson = challenge.Payload.GetRawText(),
            AnswerKeyJson = challenge.AnswerKey.GetRawText()
        };
    }

    private static bool ValidateChallenges(IReadOnlyList<DailyGameContentChallenge> challenges)
    {
        if (challenges.Count != RequiredTypes.Length)
            return false;

        if (RequiredTypes.Any(type => challenges.Count(x => x.Type == type) != 1))
            return false;

        var allText = JsonSerializer.Serialize(challenges, JsonOptions).ToLowerInvariant();
        if (BannedSafetyTerms.Any(allText.Contains))
            return false;

        return challenges.All(challenge => challenge.Type switch
        {
            "memory" => ValidateMemory(challenge),
            "quiz" => ValidateQuiz(challenge),
            "word" => ValidateWord(challenge),
            "guess" => ValidateGuess(challenge),
            "market" => ValidateMarket(challenge),
            _ => false
        });
    }

    private static bool ValidateMemory(DailyGameContentChallenge challenge)
    {
        using var payload = JsonDocument.Parse(challenge.PayloadJson);
        using var answerKey = JsonDocument.Parse(challenge.AnswerKeyJson);
        return payload.RootElement.TryGetProperty("cards", out var cards) &&
               cards.ValueKind == JsonValueKind.Array &&
               cards.GetArrayLength() == 16 &&
               answerKey.RootElement.TryGetProperty("pairs", out var pairs) &&
               pairs.ValueKind == JsonValueKind.Array &&
               pairs.GetArrayLength() == 8;
    }

    private static bool ValidateQuiz(DailyGameContentChallenge challenge)
    {
        using var payload = JsonDocument.Parse(challenge.PayloadJson);
        using var answerKey = JsonDocument.Parse(challenge.AnswerKeyJson);
        return payload.RootElement.TryGetProperty("questions", out var questions) &&
               questions.ValueKind == JsonValueKind.Array &&
               questions.GetArrayLength() == 5 &&
               answerKey.RootElement.TryGetProperty("answers", out var answers) &&
               answers.ValueKind == JsonValueKind.Array &&
               answers.GetArrayLength() == 5;
    }

    private static bool ValidateWord(DailyGameContentChallenge challenge)
    {
        using var payload = JsonDocument.Parse(challenge.PayloadJson);
        using var answerKey = JsonDocument.Parse(challenge.AnswerKeyJson);
        return payload.RootElement.TryGetProperty("words", out var words) &&
               words.ValueKind == JsonValueKind.Array &&
               words.GetArrayLength() == 5 &&
               answerKey.RootElement.TryGetProperty("answers", out var answers) &&
               answers.ValueKind == JsonValueKind.Array &&
               answers.GetArrayLength() == 5;
    }

    private static bool ValidateGuess(DailyGameContentChallenge challenge)
    {
        using var payload = JsonDocument.Parse(challenge.PayloadJson);
        using var answerKey = JsonDocument.Parse(challenge.AnswerKeyJson);
        return payload.RootElement.TryGetProperty("items", out var items) &&
               items.ValueKind == JsonValueKind.Array &&
               items.GetArrayLength() == 4 &&
               items.EnumerateArray().All(item =>
                   item.TryGetProperty("clues", out var clues) &&
                   clues.ValueKind == JsonValueKind.Array &&
                   clues.GetArrayLength() == 3 &&
                   item.TryGetProperty("options", out var options) &&
                   options.ValueKind == JsonValueKind.Array &&
                   options.GetArrayLength() == 3) &&
               answerKey.RootElement.TryGetProperty("answers", out var answers) &&
               answers.ValueKind == JsonValueKind.Array &&
               answers.GetArrayLength() == 4;
    }

    private static bool ValidateMarket(DailyGameContentChallenge challenge)
    {
        using var payload = JsonDocument.Parse(challenge.PayloadJson);
        using var answerKey = JsonDocument.Parse(challenge.AnswerKeyJson);
        if (!payload.RootElement.TryGetProperty("items", out var items) ||
            items.ValueKind != JsonValueKind.Array ||
            items.GetArrayLength() is < 14 or > 18 ||
            !answerKey.RootElement.TryGetProperty("targets", out var targets) ||
            targets.ValueKind != JsonValueKind.Array ||
            targets.GetArrayLength() != 6 ||
            !answerKey.RootElement.TryGetProperty("hazards", out var hazards) ||
            hazards.ValueKind != JsonValueKind.Array ||
            hazards.GetArrayLength() is < 8 or > 12)
        {
            return false;
        }

        var itemIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var payloadTargetIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in items.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object ||
                !item.TryGetProperty("id", out var id) ||
                string.IsNullOrWhiteSpace(id.GetString()) ||
                !itemIds.Add(id.GetString()!) ||
                !item.TryGetProperty("label", out var label) ||
                string.IsNullOrWhiteSpace(label.GetString()) ||
                !item.TryGetProperty("lane", out var lane) ||
                !lane.TryGetInt32(out var laneValue) ||
                laneValue is < -1 or > 1 ||
                !item.TryGetProperty("spawnTick", out var spawnTick) ||
                !spawnTick.TryGetInt32(out var tick) ||
                tick < 0 ||
                !item.TryGetProperty("isTarget", out var isTarget) ||
                isTarget.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            {
                return false;
            }

            if (isTarget.ValueKind == JsonValueKind.True)
            {
                payloadTargetIds.Add(id.GetString()!);
            }
        }

        var answerTargets = targets
            .EnumerateArray()
            .Select(target => target.GetString() ?? string.Empty)
            .Where(target => !string.IsNullOrWhiteSpace(target))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var answerHazards = hazards
            .EnumerateArray()
            .Select(hazard => hazard.GetString() ?? string.Empty)
            .Where(hazard => !string.IsNullOrWhiteSpace(hazard))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var expectedHazards = itemIds
            .Where(id => !payloadTargetIds.Contains(id))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return payloadTargetIds.Count == 6 &&
               answerTargets.SetEquals(payloadTargetIds) &&
               answerHazards.SetEquals(expectedHazards);
    }

    private static DailyGameContentPack BuildFallbackPack(DateOnly date, string language, string difficulty)
    {
        return new DailyGameContentPack
        {
            SourceProvider = "fallback",
            IsFallback = true,
            Challenges =
            [
                BuildMemoryFallback(date, language, difficulty),
                BuildQuizFallback(date, language, difficulty),
                BuildWordFallback(date, language, difficulty),
                BuildGuessFallback(date, language, difficulty),
                BuildMarketFallback(date, language, difficulty)
            ]
        };
    }

    private static DailyGameContentChallenge BuildMemoryFallback(DateOnly date, string language, string difficulty)
    {
        if (DateTime.UtcNow.Year > 0)
        {
            var foods = language == "en"
                ? new[]
                {
                    new MemoryFood("Apple", "🍎", "#F87171", "cute pastel apple memory card, clean white background, soft shadow"),
                    new MemoryFood("Banana", "🍌", "#FACC15", "cute pastel banana memory card, clean white background, soft shadow"),
                    new MemoryFood("Watermelon", "🍉", "#34D399", "cute pastel watermelon slice memory card, clean white background, soft shadow"),
                    new MemoryFood("Pineapple", "🍍", "#FBBF24", "cute pastel pineapple memory card, clean white background, soft shadow"),
                    new MemoryFood("Avocado", "🥑", "#86EFAC", "cute pastel avocado memory card, clean white background, soft shadow"),
                    new MemoryFood("Cherry", "🍒", "#FB7185", "cute pastel cherries memory card, clean white background, soft shadow"),
                    new MemoryFood("Strawberry", "🍓", "#F43F5E", "cute pastel strawberry memory card, clean white background, soft shadow"),
                    new MemoryFood("Lemon", "🍋", "#FDE047", "cute pastel lemon memory card, clean white background, soft shadow")
                }
                : [
                    new MemoryFood("Elma", "🍎", "#F87171", "sevimli pastel elma hafıza kartı illüstrasyonu, temiz beyaz arka plan, yumuşak gölge"),
                    new MemoryFood("Muz", "🍌", "#FACC15", "sevimli pastel muz hafıza kartı illüstrasyonu, temiz beyaz arka plan, yumuşak gölge"),
                    new MemoryFood("Karpuz", "🍉", "#34D399", "sevimli pastel karpuz dilimi hafıza kartı illüstrasyonu, temiz beyaz arka plan, yumuşak gölge"),
                    new MemoryFood("Ananas", "🍍", "#FBBF24", "sevimli pastel ananas hafıza kartı illüstrasyonu, temiz beyaz arka plan, yumuşak gölge"),
                    new MemoryFood("Avokado", "🥑", "#86EFAC", "sevimli pastel avokado hafıza kartı illüstrasyonu, temiz beyaz arka plan, yumuşak gölge"),
                    new MemoryFood("Kiraz", "🍒", "#FB7185", "sevimli pastel kiraz hafıza kartı illüstrasyonu, temiz beyaz arka plan, yumuşak gölge"),
                    new MemoryFood("Çilek", "🍓", "#F43F5E", "sevimli pastel çilek hafıza kartı illüstrasyonu, temiz beyaz arka plan, yumuşak gölge"),
                    new MemoryFood("Limon", "🍋", "#FDE047", "sevimli pastel limon hafıza kartı illüstrasyonu, temiz beyaz arka plan, yumuşak gölge")
                ];

            var selectedFoods = foods
                .Concat(BuildMemoryFoodExtras(language, difficulty))
                .OrderBy(food => StableRandomKey(date, language, $"{difficulty}:{food.Label}"))
                .Take(8)
                .ToArray();

            var memoryCards = selectedFoods.SelectMany((food, index) =>
            {
                var pairId = $"p{index + 1:00}";
                return new[]
                {
                    new { id = $"{pairId}-a", pairId, label = food.Label, emoji = food.Emoji, color = food.Color, imagePrompt = food.ImagePrompt, isJoker = false },
                    new { id = $"{pairId}-b", pairId, label = food.Label, emoji = food.Emoji, color = food.Color, imagePrompt = food.ImagePrompt, isJoker = false }
                };
            }).Cast<object>().ToList();

            var shuffledCards = memoryCards
                .OrderBy(card => StableRandomKey(date, language, JsonSerializer.Serialize(card)))
                .ToList();

            var memoryPayload = new
            {
                schemaVersion = 2,
                gridSize = 4,
                hint = language == "en" ? "Flip two cards, find matching healthy foods." : "İki kart çevir, aynı sağlıklı besinleri eşleştir.",
                cards = shuffledCards
            };
            var memoryAnswerKey = new
            {
                pairs = selectedFoods.Select((food, index) => new { pairId = $"p{index + 1:00}", label = food.Label })
            };

            return new DailyGameContentChallenge
            {
                Type = "memory",
                Title = language == "en" ? "Pantry Pairs" : "Dolap Eşleri",
                Subtitle = language == "en" ? "8 pairs · 4x4 memory" : "8 çift · 4x4 hafıza",
                EstimatedSeconds = difficulty == "hard" ? 75 : difficulty == "medium" ? 85 : 95,
                PayloadJson = JsonSerializer.Serialize(memoryPayload, JsonOptions),
                AnswerKeyJson = JsonSerializer.Serialize(memoryAnswerKey, JsonOptions)
            };
        }

        var labels = language == "en"
            ? new[] { "Apple", "Yogurt", "Oats", "Lentils", "Broccoli", "Walnut", "Cheese", "Olive", "Carrot", "Fish", "Bulgur", "Ayran" }
            : ["Elma", "Yoğurt", "Yulaf", "Mercimek", "Brokoli", "Ceviz", "Peynir", "Zeytin", "Havuç", "Balık", "Bulgur", "Ayran"];

        var icons = new[] { "nutrition-outline", "ice-cream-outline", "leaf-outline", "ellipse-outline", "flower-outline", "radio-button-on-outline", "cube-outline", "egg-outline", "color-fill-outline", "fish-outline", "grid-outline", "water-outline" };
        var cards = labels.SelectMany((label, index) =>
        {
            var pairId = $"p{index + 1:00}";
            return new[]
            {
                new { id = $"{pairId}-a", pairId, label, icon = icons[index], isJoker = false },
                new { id = $"{pairId}-b", pairId, label, icon = icons[index], isJoker = false }
            };
        }).Cast<object>().ToList();

        cards.Add(new { id = "joker", pairId = "joker", label = language == "en" ? "Joker" : "Joker", icon = "sparkles-outline", isJoker = true });
        var shuffled = cards
            .OrderBy(card => StableRandomKey(date, language, JsonSerializer.Serialize(card)))
            .ToList();

        var payload = new
        {
            gridSize = 5,
            hint = language == "en" ? "Find matching foods; the joker is a tiny bonus." : "Aynı besinleri eşleştir; joker tatlı bir bonus.",
            cards = shuffled
        };
        var answerKey = new
        {
            pairs = labels.Select((label, index) => new { pairId = $"p{index + 1:00}", label }),
            jokerId = "joker"
        };

        return new DailyGameContentChallenge
        {
            Type = "memory",
            Title = language == "en" ? "Pantry Pairs" : "Dolap Eşleri",
            Subtitle = language == "en" ? "12 pairs + 1 joker" : "12 çift + 1 joker",
            EstimatedSeconds = 90,
            PayloadJson = JsonSerializer.Serialize(payload, JsonOptions),
            AnswerKeyJson = JsonSerializer.Serialize(answerKey, JsonOptions)
        };
    }

    private static DailyGameContentChallenge BuildQuizFallback(DateOnly date, string language, string difficulty)
    {
        var seeds = BuildQuizBank(language, difficulty)
            .OrderBy(item => StableRandomKey(date, language, $"{difficulty}:quiz:{item.Id}"))
            .Take(5)
            .ToList();

        var questions = seeds.Select((seed, index) =>
        {
            var options = new[]
                {
                    new FallbackOption("a", seed.Correct),
                    new FallbackOption("b", seed.WrongA),
                    new FallbackOption("c", seed.WrongB)
                }
                .OrderBy(option => StableRandomKey(date, language, $"{difficulty}:{seed.Id}:{option.Text}"))
                .Select((option, optionIndex) => new FallbackOption(((char)('a' + optionIndex)).ToString(), option.Text))
                .ToList();

            var correctOptionId = options.Single(option => option.Text == seed.Correct).Id;
            return new
            {
                Question = new FallbackQuestion($"q{index + 1}", seed.Question, options),
                Answer = new { questionId = $"q{index + 1}", correctOptionId, explanation = seed.Explanation }
            };
        }).ToList();

        return new DailyGameContentChallenge
        {
            Type = "quiz",
            Title = language == "en" ? "Tiny Nutrition Quiz" : "Mini Beslenme Testi",
            Subtitle = DifficultySubtitle(language, difficulty, "5 daily questions", "5 günlük soru"),
            EstimatedSeconds = difficulty == "hard" ? 65 : difficulty == "medium" ? 75 : 85,
            PayloadJson = JsonSerializer.Serialize(new { questions = questions.Select(item => item.Question) }, JsonOptions),
            AnswerKeyJson = JsonSerializer.Serialize(new { answers = questions.Select(item => item.Answer) }, JsonOptions)
        };
    }

    private static DailyGameContentChallenge BuildWordFallback(DateOnly date, string language, string difficulty)
    {
        var seeds = BuildWordBank(language, difficulty)
            .OrderBy(item => StableRandomKey(date, language, $"{difficulty}:word:{item.Id}"))
            .Take(5)
            .ToList();

        var words = seeds.Select((seed, index) => new
        {
            id = $"w{index + 1}",
            clue = seed.Clue,
            scrambled = ScrambleWord(seed.Answer, date, language, difficulty, seed.Id),
            length = seed.Answer.Length
        }).ToList();

        var answers = seeds.Select((seed, index) => new
        {
            wordId = $"w{index + 1}",
            answer = seed.Answer,
            explanation = seed.Explanation
        }).ToList();

        return new DailyGameContentChallenge
        {
            Type = "word",
            Title = language == "en" ? "Word Pantry" : "Kelime Dolabı",
            Subtitle = DifficultySubtitle(language, difficulty, "Unscramble 5 clues", "5 ipucunu çöz"),
            EstimatedSeconds = difficulty == "hard" ? 80 : difficulty == "medium" ? 90 : 105,
            PayloadJson = JsonSerializer.Serialize(new { words }, JsonOptions),
            AnswerKeyJson = JsonSerializer.Serialize(new { answers }, JsonOptions)
        };
    }

    private static DailyGameContentChallenge BuildGuessFallback(DateOnly date, string language, string difficulty)
    {
        var seeds = BuildGuessBank(language, difficulty)
            .OrderBy(item => StableRandomKey(date, language, $"{difficulty}:guess:{item.Id}"))
            .Take(4)
            .ToList();

        var items = seeds.Select((seed, index) =>
        {
            var options = new[] { seed.Correct, seed.WrongA, seed.WrongB }
                .OrderBy(option => StableRandomKey(date, language, $"{difficulty}:{seed.Id}:{option.Text}"))
                .Select((option, optionIndex) => new
                {
                    id = ((char)('a' + optionIndex)).ToString(),
                    text = option.Text,
                    emoji = option.Emoji
                })
                .ToList();
            var correctOptionId = options.Single(option => option.text == seed.Correct.Text).id;

            return new
            {
                Item = new
                {
                    id = $"g{index + 1}",
                    maskedName = seed.MaskedName,
                    category = seed.Category,
                    color = seed.Color,
                    emoji = "❔",
                    clues = seed.Clues,
                    options
                },
                Answer = new
                {
                    itemId = $"g{index + 1}",
                    correctOptionId,
                    explanation = seed.Explanation
                }
            };
        }).ToList();

        return new DailyGameContentChallenge
        {
            Type = "guess",
            Title = language == "en" ? "Food Detective" : "Besin Dedektifi",
            Subtitle = DifficultySubtitle(language, difficulty, "4 staged clues", "4 aşamalı tahmin"),
            EstimatedSeconds = difficulty == "hard" ? 85 : difficulty == "medium" ? 95 : 105,
            PayloadJson = JsonSerializer.Serialize(new { items = items.Select(item => item.Item) }, JsonOptions),
            AnswerKeyJson = JsonSerializer.Serialize(new { answers = items.Select(item => item.Answer) }, JsonOptions)
        };
    }

    private static DailyGameContentChallenge BuildMarketFallback(DateOnly date, string language, string difficulty)
    {
        var targets = (language == "en"
            ? new[]
            {
                new FallbackMarketSeed("Apple", "🍎", "fruit", "#F87171", true),
                new FallbackMarketSeed("Yogurt", "🥣", "dairy", "#60A5FA", true),
                new FallbackMarketSeed("Oats", "🌾", "grain", "#EAB308", true),
                new FallbackMarketSeed("Cucumber", "🥒", "vegetable", "#34D399", true),
                new FallbackMarketSeed("Egg", "🥚", "protein", "#FDE68A", true),
                new FallbackMarketSeed("Walnut", "🌰", "healthy fat", "#A16207", true)
            }
            : [
                new FallbackMarketSeed("Elma", "🍎", "meyve", "#F87171", true),
                new FallbackMarketSeed("Yogurt", "🥣", "sut urunu", "#60A5FA", true),
                new FallbackMarketSeed("Yulaf", "🌾", "tahil", "#EAB308", true),
                new FallbackMarketSeed("Salatalik", "🥒", "sebze", "#34D399", true),
                new FallbackMarketSeed("Yumurta", "🥚", "protein", "#FDE68A", true),
                new FallbackMarketSeed("Ceviz", "🌰", "saglikli yag", "#A16207", true)
            ]).ToList();

        var hazards = (language == "en"
            ? new[]
            {
                new FallbackMarketSeed("Soda", "🥤", "distractor", "#94A3B8", false),
                new FallbackMarketSeed("Chips", "🍟", "distractor", "#FB923C", false),
                new FallbackMarketSeed("Candy", "🍬", "distractor", "#F472B6", false),
                new FallbackMarketSeed("Cream Sauce", "🧂", "distractor", "#CBD5E1", false),
                new FallbackMarketSeed("Cookie", "🍪", "distractor", "#D97706", false),
                new FallbackMarketSeed("Syrup", "🍯", "distractor", "#F59E0B", false),
                new FallbackMarketSeed("Cake", "🍰", "distractor", "#F9A8D4", false),
                new FallbackMarketSeed("Energy Drink", "🥫", "distractor", "#A78BFA", false),
                new FallbackMarketSeed("Fried Snack", "🥨", "distractor", "#C084FC", false),
                new FallbackMarketSeed("Sugary Cereal", "🥣", "distractor", "#FB7185", false)
            }
            : [
                new FallbackMarketSeed("Gazoz", "🥤", "tuzak", "#94A3B8", false),
                new FallbackMarketSeed("Cips", "🍟", "tuzak", "#FB923C", false),
                new FallbackMarketSeed("Seker", "🍬", "tuzak", "#F472B6", false),
                new FallbackMarketSeed("Krem Sos", "🧂", "tuzak", "#CBD5E1", false),
                new FallbackMarketSeed("Kurabiye", "🍪", "tuzak", "#D97706", false),
                new FallbackMarketSeed("Surup", "🍯", "tuzak", "#F59E0B", false),
                new FallbackMarketSeed("Pasta", "🍰", "tuzak", "#F9A8D4", false),
                new FallbackMarketSeed("Enerji Icecegi", "🥫", "tuzak", "#A78BFA", false),
                new FallbackMarketSeed("Kizarmis Atistirmalik", "🥨", "tuzak", "#C084FC", false),
                new FallbackMarketSeed("Sekerli Gevrek", "🥣", "tuzak", "#FB7185", false)
            ])
            .OrderBy(item => StableRandomKey(date, language, $"{difficulty}:market:{item.Label}"))
            .Take(difficulty == "hard" ? 10 : difficulty == "medium" ? 9 : 8)
            .ToList();

        var allSeeds = targets.Concat(hazards)
            .OrderBy(item => StableRandomKey(date, language, $"{difficulty}:market:order:{item.Label}"))
            .ToList();
        var lanes = new[] { -1, 0, 1 };
        var tickStep = difficulty == "hard" ? 4 : difficulty == "medium" ? 5 : 6;
        var speed = difficulty == "hard" ? 0.082 : difficulty == "medium" ? 0.074 : 0.066;

        var items = allSeeds.Select((seed, index) => new
        {
            id = seed.IsTarget ? $"target-{index + 1}" : $"hazard-{index + 1}",
            label = seed.Label,
            emoji = seed.Emoji,
            lane = lanes[Math.Abs(StableRandomKey(date, language, $"lane:{seed.Label}:{index}")) % lanes.Length],
            spawnTick = 2 + index * tickStep,
            speed,
            isTarget = seed.IsTarget,
            category = seed.Category,
            color = seed.Color
        }).ToList();

        return new DailyGameContentChallenge
        {
            Type = "market",
            Title = language == "en" ? "Market Run" : "Market Kosusu",
            Subtitle = DifficultySubtitle(language, difficulty, "3-lane grocery runner", "3 seritli market kosusu"),
            EstimatedSeconds = difficulty == "hard" ? 42 : difficulty == "medium" ? 46 : 50,
            PayloadJson = JsonSerializer.Serialize(new
            {
                missionTitle = language == "en" ? "Collect the clean list" : "Temiz listeyi topla",
                missionSubtitle = language == "en" ? "Slide lanes, grab list items, dodge distractions." : "Serit degistir, listedekileri topla, tuzaklardan kac.",
                timeLimitSeconds = difficulty == "hard" ? 42 : difficulty == "medium" ? 46 : 50,
                targetCount = targets.Count,
                items
            }, JsonOptions),
            AnswerKeyJson = JsonSerializer.Serialize(new
            {
                targets = items.Where(item => item.isTarget).Select(item => item.id),
                hazards = items.Where(item => !item.isTarget).Select(item => item.id),
                explanation = language == "en" ? "Targets are the grocery-list items." : "Hedefler alisveris listesindeki urunlerdir."
            }, JsonOptions)
        };
    }

    private static DailyGameContentChallenge BuildQuizFallback(string language)
    {
        var questions = language == "en"
            ? new[]
            {
                BuildQuestion("q1", "Which one is a protein-rich breakfast choice?", ("a", "Egg"), ("b", "Candy"), ("c", "Soda")),
                BuildQuestion("q2", "Which drink supports hydration best?", ("a", "Water"), ("b", "Cola"), ("c", "Energy drink")),
                BuildQuestion("q3", "Which food is usually rich in fiber?", ("a", "Lentils"), ("b", "Sugar cube"), ("c", "Butter")),
                BuildQuestion("q4", "A balanced plate usually includes?", ("a", "Protein, vegetables and grains"), ("b", "Only dessert"), ("c", "Only sauce")),
                BuildQuestion("q5", "When reading labels, what helps first?", ("a", "Serving size and ingredients"), ("b", "Package color"), ("c", "Shelf height"))
            }
            : [
                BuildQuestion("q1", "Protein açısından güçlü bir kahvaltı seçeneği hangisi?", ("a", "Yumurta"), ("b", "Şekerleme"), ("c", "Gazlı içecek")),
                BuildQuestion("q2", "Hidrasyonu en iyi destekleyen içecek hangisi?", ("a", "Su"), ("b", "Kola"), ("c", "Enerji içeceği")),
                BuildQuestion("q3", "Lif açısından genelde güçlü seçenek hangisi?", ("a", "Mercimek"), ("b", "Küp şeker"), ("c", "Tereyağı")),
                BuildQuestion("q4", "Dengeli tabakta genelde neler birlikte olur?", ("a", "Protein, sebze ve tahıl"), ("b", "Sadece tatlı"), ("c", "Sadece sos")),
                BuildQuestion("q5", "Etiket okurken önce neye bakmak yardımcı olur?", ("a", "Porsiyon ve içerik listesi"), ("b", "Paket rengi"), ("c", "Raf yüksekliği"))
            ];

        var explanations = language == "en"
            ? new[] { "Egg is an easy protein example.", "Water is the cleanest hydration choice.", "Lentils bring fiber and plant protein.", "Balance comes from combining food groups.", "Serving size and ingredients make labels meaningful." }
            : ["Yumurta pratik bir protein örneğidir.", "Su en sade hidrasyon seçeneğidir.", "Mercimek lif ve bitkisel protein taşır.", "Denge farklı besin gruplarını birleştirerek oluşur.", "Porsiyon ve içerik listesi etiketi anlamlı kılar."];

        var payload = new { questions };
        var answerKey = new
        {
            answers = questions.Select((question, index) => new
            {
                questionId = question.Id,
                correctOptionId = "a",
                explanation = explanations[index]
            })
        };

        return new DailyGameContentChallenge
        {
            Type = "quiz",
            Title = language == "en" ? "Tiny Nutrition Quiz" : "Mini Beslenme Testi",
            Subtitle = language == "en" ? "5 easy questions" : "5 kolay soru",
            EstimatedSeconds = 75,
            PayloadJson = JsonSerializer.Serialize(payload, JsonOptions),
            AnswerKeyJson = JsonSerializer.Serialize(answerKey, JsonOptions)
        };
    }

    private static DailyGameContentChallenge BuildWordFallback(string language)
    {
        var words = language == "en"
            ? new[]
            {
                BuildWord("w1", "A crunchy fruit", "palep", 5),
                BuildWord("w2", "Breakfast grain", "atso", 4),
                BuildWord("w3", "Green side plate", "alsad", 5),
                BuildWord("w4", "Tiny healthy crunch", "utalwn", 6),
                BuildWord("w5", "A cool dairy bowl", "tryugo", 6)
            }
            : [
                BuildWord("w1", "Kırmızı/yeşil çıtır meyve", "mael", 4),
                BuildWord("w2", "Kahvaltılık tahıl", "ylauf", 5),
                BuildWord("w3", "Yeşil yan tabak", "saalta", 6),
                BuildWord("w4", "Minik çıtır yağlı tohum", "zvcei", 5),
                BuildWord("w5", "Serin süt ürünü", "ğyortu", 6)
            ];

        var answers = language == "en"
            ? new[]
            {
                new { wordId = "w1", answer = "apple", explanation = "A simple fruit choice." },
                new { wordId = "w2", answer = "oats", explanation = "Oats are a breakfast grain." },
                new { wordId = "w3", answer = "salad", explanation = "Salad adds freshness." },
                new { wordId = "w4", answer = "walnut", explanation = "Walnuts bring crunch." },
                new { wordId = "w5", answer = "yogurt", explanation = "Yogurt is a dairy option." }
            }
            : [
                new { wordId = "w1", answer = "elma", explanation = "Elma kolay bir meyve seçimidir." },
                new { wordId = "w2", answer = "yulaf", explanation = "Yulaf kahvaltıda sık kullanılır." },
                new { wordId = "w3", answer = "salata", explanation = "Salata tabağa ferahlık katar." },
                new { wordId = "w4", answer = "ceviz", explanation = "Ceviz küçük ama doyurucu bir dokunuştur." },
                new { wordId = "w5", answer = "yoğurt", explanation = "Yoğurt serin bir süt ürünü seçeneğidir." }
            ];

        return new DailyGameContentChallenge
        {
            Type = "word",
            Title = language == "en" ? "Word Pantry" : "Kelime Dolabı",
            Subtitle = language == "en" ? "Unscramble 5 gentle clues" : "5 tatlı ipucunu çöz",
            EstimatedSeconds = 95,
            PayloadJson = JsonSerializer.Serialize(new { words }, JsonOptions),
            AnswerKeyJson = JsonSerializer.Serialize(new { answers }, JsonOptions)
        };
    }

    private static FallbackQuestion BuildQuestion(
        string id,
        string question,
        (string id, string text) optionA,
        (string id, string text) optionB,
        (string id, string text) optionC)
        => new(
            id,
            question,
            [
                new(optionA.id, optionA.text),
                new(optionB.id, optionB.text),
                new(optionC.id, optionC.text)
            ]);

    private static object BuildWord(string id, string clue, string scrambled, int length)
        => new { id, clue, scrambled, length };

    private static IReadOnlyList<MemoryFood> BuildMemoryFoodExtras(string language, string difficulty)
    {
        if (language == "en")
        {
            return difficulty switch
            {
                "hard" =>
                [
                    new("Chickpea", "🫘", "#D6A75C", "cute pastel chickpea bowl memory card, clean white background, soft shadow"),
                    new("Kefir", "🥛", "#7DD3FC", "cute pastel kefir glass memory card, clean white background, soft shadow"),
                    new("Buckwheat", "🌾", "#C084FC", "cute pastel buckwheat bowl memory card, clean white background, soft shadow"),
                    new("Pumpkin seed", "🎃", "#FB923C", "cute pastel pumpkin seed memory card, clean white background, soft shadow"),
                    new("Arugula", "🥬", "#22C55E", "cute pastel arugula leaves memory card, clean white background, soft shadow")
                ],
                "medium" =>
                [
                    new("Lentil", "🫘", "#F97316", "cute pastel lentil bowl memory card, clean white background, soft shadow"),
                    new("Oats", "🌾", "#EAB308", "cute pastel oats bowl memory card, clean white background, soft shadow"),
                    new("Carrot", "🥕", "#FB923C", "cute pastel carrot memory card, clean white background, soft shadow"),
                    new("Spinach", "🥬", "#22C55E", "cute pastel spinach memory card, clean white background, soft shadow"),
                    new("Yogurt", "🥣", "#60A5FA", "cute pastel yogurt bowl memory card, clean white background, soft shadow")
                ],
                _ =>
                [
                    new("Pear", "🍐", "#A3E635", "cute pastel pear memory card, clean white background, soft shadow"),
                    new("Grape", "🍇", "#A78BFA", "cute pastel grape memory card, clean white background, soft shadow"),
                    new("Cucumber", "🥒", "#4ADE80", "cute pastel cucumber memory card, clean white background, soft shadow"),
                    new("Tomato", "🍅", "#F87171", "cute pastel tomato memory card, clean white background, soft shadow")
                ]
            };
        }

        return difficulty switch
        {
            "hard" =>
            [
                new("Nohut", "🫘", "#D6A75C", "sevimli pastel nohut kasesi hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Kefir", "🥛", "#7DD3FC", "sevimli pastel kefir bardağı hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Karabuğday", "🌾", "#C084FC", "sevimli pastel karabuğday kasesi hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Kabak çekirdeği", "🎃", "#FB923C", "sevimli pastel kabak çekirdeği hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Roka", "🥬", "#22C55E", "sevimli pastel roka yaprakları hafıza kartı, temiz beyaz arka plan, yumuşak gölge")
            ],
            "medium" =>
            [
                new("Mercimek", "🫘", "#F97316", "sevimli pastel mercimek kasesi hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Yulaf", "🌾", "#EAB308", "sevimli pastel yulaf kasesi hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Havuç", "🥕", "#FB923C", "sevimli pastel havuç hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Ispanak", "🥬", "#22C55E", "sevimli pastel ıspanak hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Yoğurt", "🥣", "#60A5FA", "sevimli pastel yoğurt kasesi hafıza kartı, temiz beyaz arka plan, yumuşak gölge")
            ],
            _ =>
            [
                new("Armut", "🍐", "#A3E635", "sevimli pastel armut hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Üzüm", "🍇", "#A78BFA", "sevimli pastel üzüm hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Salatalık", "🥒", "#4ADE80", "sevimli pastel salatalık hafıza kartı, temiz beyaz arka plan, yumuşak gölge"),
                new("Domates", "🍅", "#F87171", "sevimli pastel domates hafıza kartı, temiz beyaz arka plan, yumuşak gölge")
            ]
        };
    }

    private static string DifficultySubtitle(string language, string difficulty, string enBase, string trBase)
    {
        if (language == "en")
            return difficulty switch
            {
                "hard" => $"hard · {enBase}",
                "medium" => $"medium · {enBase}",
                _ => $"easy · {enBase}"
            };

        return difficulty switch
        {
            "hard" => $"zor · {trBase}",
            "medium" => $"orta · {trBase}",
            _ => $"kolay · {trBase}"
        };
    }

    private static IReadOnlyList<FallbackQuizSeed> BuildQuizBank(string language, string difficulty)
    {
        if (language == "en")
        {
            return difficulty switch
            {
                "hard" =>
                [
                    new("hq1", "Which plate change usually improves balance without removing a food group?", "Add vegetables beside protein and grains", "Skip every grain", "Drink only smoothies", "Balance improves when food groups support each other."),
                    new("hq2", "Which label detail helps compare two similar products most fairly?", "Serving size", "Mascot style", "Shelf color", "Serving size makes comparisons meaningful."),
                    new("hq3", "Which snack pairing is more steady than fruit alone?", "Fruit with yogurt", "Fruit with candy", "Fruit with soda", "Pairing fruit with protein can feel more satisfying."),
                    new("hq4", "Which pantry habit makes weeknight cooking easier?", "Keep one legume and one grain ready", "Buy only sauces", "Avoid frozen vegetables", "Simple staples make meals faster."),
                    new("hq5", "Which option adds crunch with useful fats?", "Walnuts", "Sugar cubes", "Plain syrup", "Walnuts can add crunch and useful fats."),
                    new("hq6", "Which breakfast upgrade adds fiber?", "Oats or whole-grain bread", "Only juice", "Only jam", "Whole grains are an easy fiber source.")
                ],
                "medium" =>
                [
                    new("mq1", "Which option is usually richer in fiber?", "Lentils", "White sugar", "Butter", "Lentils bring fiber and plant protein."),
                    new("mq2", "Which drink is the cleanest hydration choice?", "Water", "Cola", "Energy drink", "Water is the simplest hydration choice."),
                    new("mq3", "What makes a lunch plate more balanced?", "Protein, vegetables and grains", "Only dessert", "Only sauce", "A balanced plate combines food groups."),
                    new("mq4", "Which breakfast choice brings protein?", "Egg", "Candy", "Soda", "Egg is a simple protein example."),
                    new("mq5", "Which item is useful to check first on a label?", "Serving size", "Package color", "Ad slogan", "Serving size helps interpret the label."),
                    new("mq6", "Which side adds freshness?", "Salad", "Cream candy", "Plain syrup", "Salad adds freshness and volume.")
                ],
                _ =>
                [
                    new("eq1", "Which one is a fruit?", "Apple", "Soda", "Candy", "Apple is a simple fruit choice."),
                    new("eq2", "Which one is a vegetable?", "Carrot", "Cake", "Cola", "Carrot is an everyday vegetable."),
                    new("eq3", "Which one is a dairy option?", "Yogurt", "Chips", "Lollipop", "Yogurt is a dairy option."),
                    new("eq4", "Which one is a grain?", "Oats", "Butter", "Candy", "Oats are a breakfast grain."),
                    new("eq5", "Which one supports hydration best?", "Water", "Cola", "Syrup", "Water is the clearest hydration choice."),
                    new("eq6", "Which one is a legume?", "Lentils", "Chocolate", "Cream", "Lentils are legumes.")
                ]
            };
        }

        return difficulty switch
        {
            "hard" =>
            [
                new("hq1", "Hangi tabak hamlesi bir besin grubunu çıkarmadan dengeyi artırır?", "Protein ve tahılın yanına sebze eklemek", "Tüm tahılları çıkarmak", "Sadece smoothie içmek", "Denge, besin grupları birbirini tamamladığında güçlenir."),
                new("hq2", "Benzer iki ürünü karşılaştırırken en adil başlangıç hangisi?", "Porsiyon miktarı", "Paket maskotu", "Raf rengi", "Porsiyon miktarı etiketi anlamlı kılar."),
                new("hq3", "Meyveyi tek başına yemek yerine hangi eşleşme daha tok hissettirebilir?", "Meyve ve yoğurt", "Meyve ve şekerleme", "Meyve ve gazlı içecek", "Proteinli bir eşlik meyveyi daha doyurucu yapabilir."),
                new("hq4", "Hafta içi yemeklerini kolaylaştıran dolap alışkanlığı hangisi?", "Bir baklagil ve bir tahılı hazır tutmak", "Sadece sos almak", "Dondurulmuş sebzeden kaçmak", "Basit temel ürünler yemek hazırlığını hızlandırır."),
                new("hq5", "Hangisi çıtırlıkla birlikte faydalı yağlar da ekler?", "Ceviz", "Küp şeker", "Sade şurup", "Ceviz çıtırlık ve faydalı yağlar ekleyebilir."),
                new("hq6", "Kahvaltıda lif desteği için hangi yükseltme daha uygundur?", "Yulaf veya tam tahıllı ekmek", "Sadece meyve suyu", "Sadece reçel", "Tam tahıllar pratik lif kaynaklarıdır.")
            ],
            "medium" =>
            [
                new("mq1", "Lif açısından genelde daha güçlü seçenek hangisi?", "Mercimek", "Beyaz şeker", "Tereyağı", "Mercimek lif ve bitkisel protein taşır."),
                new("mq2", "Hidrasyon için en sade seçim hangisi?", "Su", "Kola", "Enerji içeceği", "Su en sade hidrasyon seçeneğidir."),
                new("mq3", "Öğle tabağını daha dengeli yapan şey hangisi?", "Protein, sebze ve tahıl", "Sadece tatlı", "Sadece sos", "Dengeli tabak besin gruplarını birleştirir."),
                new("mq4", "Protein açısından güçlü kahvaltı örneği hangisi?", "Yumurta", "Şekerleme", "Gazlı içecek", "Yumurta pratik bir protein örneğidir."),
                new("mq5", "Etikette önce bakmak için yararlı bilgi hangisi?", "Porsiyon miktarı", "Paket rengi", "Reklam cümlesi", "Porsiyon miktarı etiketi yorumlamayı kolaylaştırır."),
                new("mq6", "Tabağa ferahlık katan yan seçenek hangisi?", "Salata", "Krem şeker", "Sade şurup", "Salata ferahlık ve hacim katar.")
            ],
            _ =>
            [
                new("eq1", "Hangisi meyvedir?", "Elma", "Gazoz", "Şekerleme", "Elma kolay bir meyve seçimidir."),
                new("eq2", "Hangisi sebzedir?", "Havuç", "Kek", "Kola", "Havuç günlük bir sebze örneğidir."),
                new("eq3", "Hangisi süt ürünü seçeneğidir?", "Yoğurt", "Cips", "Lolipop", "Yoğurt bir süt ürünü seçeneğidir."),
                new("eq4", "Hangisi tahıldır?", "Yulaf", "Tereyağı", "Şeker", "Yulaf kahvaltılık bir tahıldır."),
                new("eq5", "Hidrasyonu en iyi hangisi destekler?", "Su", "Kola", "Şurup", "Su en net hidrasyon seçimidir."),
                new("eq6", "Hangisi baklagildir?", "Mercimek", "Çikolata", "Krema", "Mercimek bir baklagildir.")
            ]
        };
    }

    private static IReadOnlyList<FallbackWordSeed> BuildWordBank(string language, string difficulty)
    {
        if (language == "en")
        {
            return difficulty switch
            {
                "hard" =>
                [
                    new("hw1", "A fermented dairy drink", "kefir", "Kefir is a fermented dairy drink."),
                    new("hw2", "A legume often used in hummus", "chickpea", "Chickpeas are useful pantry legumes."),
                    new("hw3", "A green leaf with a peppery taste", "arugula", "Arugula adds a peppery green note."),
                    new("hw4", "A seed often sprinkled on bowls", "pumpkin", "Pumpkin seeds can add crunch."),
                    new("hw5", "A grain-like pantry staple", "buckwheat", "Buckwheat is a useful grain-like staple."),
                    new("hw6", "A fresh herb that brightens meals", "parsley", "Parsley adds freshness.")
                ],
                "medium" =>
                [
                    new("mw1", "Breakfast grain", "oats", "Oats are a breakfast grain."),
                    new("mw2", "Green side plate", "salad", "Salad adds freshness."),
                    new("mw3", "Tiny healthy crunch", "walnut", "Walnuts bring crunch."),
                    new("mw4", "Cool dairy bowl", "yogurt", "Yogurt is a dairy option."),
                    new("mw5", "Orange vegetable", "carrot", "Carrot is an everyday vegetable."),
                    new("mw6", "Plant protein in soup", "lentil", "Lentils bring plant protein.")
                ],
                _ =>
                [
                    new("ew1", "A crunchy fruit", "apple", "Apple is a simple fruit choice."),
                    new("ew2", "Yellow fruit", "banana", "Banana is a familiar fruit."),
                    new("ew3", "A red fruit", "cherry", "Cherry is a fruit."),
                    new("ew4", "Clear drink", "water", "Water supports hydration."),
                    new("ew5", "A citrus fruit", "lemon", "Lemon is a citrus fruit."),
                    new("ew6", "Green fruit", "pear", "Pear is a simple fruit.")
                ]
            };
        }

        return difficulty switch
        {
            "hard" =>
            [
                new("hw1", "Fermente süt içeceği", "kefir", "Kefir fermente bir süt içeceğidir."),
                new("hw2", "Humusta sık kullanılan baklagil", "nohut", "Nohut kullanışlı bir dolap baklagilidir."),
                new("hw3", "Keskin aromalı yeşil yaprak", "roka", "Roka tabağa canlı bir aroma katar."),
                new("hw4", "Kaselere çıtırlık ekleyen çekirdek", "kabak", "Kabak çekirdeği çıtırlık katabilir."),
                new("hw5", "Dolapta işe yarayan tahıl benzeri ürün", "karabugday", "Karabuğday kullanışlı bir temel üründür."),
                new("hw6", "Yemeği tazeleyen ot", "maydanoz", "Maydanoz ferahlık katar.")
            ],
            "medium" =>
            [
                new("mw1", "Kahvaltılık tahıl", "yulaf", "Yulaf kahvaltıda sık kullanılır."),
                new("mw2", "Yeşil yan tabak", "salata", "Salata tabağa ferahlık katar."),
                new("mw3", "Minik çıtır yağlı tohum", "ceviz", "Ceviz küçük ama doyurucu bir dokunuştur."),
                new("mw4", "Serin süt ürünü", "yogurt", "Yoğurt serin bir süt ürünü seçeneğidir."),
                new("mw5", "Turuncu sebze", "havuc", "Havuç günlük bir sebzedir."),
                new("mw6", "Çorbada bitkisel protein", "mercimek", "Mercimek bitkisel protein taşır.")
            ],
            _ =>
            [
                new("ew1", "Kırmızı/yeşil çıtır meyve", "elma", "Elma kolay bir meyve seçimidir."),
                new("ew2", "Sarı meyve", "muz", "Muz tanıdık bir meyvedir."),
                new("ew3", "Kırmızı küçük meyve", "kiraz", "Kiraz bir meyvedir."),
                new("ew4", "Sade içecek", "su", "Su hidrasyonu destekler."),
                new("ew5", "Ekşi narenciye", "limon", "Limon bir narenciye örneğidir."),
                new("ew6", "Yeşil meyve", "armut", "Armut kolay bir meyve seçimidir.")
            ]
        };
    }

    private static IReadOnlyList<FallbackGuessSeed> BuildGuessBank(string language, string difficulty)
    {
        if (language == "en")
        {
            return difficulty switch
            {
                "hard" =>
                [
                    new("hg1", "K____", "Fermented dairy", "#7DD3FC",
                        ["I am a drink, but not a juice.", "I am made from milk through fermentation.", "My name starts with K and is often served cold."],
                        new GuessOption("Kefir", "🥛"), new GuessOption("Ayran", "🥛"), new GuessOption("Lemonade", "🍋"), "Kefir is a fermented dairy drink."),
                    new("hg2", "N____", "Legume", "#D6A75C",
                        ["I am small and round.", "I often become hummus.", "I am a beige legume used in salads and stews."],
                        new GuessOption("Chickpea", "🫘"), new GuessOption("Rice", "🍚"), new GuessOption("Walnut", "🌰"), "Chickpeas are useful legumes."),
                    new("hg3", "R_____", "Leafy green", "#22C55E",
                        ["I am green and leafy.", "My taste is a little peppery.", "I often joins salads as a sharp green."],
                        new GuessOption("Arugula", "🥬"), new GuessOption("Banana", "🍌"), new GuessOption("Oats", "🌾"), "Arugula adds a peppery green note."),
                    new("hg4", "B________", "Pantry staple", "#C084FC",
                        ["I sit near grains in the pantry.", "I can be used in bowls and side dishes.", "My name sounds like wheat but I am buckwheat."],
                        new GuessOption("Buckwheat", "🌾"), new GuessOption("Butter", "🧈"), new GuessOption("Cucumber", "🥒"), "Buckwheat is a useful grain-like pantry staple.")
                ],
                "medium" =>
                [
                    new("mg1", "Y_____", "Dairy", "#60A5FA",
                        ["I am cool and creamy.", "I often appears at breakfast or snacks.", "I can be eaten plain or with fruit."],
                        new GuessOption("Yogurt", "🥣"), new GuessOption("Soda", "🥤"), new GuessOption("Candy", "🍬"), "Yogurt is a familiar dairy option."),
                    new("mg2", "L_____", "Legume", "#F97316",
                        ["I am often used in soup.", "I bring plant protein.", "I am a small legume with red or green types."],
                        new GuessOption("Lentil", "🫘"), new GuessOption("Apple", "🍎"), new GuessOption("Butter", "🧈"), "Lentils bring plant protein and fiber."),
                    new("mg3", "C_____", "Vegetable", "#FB923C",
                        ["I am orange and crunchy.", "I can be eaten raw or cooked.", "Rabbits are famously linked with me."],
                        new GuessOption("Carrot", "🥕"), new GuessOption("Cherry", "🍒"), new GuessOption("Cheese", "🧀"), "Carrot is an everyday vegetable."),
                    new("mg4", "O___", "Grain", "#EAB308",
                        ["I often appears at breakfast.", "I can become porridge.", "I am a short grain word with four letters."],
                        new GuessOption("Oats", "🌾"), new GuessOption("Cola", "🥤"), new GuessOption("Jam", "🍯"), "Oats are a breakfast grain.")
                ],
                _ =>
                [
                    new("eg1", "A____", "Fruit", "#F87171",
                        ["I am a fruit.", "I can be red or green.", "I am crunchy and common in lunchboxes."],
                        new GuessOption("Apple", "🍎"), new GuessOption("Soda", "🥤"), new GuessOption("Candy", "🍬"), "Apple is a simple fruit choice."),
                    new("eg2", "B_____", "Fruit", "#FACC15",
                        ["I am a yellow fruit.", "I can be peeled by hand.", "I am often used in smoothies."],
                        new GuessOption("Banana", "🍌"), new GuessOption("Butter", "🧈"), new GuessOption("Bread", "🍞"), "Banana is a familiar fruit."),
                    new("eg3", "W____", "Drink", "#38BDF8",
                        ["I am a drink.", "I have no package slogan here.", "I is the simplest hydration choice."],
                        new GuessOption("Water", "💧"), new GuessOption("Cola", "🥤"), new GuessOption("Syrup", "🍯"), "Water is the clearest hydration choice."),
                    new("eg4", "E__", "Protein", "#FDE68A",
                        ["I am common at breakfast.", "I can be boiled.", "I comes in a shell."],
                        new GuessOption("Egg", "🥚"), new GuessOption("Cake", "🍰"), new GuessOption("Soda", "🥤"), "Egg is a simple protein example.")
                ]
            };
        }

        return difficulty switch
        {
            "hard" =>
            [
                new("hg1", "K____", "Fermente süt", "#7DD3FC",
                    ["İçeceğim ama meyve suyu değilim.", "Sütten fermantasyonla hazırlanırım.", "K harfiyle başlar, çoğu zaman soğuk içilirim."],
                    new GuessOption("Kefir", "🥛"), new GuessOption("Ayran", "🥛"), new GuessOption("Limonata", "🍋"), "Kefir fermente bir süt içeceğidir."),
                new("hg2", "N____", "Baklagil", "#D6A75C",
                    ["Küçük ve yuvarlak bir besinim.", "Humusun ana oyuncularından biriyim.", "Salata ve sulu yemeklerde kullanılan bej baklagilim."],
                    new GuessOption("Nohut", "🫘"), new GuessOption("Pirinç", "🍚"), new GuessOption("Ceviz", "🌰"), "Nohut kullanışlı bir baklagildir."),
                new("hg3", "R___", "Yeşil yaprak", "#22C55E",
                    ["Yeşil ve yapraklıyım.", "Tadım biraz keskindir.", "Salatalara aromalı bir dokunuş katarım."],
                    new GuessOption("Roka", "🥬"), new GuessOption("Muz", "🍌"), new GuessOption("Yulaf", "🌾"), "Roka tabağa canlı aroma katar."),
                new("hg4", "K_________", "Dolap ürünü", "#C084FC",
                    ["Dolapta tahıllara yakın dururum.", "Kase ve yan yemeklerde kullanılabilirim.", "Adım buğdayla biter ama karabuğdayım."],
                    new GuessOption("Karabuğday", "🌾"), new GuessOption("Tereyağı", "🧈"), new GuessOption("Salatalık", "🥒"), "Karabuğday kullanışlı bir temel üründür.")
            ],
            "medium" =>
            [
                new("mg1", "Y_____", "Süt ürünü", "#60A5FA",
                    ["Serin ve kıvamlıyım.", "Kahvaltıda veya ara öğünde sık görülürüm.", "Sade ya da meyveyle yenebilirim."],
                    new GuessOption("Yoğurt", "🥣"), new GuessOption("Gazoz", "🥤"), new GuessOption("Şekerleme", "🍬"), "Yoğurt tanıdık bir süt ürünü seçeneğidir."),
                new("mg2", "M_______", "Baklagil", "#F97316",
                    ["Çorbada sık kullanılırım.", "Bitkisel protein taşırım.", "Kırmızı ve yeşil türlerim olan küçük baklagilim."],
                    new GuessOption("Mercimek", "🫘"), new GuessOption("Elma", "🍎"), new GuessOption("Tereyağı", "🧈"), "Mercimek lif ve bitkisel protein taşır."),
                new("mg3", "H____", "Sebze", "#FB923C",
                    ["Turuncu ve çıtırım.", "Çiğ de pişmiş de yenebilirim.", "Tavşanlarla ünlü bir sebzeyim."],
                    new GuessOption("Havuç", "🥕"), new GuessOption("Kiraz", "🍒"), new GuessOption("Peynir", "🧀"), "Havuç günlük bir sebze örneğidir."),
                new("mg4", "Y____", "Tahıl", "#EAB308",
                    ["Kahvaltıda sık görülürüm.", "Lapa veya kase tariflerinde kullanılabilirim.", "Beş harfli pratik bir tahılım."],
                    new GuessOption("Yulaf", "🌾"), new GuessOption("Kola", "🥤"), new GuessOption("Reçel", "🍯"), "Yulaf kahvaltıda sık kullanılan bir tahıldır.")
            ],
            _ =>
            [
                new("eg1", "E___", "Meyve", "#F87171",
                    ["Bir meyveyim.", "Kırmızı veya yeşil olabilirim.", "Çıtır ve çok tanıdık bir ara öğünüm."],
                    new GuessOption("Elma", "🍎"), new GuessOption("Gazoz", "🥤"), new GuessOption("Şekerleme", "🍬"), "Elma kolay bir meyve seçimidir."),
                new("eg2", "M__", "Meyve", "#FACC15",
                    ["Sarı bir meyveyim.", "Kabuklu ama elle kolay soyulurum.", "Smoothie tariflerinde sık görülürüm."],
                    new GuessOption("Muz", "🍌"), new GuessOption("Tereyağı", "🧈"), new GuessOption("Ekmek", "🍞"), "Muz tanıdık bir meyvedir."),
                new("eg3", "S_", "İçecek", "#38BDF8",
                    ["Bir içeceğim.", "Paket sloganım yok, oldukça sadeyim.", "Hidrasyon için en net seçimim."],
                    new GuessOption("Su", "💧"), new GuessOption("Kola", "🥤"), new GuessOption("Şurup", "🍯"), "Su en sade hidrasyon seçeneğidir."),
                new("eg4", "Y______", "Protein", "#FDE68A",
                    ["Kahvaltıda sık görülürüm.", "Haşlanabilirim.", "Kabuk içinde gelen pratik protein örneğiyim."],
                    new GuessOption("Yumurta", "🥚"), new GuessOption("Kek", "🍰"), new GuessOption("Gazoz", "🥤"), "Yumurta pratik bir protein örneğidir.")
            ]
        };
    }

    private static string ScrambleWord(string answer, DateOnly date, string language, string difficulty, string id)
    {
        var chars = answer.ToCharArray()
            .Select((ch, index) => new { ch, index })
            .OrderBy(item => StableRandomKey(date, language, $"{difficulty}:{id}:{item.ch}:{item.index}"))
            .Select(item => item.ch)
            .ToArray();

        var scrambled = new string(chars);
        return string.Equals(scrambled, answer, StringComparison.OrdinalIgnoreCase)
            ? new string(chars.Reverse().ToArray())
            : scrambled;
    }

    private static int StableRandomKey(DateOnly date, string language, string value)
    {
        unchecked
        {
            var hash = date.DayNumber * 397;
            foreach (var ch in language)
                hash = (hash * 31) + ch;
            foreach (var ch in value)
                hash = (hash * 31) + ch;
            return hash;
        }
    }

    private sealed class AiGamePackResponse
    {
        [JsonPropertyName("challenges")]
        public List<AiGameChallenge>? Challenges { get; set; }
    }

    private sealed class AiGameChallenge
    {
        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("subtitle")]
        public string? Subtitle { get; set; }

        [JsonPropertyName("estimatedSeconds")]
        public int EstimatedSeconds { get; set; }

        [JsonPropertyName("payload")]
        public JsonElement Payload { get; set; }

        [JsonPropertyName("answerKey")]
        public JsonElement AnswerKey { get; set; }
    }

    private sealed record FallbackQuestion(
        string Id,
        string Question,
        IReadOnlyList<FallbackOption> Options);

    private sealed record FallbackOption(string Id, string Text);

    private sealed record FallbackQuizSeed(
        string Id,
        string Question,
        string Correct,
        string WrongA,
        string WrongB,
        string Explanation);

    private sealed record FallbackWordSeed(
        string Id,
        string Clue,
        string Answer,
        string Explanation);

    private sealed record GuessOption(string Text, string Emoji);

    private sealed record FallbackGuessSeed(
        string Id,
        string MaskedName,
        string Category,
        string Color,
        IReadOnlyList<string> Clues,
        GuessOption Correct,
        GuessOption WrongA,
        GuessOption WrongB,
        string Explanation);

    private sealed record FallbackMarketSeed(string Label, string Emoji, string Category, string Color, bool IsTarget);

    private sealed record MemoryFood(string Label, string Emoji, string Color, string ImagePrompt);
}
