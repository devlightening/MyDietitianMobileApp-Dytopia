using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

/// <summary>
/// Default implementation of <see cref="IIngredientDetectionResolver"/>.
///
/// Resolution chain (DB-first, cache-assisted):
///   1. IIngredientNormalizationService canonical match   — exact name hit → confidence 1.00 → auto-select
///   2. IIngredientNormalizationService alias match       — exact alias hit → confidence 0.95 → auto-select
///   3. VisionLabelMappings approved entry               — previously confirmed label → fast cache hit
///   4. VisionLabelMappings provisional entry            — tentative cache entry → review required
///   5. IIngredientNormalizationService fuzzy match      — similarity search over full Ingredients table
///   6. IIngredientNormalizationService LLM assist       — semantic normalization fallback (optional)
///   7. unresolved
///
/// ClosedSetCanonicalNames is intentionally NOT used as a resolver filter here.
/// It is consumed only as a GPT detection-prompt hint in VisionIngredientService.
/// Full Ingredients table is always the resolution universe.
///
/// Auto-select rule (mirrors IngredientAcquisitionPolicy.Vision):
///   confidence ≥ 0.85 → isAutoSelected = true
///   confidence &lt;  0.85 (and match exists) → requiresReview = true
/// </summary>
public class IngredientDetectionResolver : IIngredientDetectionResolver
{
    // Vision confidence thresholds (mirrors IngredientAcquisitionPolicy)
    private const double AutoSelectThreshold = 0.85;

    // Confidence assigned to mapping-table hits
    private const double ApprovedSpecificConfidence  = 0.90;  // specific label (e.g. "tomato") → auto-select
    private const double ApprovedGeneralConfidence   = 0.70;  // general label (e.g. "chicken") → review
    private const double ProvisionalBaseConfidence   = 0.60;  // provisional → review

    private readonly AppDbContext _db;
    private readonly IIngredientNormalizationService _normalizationService;
    private readonly ILogger<IngredientDetectionResolver> _logger;

    public IngredientDetectionResolver(
        AppDbContext db,
        IIngredientNormalizationService normalizationService,
        ILogger<IngredientDetectionResolver> logger)
    {
        _db = db;
        _normalizationService = normalizationService;
        _logger = logger;
    }

    public async Task<DetectionResolverResult> ResolveAsync(
        string rawLabel,
        Guid sessionId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rawLabel))
            return DetectionResolverResult.Unresolved(rawLabel ?? string.Empty, string.Empty);

        var normalizedLabel = NormalizeLabel(rawLabel);

        try
        {
            // ── Layers 1–2 & 5–6: IngredientNormalizationService (full Ingredients table) ──
            // Run first — canonical and alias matches are the highest-quality signal.
            // The service searches the entire Ingredients table, not a seeded subset.
            var normResult = await _normalizationService.NormalizeAsync(normalizedLabel, cancellationToken);

            // Layers 1 & 2: exact canonical or alias match — high confidence, return immediately
            if (normResult.Status == IngredientMatchStatus.Matched
                && normResult.MatchedIngredientId.HasValue
                && !string.IsNullOrWhiteSpace(normResult.MatchedCanonicalName)
                && normResult.MatchedBy is IngredientMatchedBy.Canonical or IngredientMatchedBy.Alias)
            {
                var matchType = MapMatchedBy(normResult.MatchedBy);
                var confidence = normResult.Confidence;   // 1.00 (canonical) or 0.95 (alias)
                var isAutoSelected = confidence >= AutoSelectThreshold;

                _logger.LogInformation(
                    "Vision resolve: raw='{Raw}' normalized='{Label}' → '{Name}' matchedBy={By} confidence={Conf:F2} autoSelected={Auto}",
                    rawLabel, normalizedLabel, normResult.MatchedCanonicalName, normResult.MatchedBy, confidence, isAutoSelected);

                await LogDetectionAsync(
                    sessionId, rawLabel, normalizedLabel,
                    normResult.MatchedIngredientId.Value, confidence,
                    matchType, isAutoSelected,
                    usedOpenAi: false,
                    cancellationToken);

                return new DetectionResolverResult
                {
                    RawLabel              = rawLabel,
                    NormalizedLabel       = normalizedLabel,
                    MatchedIngredientId   = normResult.MatchedIngredientId,
                    MatchedIngredientName = normResult.MatchedCanonicalName,
                    Confidence            = confidence,
                    MatchType             = matchType,
                    IsAutoSelected        = isAutoSelected,
                    RequiresReview        = !isAutoSelected,
                };
            }

            // ── Layers 3 & 4: VisionLabelMappings cache ───────────────────────
            // Check after exact DB matches so the real DB is always preferred.
            // Useful for: manually curated seeds, user-confirmed labels, provisional entries.
            var mapping = await _db.VisionLabelMappings
                .Where(m => m.NormalizedLabel == normalizedLabel)
                .OrderByDescending(m => m.IsApproved)
                .ThenByDescending(m => m.ConfidenceThreshold)
                .FirstOrDefaultAsync(cancellationToken);

            if (mapping?.IngredientId != null)
            {
                var ingredient = await _db.Ingredients
                    .Where(i => i.Id == mapping.IngredientId && i.IsActive)
                    .Select(i => new { i.Id, i.CanonicalName })
                    .FirstOrDefaultAsync(cancellationToken);

                if (ingredient != null)
                {
                    var confidence = ComputeMappingConfidence(mapping);
                    var isAutoSelected = confidence >= AutoSelectThreshold;

                    _logger.LogInformation(
                        "Vision resolve: raw='{Raw}' normalized='{Label}' → '{Name}' matchedBy=mapping_table approved={Approved} confidence={Conf:F2} autoSelected={Auto}",
                        rawLabel, normalizedLabel, ingredient.CanonicalName, mapping.IsApproved, confidence, isAutoSelected);

                    await LogDetectionAsync(
                        sessionId, rawLabel, normalizedLabel,
                        ingredient.Id, confidence,
                        "mapping_table", isAutoSelected,
                        usedOpenAi: false,
                        cancellationToken);

                    return new DetectionResolverResult
                    {
                        RawLabel              = rawLabel,
                        NormalizedLabel       = normalizedLabel,
                        MatchedIngredientId   = ingredient.Id,
                        MatchedIngredientName = ingredient.CanonicalName,
                        Confidence            = confidence,
                        MatchType             = "mapping_table",
                        IsAutoSelected        = isAutoSelected,
                        RequiresReview        = !isAutoSelected,
                    };
                }
            }

            // ── Layers 5 & 6: Fuzzy / LLM from normResult ────────────────────
            // Reuse the normResult already fetched above (no extra DB round-trip).
            // Fuzzy: 0.65–0.89 → usually requiresReview; LLM: 0.55–0.79 → review.
            if (normResult.Status == IngredientMatchStatus.Matched
                && normResult.MatchedIngredientId.HasValue
                && !string.IsNullOrWhiteSpace(normResult.MatchedCanonicalName))
            {
                var matchType = MapMatchedBy(normResult.MatchedBy);
                var confidence = normResult.Confidence;
                var isAutoSelected = confidence >= AutoSelectThreshold;

                _logger.LogInformation(
                    "Vision resolve: raw='{Raw}' normalized='{Label}' → '{Name}' matchedBy={By} confidence={Conf:F2} autoSelected={Auto}",
                    rawLabel, normalizedLabel, normResult.MatchedCanonicalName, normResult.MatchedBy, confidence, isAutoSelected);

                await LogDetectionAsync(
                    sessionId, rawLabel, normalizedLabel,
                    normResult.MatchedIngredientId.Value, confidence,
                    matchType, isAutoSelected,
                    usedOpenAi: normResult.MatchedBy == IngredientMatchedBy.Llm,
                    cancellationToken);

                return new DetectionResolverResult
                {
                    RawLabel              = rawLabel,
                    NormalizedLabel       = normalizedLabel,
                    MatchedIngredientId   = normResult.MatchedIngredientId,
                    MatchedIngredientName = normResult.MatchedCanonicalName,
                    Confidence            = confidence,
                    MatchType             = matchType,
                    IsAutoSelected        = isAutoSelected,
                    RequiresReview        = !isAutoSelected,
                };
            }

            // ── Layer 7: Unresolved ───────────────────────────────────────────
            _logger.LogWarning(
                "Vision resolve: raw='{Raw}' normalized='{Label}' UNRESOLVED — detected by GPT but no DB match found",
                rawLabel, normalizedLabel);

            await LogDetectionAsync(
                sessionId, rawLabel, normalizedLabel,
                null, 0.0,
                "unresolved", false,
                usedOpenAi: false,
                cancellationToken);

            return DetectionResolverResult.Unresolved(rawLabel, normalizedLabel);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DetectionResolver failed for label '{Label}'. Returning unresolved.", rawLabel);
            return DetectionResolverResult.Unresolved(rawLabel, normalizedLabel);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Normalize raw label: trim, lowercase, fold Turkish chars to ASCII equivalents.
    /// Must stay consistent with IngredientNormalizationService.NormalizeText so that
    /// "salatalik" and "salatalık" both resolve to "salatalik" before lookup.
    /// </summary>
    private static string NormalizeLabel(string raw)
        => raw.Trim().ToLowerInvariant()
            .Replace('ı', 'i')
            .Replace('ş', 's')
            .Replace('ç', 'c')
            .Replace('ğ', 'g')
            .Replace('ö', 'o')
            .Replace('ü', 'u');

    /// <summary>
    /// Compute the effective confidence for a VisionLabelMapping hit.
    ///
    /// Approved mappings with high threshold (≥0.70) → ApprovedSpecificConfidence (0.90) → auto-select.
    /// Approved mappings with low threshold (<0.70) → ApprovedGeneralConfidence (0.70) → review.
    ///   These are general labels like "chicken", "pepper", "milk" where the same label
    ///   could match multiple canonical ingredients.
    /// Provisional (IsApproved=false) → ProvisionalBaseConfidence (0.60) → review.
    /// </summary>
    private static double ComputeMappingConfidence(VisionLabelMapping mapping)
    {
        if (!mapping.IsApproved)
            return Math.Max(ProvisionalBaseConfidence, mapping.ConfidenceThreshold);

        return mapping.ConfidenceThreshold >= 0.70
            ? ApprovedSpecificConfidence
            : ApprovedGeneralConfidence;
    }

    private static string MapMatchedBy(IngredientMatchedBy matchedBy) => matchedBy switch
    {
        IngredientMatchedBy.Canonical => "canonical",
        IngredientMatchedBy.Alias     => "exact_alias",
        IngredientMatchedBy.Fuzzy     => "fuzzy",
        IngredientMatchedBy.Llm       => "llm",
        _                             => "unresolved",
    };

    private async Task LogDetectionAsync(
        Guid sessionId,
        string rawLabel,
        string normalizedLabel,
        Guid? predictedIngredientId,
        double confidence,
        string matchType,
        bool wasAutoSelected,
        bool usedOpenAi,
        CancellationToken cancellationToken)
    {
        try
        {
            var log = new IngredientImageDetectionLog(
                id: Guid.NewGuid(),
                sessionId: sessionId,
                clientId: null,
                imageSource: "vision",
                rawLabel: rawLabel,
                normalizedLabel: normalizedLabel,
                predictedIngredientId: predictedIngredientId,
                confidence: confidence,
                matchType: matchType,
                wasAutoSelected: wasAutoSelected,
                usedOpenAiFallback: usedOpenAi);

            _db.IngredientImageDetectionLogs.Add(log);
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Logging failure must never break the resolution result
            _logger.LogWarning(ex, "Failed to write IngredientImageDetectionLog for '{Label}'.", rawLabel);
        }
    }
}
