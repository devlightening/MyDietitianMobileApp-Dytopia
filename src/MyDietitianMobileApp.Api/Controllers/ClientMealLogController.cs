using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Api.Extensions;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Client meal log (photo journal) endpoints.
/// GET /api/client/meal-logs        — list today's logs
/// POST /api/client/meal-logs       — add a new log entry
/// DELETE /api/client/meal-logs/{id} — remove a log entry
/// </summary>
[Authorize(Roles = "Client")]
[ApiController]
[Route("api/client/meal-logs")]
public class ClientMealLogController : ControllerBase
{
    private static readonly JsonSerializerOptions LaxJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
    };

    private readonly AppDbContext _appDb;
    private readonly AuthDbContext _authDb;
    private readonly IPremiumStatusService _premiumStatusService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly VisionIngredientOptions _visionOptions;
    private readonly ILogger<ClientMealLogController> _logger;

    public ClientMealLogController(
        AppDbContext appDb,
        AuthDbContext authDb,
        IPremiumStatusService premiumStatusService,
        IHttpClientFactory httpClientFactory,
        VisionIngredientOptions visionOptions,
        ILogger<ClientMealLogController> logger)
    {
        _appDb = appDb;
        _authDb = authDb;
        _premiumStatusService = premiumStatusService;
        _httpClientFactory = httpClientFactory;
        _visionOptions = visionOptions;
        _logger = logger;
    }

    // GET /api/client/meal-logs?date=YYYY-MM-DD
    [HttpGet]
    public async Task<IActionResult> GetLogs([FromQuery] string? date)
    {
        var (clientId, err) = await RequireClientAsync();
        if (err != null) return err;

        DateOnly queryDate;
        if (string.IsNullOrEmpty(date) || !DateOnly.TryParse(date, out queryDate))
            queryDate = DateOnly.FromDateTime(DateTime.UtcNow);

        var logs = await _appDb.ClientMealLogs
            .Where(l => l.ClientId == clientId!.Value && l.Date == queryDate)
            .OrderBy(l => l.CreatedAtUtc)
            .ToListAsync();

        return Ok(new { logs = logs.Select(ToDto) });
    }

    // POST /api/client/meal-logs/analyze-photo
    [HttpPost("analyze-photo")]
    [EnableRateLimiting("kitchen-vision")]
    public async Task<IActionResult> AnalyzePhoto([FromBody] AnalyzeMealPhotoRequest req, CancellationToken ct)
    {
        var (_, err) = await RequireClientAsync();
        if (err != null) return err;

        if (!_visionOptions.Enabled)
        {
            return StatusCode(503, new
            {
                code = "MEAL_PHOTO_AI_DISABLED",
                message = "Tabak tarama şu anda kapalı. VisionIngredient:Enabled ayarını açınca çalışır.",
            });
        }

        var apiKey = _visionOptions.ApiKey ?? Environment.GetEnvironmentVariable(_visionOptions.ApiKeyEnvVar);
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return StatusCode(503, new
            {
                code = "OPENAI_API_KEY_MISSING",
                message = "OpenAI anahtarı backend tarafında tanımlı değil.",
            });
        }

        if (string.IsNullOrWhiteSpace(req.Base64Image))
            return BadRequest(new { code = "IMAGE_REQUIRED", message = "Fotoğraf verisi gerekli." });

        var mediaType = string.IsNullOrWhiteSpace(req.MediaType) ? "image/jpeg" : req.MediaType.Trim().ToLowerInvariant();
        if (mediaType is not ("image/jpeg" or "image/png" or "image/webp"))
            return BadRequest(new { code = "UNSUPPORTED_IMAGE_TYPE", message = "Sadece jpeg, png veya webp görsel kabul edilir." });

        var approxBytes = (long)req.Base64Image.Length * 3 / 4;
        if (approxBytes > _visionOptions.MaxImageBytes)
            return BadRequest(new { code = "IMAGE_TOO_LARGE", message = "Fotoğraf çok büyük. Daha küçük bir görsel dene." });

        try
        {
            var dataUri = $"data:{mediaType};base64,{req.Base64Image}";
            var requestBody = new
            {
                model = _visionOptions.ModelName,
                max_tokens = 420,
                temperature = 0.0,
                response_format = new { type = "json_object" },
                messages = new object[]
                {
                    new
                    {
                        role = "system",
                        content =
                            "Sen Dytopia icin calisan dikkatli bir yemek fotografi analiz yardimcisisin. " +
                            "Tibbi tani, tedavi, zayiflama vaadi veya kesin besin degeri iddiasi verme. " +
                            "Sadece gorseldeki yemegi 1 porsiyon varsayimi ile yaklasik kalori ve makrolarla tahmin et. " +
                            "Turkce, kisa, guvenli cevap ver. JSON disinda metin yazma."
                    },
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new
                            {
                                type = "text",
                                text =
                                    "Bu tabaktaki yemegi tahmin et. Her zaman portionCount=1 olsun. " +
                                    "JSON formati: {\"foodName\":\"...\",\"confidence\":0.75,\"portionCount\":1," +
                                    "\"caloriesKcal\":420,\"proteinGrams\":24,\"carbsGrams\":38,\"fatGrams\":16," +
                                    "\"ingredients\":[\"...\"],\"notes\":\"Yaklasik tahmindir.\"}. " +
                                    $"Ogun tipi ipucu: {req.MealType ?? "belirtilmedi"}"
                            },
                            new
                            {
                                type = "image_url",
                                image_url = new { url = dataUri, detail = "low" }
                            }
                        }
                    }
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var client = _httpClientFactory.CreateClient("openai");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(8, _visionOptions.TimeoutSeconds)));

            using var response = await client.SendAsync(request, timeout.Token);
            var body = await response.Content.ReadAsStringAsync(timeout.Token);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Meal photo OpenAI analysis failed: {Status} {Body}", response.StatusCode, body);
                return StatusCode(502, new { code = "MEAL_PHOTO_AI_FAILED", message = "Tabak şu an okunamadı. Lütfen tekrar dene." });
            }

            using var document = JsonDocument.Parse(body);
            var content = document.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            var payload = string.IsNullOrWhiteSpace(content)
                ? null
                : JsonSerializer.Deserialize<MealPhotoAnalysisPayload>(content, LaxJsonOptions);

            if (payload == null)
                return StatusCode(502, new { code = "MEAL_PHOTO_AI_EMPTY", message = "Tabak analizi boş döndü. Yeniden dene." });

            var result = NormalizeAnalysis(payload);
            return Ok(result);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return StatusCode(504, new { code = "MEAL_PHOTO_AI_TIMEOUT", message = "Tabak analizi uzun sürdü. Daha net bir fotoğrafla tekrar dene." });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Meal photo analysis failed.");
            return StatusCode(502, new { code = "MEAL_PHOTO_AI_FAILED", message = "Tabak şu an okunamadı. Lütfen tekrar dene." });
        }
    }

    // POST /api/client/meal-logs
    [HttpPost]
    public async Task<IActionResult> CreateLog([FromBody] CreateMealLogRequest req)
    {
        var (clientId, err) = await RequireClientAsync();
        if (err != null) return err;

        var date = req.Date.HasValue
            ? DateOnly.FromDateTime(req.Date.Value)
            : DateOnly.FromDateTime(DateTime.UtcNow);

        var log = new ClientMealLog(
            clientId!.Value,
            date,
            req.MealType ?? "Snack",
            req.Notes,
            req.PhotoUrl,
            req.FoodName,
            req.CaloriesKcal,
            req.ProteinGrams,
            req.CarbsGrams,
            req.FatGrams,
            req.PortionCount ?? 1m,
            req.AiConfidence,
            req.AnalysisJson,
            req.Source ?? "manual");
        _appDb.ClientMealLogs.Add(log);
        await _appDb.SaveChangesAsync();

        return Created($"/api/client/meal-logs/{log.Id}", ToDto(log));
    }

    // DELETE /api/client/meal-logs/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteLog(Guid id)
    {
        var (clientId, err) = await RequireClientAsync();
        if (err != null) return err;

        var log = await _appDb.ClientMealLogs
            .FirstOrDefaultAsync(l => l.Id == id && l.ClientId == clientId!.Value);

        if (log == null) return NotFound(new { message = "Kayıt bulunamadı." });

        _appDb.ClientMealLogs.Remove(log);
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    private static MealPhotoAnalysisResponse NormalizeAnalysis(MealPhotoAnalysisPayload payload)
    {
        var foodName = string.IsNullOrWhiteSpace(payload.FoodName)
            ? "Tespit edilen yemek"
            : payload.FoodName.Trim();
        var confidence = Clamp(payload.Confidence ?? 0.55m, 0m, 1m);
        var calories = (int?)Clamp(payload.CaloriesKcal ?? 0, 0, 2500);
        if (calories == 0) calories = null;
        var protein = ClampNullable(payload.ProteinGrams, 0m, 300m);
        var carbs = ClampNullable(payload.CarbsGrams, 0m, 300m);
        var fat = ClampNullable(payload.FatGrams, 0m, 300m);
        var ingredients = (payload.Ingredients ?? [])
            .Where(i => !string.IsNullOrWhiteSpace(i))
            .Select(i => i.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(8)
            .ToArray();
        var notes = string.IsNullOrWhiteSpace(payload.Notes)
            ? "OpenAI Vision ile yaklaşık 1 porsiyon tahminidir."
            : payload.Notes.Trim();

        var normalized = new MealPhotoAnalysisResponse(
            "active",
            foodName,
            confidence,
            1m,
            calories,
            protein,
            carbs,
            fat,
            ingredients,
            notes,
            true,
            string.Empty);

        var analysisJson = JsonSerializer.Serialize(normalized with { AnalysisJson = null });
        return normalized with { AnalysisJson = analysisJson };
    }

    private static object ToDto(ClientMealLog log)
    {
        return new
        {
            log.Id,
            log.Date,
            log.MealType,
            log.Notes,
            log.PhotoUrl,
            log.FoodName,
            log.CaloriesKcal,
            log.ProteinGrams,
            log.CarbsGrams,
            log.FatGrams,
            log.PortionCount,
            log.AiConfidence,
            log.AnalysisJson,
            log.Source,
            log.CreatedAtUtc,
        };
    }

    private static int Clamp(int value, int min, int max) => Math.Min(max, Math.Max(min, value));

    private static decimal Clamp(decimal value, decimal min, decimal max) => Math.Min(max, Math.Max(min, value));

    private static decimal? ClampNullable(decimal? value, decimal min, decimal max)
    {
        return value.HasValue ? decimal.Round(Clamp(value.Value, min, max), 2) : null;
    }

    private async Task<(Guid? clientId, IActionResult? error)> RequireClientAsync()
    {
        var userId = User.GetUserId();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            return (null, Unauthorized());

        var user = await _authDb.UserAccounts.FirstOrDefaultAsync(u => u.Id == userGuid);
        if (user?.LinkedClientId == null)
            return (null, Unauthorized());

        return (user.LinkedClientId, null);
    }
}

public record CreateMealLogRequest(
    string? MealType,
    string? Notes,
    string? PhotoUrl,
    DateTime? Date,
    string? FoodName,
    int? CaloriesKcal,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    decimal? PortionCount,
    decimal? AiConfidence,
    string? AnalysisJson,
    string? Source);

public record AnalyzeMealPhotoRequest(string Base64Image, string? MediaType, string? MealType);

public record MealPhotoAnalysisResponse(
    string FeatureStatus,
    string FoodName,
    decimal Confidence,
    decimal PortionCount,
    int? CaloriesKcal,
    decimal? ProteinGrams,
    decimal? CarbsGrams,
    decimal? FatGrams,
    IReadOnlyList<string> Ingredients,
    string Notes,
    bool Estimated,
    string? AnalysisJson);

public sealed class MealPhotoAnalysisPayload
{
    [JsonPropertyName("foodName")]
    public string? FoodName { get; set; }

    [JsonPropertyName("confidence")]
    public decimal? Confidence { get; set; }

    [JsonPropertyName("portionCount")]
    public decimal? PortionCount { get; set; }

    [JsonPropertyName("caloriesKcal")]
    public int? CaloriesKcal { get; set; }

    [JsonPropertyName("proteinGrams")]
    public decimal? ProteinGrams { get; set; }

    [JsonPropertyName("carbsGrams")]
    public decimal? CarbsGrams { get; set; }

    [JsonPropertyName("fatGrams")]
    public decimal? FatGrams { get; set; }

    [JsonPropertyName("ingredients")]
    public List<string>? Ingredients { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}
