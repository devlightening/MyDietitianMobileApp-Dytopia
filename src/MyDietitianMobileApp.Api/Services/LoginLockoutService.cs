using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;

namespace MyDietitianMobileApp.Api.Services;

public interface ILoginLockoutService
{
    Task<bool> IsLockedOutAsync(string email, CancellationToken cancellationToken = default);
    Task RegisterFailureAsync(string email, CancellationToken cancellationToken = default);
    Task ResetAsync(string email, CancellationToken cancellationToken = default);
}

public class LoginLockoutService : ILoginLockoutService
{
    private class LockoutState
    {
        public int FailedCount { get; set; }
        public DateTimeOffset? LockedUntilUtc { get; set; }
    }

    private readonly IDistributedCache _cache;
    private readonly byte[] _secretKey;

    private const int MaxFailures = 10;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan UnlockedStateTtl = TimeSpan.FromHours(1);

    public LoginLockoutService(IDistributedCache cache, IConfiguration config)
    {
        _cache = cache;

        var secret = config["AuthSecurity:LockoutKeySecret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("AuthSecurity:LockoutKeySecret is not configured.");
        }

        _secretKey = Encoding.UTF8.GetBytes(secret);
    }

    public async Task<bool> IsLockedOutAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;

        var key = BuildKey(email);
        var json = await _cache.GetStringAsync(key, cancellationToken);
        if (string.IsNullOrWhiteSpace(json))
            return false;

        var state = System.Text.Json.JsonSerializer.Deserialize<LockoutState>(json) ?? new LockoutState();

        if (state.LockedUntilUtc is { } until && until > DateTimeOffset.UtcNow)
        {
            return true;
        }

        // If lockout expired, clear state
        if (state.LockedUntilUtc is { } expired && expired <= DateTimeOffset.UtcNow)
        {
            await _cache.RemoveAsync(key, cancellationToken);
        }

        return false;
    }

    public async Task RegisterFailureAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
            return;

        var key = BuildKey(email);
        var json = await _cache.GetStringAsync(key, cancellationToken);
        var state = string.IsNullOrWhiteSpace(json)
            ? new LockoutState()
            : (System.Text.Json.JsonSerializer.Deserialize<LockoutState>(json) ?? new LockoutState());

        state.FailedCount++;
        if (state.FailedCount >= MaxFailures)
        {
            state.LockedUntilUtc = DateTimeOffset.UtcNow.Add(LockoutDuration);
        }

        var ttl = state.LockedUntilUtc.HasValue
            ? (state.LockedUntilUtc.Value - DateTimeOffset.UtcNow) + TimeSpan.FromMinutes(1)
            : UnlockedStateTtl;

        if (ttl <= TimeSpan.Zero)
            ttl = UnlockedStateTtl;

        var updatedJson = System.Text.Json.JsonSerializer.Serialize(state);
        await _cache.SetStringAsync(key, updatedJson, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = ttl
        }, cancellationToken);
    }

    public Task ResetAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
            return Task.CompletedTask;

        var key = BuildKey(email);
        return _cache.RemoveAsync(key, cancellationToken);
    }

    private string BuildKey(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        using var hmac = new HMACSHA256(_secretKey);
        var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(normalized));
        var hash = Convert.ToHexString(bytes);
        return $"lockout:{hash}";
    }
}

