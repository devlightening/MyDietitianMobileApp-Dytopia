using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using Microsoft.Extensions.Logging;

namespace MyDietitianMobileApp.Application.Handlers;

/// <summary>
/// Orchestrates: vision detection → parallel resolver (VisionLabelMappings + normalization) → deduplication.
/// </summary>
public class AnalyzeIngredientImageCommandHandler
    : IRequestHandler<AnalyzeIngredientImageCommand, AnalyzeIngredientImageResult>
{
    private readonly IVisionIngredientService _visionService;
    private readonly IIngredientDetectionResolver _resolver;
    private readonly VisionIngredientOptions _visionOptions;
    private readonly ILogger<AnalyzeIngredientImageCommandHandler> _logger;

    public AnalyzeIngredientImageCommandHandler(
        IVisionIngredientService visionService,
        IIngredientDetectionResolver resolver,
        VisionIngredientOptions visionOptions,
        ILogger<AnalyzeIngredientImageCommandHandler> logger)
    {
        _visionService = visionService;
        _resolver = resolver;
        _visionOptions = visionOptions;
        _logger = logger;
    }

    public async Task<AnalyzeIngredientImageResult> Handle(
        AnalyzeIngredientImageCommand request,
        CancellationToken cancellationToken)
    {
        var sessionId = Guid.NewGuid();

        // Step 0: Fail-fast if feature is not available — return a meaningful status
        var featureStatus = _visionService.GetStatus();
        if (featureStatus != VisionFeatureStatus.Active)
        {
            _logger.LogInformation(
                "Vision ingredient detection skipped: feature status = {Status}.", featureStatus);
            return new AnalyzeIngredientImageResult
            {
                SessionId     = sessionId,
                TotalDetected = 0,
                FeatureStatus = featureStatus.ToString().ToLowerInvariant(),
                // "active" | "disabled" | "apikeymissing" — matches VisionFeatureStatus type in vision.ts
            };
        }

        var closedSet = _visionOptions.ClosedSetCanonicalNames
            .Select(IngredientAcquisitionPolicy.NormalizeLookupKey)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToHashSet(StringComparer.Ordinal);

        // Step 1: Call vision service — get raw food name strings + token usage
        var detectionResult = await _visionService.DetectFoodNamesAsync(
            request.Base64Image, request.MediaType, cancellationToken);
        var rawNames = detectionResult.Items;

        if (rawNames.Count == 0)
        {
            _logger.LogInformation("Vision returned no items for the provided image.");
            return new AnalyzeIngredientImageResult
            {
                SessionId        = sessionId,
                TotalDetected    = 0,
                FeatureStatus    = "active",
                PromptTokens     = detectionResult.PromptTokens,
                CompletionTokens = detectionResult.CompletionTokens,
            };
        }

        _logger.LogInformation("Vision detected {Count} raw food names.", rawNames.Count);

        // Step 2: Resolve each label sequentially.
        // AppDbContext is not thread-safe — concurrent Task.WhenAll calls on the same scoped context
        // throw "A second operation was started on this context instance before a previous operation completed."
        var results = new List<(string rawName, DetectionResolverResult resolveResult)>();
        foreach (var name in rawNames)
        {
            _logger.LogInformation(
                "Vision resolve: rawLabel='{Raw}' startedResolution=true", name);

            var resolveResult = await _resolver.ResolveAsync(name, sessionId, cancellationToken);

            _logger.LogInformation(
                "Vision resolve: rawLabel='{Raw}' normalizedLabel='{Norm}' completedResolution=true matchType={MatchType} matched={Matched} confidence={Conf:F2} autoSelected={Auto}",
                name,
                resolveResult.NormalizedLabel,
                resolveResult.MatchType,
                resolveResult.MatchedIngredientId.HasValue,
                resolveResult.Confidence,
                resolveResult.IsAutoSelected);

            results.Add((rawName: name, resolveResult));
        }

        // Step 3: Split matched vs unmatched; apply closed-set filter
        var matched = new List<DetectedIngredientDto>();
        var unmatched = new List<string>();

        foreach (var (rawName, resolveResult) in results)
        {
            if (resolveResult.MatchType == "unresolved"
                || !resolveResult.MatchedIngredientId.HasValue
                || string.IsNullOrWhiteSpace(resolveResult.MatchedIngredientName))
            {
                unmatched.Add(rawName);
                continue;
            }

            // Closed-set enforcement: only active when EnforceClosedSetInResolver = true.
            // Default (false): resolver returns any match from the full Ingredients table.
            // Set to true only in controlled Faz 1 demos requiring strict closed-set behavior.
            if (_visionOptions.EnforceClosedSetInResolver && closedSet.Count > 0)
            {
                var canonicalKey = IngredientAcquisitionPolicy.NormalizeLookupKey(resolveResult.MatchedIngredientName);
                if (!closedSet.Contains(canonicalKey))
                {
                    unmatched.Add(rawName);
                    continue;
                }
            }

            matched.Add(new DetectedIngredientDto
            {
                IngredientId         = resolveResult.MatchedIngredientId.Value,
                CanonicalName        = resolveResult.MatchedIngredientName,
                Confidence           = resolveResult.Confidence,
                DetectedName         = rawName,
                NormalizedLabel      = resolveResult.NormalizedLabel,
                MatchedBy            = resolveResult.MatchType,
                MappingType          = MappingType.ExactIngredient,
                IsAutoSelected       = resolveResult.IsAutoSelected,
                RequiresConfirmation = resolveResult.RequiresReview,
            });
        }

        // Step 4: Deduplicate — same IngredientId from different raw names → keep highest confidence
        var deduped = matched
            .GroupBy(m => m.IngredientId)
            .Select(g => g.OrderByDescending(m => m.Confidence).First())
            .ToList();

        _logger.LogInformation(
            "Image analysis complete: {Matched} matched ({AutoSelected} auto-selected), {Unmatched} unmatched (from {Total} detected).",
            deduped.Count,
            deduped.Count(m => !m.RequiresConfirmation),
            unmatched.Count,
            rawNames.Count);

        return new AnalyzeIngredientImageResult
        {
            SessionId        = sessionId,
            Matched          = deduped,
            Unmatched        = unmatched,
            TotalDetected    = rawNames.Count,
            FeatureStatus    = "active",
            PromptTokens     = detectionResult.PromptTokens,
            CompletionTokens = detectionResult.CompletionTokens,
        };
    }
}
