using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Domain.Services;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Optional self-hosted/local adapter for the Layer D ingredient fallback.
/// Uses Ollama's native chat API so the normalization pipeline can run
/// without a hosted provider when a local model server is available.
/// </summary>
public sealed class OllamaIngredientLlmClient : IIngredientLlmClient
{
    private static readonly JsonSerializerOptions LaxJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly LlmNormalizationOptions _options;
    private readonly ILogger<OllamaIngredientLlmClient> _logger;

    public OllamaIngredientLlmClient(
        IHttpClientFactory httpClientFactory,
        LlmNormalizationOptions options,
        ILogger<OllamaIngredientLlmClient> logger)
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
            var requestBody = new
            {
                model = _options.ModelName,
                stream = false,
                format = "json",
                options = new
                {
                    temperature = 0.0
                },
                messages = new[]
                {
                    new { role = "system", content = BuildSystemPrompt(candidates) },
                    new { role = "user", content = $"User input: \"{normalizedInput}\"" }
                }
            };

            var client = _httpClientFactory.CreateClient("ollama");
            var apiKey = Environment.GetEnvironmentVariable(_options.ApiKeyEnvVar);

            var request = new HttpRequestMessage(HttpMethod.Post, "api/chat")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(requestBody),
                    Encoding.UTF8,
                    "application/json")
            };

            if (!string.IsNullOrWhiteSpace(apiKey))
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await client.SendAsync(request, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Ollama API error {Status}: {Body}", response.StatusCode, responseBody);
                return LlmIngredientMatchResult.None($"Ollama API returned {response.StatusCode}.");
            }

            return ParseResponse(responseBody, candidates, normalizedInput);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ollama ingredient match failed for input '{Input}'. Returning None.", normalizedInput);
            return LlmIngredientMatchResult.None($"Ollama call failed: {ex.Message}");
        }
    }

    private static string BuildSystemPrompt(IReadOnlyList<LlmCandidateIngredient> candidates)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are an ingredient normalization assistant.");
        sb.AppendLine("Match the user input to exactly one candidate from the shortlist.");
        sb.AppendLine("Rules:");
        sb.AppendLine("- You may only choose from the provided shortlist.");
        sb.AppendLine("- If none fit, return choice = \"none\".");
        sb.AppendLine("- If more than one candidate is plausible, return choice = \"ambiguous\".");
        sb.AppendLine("- Return JSON only.");
        sb.AppendLine("{\"choice\":\"<ingredientId|none|ambiguous>\",\"confidence\":0.0,\"reason\":\"short explanation\"}");
        sb.AppendLine("Shortlist:");

        foreach (var candidate in candidates)
        {
            var aliases = candidate.Aliases.Any()
                ? $" aliases: {string.Join(", ", candidate.Aliases.Take(3))}"
                : string.Empty;
            var family = string.IsNullOrWhiteSpace(candidate.FamilyName)
                ? string.Empty
                : $" family: {candidate.FamilyName}";

            sb.AppendLine($"- id: {candidate.IngredientId}; name: {candidate.CanonicalName};{aliases};{family}");
        }

        return sb.ToString().TrimEnd();
    }

    private LlmIngredientMatchResult ParseResponse(
        string responseBody,
        IReadOnlyList<LlmCandidateIngredient> candidates,
        string normalizedInput)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var content = doc.RootElement
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? string.Empty;

            var parsed = JsonSerializer.Deserialize<LlmRawResponse>(content, LaxJsonOptions);
            if (parsed is null)
                return LlmIngredientMatchResult.None("Could not parse Ollama JSON response.");

            var choice = (parsed.Choice ?? string.Empty).Trim().ToLowerInvariant();
            var confidence = Math.Clamp(parsed.Confidence, 0.0, 1.0);
            var reason = parsed.Reason ?? string.Empty;

            if (choice == "none" || string.IsNullOrWhiteSpace(choice))
                return LlmIngredientMatchResult.None($"Ollama selected none. Reason: {reason}");

            if (choice == "ambiguous")
                return LlmIngredientMatchResult.AmbiguousResult(confidence, $"Ollama indicated ambiguity. Reason: {reason}");

            if (!Guid.TryParse(choice, out var selectedId))
            {
                _logger.LogWarning("Ollama returned non-GUID choice '{Choice}' for input '{Input}'.", choice, normalizedInput);
                return LlmIngredientMatchResult.None($"Ollama returned non-GUID choice '{choice}'.");
            }

            var matched = candidates.FirstOrDefault(c => c.IngredientId == selectedId);
            if (matched is null)
            {
                _logger.LogWarning("Ollama returned ID {Id} outside the shortlist for '{Input}'.", selectedId, normalizedInput);
                return LlmIngredientMatchResult.None($"Ollama returned ID {selectedId} not in shortlist.");
            }

            return LlmIngredientMatchResult.Match(
                selectedId,
                confidence,
                $"Ollama selected '{matched.CanonicalName}' (confidence {confidence:F2}). Reason: {reason}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Ollama response for input '{Input}'.", normalizedInput);
            return LlmIngredientMatchResult.None($"Failed to parse Ollama response: {ex.Message}");
        }
    }

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
