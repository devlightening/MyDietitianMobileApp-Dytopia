using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Enums;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.SmokeTests.Infrastructure;

/// <summary>
/// Seeds initial data for smoke tests:
/// - 2 dietitians (+ user accounts)
/// - 2 clients linked to dietitians
/// - 1 free client
/// </summary>
public static class SmokeTestSeeder
{
    public static async Task EnsureSeededAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

        // Idempotent: if our smoke users already exist, do nothing
        if (await authDb.UserAccounts.AnyAsync(u => u.Email.EndsWith("@smoke.local")))
            return;

        var passwordHasher = new PasswordHasherService();

        // Dietitians
        var dietitian1 = new MyDietitianMobileApp.Domain.Entities.Dietitian(Guid.NewGuid(), "Smoke Dietitian One", "Smoke Clinic One", true);
        var dietitian2 = new MyDietitianMobileApp.Domain.Entities.Dietitian(Guid.NewGuid(), "Smoke Dietitian Two", "Smoke Clinic Two", true);

        appDb.Dietitians.AddRange(dietitian1, dietitian2);

        // Clients
        var birthDate = new DateOnly(1990, 1, 1);
        var client1 = new Client(Guid.NewGuid(), "Smoke Client One", "client1@example.com", Gender.Male, birthDate);
        var client2 = new Client(Guid.NewGuid(), "Smoke Client Two", "client2@example.com", Gender.Female, birthDate);
        var freeClient = new Client(Guid.NewGuid(), "Smoke Free Client", "freeclient@example.com", Gender.Male, birthDate);

        appDb.Clients.AddRange(client1, client2, freeClient);

        await appDb.SaveChangesAsync();

        // Links: client1 -> dietitian1, client2 -> dietitian1 (DietitianA sees 2 clients)
        var link1 = new DietitianClientLink(dietitian1.Id, client1.Id, "SMOKE-PUBLIC-1");
        var link2 = new DietitianClientLink(dietitian1.Id, client2.Id, "SMOKE-PUBLIC-2");

        appDb.DietitianClientLinks.AddRange(link1, link2);
        await appDb.SaveChangesAsync();

        // User accounts
        var d1User = new UserAccount
        {
            Id = Guid.NewGuid(),
            Email = "dietitian1@smoke.local",
            Role = "Dietitian",
            LinkedDietitianId = dietitian1.Id,
            PasswordHash = passwordHasher.HashPassword("SmokeTest1!")
        };

        var d2User = new UserAccount
        {
            Id = Guid.NewGuid(),
            Email = "dietitian2@smoke.local",
            Role = "Dietitian",
            LinkedDietitianId = dietitian2.Id,
            PasswordHash = passwordHasher.HashPassword("SmokeTest2!")
        };

        var c1User = new UserAccount
        {
            Id = Guid.NewGuid(),
            Email = "client1@smoke.local",
            Role = "Client",
            LinkedClientId = client1.Id,
            PasswordHash = passwordHasher.HashPassword("SmokeClient1!")
        };

        var c2User = new UserAccount
        {
            Id = Guid.NewGuid(),
            Email = "client2@smoke.local",
            Role = "Client",
            LinkedClientId = client2.Id,
            PasswordHash = passwordHasher.HashPassword("SmokeClient2!")
        };

        var freeUser = new UserAccount
        {
            Id = Guid.NewGuid(),
            Email = "freeclient@smoke.local",
            Role = "Client",
            LinkedClientId = freeClient.Id,
            PasswordHash = passwordHasher.HashPassword("SmokeFree1!")
        };

        authDb.UserAccounts.AddRange(d1User, d2User, c1User, c2User, freeUser);
        await authDb.SaveChangesAsync();
    }
}

