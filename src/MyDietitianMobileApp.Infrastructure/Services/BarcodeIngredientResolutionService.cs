using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

public sealed class BarcodeIngredientResolutionService : IBarcodeIngredientResolutionService
{
    private static readonly (string CanonicalQuery, string[] Tokens)[] FamilyRules =
    [
        ("ton baligi", ["ton baligi", "ton balığı", "tuna"]),
        ("yogurt", ["yogurt", "yoğurt"]),
        ("sut", ["sut", "süt", "milk"]),
        ("yulaf", ["yulaf", "oat", "oats"]),
        ("peynir", ["peynir", "cheese"])
    ];

    private static readonly string[] CompositeKeywords =
    [
        "meyveli", "dessert", "tatli", "tatlı", "sandvic", "sandviç",
        "harc", "harç", "karisim", "karışım", "mix", "sos", "salata"
    ];

    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IIngredientNormalizationService _normalizationService;
    private readonly OpenFoodFactsOptions _options;
    private readonly ILogger<BarcodeIngredientResolutionService> _logger;

    public BarcodeIngredientResolutionService(
        AppDbContext db,
        IHttpClientFactory httpClientFactory,
        IIngredientNormalizationService normalizationService,
        OpenFoodFactsOptions options,
        ILogger<BarcodeIngredientResolutionService> logger)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _normalizationService = normalizationService;
        _options = options;
        _logger = logger;
    }

    public async Task<BarcodeResolutionResult> ResolveAsync(
        string barcode,
        CancellationToken cancellationToken = default)
    {
        var cleanedBarcode = (barcode ?? string.Empty).Trim();
        var sessionId = Guid.NewGuid();

        if (string.IsNullOrWhiteSpace(cleanedBarcode))
        {
            return CreateUnresolved(sessionId, cleanedBarcode, "validation");
        }

        var existing = await _db.ProductBarcodeMappings
            .AsNoTracking()
            .Include(m => m.CanonicalIngredient)
            .FirstOrDefaultAsync(m => m.Barcode == cleanedBarcode, cancellationToken);

        if (existing is not null && existing.CanonicalIngredient is { IsActive: true } cachedIngredient)
        {
            var candidate = new IngredientAcquisitionCandidate
            {
                IngredientId = cachedIngredient.Id,
                CanonicalName = cachedIngredient.CanonicalName,
                MappingType = existing.MappingType,
                Confidence = existing.Confidence,
                SourceProvider = "local_cache",
                RequiresConfirmation = IngredientAcquisitionPolicy.RequiresConfirmation(
                    AcquisitionSource.Barcode,
                    existing.MappingType,
                    existing.Confidence)
            };

            return new BarcodeResolutionResult
            {
                SessionId = sessionId,
                Barcode = cleanedBarcode,
                ProductName = existing.ProductName,
                Brand = existing.Brand,
                MappingType = existing.MappingType,
                Confidence = existing.Confidence,
                RequiresConfirmation = candidate.RequiresConfirmation,
                SourceProvider = "local_cache",
                Candidates = [candidate]
            };
        }

        var externalProduct = await LookupOpenFoodFactsAsync(cleanedBarcode, cancellationToken);
        if (externalProduct is null)
        {
            return CreateUnresolved(sessionId, cleanedBarcode, "not_found");
        }

        var resolved = await ResolveProductAsync(externalProduct, cancellationToken);
        return new BarcodeResolutionResult
        {
            SessionId = sessionId,
            Barcode = resolved.Barcode,
            ProductName = resolved.ProductName,
            Brand = resolved.Brand,
            MappingType = resolved.MappingType,
            Confidence = resolved.Confidence,
            RequiresConfirmation = resolved.RequiresConfirmation,
            SourceProvider = resolved.SourceProvider,
            Candidates = resolved.Candidates
        };
    }

    public async Task<BarcodeResolutionResult> ResolveProductAsync(
        BarcodeProductContext productContext,
        CancellationToken cancellationToken = default)
    {
        var sessionId = Guid.NewGuid();
        var normalizedName = IngredientAcquisitionPolicy.NormalizeLookupKey(productContext.ProductName);
        var normalizedCategories = IngredientAcquisitionPolicy.NormalizeLookupKey(productContext.CategoriesText);
        var lookupText = string.Join(" ", new[] { normalizedName, normalizedCategories }.Where(v => !string.IsNullOrWhiteSpace(v)));

        if (string.IsNullOrWhiteSpace(lookupText))
        {
            return CreateUnresolved(sessionId, productContext.Barcode, productContext.SourceProvider, productContext.ProductName, productContext.Brand);
        }

        var isComposite = CompositeKeywords.Any(keyword => lookupText.Contains(keyword, StringComparison.Ordinal));
        var candidates = new List<IngredientAcquisitionCandidate>();
        var overallMappingType = isComposite ? MappingType.CompositeProduct : MappingType.Unresolved;
        var overallConfidence = 0d;

        foreach (var rule in FamilyRules)
        {
            if (!rule.Tokens.Any(token => lookupText.Contains(token, StringComparison.Ordinal)))
            {
                continue;
            }

            var normalization = await _normalizationService.NormalizeAsync(rule.CanonicalQuery, cancellationToken);
            if (normalization.Status != IngredientMatchStatus.Matched ||
                !normalization.MatchedIngredientId.HasValue ||
                string.IsNullOrWhiteSpace(normalization.MatchedCanonicalName))
            {
                continue;
            }

            var mappingType = isComposite ? MappingType.CompositeProduct : MappingType.IngredientFamily;
            var confidence = ResolveConfidence(productContext.ProductName, rule.Tokens, isComposite);
            var requiresConfirmation = IngredientAcquisitionPolicy.RequiresConfirmation(
                AcquisitionSource.Barcode,
                mappingType,
                confidence);

            candidates.Add(new IngredientAcquisitionCandidate
            {
                IngredientId = normalization.MatchedIngredientId.Value,
                CanonicalName = normalization.MatchedCanonicalName,
                MappingType = mappingType,
                Confidence = confidence,
                SourceProvider = productContext.SourceProvider,
                RequiresConfirmation = requiresConfirmation
            });

            if (confidence > overallConfidence)
            {
                overallConfidence = confidence;
                overallMappingType = mappingType;
            }
        }

        if (candidates.Count == 0)
        {
            return CreateUnresolved(sessionId, productContext.Barcode, productContext.SourceProvider, productContext.ProductName, productContext.Brand);
        }

        var orderedCandidates = candidates
            .OrderByDescending(c => c.Confidence)
            .ThenBy(c => c.CanonicalName, StringComparer.OrdinalIgnoreCase)
            .Take(3)
            .ToArray();

        return new BarcodeResolutionResult
        {
            SessionId = sessionId,
            Barcode = productContext.Barcode,
            ProductName = productContext.ProductName,
            Brand = productContext.Brand,
            MappingType = overallMappingType,
            Confidence = overallConfidence,
            RequiresConfirmation = orderedCandidates.All(c => c.RequiresConfirmation),
            SourceProvider = productContext.SourceProvider,
            Candidates = orderedCandidates
        };
    }

    private async Task<BarcodeProductContext?> LookupOpenFoodFactsAsync(
        string barcode,
        CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
        {
            return null;
        }

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, _options.TimeoutSeconds)));

            var client = _httpClientFactory.CreateClient("openfoodfacts");
            var response = await client.GetFromJsonAsync<OpenFoodFactsResponse>(
                $"api/v2/product/{barcode}.json?fields=product_name,product_name_tr,brands,categories,categories_tags",
                cts.Token);

            if (response?.Product is null)
            {
                return null;
            }

            var productName = response.Product.ProductNameTr
                              ?? response.Product.ProductName
                              ?? string.Empty;
            var categories = response.Product.Categories;
            if (string.IsNullOrWhiteSpace(categories) && response.Product.CategoriesTags?.Count > 0)
            {
                categories = string.Join(", ", response.Product.CategoriesTags);
            }

            return new BarcodeProductContext
            {
                Barcode = barcode,
                ProductName = productName,
                Brand = response.Product.Brands,
                CategoriesText = categories,
                SourceProvider = "open_food_facts"
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Open Food Facts lookup failed for barcode {Barcode}.", barcode);
            return null;
        }
    }

    private static double ResolveConfidence(
        string? productName,
        IReadOnlyCollection<string> familyTokens,
        bool isComposite)
    {
        if (isComposite)
        {
            return 0.72d;
        }

        var normalizedName = IngredientAcquisitionPolicy.NormalizeLookupKey(productName);
        if (familyTokens.Any(token => normalizedName.Equals(token, StringComparison.Ordinal)))
        {
            return 0.94d;
        }

        if (familyTokens.Any(token => normalizedName.StartsWith(token, StringComparison.Ordinal) ||
                                      normalizedName.EndsWith(token, StringComparison.Ordinal)))
        {
            return 0.89d;
        }

        return 0.84d;
    }

    private static BarcodeResolutionResult CreateUnresolved(
        Guid sessionId,
        string barcode,
        string sourceProvider,
        string? productName = null,
        string? brand = null)
    {
        return new BarcodeResolutionResult
        {
            SessionId = sessionId,
            Barcode = barcode,
            ProductName = productName,
            Brand = brand,
            MappingType = MappingType.Unresolved,
            Confidence = 0,
            RequiresConfirmation = true,
            SourceProvider = sourceProvider,
            Candidates = Array.Empty<IngredientAcquisitionCandidate>()
        };
    }

    private sealed class OpenFoodFactsResponse
    {
        public OpenFoodFactsProduct? Product { get; set; }
    }

    private sealed class OpenFoodFactsProduct
    {
        public string? ProductName { get; set; }
        public string? ProductNameTr { get; set; }
        public string? Brands { get; set; }
        public string? Categories { get; set; }
        public List<string>? CategoriesTags { get; set; }
    }
}
