using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
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

    private static readonly string[] RequiredTypes = ["memory", "quiz", "word"];
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
        CancellationToken ct = default)
    {
        var apiKey = _options.ApiKey ?? Environment.GetEnvironmentVariable(_options.ApiKeyEnvVar);
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            using var aiTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            aiTimeout.CancelAfter(AiGenerationBudget);
            var aiPack = await TryGenerateWithOpenAiAsync(date, language, apiKey, aiTimeout.Token);
            if (aiPack is not null)
                return aiPack;
        }

        return BuildFallbackPack(date, language);
    }

    private async Task<DailyGameContentPack?> TryGenerateWithOpenAiAsync(
        DateOnly date,
        string language,
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
                    new { role = "system", content = BuildSystemPrompt(language) },
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

    private static string BuildSystemPrompt(string language)
    {
        var locale = language == "en" ? "English" : "Turkish";
        return $$"""
        You create safe, easy nutrition mini-game content for a dietitian mobile app.
        Language: {{locale}}.

        Return only JSON object with this shape:
        {
          "challenges": [
            {
              "type": "memory|quiz|word",
              "title": "short friendly title",
              "subtitle": "short friendly subtitle",
              "estimatedSeconds": 60,
              "payload": {},
              "answerKey": {}
            }
          ]
        }

        Mandatory game rules:
        - Exactly 3 challenges: one "memory", one "quiz", one "word".
        - Difficulty must be easy enough for a normal app user.
        - No medical claims, no disease/treatment advice, no guaranteed weight-loss statements.
        - memory payload: { "schemaVersion": 2, "gridSize": 4, "cards": 16 cards, "hint": "..." }.
          Cards must be 8 healthy food pairs. Each card has pairId, label, emoji, color, imagePrompt, isJoker=false.
          imagePrompt should describe a cute pastel fruit/vegetable card illustration, but do not include medical claims.
          answerKey: { "pairs": 8 objects with pairId and label }.
        - quiz payload: { "questions": 5 questions }. Each question has id, question, options[3] with id/text.
          answerKey: { "answers": 5 objects with questionId, correctOptionId, explanation }.
        - word payload: { "words": 5 items }. Each item has id, clue, scrambled, length.
          answerKey: { "answers": 5 objects with wordId, answer, explanation }.
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
        if (challenges.Count != 3)
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

    private static DailyGameContentPack BuildFallbackPack(DateOnly date, string language)
    {
        return new DailyGameContentPack
        {
            SourceProvider = "fallback",
            IsFallback = true,
            Challenges =
            [
                BuildMemoryFallback(date, language),
                BuildQuizFallback(language),
                BuildWordFallback(language)
            ]
        };
    }

    private static DailyGameContentChallenge BuildMemoryFallback(DateOnly date, string language)
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

            var memoryCards = foods.SelectMany((food, index) =>
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
                pairs = foods.Select((food, index) => new { pairId = $"p{index + 1:00}", label = food.Label })
            };

            return new DailyGameContentChallenge
            {
                Type = "memory",
                Title = language == "en" ? "Pantry Pairs" : "Dolap Eşleri",
                Subtitle = language == "en" ? "8 pairs · 4x4 memory" : "8 çift · 4x4 hafıza",
                EstimatedSeconds = 90,
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

    private sealed record MemoryFood(string Label, string Emoji, string Color, string ImagePrompt);
}
