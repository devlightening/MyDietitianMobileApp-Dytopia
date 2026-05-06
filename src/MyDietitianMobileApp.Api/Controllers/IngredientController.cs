using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediatR;
using MyDietitianMobileApp.Api.Problems;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers;

/// <summary>
/// Manages ingredients: search and admin CRUD operations
/// </summary>
[ApiController]
[Route("api")]
public class IngredientController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IBarcodeIngredientResolutionService _barcodeResolutionService;
    private readonly IIngredientAcquisitionService _ingredientAcquisitionService;
    private readonly AppDbContext _db;
    private readonly ILogger<IngredientController> _logger;

    public IngredientController(
        IMediator mediator,
        IBarcodeIngredientResolutionService barcodeResolutionService,
        IIngredientAcquisitionService ingredientAcquisitionService,
        AppDbContext db,
        ILogger<IngredientController> logger)
    {
        _mediator = mediator;
        _barcodeResolutionService = barcodeResolutionService;
        _ingredientAcquisitionService = ingredientAcquisitionService;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Search ingredients with pagination (public, searches canonicalName and aliases)
    /// </summary>
    [HttpGet("ingredients/search")]
    [AllowAnonymous]
    public async Task<IActionResult> SearchIngredients(
        [FromQuery] string? q = null,
        [FromQuery(Name = "query")] string? legacyQuery = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        // Backward-compatible support for both q and query parameters.
        // If both are provided, q has precedence.
        var effectiveQuery = !string.IsNullOrWhiteSpace(q)
            ? q
            : legacyQuery;

        if (string.IsNullOrWhiteSpace(effectiveQuery))
        {
            return Ok(new { page, pageSize, total = 0, ingredients = Array.Empty<object>() });
        }

        var searchQuery = new MyDietitianMobileApp.Application.Queries.SearchIngredientsQuery(effectiveQuery.Trim(), maxResults: pageSize);
        var result = (MyDietitianMobileApp.Application.Queries.SearchIngredientsResult)await _mediator.Send(searchQuery);
        
        // Note: SearchIngredientsQuery currently doesn't support pagination internally,
        // so we'll return all results with pagination metadata
        var total = result.Ingredients.Count();
        var ingredients = result.Ingredients
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return Ok(new { page, pageSize, total, ingredients });
    }

    /// <summary>
    /// List all ingredients (admin)
    /// </summary>
    [HttpGet("admin/ingredients")]
    [Authorize("Admin")]
    public async Task<IActionResult> ListAllIngredients()
    {
        var query = new MyDietitianMobileApp.Application.Queries.ListAllIngredientsQuery();
        var result = (MyDietitianMobileApp.Application.Queries.ListAllIngredientsResult)await _mediator.Send(query);
        return Ok(new { ingredients = result.Ingredients });
    }

    /// <summary>
    /// Create ingredient (admin)
    /// </summary>
    [HttpPost("admin/ingredients")]
    [Authorize("Admin")]
    public async Task<IActionResult> CreateIngredient([FromBody] CreateIngredientRequest request)
    {
        var command = new MyDietitianMobileApp.Application.Commands.CreateIngredientCommand(
            request.CanonicalName,
            request.Aliases,
            request.IsActive
        );

        var result = await _mediator.Send(command);
        return Ok(new { ingredientId = result.IngredientId });
    }

    /// <summary>
    /// Update ingredient (admin)
    /// </summary>
    [HttpPut("admin/ingredients/{id}")]
    [Authorize("Admin")]
    public async Task<IActionResult> UpdateIngredient(Guid id, [FromBody] UpdateIngredientRequest request)
    {
        var command = new MyDietitianMobileApp.Application.Commands.UpdateIngredientCommand(
            id,
            request.CanonicalName,
            request.Aliases,
            request.IsActive
        );

        var result = await _mediator.Send(command);
        return Ok(new { success = result.Success });
    }

    /// <summary>
    /// Toggle ingredient active status (admin)
    /// </summary>
    [HttpPatch("admin/ingredients/{id}/toggle-active")]
    [Authorize("Admin")]
    public async Task<IActionResult> ToggleActive(Guid id, [FromBody] ToggleIngredientActiveRequest request)
    {
        var command = new MyDietitianMobileApp.Application.Commands.ToggleIngredientActiveCommand(id, request.IsActive);
        var result = await _mediator.Send(command);
        return Ok(new { success = result.Success });
    }

    /// <summary>
    /// Analyze a food image and return matched ingredients for the kitchen basket.
    /// Image must be base64-encoded (no data URI prefix) in the JSON body.
    /// </summary>
    [HttpPost("ingredients/analyze-image")]
    [Authorize(Policy = "Client")]
    [EnableRateLimiting("kitchen-vision")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> AnalyzeImage(
        [FromBody] AnalyzeImageRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Base64Image))
            return BadRequest(new { error = "base64Image alanı boş olamaz." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
        var mediaType = (request.MediaType ?? "image/jpeg").ToLowerInvariant();
        if (!allowedTypes.Contains(mediaType))
            return BadRequest(new { error = "Desteklenmeyen görüntü türü. JPEG, PNG veya WebP kullanın." });

        var command = new AnalyzeIngredientImageCommand(request.Base64Image, mediaType);
        var result = (AnalyzeIngredientImageResult)await _mediator.Send(command, cancellationToken);

        return Ok(new
        {
            sessionId     = result.SessionId,
            featureStatus = result.FeatureStatus,
            totalDetected = result.TotalDetected,
            promptTokens     = result.PromptTokens,
            completionTokens = result.CompletionTokens,
            reason      = result.Reason,
            userMessage = result.UserMessage,
            matched = result.Matched.Select(m => new
            {
                ingredientId         = m.IngredientId,
                canonicalName        = m.CanonicalName,
                confidence           = m.Confidence,
                detectedName         = m.DetectedName,
                normalizedLabel      = m.NormalizedLabel,
                matchedBy            = m.MatchedBy,
                mappingType          = m.MappingType,
                isAutoSelected       = m.IsAutoSelected,
                requiresConfirmation = m.RequiresConfirmation,
            }),
            unmatched = result.Unmatched,
        });
    }

    [HttpPost("ingredients/resolve-barcode")]
    [Authorize(Policy = "Client")]
    public async Task<IActionResult> ResolveBarcode(
        [FromBody] ResolveBarcodeRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Barcode))
        {
            return BadRequest(new { error = "barcode alanı boş olamaz." });
        }

        var result = await _barcodeResolutionService.ResolveAsync(request.Barcode.Trim(), cancellationToken);
        return Ok(new
        {
            sessionId = result.SessionId,
            barcode = result.Barcode,
            productName = result.ProductName,
            brand = result.Brand,
            mappingType = result.MappingType,
            confidence = result.Confidence,
            requiresConfirmation = result.RequiresConfirmation,
            sourceProvider = result.SourceProvider,
            candidates = result.Candidates.Select(candidate => new
            {
                ingredientId = candidate.IngredientId,
                canonicalName = candidate.CanonicalName,
                mappingType = candidate.MappingType,
                confidence = candidate.Confidence,
                sourceProvider = candidate.SourceProvider,
                requiresConfirmation = candidate.RequiresConfirmation
            })
        });
    }

    /// <summary>
    /// Record user decisions (accepted / rejected) for a vision scan session.
    /// Updates WasAccepted and ConfirmedIngredientId in IngredientImageDetectionLogs.
    /// Call this immediately after the user confirms or dismisses the review screen.
    /// </summary>
    [HttpPost("ingredients/detect/confirm")]
    [Authorize(Policy = "Client")]
    public async Task<IActionResult> ConfirmDetection(
        [FromBody] ConfirmDetectionRequest request,
        CancellationToken cancellationToken)
    {
        if (request.SessionId == Guid.Empty)
            return BadRequest(new { error = "sessionId geçersiz." });

        var logs = await _db.IngredientImageDetectionLogs
            .Where(l => l.SessionId == request.SessionId)
            .ToListAsync(cancellationToken);

        if (logs.Count == 0)
            return Ok(new { updated = 0 });

        var acceptedSet = request.AcceptedIngredientIds
            .Select(id => (Guid?)id)
            .ToHashSet();

        foreach (var log in logs)
        {
            // A log entry is "accepted" when its predicted ingredient is in the accepted set
            var accepted = log.PredictedIngredientId.HasValue
                           && acceptedSet.Contains(log.PredictedIngredientId);
            log.RecordUserDecision(accepted, accepted ? log.PredictedIngredientId : null);
        }

        await _db.SaveChangesAsync(cancellationToken);

        // ── Learning write-back: promote confirmed review items into VisionLabelMappings ──
        // When a user explicitly accepts a review item (not auto-selected, matched by DB/fuzzy/LLM),
        // write an approved mapping entry so future scans of the same label skip the resolution cost.
        var confirmed = logs
            .Where(l => l.WasAccepted == true
                        && l.PredictedIngredientId.HasValue
                        && !l.WasAutoSelected
                        && l.MatchType != "mapping_table")
            .ToList();

        if (confirmed.Count > 0)
        {
            foreach (var log in confirmed)
            {
                var ingredientId = log.PredictedIngredientId!.Value;
                var normalizedLabelKey = log.NormalizedLabel;

                // Look for an existing mapping for this label + ingredient combination
                var existing = await _db.VisionLabelMappings
                    .Where(m => m.NormalizedLabel == normalizedLabelKey && m.IngredientId == ingredientId)
                    .FirstOrDefaultAsync(cancellationToken);

                if (existing != null)
                {
                    // Promote provisional → approved; boost threshold if needed
                    existing.Approve();
                    if (existing.ConfidenceThreshold < 0.70)
                        existing.SetConfidenceThreshold(0.70);
                }
                else
                {
                    // Create a new approved entry so future scans resolve instantly
                    var newMapping = new VisionLabelMapping(
                        id: Guid.NewGuid(),
                        rawLabel: log.RawLabel,
                        ingredientId: ingredientId,
                        confidenceThreshold: 0.70,
                        isApproved: true,
                        notes: $"auto-promoted via user confirmation (session {log.SessionId:D})");

                    _db.VisionLabelMappings.Add(newMapping);
                }
            }

            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "ConfirmDetection: {Count} mapping(s) written back to VisionLabelMappings (session {SessionId}).",
                confirmed.Count, request.SessionId);
        }

        return Ok(new { updated = logs.Count, mappingsWritten = confirmed.Count });
    }

    [HttpPost("ingredients/acquisition/log")]
    [Authorize(Policy = "Client")]
    public async Task<IActionResult> LogIngredientAcquisition(
        [FromBody] LogIngredientAcquisitionRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RawInput))
        {
            return BadRequest(new { error = "rawInput alanı boş olamaz." });
        }

        var logId = await _ingredientAcquisitionService.LogAsync(
            new IngredientAcquisitionLogRequest
            {
                SessionId = request.SessionId ?? Guid.NewGuid(),
                Source = request.Source,
                RawInput = request.RawInput.Trim(),
                SelectedIngredients = request.SelectedIngredients?
                    .Select(selection => new IngredientAcquisitionSelection
                    {
                        IngredientId = selection.IngredientId,
                        MappingType = selection.MappingType,
                        Confidence = selection.Confidence
                    })
                    .ToArray() ?? Array.Empty<IngredientAcquisitionSelection>(),
                MappingType = request.MappingType,
                RequiredConfirmation = request.RequiredConfirmation,
                ConfirmedByUser = request.ConfirmedByUser,
                InteractionCount = request.InteractionCount,
                LatencyMs = request.LatencyMs,
                StartedAtUtc = request.StartedAtUtc ?? DateTime.UtcNow,
                CompletedAtUtc = request.CompletedAtUtc,
                ProductName = request.ProductName,
                Brand = request.Brand
            },
            cancellationToken);

        return Ok(new { logId });
    }
}

// DTOs
public record ConfirmDetectionRequest(Guid SessionId, List<Guid> AcceptedIngredientIds);
public record CreateIngredientRequest(string CanonicalName, List<string> Aliases, bool IsActive);
public record UpdateIngredientRequest(string CanonicalName, List<string> Aliases, bool IsActive);
public record ToggleIngredientActiveRequest(bool IsActive);
public record AnalyzeImageRequest(string? Base64Image, string? MediaType = "image/jpeg");
public record ResolveBarcodeRequest(string? Barcode);
public record IngredientAcquisitionSelectionRequest(Guid IngredientId, MappingType MappingType, double Confidence);
public record LogIngredientAcquisitionRequest(
    Guid? SessionId,
    AcquisitionSource Source,
    string? RawInput,
    List<IngredientAcquisitionSelectionRequest>? SelectedIngredients,
    MappingType MappingType,
    bool RequiredConfirmation,
    bool ConfirmedByUser,
    int InteractionCount,
    long LatencyMs,
    DateTime? StartedAtUtc,
    DateTime? CompletedAtUtc,
    string? ProductName,
    string? Brand);
