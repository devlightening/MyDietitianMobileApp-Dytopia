using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Api.SmokeTests.Infrastructure;

/// <summary>
/// WebApplicationFactory configured for smoke tests.
/// Uses in-memory SQLite for both AppDbContext and AuthDbContext
/// and injects minimal configuration (connection strings, JWT settings).
/// </summary>
public class SmokeWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _appConnection;
    private readonly SqliteConnection _authConnection;

    public SmokeWebApplicationFactory()
    {
        _appConnection = new SqliteConnection("DataSource=:memory:");
        _appConnection.Open();

        _authConnection = new SqliteConnection("DataSource=:memory:");
        _authConnection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Use a dedicated Testing environment so Program.cs can relax certain configs (e.g. JWT) for smoke tests
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, configBuilder) =>
        {
            var inMemorySettings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:AppDb"] = "Host=localhost;Database=SmokeTest_AppDb;Username=ignored;Password=ignored",
                ["ConnectionStrings:AuthDb"] = "Host=localhost;Database=SmokeTest_AuthDb;Username=ignored;Password=ignored",
                ["Jwt:SecretKey"] = "SmokeTests_Secret_Key_1234567890",
                ["Jwt:Secret"] = "SmokeTests_Secret_Key_1234567890",
                ["Jwt:Issuer"] = "SmokeTests",
                ["Jwt:Audience"] = "SmokeTestsAudience",
                ["Jwt:ExpiresMinutes"] = "60",
                ["PremiumExpirationWorker:Enabled"] = "false"
            };

            configBuilder.AddInMemoryCollection(inMemorySettings);
        });

        builder.ConfigureServices(services =>
        {
            // Replace AppDbContext and AuthDbContext with SQLite in-memory versions
            var appDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (appDescriptor != null)
            {
                services.Remove(appDescriptor);
            }

            var authDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<AuthDbContext>));
            if (authDescriptor != null)
            {
                services.Remove(authDescriptor);
            }

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlite(_appConnection);
            });

            services.AddDbContext<AuthDbContext>(options =>
            {
                options.UseSqlite(_authConnection);
            });

            // Build provider to create databases
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

            appDb.Database.EnsureCreated();
            authDb.Database.EnsureCreated();
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing)
        {
            _appConnection.Dispose();
            _authConnection.Dispose();
        }
    }

    public HttpClient CreateDefaultClient() => CreateClient(new()
    {
        AllowAutoRedirect = false
    });
}

