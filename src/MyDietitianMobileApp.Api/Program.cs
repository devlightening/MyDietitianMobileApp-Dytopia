using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Application.Handlers;
using MyDietitianMobileApp.Application.Queries;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Api.Middleware;
using MyDietitianMobileApp.Api.Services;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Npgsql;
using System.Text;
using System.Threading.RateLimiting;
using System.Threading.Tasks;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MediatR;
using MyDietitianMobileApp.Domain.Interfaces;
using MyDietitianMobileApp.Infrastructure.Repositories;
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(args);

// ====================
// NETWORK CONFIGURATION
// ====================
builder.WebHost.UseUrls("http://0.0.0.0:5000", "https://0.0.0.0:7154");

// ====================
// CONTROLLERS & API
// ====================
// AG-DASH-FIX-15: Ensure all controllers are discovered
builder.Services.AddControllers()
    .AddApplicationPart(typeof(MyDietitianMobileApp.Api.Controllers.DashboardController).Assembly);
builder.Services.AddEndpointsApiExplorer();

// ====================
// SWAGGER
// ====================
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "MyDietitian API",
        Version = "v1",
        Description = "Professional Dietitian-Client Management Platform"
    });

    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme (Example: 'Bearer 12345abcdef')",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ====================
// DATABASE CONTEXTS
// ====================
var appDbConnection = builder.Configuration.GetConnectionString("AppDb") 
    ?? throw new InvalidOperationException("Connection string 'AppDb' missing");
var authDbConnection = builder.Configuration.GetConnectionString("AuthDb")
    ?? throw new InvalidOperationException("Connection string 'AuthDb' missing");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(appDbConnection)
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment()));

builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(authDbConnection)
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment()));

// ====================
// SERVICES
// ====================
builder.Services.AddScoped<PasswordHasherService>();
builder.Services.AddScoped<IHealthCalculationService, HealthCalculationService>();
builder.Services.AddScoped<IPremiumStatusService, PremiumStatusService>();
builder.Services.AddScoped<IAlternativeMealDecisionService, AlternativeMealDecisionService>();
builder.Services.AddScoped<IComplianceCalculationService, ComplianceCalculationService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IIngredientRepository, IngredientRepository>();
builder.Services.AddScoped<IRecipeRepository, RecipeRepository>();
builder.Services.AddScoped<IDietitianRepository, DietitianRepository>();
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<ILoginLockoutService, LoginLockoutService>();

// ====================
// ASP.NET CORE SERVICES
// ====================
builder.Services.AddHttpContextAccessor();

// ====================
// DISTRIBUTED CACHE (Lockout / rate limiting metadata)
// ====================
var redisConnection = builder.Configuration.GetConnectionString("Redis");
if (!string.IsNullOrWhiteSpace(redisConnection))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnection;
        options.InstanceName = "MyDietitian:";
    });
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

// ====================
// MediatR (CQRS)
// ====================
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(typeof(CreateRecipeCommand).Assembly));

// ====================
// CORS
// ====================
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// ====================
// RATE LIMITING
// ====================
builder.Services.AddRateLimiter(options =>
{
    // Auth endpoints: IP-based sliding window
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromSeconds(10),
                SegmentsPerWindow = 2,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Access key generation: per-dietitian focused throttling
    options.AddPolicy("keygen", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"keygen:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(10),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });

    // Pantry operations: per-client throttling
    options.AddPolicy("pantry", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"pantry:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/problem+json";

        var problem = MyDietitianMobileApp.Api.Problems.ApiProblems
            .TooManyRequests("RATE_LIMITED", "Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.");

        await context.HttpContext.Response.WriteAsJsonAsync(problem, cancellationToken: token);
    };
});

// ====================
// JWT AUTHENTICATION
// ====================
var jwtSecret = builder.Configuration["Jwt:SecretKey"] 
    ?? throw new InvalidOperationException("JWT Secret missing");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "MyDietitian.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "MyDietitian.Mobile";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // CRITICAL: Disable inbound claim mapping to prevent "sub" from being remapped to "nameidentifier"
        options.MapInboundClaims = false;
        
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            NameClaimType = "sub",
            RoleClaimType = "role"
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Cookies.TryGetValue("access_token", out var token))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Dietitian", policy => policy.RequireRole("Dietitian"));
    options.AddPolicy("Client", policy => policy.RequireRole("Client"));
    options.AddPolicy("Admin", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim(ClaimTypes.Role, "Admin");
    });
    
    // Premium client policy - requires authenticated client with active premium subscription
    options.AddPolicy("RequirePremiumClient", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("Client");
        // Premium check is done in controller/middleware by querying client state
    });
});

// Standardize 401/403 responses as ProblemDetails
builder.Services.AddSingleton<IAuthorizationMiddlewareResultHandler, ProblemDetailsAuthorizationMiddlewareResultHandler>();

var app = builder.Build();

// ====================
// DATABASE CONNECTIVITY CHECK
// ====================
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (await appDb.Database.CanConnectAsync())
            logger.LogInformation("✅ Successfully connected to PostgreSQL database (AppDbContext)");

        var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        if (await authDb.Database.CanConnectAsync())
            logger.LogInformation("✅ Successfully connected to PostgreSQL database (AuthDbContext)");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Database connection failed");
        throw;
    }
}

// ====================
// ONE-TIME DATA FIXES (IDEMPOTENT)
// ====================
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

    // Backfill missing PublicUserId values on DietitianClientLinks and associated UserAccounts
    var linksWithoutPublicId = await appDb.DietitianClientLinks
        .Where(l => string.IsNullOrWhiteSpace(l.PublicUserId))
        .ToListAsync();

    if (linksWithoutPublicId.Any())
    {
        logger.LogInformation("Backfilling PublicUserId for {Count} dietitian-client links", linksWithoutPublicId.Count);

        foreach (var link in linksWithoutPublicId)
        {
            var userAccount = await authDb.UserAccounts
                .FirstOrDefaultAsync(u => u.LinkedClientId == link.ClientId);

            string publicUserId;

            if (userAccount != null && !string.IsNullOrWhiteSpace(userAccount.PublicUserId))
            {
                publicUserId = userAccount.PublicUserId;
            }
            else
            {
                // Generate unique PublicUserId
                do
                {
                    publicUserId = PublicUserIdGenerator.Generate();
                } while (await authDb.UserAccounts.AnyAsync(u => u.PublicUserId == publicUserId)
                      || await appDb.DietitianClientLinks.AnyAsync(l => l.PublicUserId == publicUserId));

                if (userAccount != null)
                {
                    userAccount.SetPublicUserId(publicUserId);
                }
            }

            link.SetPublicUserIdIfEmpty(publicUserId);
        }

        await authDb.SaveChangesAsync();
        await appDb.SaveChangesAsync();
    }

    // Seed initial public recipes for free users (idempotent)
    if (!await appDb.Recipes.AnyAsync(r => r.IsPublic))
    {
        var seedRecipes = new List<Recipe>();
        for (int i = 1; i <= 50; i++)
        {
            var id = Guid.NewGuid();
            var name = $"Genel Tarif {i}";
            var description = "Sistem tarafından tanımlanmış genel tarif.";
            var recipe = new Recipe(id, null, name, description, isPublic: true);
            seedRecipes.Add(recipe);
        }

        await appDb.Recipes.AddRangeAsync(seedRecipes);
        await appDb.SaveChangesAsync();
    }
}

// ====================
// MIDDLEWARE PIPELINE
// ====================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Forwarded headers (for reverse proxy / real client IP)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    ForwardLimit = 1,
    // Trust all proxies by default; can be restricted via config in production
});

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<GlobalExceptionMiddleware>();

// ====================
// MAP CONTROLLERS
// ====================
app.MapControllers();

// ====================
// DEBUG ENDPOINTS (DEV ONLY)
// ====================
if (app.Environment.IsDevelopment())
{
    // AG-DASH-FIX-13: Build info to verify correct backend instance
    app.MapGet("/debug/build", () =>
    {
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        var version = assembly.GetName().Version?.ToString() ?? "unknown";
        var buildTime = System.IO.File.GetLastWriteTimeUtc(assembly.Location);
        
        return Results.Ok(new
        {
            service = "MyDietitian API",
            version,
            buildTime = buildTime.ToString("yyyy-MM-dd HH:mm:ss UTC"),
            environment = app.Environment.EnvironmentName,
            utc = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC")
        });
    })
    .AllowAnonymous()
    .WithMetadata(new ApiExplorerSettingsAttribute { IgnoreApi = true });

    // AG-DASH-FIX-14: List all registered endpoints
    app.MapGet("/debug/endpoints", (IEnumerable<Microsoft.AspNetCore.Routing.EndpointDataSource> sources) =>
    {
        var endpoints = sources
            .SelectMany(s => s.Endpoints)
            .OfType<Microsoft.AspNetCore.Routing.RouteEndpoint>()
            .Select(e => new
            {
                pattern = e.RoutePattern.RawText,
                methods = e.Metadata.GetMetadata<Microsoft.AspNetCore.Routing.HttpMethodMetadata>()?.HttpMethods.ToArray() ?? new[] { "ANY" },
                name = e.DisplayName,
                requiresAuth = e.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>() != null
            })
            .OrderBy(e => e.pattern)
            .ToList();

        var dashboardEndpoints = endpoints.Where(e => e.pattern?.Contains("dashboard", StringComparison.OrdinalIgnoreCase) == true).ToList();

        return Results.Ok(new
        {
            count = endpoints.Count,
            dashboardEndpoints,
            allEndpoints = endpoints
        });
    })
    .AllowAnonymous()
    .WithMetadata(new ApiExplorerSettingsAttribute { IgnoreApi = true });
}

app.Run();
