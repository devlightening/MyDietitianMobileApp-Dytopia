using System.Net.Http.Json;
using System.Text.Json;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

public sealed class BarcodeIngredientResolutionService : IBarcodeIngredientResolutionService
{
    private static readonly ConcurrentDictionary<string, (DateTimeOffset ExpiresAt, BarcodeProductContext Context)> OpenFoodFactsCache = new(StringComparer.Ordinal);

    private static readonly IReadOnlyDictionary<string, BarcodeProductContext> KnownBarcodeFallbacks =
        new Dictionary<string, BarcodeProductContext>(StringComparer.Ordinal)
        {
            ["8695077001450"] = new()
            {
                Barcode = "8695077001450",
                ProductName = "Derya Ton Balığı",
                Brand = "Derya",
                CategoriesText = "ton balığı, konserve balık",
                SourceProvider = "known_barcode"
            }
        };

    private static readonly (string CanonicalQuery, string[] Tokens)[] FamilyRules =
    [
        ("ton baligi", ["ton baligi", "tonbaligi", "ton balik", "ton baligi konservesi", "tuna", "tuna fish", "canned tuna", "en:tuna", "en:tunas", "en:canned-tuna"]),
        ("su", ["icme suyu", "maden suyu", "mineral water", "spring water", "water", "en:waters", "en:spring-waters", "en:mineral-waters", "tr:sular", "su"]),
        ("yogurt", ["yogurt"]),
        ("sut", ["sut", "milk"]),
        ("yulaf", ["yulaf", "oat", "oats"]),
        ("peynir", ["peynir", "cheese"])
    ];

    private static readonly string[] CompositeKeywords =
    [
        "meyveli", "dessert", "tatli", "sandvic",
        "harc", "karisim", "mix", "sos", "salata"
    ];

    private static readonly HashSet<string> ProductStopWords = new(StringComparer.Ordinal)
    {
        "ve", "ile", "icin", "gida", "gida urunu", "urun", "urunleri", "konserve", "konservesi",
        "dogal", "organik", "taze", "net", "miktar", "gram", "gr", "kg", "ml", "lt", "adet",
        "the", "and", "with", "food", "product", "fresh", "natural", "organic"
    };

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
            .Include(m => m.CanonicalIngredient)
            .FirstOrDefaultAsync(m => m.Barcode == cleanedBarcode, cancellationToken);

        if (existing is not null && existing.CanonicalIngredient is { IsActive: true } cachedIngredient)
        {
            existing.UpdateResolution(
                existing.ProductName,
                existing.Brand,
                existing.CanonicalIngredientId,
                existing.MappingType,
                existing.Confidence,
                existing.SourceProvider,
                existing.IsManualOverride,
                DateTime.UtcNow);
            await _db.SaveChangesAsync(cancellationToken);

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
            if (!KnownBarcodeFallbacks.TryGetValue(cleanedBarcode, out externalProduct))
            {
                return CreateUnresolved(sessionId, cleanedBarcode, "not_found");
            }
        }

        var resolved = await ResolveProductAsync(externalProduct, cancellationToken);

        await TryPersistAutoResolutionAsync(cleanedBarcode, resolved, cancellationToken);

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
        var normalizedGenericName = IngredientAcquisitionPolicy.NormalizeLookupKey(productContext.GenericName);
        var normalizedCategories = IngredientAcquisitionPolicy.NormalizeLookupKey(productContext.CategoriesText);
        var normalizedIngredients = IngredientAcquisitionPolicy.NormalizeLookupKey(productContext.IngredientsText);
        var lookupText = string.Join(" ", new[] { normalizedName, normalizedGenericName, normalizedCategories, normalizedIngredients }.Where(v => !string.IsNullOrWhiteSpace(v)));
        var lookupTextNoSpaces = RemoveWhitespace(lookupText);

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
            var normalizedTokens = rule.Tokens
                .Select(IngredientAcquisitionPolicy.NormalizeLookupKey)
                .Where(token => !string.IsNullOrWhiteSpace(token))
                .Distinct(StringComparer.Ordinal)
                .ToArray();

            if (!ContainsAnyToken(lookupText, lookupTextNoSpaces, normalizedTokens))
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

            var mappingType = ResolveMappingType(isComposite, normalizedName, normalizedTokens);
            var confidence = ResolveConfidence(productContext.ProductName, normalizedTokens, isComposite);
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
            candidates.AddRange(await ResolveFromProductTextAsync(
                productContext,
                isComposite,
                cancellationToken));
        }

        if (candidates.Count == 0)
        {
            return CreateUnresolved(sessionId, productContext.Barcode, productContext.SourceProvider, productContext.ProductName, productContext.Brand);
        }

        var orderedCandidates = candidates
            .GroupBy(c => c.IngredientId)
            .Select(group => group
                .OrderByDescending(c => c.Confidence)
                .First())
            .OrderByDescending(c => c.Confidence)
            .ThenBy(c => c.CanonicalName, StringComparer.OrdinalIgnoreCase)
            .Take(3)
            .ToArray();

        var bestCandidate = orderedCandidates[0];

        return new BarcodeResolutionResult
        {
            SessionId = sessionId,
            Barcode = productContext.Barcode,
            ProductName = productContext.ProductName,
            Brand = productContext.Brand,
            MappingType = overallConfidence > 0 ? overallMappingType : bestCandidate.MappingType,
            Confidence = overallConfidence > 0 ? overallConfidence : bestCandidate.Confidence,
            RequiresConfirmation = orderedCandidates.All(c => c.RequiresConfirmation),
            SourceProvider = productContext.SourceProvider,
            Candidates = orderedCandidates
        };
    }

    private async Task<IReadOnlyList<IngredientAcquisitionCandidate>> ResolveFromProductTextAsync(
        BarcodeProductContext productContext,
        bool isComposite,
        CancellationToken cancellationToken)
    {
        var phrases = BuildProductLookupPhrases(productContext);
        var candidates = new List<IngredientAcquisitionCandidate>();

        foreach (var phrase in phrases)
        {
            var normalization = await _normalizationService.NormalizeAsync(phrase.Text, cancellationToken);
            if (normalization.Status != IngredientMatchStatus.Matched ||
                !normalization.MatchedIngredientId.HasValue ||
                string.IsNullOrWhiteSpace(normalization.MatchedCanonicalName))
            {
                continue;
            }

            var mappingType = ResolveTextMappingType(isComposite, phrase.Source, normalization.MatchedBy);
            var confidence = ResolveTextConfidence(phrase.Source, normalization.MatchedBy, normalization.Confidence);
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
        }

        return candidates;
    }

    private static IReadOnlyList<ProductLookupPhrase> BuildProductLookupPhrases(BarcodeProductContext productContext)
    {
        var brandKeys = BuildBrandKeys(productContext.Brand);
        var phrases = new List<ProductLookupPhrase>();

        AddProductNamePhrases(phrases, productContext.ProductName, brandKeys, ProductPhraseSource.ProductName);
        AddProductNamePhrases(phrases, productContext.GenericName, brandKeys, ProductPhraseSource.GenericName);
        AddDelimitedPhrases(phrases, productContext.CategoriesText, ProductPhraseSource.Category);
        AddDelimitedPhrases(phrases, productContext.IngredientsText, ProductPhraseSource.IngredientsText);

        return phrases
            .Where(p => IsUsefulLookupPhrase(p.Text, brandKeys))
            .GroupBy(p => p.Text, StringComparer.Ordinal)
            .Select(group => group
                .OrderBy(p => p.Source)
                .ThenByDescending(p => p.Text.Length)
                .First())
            .Take(24)
            .ToArray();
    }

    private static void AddProductNamePhrases(
        List<ProductLookupPhrase> phrases,
        string? rawText,
        IReadOnlySet<string> brandKeys,
        ProductPhraseSource source)
    {
        var cleaned = NormalizeProductText(rawText, brandKeys);
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return;
        }

        phrases.Add(new ProductLookupPhrase(cleaned, source));

        var words = cleaned
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(word => !ProductStopWords.Contains(word))
            .ToArray();

        for (var length = Math.Min(4, words.Length); length >= 1; length--)
        {
            for (var start = 0; start + length <= words.Length; start++)
            {
                phrases.Add(new ProductLookupPhrase(string.Join(" ", words.Skip(start).Take(length)), source));
            }
        }
    }

    private static void AddDelimitedPhrases(
        List<ProductLookupPhrase> phrases,
        string? rawText,
        ProductPhraseSource source)
    {
        var normalized = IngredientAcquisitionPolicy.NormalizeLookupKey(rawText);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return;
        }

        foreach (var part in normalized.Split([',', ';', '|', '/', '\\', '(', ')'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var cleaned = part;
            var colonIndex = cleaned.LastIndexOf(':');
            if (colonIndex >= 0 && colonIndex + 1 < cleaned.Length)
            {
                cleaned = cleaned[(colonIndex + 1)..];
            }

            cleaned = cleaned.Replace('-', ' ').Trim();
            if (!string.IsNullOrWhiteSpace(cleaned))
            {
                phrases.Add(new ProductLookupPhrase(cleaned, source));
            }
        }
    }

    private static IReadOnlySet<string> BuildBrandKeys(string? brand)
    {
        var normalized = IngredientAcquisitionPolicy.NormalizeLookupKey(brand);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return new HashSet<string>(StringComparer.Ordinal);
        }

        return normalized
            .Split([' ', ',', '.', ';', ':', '-', '_'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Append(normalized)
            .Where(value => value.Length > 1)
            .ToHashSet(StringComparer.Ordinal);
    }

    private static string NormalizeProductText(string? rawText, IReadOnlySet<string> brandKeys)
    {
        var normalized = IngredientAcquisitionPolicy.NormalizeLookupKey(rawText);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return string.Empty;
        }

        foreach (var separator in new[] { ',', ';', '|', '/', '\\', '(', ')', '[', ']', '{', '}', '.', ':' })
        {
            normalized = normalized.Replace(separator, ' ');
        }

        var words = normalized
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(word => !brandKeys.Contains(word))
            .ToArray();

        return string.Join(" ", words);
    }

    private static bool IsUsefulLookupPhrase(string phrase, IReadOnlySet<string> brandKeys)
    {
        if (string.IsNullOrWhiteSpace(phrase) || phrase.Length < 3)
        {
            return false;
        }

        if (brandKeys.Contains(phrase) || ProductStopWords.Contains(phrase))
        {
            return false;
        }

        return phrase.Any(char.IsLetter);
    }

    private static MappingType ResolveTextMappingType(
        bool isComposite,
        ProductPhraseSource source,
        IngredientMatchedBy matchedBy)
    {
        if (isComposite)
        {
            return MappingType.CompositeProduct;
        }

        if (source is ProductPhraseSource.Category or ProductPhraseSource.IngredientsText)
        {
            return MappingType.IngredientFamily;
        }

        return matchedBy is IngredientMatchedBy.Canonical or IngredientMatchedBy.Alias
            ? MappingType.ExactIngredient
            : MappingType.IngredientFamily;
    }

    private static double ResolveTextConfidence(
        ProductPhraseSource source,
        IngredientMatchedBy matchedBy,
        double normalizationConfidence)
    {
        var sourceCap = source switch
        {
            ProductPhraseSource.ProductName => 0.94d,
            ProductPhraseSource.GenericName => 0.92d,
            ProductPhraseSource.Category => 0.88d,
            ProductPhraseSource.IngredientsText => 0.82d,
            _ => 0.80d
        };

        var matchCap = matchedBy switch
        {
            IngredientMatchedBy.Canonical => sourceCap,
            IngredientMatchedBy.Alias => Math.Min(sourceCap, 0.93d),
            IngredientMatchedBy.Fuzzy => Math.Min(sourceCap, 0.86d),
            IngredientMatchedBy.Llm => Math.Min(sourceCap, 0.79d),
            _ => 0d
        };

        return Math.Round(Math.Clamp(normalizationConfidence, 0, matchCap), 4);
    }

    private async Task<BarcodeProductContext?> LookupOpenFoodFactsAsync(
        string barcode,
        CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
        {
            return null;
        }

        if (TryGetFromOpenFoodFactsCache(barcode, out var cached))
        {
            return cached;
        }

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, _options.TimeoutSeconds)));

            var client = _httpClientFactory.CreateClient("openfoodfacts");
            var relativeUrl = $"api/v2/product/{barcode}.json?fields=product_name,product_name_tr,generic_name,generic_name_tr,brands,categories,categories_tags,ingredients_text,ingredients_text_tr";

            for (var attempt = 1; attempt <= 3; attempt++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, relativeUrl);
                using var httpResponse = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token);

                if (httpResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return null;
                }

                if ((int)httpResponse.StatusCode == 429 || (int)httpResponse.StatusCode >= 500)
                {
                    if (attempt == 3)
                    {
                        httpResponse.EnsureSuccessStatusCode();
                    }

                    var delay = GetRetryDelay(httpResponse, attempt);
                    await Task.Delay(delay, cts.Token);
                    continue;
                }

                httpResponse.EnsureSuccessStatusCode();

                var response = await httpResponse.Content.ReadFromJsonAsync<OpenFoodFactsResponse>(
                    new JsonSerializerOptions(JsonSerializerDefaults.Web),
                    cts.Token);

                if (response?.Product is null)
                {
                    return null;
                }

                var productName = response.Product.ProductNameTr
                                  ?? response.Product.ProductName
                                  ?? string.Empty;
                var genericName = response.Product.GenericNameTr
                                  ?? response.Product.GenericName;
                var ingredientsText = response.Product.IngredientsTextTr
                                      ?? response.Product.IngredientsText;
                var categories = response.Product.Categories;
                if (string.IsNullOrWhiteSpace(categories) && response.Product.CategoriesTags?.Count > 0)
                {
                    categories = string.Join(", ", response.Product.CategoriesTags);
                }

                var context = new BarcodeProductContext
                {
                    Barcode = barcode,
                    ProductName = productName,
                    GenericName = genericName,
                    Brand = response.Product.Brands,
                    CategoriesText = categories,
                    IngredientsText = ingredientsText,
                    SourceProvider = "open_food_facts"
                };

                SetOpenFoodFactsCache(barcode, context);
                return context;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Open Food Facts lookup failed for barcode {Barcode}.", barcode);
            return null;
        }
    }

    private async Task TryPersistAutoResolutionAsync(
        string barcode,
        BarcodeResolutionResult resolved,
        CancellationToken cancellationToken)
    {
        if (resolved is not { Candidates.Count: > 0 })
        {
            return;
        }

        var best = resolved.Candidates
            .OrderByDescending(c => c.Confidence)
            .First();

        if (best.Confidence < 0.80d)
        {
            return;
        }

        if (best.MappingType is MappingType.Unresolved or MappingType.CompositeProduct)
        {
            return;
        }

        var existing = await _db.ProductBarcodeMappings
            .FirstOrDefaultAsync(m => m.Barcode == barcode, cancellationToken);

        if (existing is not null)
        {
            // Keep manual overrides intact.
            if (existing.IsManualOverride)
            {
                return;
            }

            existing.UpdateResolution(
                resolved.ProductName ?? existing.ProductName,
                resolved.Brand,
                best.IngredientId,
                best.MappingType,
                best.Confidence,
                sourceProvider: resolved.SourceProvider,
                isManualOverride: false,
                lastVerifiedAtUtc: DateTime.UtcNow);
        }
        else
        {
            var mapping = new ProductBarcodeMapping(
                Guid.NewGuid(),
                barcode,
                resolved.ProductName ?? barcode,
                resolved.Brand,
                best.IngredientId,
                best.MappingType,
                best.Confidence,
                sourceProvider: resolved.SourceProvider,
                isManualOverride: false,
                lastVerifiedAtUtc: DateTime.UtcNow);

            _db.ProductBarcodeMappings.Add(mapping);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private static MappingType ResolveMappingType(
        bool isComposite,
        string normalizedName,
        IReadOnlyCollection<string> normalizedTokens)
    {
        if (isComposite)
        {
            return MappingType.CompositeProduct;
        }

        if (normalizedTokens.Any(token =>
                normalizedName.Equals(token, StringComparison.Ordinal) ||
                IsBrandPrefixedExactIngredient(normalizedName, token)))
        {
            return MappingType.ExactIngredient;
        }

        return MappingType.IngredientFamily;
    }

    private static bool ContainsAnyToken(
        string normalizedLookup,
        string normalizedLookupNoSpaces,
        IReadOnlyCollection<string> normalizedTokens)
    {
        foreach (var token in normalizedTokens)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                continue;
            }

            if (IsShortToken(token))
            {
                if (ContainsWord(normalizedLookup, token))
                {
                    return true;
                }

                continue;
            }

            if (normalizedLookup.Contains(token, StringComparison.Ordinal))
            {
                return true;
            }

            var tokenNoSpaces = RemoveWhitespace(token);
            if (tokenNoSpaces.Length > 0 && normalizedLookupNoSpaces.Contains(tokenNoSpaces, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    private static bool ContainsWord(string text, string token)
    {
        var startIndex = 0;
        while (startIndex < text.Length)
        {
            while (startIndex < text.Length && !char.IsLetterOrDigit(text[startIndex]))
            {
                startIndex++;
            }

            if (startIndex >= text.Length)
            {
                break;
            }

            var endIndex = startIndex;
            while (endIndex < text.Length && char.IsLetterOrDigit(text[endIndex]))
            {
                endIndex++;
            }

            var length = endIndex - startIndex;
            if (length == token.Length &&
                text.AsSpan(startIndex, length).Equals(token.AsSpan(), StringComparison.Ordinal))
            {
                return true;
            }

            startIndex = endIndex;
        }

        return false;
    }

    private static bool IsShortToken(string token)
        => token.Length <= 2;

    private static string RemoveWhitespace(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        Span<char> buffer = stackalloc char[value.Length];
        var length = 0;

        foreach (var c in value)
        {
            if (!char.IsWhiteSpace(c))
            {
                buffer[length++] = c;
            }
        }

        return buffer[..length].ToString();
    }

    private static TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        if (response.Headers.RetryAfter?.Delta is { } delta)
        {
            return delta > TimeSpan.FromSeconds(2) ? TimeSpan.FromSeconds(2) : delta;
        }

        if (response.Headers.RetryAfter?.Date is { } date)
        {
            var delay = date - DateTimeOffset.UtcNow;
            if (delay > TimeSpan.Zero)
            {
                return delay > TimeSpan.FromSeconds(2) ? TimeSpan.FromSeconds(2) : delay;
            }
        }

        // Gentle exponential backoff capped at ~1s.
        var ms = Math.Min(1000, 150 * Math.Pow(2, attempt - 1));
        return TimeSpan.FromMilliseconds(ms);
    }

    private static bool TryGetFromOpenFoodFactsCache(string barcode, out BarcodeProductContext? context)
    {
        context = null;

        if (OpenFoodFactsCache.TryGetValue(barcode, out var entry) && entry.ExpiresAt > DateTimeOffset.UtcNow)
        {
            context = entry.Context;
            return true;
        }

        return false;
    }

    private static void SetOpenFoodFactsCache(string barcode, BarcodeProductContext context)
    {
        OpenFoodFactsCache[barcode] = (DateTimeOffset.UtcNow.AddHours(12), context);
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

        if (familyTokens.Any(token => IsBrandPrefixedExactIngredient(normalizedName, token)))
        {
            return 0.98d;
        }

        if (familyTokens.Any(token => normalizedName.StartsWith(token, StringComparison.Ordinal) ||
                                      normalizedName.EndsWith(token, StringComparison.Ordinal)))
        {
            return 0.89d;
        }

        return 0.84d;
    }

    private static bool IsBrandPrefixedExactIngredient(string normalizedName, string normalizedToken)
    {
        if (string.IsNullOrWhiteSpace(normalizedName) ||
            string.IsNullOrWhiteSpace(normalizedToken) ||
            !normalizedName.EndsWith(normalizedToken, StringComparison.Ordinal))
        {
            return false;
        }

        var brandPrefix = normalizedName[..^normalizedToken.Length].Trim();
        return !string.IsNullOrWhiteSpace(brandPrefix) &&
               !brandPrefix.Contains(' ', StringComparison.Ordinal);
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
        public string? GenericName { get; set; }
        public string? GenericNameTr { get; set; }
        public string? Brands { get; set; }
        public string? Categories { get; set; }
        public List<string>? CategoriesTags { get; set; }
        public string? IngredientsText { get; set; }
        public string? IngredientsTextTr { get; set; }
    }

    private sealed record ProductLookupPhrase(string Text, ProductPhraseSource Source);

    private enum ProductPhraseSource
    {
        ProductName = 0,
        GenericName = 1,
        Category = 2,
        IngredientsText = 3
    }
}
