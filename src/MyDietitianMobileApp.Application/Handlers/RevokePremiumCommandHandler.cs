using MediatR;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Handlers;

public class RevokePremiumCommandHandler : IRequestHandler<RevokePremiumCommand, RevokePremiumResult>
{
    private readonly AppDbContext _context;

    public RevokePremiumCommandHandler(AppDbContext context)
    {
        _context = context;
    }

    public async Task<RevokePremiumResult> Handle(RevokePremiumCommand request, CancellationToken cancellationToken)
    {
        // IDOR guard is performed in controller by scoping DietitianId to current user.
        // Here we enforce domain invariants and transactional consistency.
        var now = DateTime.UtcNow;

        await using var tx = await _context.Database.BeginTransactionAsync(cancellationToken);

        var link = await _context.DietitianClientLinks
            .Include(l => l.Client)
            .FirstOrDefaultAsync(
                l => l.DietitianId == request.DietitianId &&
                     l.ClientId == request.ClientId &&
                     l.IsActive,
                cancellationToken);

        if (link == null)
        {
            return new RevokePremiumResult
            {
                Success = false,
                ClientId = request.ClientId,
                RevokedAtUtc = now,
                WasPremium = false,
                ErrorCode = "LINK_NOT_FOUND",
                ErrorMessage = "Active premium link bulunamadı veya erişim yetkiniz yok."
            };
        }

        var client = link.Client;
        var wasPremium = client.IsPremium;

        // Deactivate link
        link.Deactivate();

        // Deactivate all active access keys for this dietitian+client pair
        var activeKeys = await _context.AccessKeys
            .Where(k => k.DietitianId == request.DietitianId &&
                        k.ClientId == request.ClientId &&
                        k.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var key in activeKeys)
        {
            key.Deactivate();
        }

        // Update client premium state
        client.RevokePremium(now);

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return new RevokePremiumResult
        {
            Success = true,
            ClientId = client.Id,
            RevokedAtUtc = now,
            WasPremium = wasPremium,
            ErrorCode = null,
            ErrorMessage = null
        };
    }
}

