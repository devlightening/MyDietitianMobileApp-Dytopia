using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// GPT-4o Vision-based ingredient and receipt reader.
/// </summary>
public sealed class VisionIngredientService : IVisionIngredientService
{
    private static readonly JsonSerializerOptions LaxJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly VisionIngredientOptions _options;
    private readonly ILogger<VisionIngredientService> _logger;

    public VisionIngredientService(
        IHttpClientFactory httpClientFactory,
        VisionIngredientOptions options,
        ILogger<VisionIngredientService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
        _logger = logger;
    }

    public VisionFeatureStatus GetStatus()
    {
        var key = _options.ApiKey ?? Environment.GetEnvironmentVariable(_options.ApiKeyEnvVar);
        return string.IsNullOrWhiteSpace(key)
            ? VisionFeatureStatus.ApiKeyMissing
            : VisionFeatureStatus.Active;
    }

    public Task<VisionDetectionResult> DetectFoodNamesAsync(
        string base64Image,
        string mediaType,
        CancellationToken cancellationToken = default)
    {
        var prompt =
            $"Gorseldeki yiyecekleri tani. Yalnizca bu listeden sec: {string.Join(", ", _options.ClosedSetCanonicalNames)}. " +
            "Ambalajli veya konserve urunler de dahil, icerigini listele. " +
            "Gorduklerini yaz, gormedigini yazma. Turkce, kucuk harf, tekil. " +
            "JSON: {\"items\":[\"domates\",\"marul\"]}.";

        return DetectItemsAsync(
            base64Image,
            mediaType,
            prompt,
            "Vision ingredient detection",
            cancellationToken);
    }

    public Task<VisionDetectionResult> DetectReceiptItemsAsync(
        string base64Image,
        string mediaType,
        CancellationToken cancellationToken = default)
    {
        const string prompt =
            "Bu gorsel bir market fisi olabilir. Fisteki yenilebilir urun satirlarini ayikla ve pantry icin anlamli urun adlarini listele. " +
            "Fiyat, adet, KDV, kampanya, toplam, kasa bilgisi ve fis numarasi gibi alanlari yok say. " +
            "Marka varsa mumkunse sadelestir; urun turunu koru. " +
            "Ornek: 'PINAR TAM YAGLI SUT 1L' -> 'sut', 'BANVIT TAVUK GOGSU' -> 'tavuk gogsu'. " +
            "Yalnizca yenilebilir mutfak urunlerini dondur. Turkce, kucuk harf, kisa ve acik yaz. " +
            "JSON: {\"items\":[\"sut\",\"yumurta\",\"domates\"]}.";

        return DetectItemsAsync(
            base64Image,
            mediaType,
            prompt,
            "Receipt ingredient detection",
            cancellationToken);
    }

    private async Task<VisionDetectionResult> DetectItemsAsync(
        string base64Image,
        string mediaType,
        string systemPrompt,
        string operationName,
        CancellationToken cancellationToken)
    {
        try
        {
            var apiKey = _options.ApiKey ?? Environment.GetEnvironmentVariable(_options.ApiKeyEnvVar);
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("{Operation} skipped: OPENAI_API_KEY is not configured.", operationName);
                return VisionDetectionResult.Empty;
            }

            var approxBytes = (long)base64Image.Length * 3 / 4;
            if (approxBytes > _options.MaxImageBytes)
            {
                _logger.LogWarning(
                    "{Operation}: image too large ({Bytes} bytes approx, max {Max}). Skipping.",
                    operationName,
                    approxBytes,
                    _options.MaxImageBytes);
                return VisionDetectionResult.ImageTooLarge;
            }

            var dataUri = $"data:{mediaType};base64,{base64Image}";

            var requestBody = new
            {
                model = _options.ModelName,
                max_tokens = 140,
                temperature = 0.0,
                response_format = new { type = "json_object" },
                messages = new object[]
                {
                    new
                    {
                        role = "system",
                        content = systemPrompt,
                    },
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new
                            {
                                type = "image_url",
                                image_url = new
                                {
                                    url = dataUri,
                                    detail = "low",
                                }
                            }
                        }
                    }
                }
            };

            var client = _httpClientFactory.CreateClient("openai");
            var request = new HttpRequestMessage(HttpMethod.Post, "v1/chat/completions")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(requestBody),
                    Encoding.UTF8,
                    "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(_options.TimeoutSeconds));

            var response = await client.SendAsync(request, cts.Token);
            var responseBody = await response.Content.ReadAsStringAsync(cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "{Operation} API error {Status}: {Body}",
                    operationName,
                    response.StatusCode,
                    responseBody);
                return VisionDetectionResult.Empty;
            }

            return ParseResult(responseBody);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "{Operation} threw an exception. Returning empty list.", operationName);
            return VisionDetectionResult.Empty;
        }
    }

    private VisionDetectionResult ParseResult(string responseBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            var promptTokens = 0;
            var completionTokens = 0;
            if (root.TryGetProperty("usage", out var usage))
            {
                if (usage.TryGetProperty("prompt_tokens", out var pt)) promptTokens = pt.GetInt32();
                if (usage.TryGetProperty("completion_tokens", out var ct)) completionTokens = ct.GetInt32();
            }

            _logger.LogInformation(
                "Vision API usage: model={Model} prompt_tokens={Prompt} completion_tokens={Completion} total={Total}",
                _options.ModelName,
                promptTokens,
                completionTokens,
                promptTokens + completionTokens);

            var content = root
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? string.Empty;

            var parsed = JsonSerializer.Deserialize<VisionRawResponse>(content, LaxJsonOptions);
            var items = parsed?.Items is null || parsed.Items.Count == 0
                ? Array.Empty<string>()
                : (IReadOnlyList<string>)parsed.Items
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Select(s => s.Trim())
                    .Take(_options.MaxDetectedItems)
                    .ToList()
                    .AsReadOnly();

            return new VisionDetectionResult
            {
                Items = items,
                PromptTokens = promptTokens,
                CompletionTokens = completionTokens,
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse vision response.");
            return VisionDetectionResult.Empty;
        }
    }

    private sealed class VisionRawResponse
    {
        [JsonPropertyName("items")]
        public List<string>? Items { get; set; }
    }
}
