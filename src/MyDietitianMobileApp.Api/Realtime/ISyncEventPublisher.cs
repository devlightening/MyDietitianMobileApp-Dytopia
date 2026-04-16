namespace MyDietitianMobileApp.Api.Realtime;

public interface ISyncEventPublisher
{
    Task PublishToDietitianAsync(Guid dietitianId, string eventType, object? payload = null, CancellationToken cancellationToken = default);
    Task PublishToClientAsync(Guid clientId, string eventType, object? payload = null, CancellationToken cancellationToken = default);
    Task PublishToLinkAsync(Guid dietitianId, Guid clientId, string eventType, object? payload = null, CancellationToken cancellationToken = default);
}
