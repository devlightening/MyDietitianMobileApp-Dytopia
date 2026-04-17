using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using MyDietitianMobileApp.Domain.Services;
using Microsoft.Extensions.Logging;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// GPT-4o Vision-based food detection service.
///
/// Strategy:
///   1. Sends a base64 image inline to v1/chat/completions with a system prompt.
///   2. Requests structured JSON: { "items": ["elma", "yumurta", ...] }
///   3. Returns the raw item strings for downstream normalization.
///   4. Any exception or API error → returns empty list (never propagates).
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

    public async Task<VisionDetectionResult> DetectFoodNamesAsync(
        string base64Image,
        string mediaType,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var apiKey = _options.ApiKey ?? Environment.GetEnvironmentVariable(_options.ApiKeyEnvVar);
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("Vision ingredient detection skipped: OPENAI_API_KEY is not configured.");
                return VisionDetectionResult.Empty;
            }

            // Guard: base64 length (≈ 4/3 * raw bytes) against MaxImageBytes
            var approxBytes = (long)base64Image.Length * 3 / 4;
            if (approxBytes > _options.MaxImageBytes)
            {
                _logger.LogWarning(
                    "Vision: image too large ({Bytes} bytes approx, max {Max}). Skipping.",
                    approxBytes, _options.MaxImageBytes);
                return VisionDetectionResult.Empty;
            }

            var dataUri = $"data:{mediaType};base64,{base64Image}";

            var requestBody = new
            {
                model = _options.ModelName,
                max_tokens = 100,
                temperature = 0.0,
                response_format = new { type = "json_object" },
                messages = new object[]
                {
                    new
                    {
                        role = "system",
                        content = $"Görseldeki yiyecekleri tanı. Yalnızca bu listeden seç: {string.Join(", ", _options.ClosedSetCanonicalNames)}. " +
                                  "Ambalajlı veya konserve ürünler de dahil, içeriğini listele. " +
                                  "Gördüklerini yaz, görmediğini yazma. " +
                                  "Türkçe, küçük harf, tekil. JSON: {\"items\":[\"domates\",\"marul\"]}."
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
                                    detail = "low"   // ~65 tokens — sufficient for food ID
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
                _logger.LogWarning("Vision API error {Status}: {Body}", response.StatusCode, responseBody);
                return VisionDetectionResult.Empty;
            }

            return ParseResult(responseBody);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Vision ingredient detection threw an exception. Returning empty list.");
            return VisionDetectionResult.Empty;
        }
    }

    // ─── Response parsing ─────────────────────────────────────────────────────

    private VisionDetectionResult ParseResult(string responseBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            // ── Token usage ───────────────────────────────────────────────────
            var promptTokens     = 0;
            var completionTokens = 0;
            if (root.TryGetProperty("usage", out var usage))
            {
                if (usage.TryGetProperty("prompt_tokens",     out var pt)) promptTokens     = pt.GetInt32();
                if (usage.TryGetProperty("completion_tokens", out var ct)) completionTokens = ct.GetInt32();
            }

            _logger.LogInformation(
                "Vision API usage: model={Model} prompt_tokens={Prompt} completion_tokens={Completion} total={Total}",
                _options.ModelName, promptTokens, completionTokens, promptTokens + completionTokens);

            // ── Content parsing ───────────────────────────────────────────────
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
                Items            = items,
                PromptTokens     = promptTokens,
                CompletionTokens = completionTokens,
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse vision response.");
            return VisionDetectionResult.Empty;
        }
    }

    // ─── Internal DTO ─────────────────────────────────────────────────────────

    private sealed class VisionRawResponse
    {
        [JsonPropertyName("items")]
        public List<string>? Items { get; set; }
    }
}
