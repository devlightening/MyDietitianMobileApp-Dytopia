using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace MyDietitianMobileApp.Api.Tests.Infrastructure;

/// <summary>
/// Minimal WebApplicationFactory for integration tests.
/// Uses the real Program class and default configuration.
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override IHost CreateHost(IHostBuilder builder)
    {
        // For now, use the real host; tests can override configuration if needed later.
        return base.CreateHost(builder);
    }
}

