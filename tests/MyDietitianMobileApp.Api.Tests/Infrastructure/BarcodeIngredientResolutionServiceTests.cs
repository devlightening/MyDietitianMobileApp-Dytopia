using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Infrastructure;

public sealed class BarcodeIngredientResolutionServiceTests
{
    [Fact]
    public async Task ResolveAsync_WhenDeryaTunaBarcodeWasUnresolved_ShouldReturnTonBaligiAndRepairCache()
    {
        var db = CreateDb();
        var tuna = new Ingredient(Guid.NewGuid(), "Ton Balığı");
        tuna.AddAlias("Ton Baligi");
        db.Ingredients.Add(tuna);
        db.ProductBarcodeMappings.Add(new ProductBarcodeMapping(
            Guid.NewGuid(),
            barcode: "8695077001450",
            productName: "Derya",
            brand: "Derya",
            canonicalIngredientId: null,
            mappingType: MappingType.Unresolved,
            confidence: 0,
            sourceProvider: "open_food_facts",
            isManualOverride: false,
            lastVerifiedAtUtc: DateTime.UtcNow.AddDays(-1)));
        await db.SaveChangesAsync();

        var sut = new BarcodeIngredientResolutionService(
            db,
            httpClientFactory: new Mock<IHttpClientFactory>().Object,
            new IngredientNormalizationService(
                db,
                new NullIngredientLlmClient(),
                new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
                new LlmNormalizationOptions()),
            options: new OpenFoodFactsOptions { Enabled = false },
            logger: NullLogger<BarcodeIngredientResolutionService>.Instance);

        var result = await sut.ResolveAsync("8695077001450");

        result.ProductName.Should().Be("Derya Ton Balığı");
        result.Brand.Should().Be("Derya");
        result.MappingType.Should().Be(MappingType.ExactIngredient);
        result.Confidence.Should().Be(0.98d);
        result.RequiresConfirmation.Should().BeFalse();
        result.Candidates.Should().ContainSingle();
        result.Candidates[0].IngredientId.Should().Be(tuna.Id);
        result.Candidates[0].CanonicalName.Should().Be("Ton Balığı");

        var repaired = await db.ProductBarcodeMappings.SingleAsync(x => x.Barcode == "8695077001450");
        repaired.CanonicalIngredientId.Should().Be(tuna.Id);
        repaired.MappingType.Should().Be(MappingType.ExactIngredient);
        repaired.SourceProvider.Should().Be("known_barcode");
    }

    [Fact]
    public async Task ResolveProductAsync_WhenProductNameHasNoSpaces_ShouldMatchTonBaligiRule()
    {
        var tunaId = Guid.NewGuid();

        var normalizationService = new Mock<IIngredientNormalizationService>();
        normalizationService
            .Setup(s => s.NormalizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string input, CancellationToken _) =>
            {
                if (string.Equals(input, "ton baligi", StringComparison.Ordinal))
                {
                    return new IngredientNormalizationResult
                    {
                        RawInput = input,
                        NormalizedInput = input,
                        Status = IngredientMatchStatus.Matched,
                        MatchedIngredientId = tunaId,
                        MatchedCanonicalName = "Ton Balığı",
                        Confidence = 1
                    };
                }

                return new IngredientNormalizationResult
                {
                    RawInput = input,
                    NormalizedInput = input,
                    Status = IngredientMatchStatus.Unmatched
                };
            });

        var db = CreateDb();
        var sut = new BarcodeIngredientResolutionService(
            db,
            httpClientFactory: new Mock<IHttpClientFactory>().Object,
            normalizationService.Object,
            options: new OpenFoodFactsOptions { Enabled = false },
            logger: NullLogger<BarcodeIngredientResolutionService>.Instance);

        var result = await sut.ResolveProductAsync(new BarcodeProductContext
        {
            Barcode = "8695077001450",
            ProductName = "Derya Tonbalığı",
            Brand = "Derya",
            CategoriesText = null,
            SourceProvider = "open_food_facts"
        });

        result.Candidates.Should().NotBeEmpty();
        result.Candidates[0].IngredientId.Should().Be(tunaId);
        result.Candidates[0].CanonicalName.Should().Be("Ton Balığı");
    }

    [Fact]
    public async Task ResolveProductAsync_WhenProductNameLooksLikeWater_ShouldReturnSuCandidate()
    {
        var waterId = Guid.NewGuid();

        var normalizationService = new Mock<IIngredientNormalizationService>();
        normalizationService
            .Setup(s => s.NormalizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string input, CancellationToken _) =>
            {
                if (string.Equals(input, "su", StringComparison.Ordinal))
                {
                    return new IngredientNormalizationResult
                    {
                        RawInput = input,
                        NormalizedInput = input,
                        Status = IngredientMatchStatus.Matched,
                        MatchedIngredientId = waterId,
                        MatchedCanonicalName = "Su",
                        Confidence = 1
                    };
                }

                return new IngredientNormalizationResult
                {
                    RawInput = input,
                    NormalizedInput = input,
                    Status = IngredientMatchStatus.Unmatched
                };
            });

        var db = CreateDb();
        var sut = new BarcodeIngredientResolutionService(
            db,
            httpClientFactory: new Mock<IHttpClientFactory>().Object,
            normalizationService.Object,
            options: new OpenFoodFactsOptions { Enabled = false },
            logger: NullLogger<BarcodeIngredientResolutionService>.Instance);

        var result = await sut.ResolveProductAsync(new BarcodeProductContext
        {
            Barcode = "8683052622943",
            ProductName = "Erikli Su",
            Brand = "Erikli",
            CategoriesText = "en:waters",
            SourceProvider = "open_food_facts"
        });

        result.Candidates.Should().NotBeEmpty();
        result.Candidates[0].IngredientId.Should().Be(waterId);
        result.Candidates[0].CanonicalName.Should().Be("Su");
    }

    [Fact]
    public async Task ResolveProductAsync_WhenProductNameContainsIngredientOutsideFamilyRules_ShouldUseIngredientNormalization()
    {
        var lentilId = Guid.NewGuid();

        var normalizationService = new Mock<IIngredientNormalizationService>();
        normalizationService
            .Setup(s => s.NormalizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string input, CancellationToken _) =>
            {
                if (string.Equals(input, "kirmizi mercimek", StringComparison.Ordinal))
                {
                    return new IngredientNormalizationResult
                    {
                        RawInput = input,
                        NormalizedInput = input,
                        Status = IngredientMatchStatus.Matched,
                        MatchedBy = IngredientMatchedBy.Alias,
                        MatchedIngredientId = lentilId,
                        MatchedCanonicalName = "Mercimek",
                        Confidence = 0.95
                    };
                }

                return new IngredientNormalizationResult
                {
                    RawInput = input,
                    NormalizedInput = input,
                    Status = IngredientMatchStatus.Unmatched
                };
            });

        var db = CreateDb();
        var sut = new BarcodeIngredientResolutionService(
            db,
            httpClientFactory: new Mock<IHttpClientFactory>().Object,
            normalizationService.Object,
            options: new OpenFoodFactsOptions { Enabled = false },
            logger: NullLogger<BarcodeIngredientResolutionService>.Instance);

        var result = await sut.ResolveProductAsync(new BarcodeProductContext
        {
            Barcode = "8690000001234",
            ProductName = "Acme Kirmizi Mercimek 1000 g",
            Brand = "Acme",
            CategoriesText = null,
            SourceProvider = "open_food_facts"
        });

        result.Candidates.Should().ContainSingle();
        result.Candidates[0].IngredientId.Should().Be(lentilId);
        result.Candidates[0].CanonicalName.Should().Be("Mercimek");
        result.Candidates[0].MappingType.Should().Be(MappingType.ExactIngredient);
        result.Candidates[0].Confidence.Should().Be(0.93d);
    }

    [Fact]
    public async Task ResolveProductAsync_WhenProviderOnlyReturnsBrandText_ShouldRemainUnresolved()
    {
        var normalizationService = new Mock<IIngredientNormalizationService>();
        normalizationService
            .Setup(s => s.NormalizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Brand-only text should not be normalized."));

        var db = CreateDb();
        var sut = new BarcodeIngredientResolutionService(
            db,
            httpClientFactory: new Mock<IHttpClientFactory>().Object,
            normalizationService.Object,
            options: new OpenFoodFactsOptions { Enabled = false },
            logger: NullLogger<BarcodeIngredientResolutionService>.Instance);

        var result = await sut.ResolveProductAsync(new BarcodeProductContext
        {
            Barcode = "8690000005678",
            ProductName = "Derya",
            Brand = "Derya",
            CategoriesText = null,
            SourceProvider = "open_food_facts"
        });

        result.MappingType.Should().Be(MappingType.Unresolved);
        result.Candidates.Should().BeEmpty();
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        return new AppDbContext(options);
    }
}
