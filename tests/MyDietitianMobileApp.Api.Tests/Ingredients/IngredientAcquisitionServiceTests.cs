using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Ingredients;

public sealed class IngredientAcquisitionServiceTests
{
    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static IIngredientNormalizationService CreateNormalizationService(AppDbContext db)
        => new IngredientNormalizationService(
            db,
            new NullIngredientLlmClient(),
            new IngredientLlmCandidateBuilder(db, new LlmNormalizationOptions()),
            new LlmNormalizationOptions());

    private static async Task<(Ingredient Tomato, Ingredient Tuna)> SeedIngredientsAsync(AppDbContext db)
    {
        var tomato = new Ingredient(Guid.NewGuid(), "Tomato");
        tomato.AddAlias("Domates");

        var tuna = new Ingredient(Guid.NewGuid(), "Tuna");
        tuna.AddAlias("Ton Baligi");

        db.Ingredients.AddRange(tomato, tuna);
        await db.SaveChangesAsync();
        return (tomato, tuna);
    }

    [Fact]
    public async Task LogAsync_WithMultipleSelections_PersistsOneRowPerResolvedIngredient()
    {
        await using var db = CreateDbContext();
        var (tomato, tuna) = await SeedIngredientsAsync(db);
        var service = new IngredientAcquisitionService(db);
        var sessionId = Guid.NewGuid();

        var logId = await service.LogAsync(new IngredientAcquisitionLogRequest
        {
            SessionId = sessionId,
            Source = AcquisitionSource.Vision,
            RawInput = "domates ve ton baligi",
            SelectedIngredients =
            [
                new IngredientAcquisitionSelection
                {
                    IngredientId = tomato.Id,
                    MappingType = MappingType.ExactIngredient,
                    Confidence = 0.93d
                },
                new IngredientAcquisitionSelection
                {
                    IngredientId = tuna.Id,
                    MappingType = MappingType.ExactIngredient,
                    Confidence = 0.88d
                }
            ],
            MappingType = MappingType.ExactIngredient,
            RequiredConfirmation = true,
            ConfirmedByUser = true,
            InteractionCount = 2,
            LatencyMs = 1400,
            StartedAtUtc = DateTime.UtcNow.AddSeconds(-2)
        });

        logId.Should().NotBeEmpty();

        var logs = await db.IngredientAcquisitionLogs
            .AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .OrderBy(x => x.CreatedAtUtc)
            .ToListAsync();

        logs.Should().HaveCount(2);
        logs.Select(x => x.ResolvedIngredientId).Should().BeEquivalentTo([tomato.Id, tuna.Id]);
        logs.Should().OnlyContain(x => x.Source == AcquisitionSource.Vision);
        logs.Should().OnlyContain(x => x.RequiredConfirmation);
    }

    [Fact]
    public async Task LogAsync_WithConfirmedBarcodeSelection_UpsertsManualOverrideMapping()
    {
        await using var db = CreateDbContext();
        var (_, tuna) = await SeedIngredientsAsync(db);
        var service = new IngredientAcquisitionService(db);

        await service.LogAsync(new IngredientAcquisitionLogRequest
        {
            SessionId = Guid.NewGuid(),
            Source = AcquisitionSource.Barcode,
            RawInput = "869000000001",
            ProductName = "Ton Baligi Konservesi",
            Brand = "Acme",
            SelectedIngredients =
            [
                new IngredientAcquisitionSelection
                {
                    IngredientId = tuna.Id,
                    MappingType = MappingType.IngredientFamily,
                    Confidence = 0.94d
                }
            ],
            MappingType = MappingType.IngredientFamily,
            RequiredConfirmation = false,
            ConfirmedByUser = true,
            InteractionCount = 1,
            LatencyMs = 320,
            StartedAtUtc = DateTime.UtcNow.AddMilliseconds(-320)
        });

        var mapping = await db.ProductBarcodeMappings.SingleAsync(x => x.Barcode == "869000000001");
        mapping.CanonicalIngredientId.Should().Be(tuna.Id);
        mapping.MappingType.Should().Be(MappingType.IngredientFamily);
        mapping.IsManualOverride.Should().BeTrue();
        mapping.SourceProvider.Should().Be("manual_override");
    }

    [Fact]
    public async Task ResolveAsync_WithSeededBarcodeCache_ReturnsExactIngredientFromLocalCache()
    {
        await using var db = CreateDbContext();
        var (_, tuna) = await SeedIngredientsAsync(db);

        db.ProductBarcodeMappings.Add(new ProductBarcodeMapping(
            Guid.NewGuid(),
            barcode: "869000000099",
            productName: "Tuna",
            brand: "Acme",
            canonicalIngredientId: tuna.Id,
            mappingType: MappingType.ExactIngredient,
            confidence: 0.95d,
            sourceProvider: "seed_cache",
            isManualOverride: false,
            lastVerifiedAtUtc: DateTime.UtcNow));

        await db.SaveChangesAsync();

        var service = new BarcodeIngredientResolutionService(
            db,
            new StaticHttpClientFactory(),
            CreateNormalizationService(db),
            new OpenFoodFactsOptions { Enabled = false },
            NullLogger<BarcodeIngredientResolutionService>.Instance);

        var result = await service.ResolveAsync("869000000099");

        result.Candidates.Should().ContainSingle();
        result.Candidates[0].IngredientId.Should().Be(tuna.Id);
        result.Candidates[0].CanonicalName.Should().Be("Tuna");
        result.MappingType.Should().Be(MappingType.ExactIngredient);
        result.RequiresConfirmation.Should().BeFalse();
        result.SourceProvider.Should().Be("local_cache");
    }

    private sealed class StaticHttpClientFactory : IHttpClientFactory
    {
        private static readonly HttpClient Client = new();

        public HttpClient CreateClient(string name) => Client;
    }
}
