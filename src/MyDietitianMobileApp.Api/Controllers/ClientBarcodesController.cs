using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Controllers.Barcodes;

[ApiController]
[Route("api/client/barcodes")]
[Authorize(Policy = "Client")]
public sealed class ClientBarcodesController : ControllerBase
{
    private const double AutoMapThreshold = 0.80d;
    private static readonly Regex BarcodePattern = new("^[A-Za-z0-9-]{1,64}$", RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly IBarcodeIngredientResolutionService _resolver;

    public ClientBarcodesController(
        AppDbContext db,
        IBarcodeIngredientResolutionService resolver)
    {
        _db = db;
        _resolver = resolver;
    }

    [HttpPost("resolve")]
    public async Task<ActionResult<BarcodeResolveResponse>> Resolve(
        [FromBody] ResolveBarcodeRequest request,
        CancellationToken cancellationToken)
    {
        var validation = NormalizeBarcode(request.Barcode);
        if (validation.Error is not null)
        {
            return BadRequest(new { error = validation.Error });
        }

        var barcode = validation.Barcode!;
        var local = await _db.ProductBarcodeMappings
            .Include(x => x.CanonicalIngredient)
            .FirstOrDefaultAsync(x => x.Barcode == barcode, cancellationToken);

        if (local is not null)
        {
            Touch(local);
            await _db.SaveChangesAsync(cancellationToken);
            return Ok(ToLocalResponse(local));
        }

        var resolved = await _resolver.ResolveAsync(barcode, cancellationToken);
        var best = resolved.Candidates
            .OrderByDescending(x => x.Confidence)
            .FirstOrDefault();

        if (best is not null &&
            best.Confidence >= AutoMapThreshold &&
            best.MappingType is not MappingType.CompositeProduct and not MappingType.Unresolved)
        {
            return Ok(new BarcodeResolveResponse(
                Barcode: barcode,
                Found: true,
                Source: MapSource(resolved.SourceProvider),
                ProductName: resolved.ProductName,
                Brand: resolved.Brand,
                CanonicalIngredientId: best.IngredientId,
                CanonicalIngredientName: best.CanonicalName,
                Confidence: ToDecimal(best.Confidence),
                RequiresManualMapping: false,
                Message: resolved.SourceProvider == "open_food_facts"
                    ? "Ürün Open Food Facts üzerinden bulundu ve malzeme eşleştirildi."
                    : "Barkod çözümlendi ve malzeme eşleştirildi."));
        }

        var source = resolved.SourceProvider is "not_found" or "validation"
            ? null
            : MapSource(resolved.SourceProvider);

        return Ok(new BarcodeResolveResponse(
            Barcode: barcode,
            Found: false,
            Source: source,
            ProductName: resolved.ProductName,
            Brand: resolved.Brand,
            CanonicalIngredientId: null,
            CanonicalIngredientName: null,
            Confidence: resolved.Confidence > 0 ? ToDecimal(resolved.Confidence) : null,
            RequiresManualMapping: true,
            Message: source == "open_food_facts"
                ? "Ürün bulundu ancak hangi malzemeye karşılık geldiği net değil."
                : "Bu barkod tanınamadı. Lütfen malzemeyi manuel seçin."));
    }

    [HttpPost("confirm-mapping")]
    public async Task<ActionResult<BarcodeResolveResponse>> ConfirmMapping(
        [FromBody] ConfirmBarcodeMappingRequest request,
        CancellationToken cancellationToken)
    {
        var validation = NormalizeBarcode(request.Barcode);
        if (validation.Error is not null)
        {
            return BadRequest(new { error = validation.Error });
        }

        var ingredient = await _db.Ingredients
            .FirstOrDefaultAsync(x => x.Id == request.IngredientId && x.IsActive, cancellationToken);

        if (ingredient is null)
        {
            return NotFound(new { error = "Malzeme bulunamadı." });
        }

        var barcode = validation.Barcode!;
        var mapping = await _db.ProductBarcodeMappings
            .FirstOrDefaultAsync(x => x.Barcode == barcode, cancellationToken);

        if (mapping is null)
        {
            mapping = new ProductBarcodeMapping(
                Guid.NewGuid(),
                barcode,
                request.ProductName ?? barcode,
                request.Brand,
                ingredient.Id,
                MappingType.ExactIngredient,
                1.0d,
                sourceProvider: "manual",
                isManualOverride: true,
                lastVerifiedAtUtc: DateTime.UtcNow);

            _db.ProductBarcodeMappings.Add(mapping);
        }
        else
        {
            mapping.UpdateResolution(
                request.ProductName ?? mapping.ProductName,
                request.Brand ?? mapping.Brand,
                ingredient.Id,
                MappingType.ExactIngredient,
                1.0d,
                sourceProvider: "manual",
                isManualOverride: true,
                lastVerifiedAtUtc: DateTime.UtcNow);
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(new BarcodeResolveResponse(
            Barcode: barcode,
            Found: true,
            Source: "manual",
            ProductName: mapping.ProductName,
            Brand: mapping.Brand,
            CanonicalIngredientId: ingredient.Id,
            CanonicalIngredientName: ingredient.CanonicalName,
            Confidence: 1.0m,
            RequiresManualMapping: false,
            Message: $"Bu barkod artık {ingredient.CanonicalName} olarak kaydedildi."));
    }

    private static BarcodeResolveResponse ToLocalResponse(ProductBarcodeMapping mapping)
    {
        if (mapping.CanonicalIngredient is { IsActive: true } ingredient)
        {
            return new BarcodeResolveResponse(
                Barcode: mapping.Barcode,
                Found: true,
                Source: "local",
                ProductName: mapping.ProductName,
                Brand: mapping.Brand,
                CanonicalIngredientId: ingredient.Id,
                CanonicalIngredientName: ingredient.CanonicalName,
                Confidence: ToDecimal(mapping.Confidence),
                RequiresManualMapping: false,
                Message: "Barkod local veritabanında bulundu.");
        }

        return new BarcodeResolveResponse(
            Barcode: mapping.Barcode,
            Found: false,
            Source: "local",
            ProductName: mapping.ProductName,
            Brand: mapping.Brand,
            CanonicalIngredientId: null,
            CanonicalIngredientName: null,
            Confidence: ToDecimal(mapping.Confidence),
            RequiresManualMapping: true,
            Message: "Ürün local veritabanında bulundu ancak hangi malzemeye karşılık geldiği net değil.");
    }

    private static void Touch(ProductBarcodeMapping mapping)
    {
        mapping.UpdateResolution(
            mapping.ProductName,
            mapping.Brand,
            mapping.CanonicalIngredientId,
            mapping.MappingType,
            mapping.Confidence,
            mapping.SourceProvider,
            mapping.IsManualOverride,
            DateTime.UtcNow);
    }

    private static (string? Barcode, string? Error) NormalizeBarcode(string? barcode)
    {
        var normalized = barcode?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return (null, "barcode alanı boş olamaz.");
        }

        if (!BarcodePattern.IsMatch(normalized))
        {
            return (null, "barcode en fazla 64 karakter olmalı ve yalnızca harf, rakam veya tire içermelidir.");
        }

        return (normalized, null);
    }

    private static string? MapSource(string? sourceProvider)
        => sourceProvider switch
        {
            "local_cache" => "local",
            "open_food_facts" => "open_food_facts",
            "manual" or "manual_override" => "manual",
            "known_barcode" => "rule",
            "not_found" or "validation" or null => null,
            _ => sourceProvider,
        };

    private static decimal ToDecimal(double value)
        => decimal.Round((decimal)Math.Clamp(value, 0d, 1d), 4);
}

public sealed record ResolveBarcodeRequest(string Barcode);

public sealed record BarcodeResolveResponse(
    string Barcode,
    bool Found,
    string? Source,
    string? ProductName,
    string? Brand,
    Guid? CanonicalIngredientId,
    string? CanonicalIngredientName,
    decimal? Confidence,
    bool RequiresManualMapping,
    string? Message);

public sealed record ConfirmBarcodeMappingRequest(
    string Barcode,
    Guid IngredientId,
    string? ProductName,
    string? Brand);
