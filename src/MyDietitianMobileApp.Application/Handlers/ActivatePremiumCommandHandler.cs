using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Handlers;

public class ActivatePremiumCommandHandler : IRequestHandler<ActivatePremiumCommand, ActivatePremiumResult>
{
    private readonly AppDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public ActivatePremiumCommandHandler(AppDbContext context, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<ActivatePremiumResult> Handle(ActivatePremiumCommand request, CancellationToken cancellationToken)
    {
        // Get client ID from JWT
        var clientIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst("clientId")?.Value;
        if (string.IsNullOrEmpty(clientIdClaim) || !Guid.TryParse(clientIdClaim, out var clientId))
        {
            return new ActivatePremiumResult
            {
                Success = false,
                Message = "Yetkilendirme hatası"
            };
        }

        // Find access key
        var accessKey = await _context.AccessKeys
            .FirstOrDefaultAsync(k => k.KeyValue == request.AccessKey, cancellationToken);

        if (accessKey == null)
        {
            return new ActivatePremiumResult
            {
                Success = false,
                Message = "Geçersiz access key"
            };
        }

        // Validate key
        if (!accessKey.IsValid(DateTime.UtcNow))
        {
            return new ActivatePremiumResult
            {
                Success = false,
                Message = "Access key süresi dolmuş veya aktif değil"
            };
        }

        // Get client
        var client = await _context.Clients
            .FirstOrDefaultAsync(c => c.Id == clientId, cancellationToken);

        if (client == null)
        {
            return new ActivatePremiumResult
            {
                Success = false,
                Message = "Client bulunamadı"
            };
        }

        // Activate premium
        client.ActivatePremium(
            accessKey.DietitianId,
            accessKey.CreatedAtUtc,
            accessKey.ExpiresAtUtc
        );

        // Mark key as used
        accessKey.MarkAsActivated();

        await _context.SaveChangesAsync(cancellationToken);

        // Get dietitian info
        var dietitian = await _context.Dietitians
            .FirstOrDefaultAsync(d => d.Id == accessKey.DietitianId, cancellationToken);

        return new ActivatePremiumResult
        {
            Success = true,
            Message = "Premium aktivasyonu başarılı! Artık diyet planınıza erişebilirsiniz.",
            DietitianId = accessKey.DietitianId,
            DietitianName = dietitian?.FullName ?? "Diyetisyen",
            ProgramStartDate = accessKey.CreatedAtUtc,
            ProgramEndDate = accessKey.ExpiresAtUtc
        };
    }
}
