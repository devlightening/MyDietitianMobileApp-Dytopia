using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Services;

public class ClientActivityWriter : IClientActivityWriter
{
    private readonly AppDbContext _appDb;

    public ClientActivityWriter(AppDbContext appDb)
    {
        _appDb = appDb;
    }

    public async Task WriteAsync(Guid clientId, Guid? dietitianId, string type, object? metadata = null)
    {
        if (string.IsNullOrWhiteSpace(type) || type.Length > 60)
            throw new ArgumentException("Activity type must be non-empty and max 60 characters", nameof(type));

        var activity = new ClientActivity(clientId, dietitianId, type, metadata);
        _appDb.ClientActivities.Add(activity);
        await _appDb.SaveChangesAsync();
    }
}
