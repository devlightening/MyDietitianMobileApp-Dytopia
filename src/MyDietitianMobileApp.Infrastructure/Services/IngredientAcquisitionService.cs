using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Infrastructure.Services;

public sealed class IngredientAcquisitionService : IIngredientAcquisitionService
{
    private readonly AppDbContext _db;

    public IngredientAcquisitionService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Guid> LogAsync(
        IngredientAcquisitionLogRequest request,
        CancellationToken cancellationToken = default)
    {
        var completedAtUtc = request.CompletedAtUtc ?? DateTime.UtcNow;
        var sessionId = request.SessionId == Guid.Empty ? Guid.NewGuid() : request.SessionId;
        var rawInput = request.RawInput.Trim();
        var selections = request.SelectedIngredients.Any()
            ? request.SelectedIngredients
            : [new IngredientAcquisitionSelection
                {
                    IngredientId = Guid.Empty,
                    MappingType = request.MappingType,
                    Confidence = 0d
                }];

        Guid? firstLogId = null;

        foreach (var selection in selections)
        {
            var log = new IngredientAcquisitionLog(
                id: Guid.NewGuid(),
                sessionId: sessionId,
                source: request.Source,
                rawInput: rawInput,
                resolvedIngredientId: selection.IngredientId == Guid.Empty ? null : selection.IngredientId,
                mappingType: selection.MappingType,
                confidence: selection.Confidence,
                requiredConfirmation: request.RequiredConfirmation,
                confirmedByUser: request.ConfirmedByUser,
                interactionCount: request.InteractionCount,
                latencyMs: request.LatencyMs,
                startedAtUtc: request.StartedAtUtc == default ? completedAtUtc : request.StartedAtUtc,
                completedAtUtc: completedAtUtc);

            firstLogId ??= log.Id;
            _db.IngredientAcquisitionLogs.Add(log);
        }

        if (request.Source == AcquisitionSource.Barcode &&
            request.ConfirmedByUser &&
            !string.IsNullOrWhiteSpace(rawInput) &&
            request.SelectedIngredients.Count > 0)
        {
            await UpsertBarcodeMappingAsync(request, cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return firstLogId ?? Guid.Empty;
    }

    private async Task UpsertBarcodeMappingAsync(
        IngredientAcquisitionLogRequest request,
        CancellationToken cancellationToken)
    {
        var selection = request.SelectedIngredients.First();
        var barcode = request.RawInput.Trim();
        var existing = await _db.ProductBarcodeMappings
            .FirstOrDefaultAsync(m => m.Barcode == barcode, cancellationToken);

        if (existing is null)
        {
            var mapping = new ProductBarcodeMapping(
                Guid.NewGuid(),
                barcode,
                request.ProductName ?? barcode,
                request.Brand,
                selection.IngredientId,
                selection.MappingType,
                selection.Confidence,
                sourceProvider: "manual_override",
                isManualOverride: true,
                lastVerifiedAtUtc: DateTime.UtcNow);

            _db.ProductBarcodeMappings.Add(mapping);
            return;
        }

        existing.UpdateResolution(
            request.ProductName ?? existing.ProductName,
            request.Brand,
            selection.IngredientId,
            selection.MappingType,
            selection.Confidence,
            sourceProvider: "manual_override",
            isManualOverride: true,
            lastVerifiedAtUtc: DateTime.UtcNow);
    }
}
