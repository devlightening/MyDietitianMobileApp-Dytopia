using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using MyDietitianMobileApp.Domain.Services;
using Microsoft.Extensions.Logging;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// OpenAI Chat Completions-based ingredient LLM client.
///
/// Strategy:
///   1. Builds a concise system prompt with the bounded candidate shortlist.
///   2. Requests structured JSON output: { "choice": "&lt;ingredientId|none|ambiguous&gt;", "confidence": 0.0-1.0, "reason": "..." }
///   3. Parses and validates the response:
///      - returned ingredientId must exist in the candidate shortlist (hallucination guard)
///      - confidence interpreted per thresholds from <see cref="LlmNormalizationOptions"/>
///   4. Any exception → returns None (never propagates to callers).
/// </summary>
public sealed class OpenAiIngredientLlmClient : IIngredientLlmClient
{
    private static readonly JsonSerializerOptions LaxJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly LlmNormalizationOptions _options;
    private readonly ILogger<OpenAiIngredientLlmClient> _logger;

    public OpenAiIngredientLlmClient(
        IHttpClientFactory httpClientFactory,
        LlmNormalizationOptions options,
        ILogger<OpenAiIngredientLlmClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
        _logger = logger;
    }

    public async Task<LlmIngredientMatchResult> MatchAsync(
        string normalizedInput,
        IReadOnlyList<LlmCandidateIngredient> candidates,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var apiKey = _options.ApiKey ?? Environment.GetEnvironmentVariable(_options.ApiKeyEnvVar);
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("LLM ingredient match skipped: OPENAI_API_KEY is not configured.");
                return LlmIngredientMatchResult.None("OpenAI API key is not configured.");
            }

            var systemPrompt = BuildSystemPrompt(candidates);
            var userMessage = $"Kullanıcı girişi: \"{normalizedInput}\"";

            var requestBody = new
            {
                model = _options.ModelName,
                response_format = new { type = "json_object" },
                temperature = 0.0,  // Deterministic — we want consistent results
                max_tokens = 200,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user",   content = userMessage }
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

            var response = await client.SendAsync(request, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("OpenAI API error {Status}: {Body}", response.StatusCode, responseBody);
                return LlmIngredientMatchResult.None($"OpenAI API returned {response.StatusCode}.");
            }

            return ParseResponse(responseBody, candidates, normalizedInput);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LLM ingredient match threw an exception for input '{Input}'. Returning None.", normalizedInput);
            return LlmIngredientMatchResult.None($"LLM call failed: {ex.Message}");
        }
    }

    // ─── Prompt building ──────────────────────────────────────────────────────────

    private static string BuildSystemPrompt(IReadOnlyList<LlmCandidateIngredient> candidates)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Sen bir gıda/besin sınıflandırma uzmanısın.");
        sb.AppendLine("Görevin: kullanıcının girdiği besin ifadesini, aşağıdaki aday listesinden TAM OLARAK biriyle eşleştirmek.");
        sb.AppendLine();
        sb.AppendLine("KURALLAR:");
        sb.AppendLine("- SADECE aşağıdaki listeden seçim yapabilirsin.");
        sb.AppendLine("- Eğer hiçbir aday uygun değilse: choice = \"none\"");
        sb.AppendLine("- Eğer birden fazla aday eşit derecede uygunsa: choice = \"ambiguous\"");
        sb.AppendLine("- confidence: 0.0 ile 1.0 arasında bir sayı (ne kadar emin olduğun)");
        sb.AppendLine("- Cevabını SADECE JSON formatında ver, başka bir şey yazma.");
        sb.AppendLine();
        sb.AppendLine("JSON formatı:");
        sb.AppendLine("{ \"choice\": \"<ingredientId|none|ambiguous>\", \"confidence\": <0.0-1.0>, \"reason\": \"<kısa açıklama>\" }");
        sb.AppendLine();
        sb.AppendLine("ADAY LİSTESİ:");

        foreach (var c in candidates)
        {
            var aliases = c.Aliases.Any()
                ? $" (diğer adlar: {string.Join(", ", c.Aliases.Take(3))})"
                : string.Empty;
            var family = !string.IsNullOrEmpty(c.FamilyName)
                ? $" [Aile: {c.FamilyName}]"
                : string.Empty;
            sb.AppendLine($"- ID: {c.IngredientId} — {c.CanonicalName}{aliases}{family}");
        }

        return sb.ToString().TrimEnd();
    }

    // ─── Response parsing + hallucination guard ──────────────────────────────────

    private LlmIngredientMatchResult ParseResponse(
        string responseBody,
        IReadOnlyList<LlmCandidateIngredient> candidates,
        string normalizedInput)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            // Extract content from OpenAI chat completion response
            var content = root
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? string.Empty;

            var parsed = JsonSerializer.Deserialize<LlmRawResponse>(content, LaxJsonOptions);
            if (parsed is null)
                return LlmIngredientMatchResult.None("Could not parse LLM JSON response.");

            var choice = (parsed.Choice ?? string.Empty).Trim().ToLowerInvariant();
            var confidence = Math.Clamp(parsed.Confidence, 0.0, 1.0);
            var reason = parsed.Reason ?? string.Empty;

            if (choice == "none" || string.IsNullOrWhiteSpace(choice))
                return LlmIngredientMatchResult.None($"LLM selected none. Reason: {reason}");

            if (choice == "ambiguous")
                return LlmIngredientMatchResult.AmbiguousResult(confidence, $"LLM indicated ambiguous result. Reason: {reason}");

            // Attempt to parse as GUID and validate against shortlist (hallucination guard)
            if (!Guid.TryParse(choice, out var selectedId))
            {
                _logger.LogWarning("LLM returned non-GUID choice '{Choice}' for input '{Input}'. Treating as None.", choice, normalizedInput);
                return LlmIngredientMatchResult.None($"LLM returned non-GUID choice '{choice}' (hallucination guard triggered).");
            }

            var matched = candidates.FirstOrDefault(c => c.IngredientId == selectedId);
            if (matched is null)
            {
                _logger.LogWarning("LLM returned ID {Id} which is not in the candidate shortlist for '{Input}'. Treated as None.", selectedId, normalizedInput);
                return LlmIngredientMatchResult.None($"LLM returned ID {selectedId} not in shortlist (hallucination guard triggered).");
            }

            return LlmIngredientMatchResult.Match(
                selectedId,
                confidence,
                $"LLM selected '{matched.CanonicalName}' (confidence {confidence:F2}). Reason: {reason}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse LLM response for input '{Input}'.", normalizedInput);
            return LlmIngredientMatchResult.None($"Failed to parse LLM response: {ex.Message}");
        }
    }

    // ─── Internal DTO for LLM JSON output ────────────────────────────────────────

    private sealed class LlmRawResponse
    {
        [JsonPropertyName("choice")]
        public string? Choice { get; set; }

        [JsonPropertyName("confidence")]
        public double Confidence { get; set; }

        [JsonPropertyName("reason")]
        public string? Reason { get; set; }
    }
}
