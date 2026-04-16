using Microsoft.AspNetCore.SignalR;

namespace MyDietitianMobileApp.Api.Realtime;

public sealed class SyncEventPublisher : ISyncEventPublisher
{
    private readonly IHubContext<SyncHub> _hubContext;

    public SyncEventPublisher(IHubContext<SyncHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public Task PublishToDietitianAsync(Guid dietitianId, string eventType, object? payload = null, CancellationToken cancellationToken = default)
    {
        return PublishToGroupsAsync(new[] { SyncHub.GroupNames.Dietitian(dietitianId) }, eventType, payload, cancellationToken);
    }

    public Task PublishToClientAsync(Guid clientId, string eventType, object? payload = null, CancellationToken cancellationToken = default)
    {
        return PublishToGroupsAsync(new[] { SyncHub.GroupNames.Client(clientId) }, eventType, payload, cancellationToken);
    }

    public Task PublishToLinkAsync(Guid dietitianId, Guid clientId, string eventType, object? payload = null, CancellationToken cancellationToken = default)
    {
        return PublishToGroupsAsync(
            new[]
            {
            SyncHub.GroupNames.Dietitian(dietitianId),
            SyncHub.GroupNames.Client(clientId),
            SyncHub.GroupNames.Link(dietitianId, clientId),
            },
            eventType,
            payload,
            cancellationToken);
    }

    private Task PublishToGroupsAsync(IEnumerable<string> groups, string eventType, object? payload, CancellationToken cancellationToken)
    {
        var envelope = new
        {
            eventType,
            occurredAtUtc = DateTime.UtcNow,
            payload
        };

        return Task.WhenAll(groups.Distinct().Select(group => _hubContext.Clients.Group(group).SendAsync("sync.event", envelope, cancellationToken)));
    }
}
