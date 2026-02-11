using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.Services;

public class PremiumExpirationWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PremiumExpirationWorker> _logger;
    private readonly TimeSpan _interval;

    public PremiumExpirationWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<PremiumExpirationWorker> logger,
        IConfiguration config)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var seconds = config.GetValue<int?>("PremiumLifecycle:ExpirationCheckIntervalSeconds") ?? 300;
        if (seconds < 60) seconds = 60;
        _interval = TimeSpan.FromSeconds(seconds);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PremiumExpirationWorker started with interval {IntervalSeconds}s", _interval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_interval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }

            try
            {
                await ProcessExpirationsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while processing premium expirations");
            }
        }

        _logger.LogInformation("PremiumExpirationWorker stopping");
    }

    private async Task ProcessExpirationsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;

        var expiringClients = await appDb.Clients
            .Where(c => c.ActiveDietitianId != null
                        && c.ProgramEndDate != null
                        && c.ProgramEndDate < now)
            .ToListAsync(ct);

        if (expiringClients.Count == 0)
            return;

        _logger.LogInformation("Processing {Count} premium expirations", expiringClients.Count);

        foreach (var client in expiringClients)
        {
            // Idempotent: if already cleared, skip
            if (client.ActiveDietitianId == null)
                continue;

            var dietitianId = client.ActiveDietitianId;

            // Clear premium state on client
            client.RevokePremium(now);

            // Deactivate any active access keys for this client/dietitian
            var keys = await appDb.AccessKeys
                .Where(k => k.ClientId == client.Id && k.DietitianId == dietitianId && k.IsActive)
                .ToListAsync(ct);

            foreach (var key in keys)
            {
                key.Deactivate();
            }

            // Audit log
            var meta = new
            {
                reason = "ProgramEndDateExpired",
                previousProgramEndDate = client.ProgramEndDate
            };

            var log = new PremiumAuditLog(
                Guid.NewGuid(),
                client.Id,
                dietitianId,
                "Expired",
                now,
                System.Text.Json.JsonSerializer.Serialize(meta));

            appDb.PremiumAuditLogs.Add(log);
        }

        await appDb.SaveChangesAsync(ct);
    }
}

