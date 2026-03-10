    using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Services;
using MyDietitianMobileApp.Infrastructure.Persistence;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Api.Middleware;
using MyDietitianMobileApp.Api.Services;
using System.Text;
using System.Threading.RateLimiting;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MyDietitianMobileApp.Domain.Interfaces;
using MyDietitianMobileApp.Infrastructure.Repositories;
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = Directory.GetCurrentDirectory(),
    WebRootPath = "wwwroot"
});

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
// DOMAIN SERVICES
// ====================
builder.Services.AddSingleton<MyDietitianMobileApp.Domain.Services.AccessCodeGenerator>();
builder.Services.AddSingleton<MyDietitianMobileApp.Domain.Services.RecipeMatchService>();
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
var appDbConnection = builder.Configuration.GetConnectionString("AppDb");
var authDbConnection = builder.Configuration.GetConnectionString("AuthDb");

// In Testing environment (used by smoke tests), fall back to in-memory placeholders
// to allow WebApplicationFactory to override DbContexts without requiring real Npgsql strings.
if (builder.Environment.IsEnvironment("Testing"))
{
    appDbConnection ??= "Host=localhost;Database=SmokeTest_AppDb;Username=ignored;Password=ignored";
    authDbConnection ??= "Host=localhost;Database=SmokeTest_AuthDb;Username=ignored;Password=ignored";
}

if (appDbConnection is null)
{
    throw new InvalidOperationException("Connection string 'AppDb' missing");
}

if (authDbConnection is null)
{
    throw new InvalidOperationException("Connection string 'AuthDb' missing");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(appDbConnection)
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment()));

builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(authDbConnection)
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment()));

// ====================
// SERVICES
// ====================
var premiumWorkerEnabled = builder.Configuration.GetValue<bool?>("PremiumExpirationWorker:Enabled") ?? true;

builder.Services.AddScoped<PasswordHasherService>();
builder.Services.AddScoped<IHealthCalculationService, HealthCalculationService>();
builder.Services.AddScoped<IPremiumStatusService, PremiumStatusService>();
builder.Services.AddScoped<IAlternativeMealDecisionService, AlternativeMealDecisionService>();
builder.Services.AddScoped<IRecipeRecommendationEngine, RecipeRecommendationEngine>();
builder.Services.AddScoped<IIngredientNormalizationService, IngredientNormalizationService>();
builder.Services.AddScoped<IIngredientTaxonomyService, IngredientTaxonomyService>();

// ── LLM Normalization Layer (opt-in, disabled by default) ──────────────────
var llmOptions = builder.Configuration.GetSection("IngredientLlm").Get<LlmNormalizationOptions>()
                 ?? new LlmNormalizationOptions();
builder.Services.AddSingleton(llmOptions);
builder.Services.AddScoped<IngredientLlmCandidateBuilder>();
if (llmOptions.Enabled)
{
    builder.Services.AddHttpClient("openai", c =>
    {
        c.BaseAddress = new Uri("https://api.openai.com/");
        c.Timeout = TimeSpan.FromSeconds(15);
    });
    builder.Services.AddScoped<IIngredientLlmClient, OpenAiIngredientLlmClient>();
}
else
{
    builder.Services.AddScoped<IIngredientLlmClient, NullIngredientLlmClient>();
}builder.Services.AddScoped<IBenchmarkRunner, BenchmarkRunner>();
builder.Services.AddScoped<IComplianceCalculationService, ComplianceCalculationService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IIngredientRepository, IngredientRepository>();
builder.Services.AddScoped<IRecipeRepository, RecipeRepository>();
builder.Services.AddScoped<IDietitianRepository, DietitianRepository>();
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<ILoginLockoutService, LoginLockoutService>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IKitchenNarrator, MyDietitianMobileApp.Application.Services.KitchenNarrator>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IClientIdentityResolver, MyDietitianMobileApp.Application.Services.ClientIdentityResolver>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IClientActivityWriter, MyDietitianMobileApp.Application.Services.ClientActivityWriter>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IComplianceService, MyDietitianMobileApp.Application.Services.ComplianceService>();
builder.Services.AddScoped<DatabaseSeeder>();

if (premiumWorkerEnabled)
{
    builder.Services.AddHostedService<PremiumExpirationWorker>();
}

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

    // auth-strict policy: auth/register/login gibi endpointler i�in IP bazl� limit
    options.AddPolicy("auth-strict", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ip,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,                 // 1 dakikada 10 istek
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    });
    options.AddPolicy("activation", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"activation:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,                   // �r: 10 deneme
                Window = TimeSpan.FromMinutes(5),   // 5 dakika
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });

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

    // Dietitian write operations (recipe CRUD): per-dietitian throttling
    options.AddPolicy("dietitian-write", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"dietitian-write:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
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

    // Profile write operations: per-client throttling
    options.AddPolicy("profile-write", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"profile-write:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(10),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });

    // Kitchen merge operations: per-client throttling
    options.AddPolicy("kitchen", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"kitchen:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });

    // Telemetry write operations (meal mark done/skip): per-client throttling
    options.AddPolicy("telemetry-write", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"telemetry:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,                    // 120 telemetry events
                Window = TimeSpan.FromMinutes(1),     // per minute
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });

    // Dietitian read-heavy reporting endpoints: per-dietitian throttling
    options.AddPolicy("dietitian-read-heavy", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"dietitian-read:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,                    // 120 read ops
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
            .TooManyRequests("RATE_LIMITED", "�ok fazla istek g�nderdiniz. L�tfen daha sonra tekrar deneyin.");

        await context.HttpContext.Response.WriteAsJsonAsync(problem, cancellationToken: token);
    };
});

// ====================
// JWT AUTHENTICATION
// ====================
var jwtSecret = builder.Configuration["Jwt:SecretKey"];

// In Testing environment (smoke tests / WebApplicationFactory discovery host),
// use a deterministic fallback secret if none is configured so the host can start.
if (string.IsNullOrEmpty(jwtSecret) && builder.Environment.IsEnvironment("Testing"))
{
    jwtSecret = "SmokeTests_Secret_Key_1234567890";
}

if (string.IsNullOrEmpty(jwtSecret))
{
    throw new InvalidOperationException("JWT Secret missing");
}
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "MyDietitian.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "MyDietitian.Mobile";
var isTestingLikeEnv = builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // CRITICAL: Disable inbound claim mapping to prevent "sub" from being remapped to "nameidentifier"
        options.MapInboundClaims = false;
        
        options.TokenValidationParameters = new TokenValidationParameters
        {
            // In development/testing, be more lenient on issuer/audience to simplify smoke tests
            ValidateIssuer = !isTestingLikeEnv,
            ValidateAudience = !isTestingLikeEnv,
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
    
    // DietitianOnly policy - robust role claim checking for settings endpoints
    options.AddPolicy("DietitianOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(ctx =>
        {
            // Support different role claim types (role, Role, ClaimTypes.Role)
            var roles = ctx.User.FindAll(ClaimTypes.Role).Select(c => c.Value)
                .Concat(ctx.User.FindAll("role").Select(c => c.Value))
                .Concat(ctx.User.FindAll("Role").Select(c => c.Value));

            return roles.Any(r => string.Equals(r, "Dietitian", StringComparison.OrdinalIgnoreCase));
        });
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
// ENSURE WWWROOT AND UPLOADS DIRECTORIES EXIST
// ====================
{
    var env = app.Services.GetRequiredService<IWebHostEnvironment>();
    var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
    
    // Create wwwroot if it doesn't exist
    Directory.CreateDirectory(webRoot);
    
    // Create uploads directory structure
    var uploadsDir = Path.Combine(webRoot, "uploads", "dietitian-logos");
    Directory.CreateDirectory(uploadsDir);
    
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogInformation("? Created/verified directory structure: {UploadsDir}", uploadsDir);
}

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
            logger.LogInformation("? Successfully connected to PostgreSQL database (AppDbContext)");

        var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        if (await authDb.Database.CanConnectAsync())
            logger.LogInformation("? Successfully connected to PostgreSQL database (AuthDbContext)");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "? Database connection failed");
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
            var description = "Sistem taraf�ndan tan�mlanm�� genel tarif.";
            var recipe = new Recipe(id, null, name, description, isPublic: true);
            seedRecipes.Add(recipe);
        }

        await appDb.Recipes.AddRangeAsync(seedRecipes);
        await appDb.SaveChangesAsync();
    }

    // Seed ingredient packs (idempotent)
    if (!await appDb.IngredientPacks.AnyAsync(p => p.IsSystem))
    {
        // First, ensure we have basic ingredients
        var basicIngredientNames = new[] { "Yumurta", "S�t", "Yo�urt", "Tavuk", "Zeytinya��", "Tuz", "Karabiber", "Yulaf", "Muz", "Domates" };
        var existingIngredients = await appDb.Ingredients
            .Where(i => basicIngredientNames.Contains(i.CanonicalName))
            .ToDictionaryAsync(i => i.CanonicalName, i => i.Id);

        var ingredientsToCreate = new List<Ingredient>();
        foreach (var name in basicIngredientNames)
        {
            if (!existingIngredients.ContainsKey(name))
            {
                ingredientsToCreate.Add(new Ingredient(Guid.NewGuid(), name, isActive: true));
            }
        }

        if (ingredientsToCreate.Any())
        {
            appDb.Ingredients.AddRange(ingredientsToCreate);
            await appDb.SaveChangesAsync();
        }

        // Reload all ingredients
        var allIngredients = await appDb.Ingredients
            .Where(i => basicIngredientNames.Contains(i.CanonicalName))
            .ToDictionaryAsync(i => i.CanonicalName, i => i.Id);

        // Create packs
        var packs = new List<IngredientPack>
        {
            new IngredientPack(Guid.NewGuid(), "Kahvalt�l�klar", isSystem: true, sortOrder: 1),
            new IngredientPack(Guid.NewGuid(), "Temel Baharatlar", isSystem: true, sortOrder: 2),
            new IngredientPack(Guid.NewGuid(), "Fitness Temelleri", isSystem: true, sortOrder: 3)
        };

        appDb.IngredientPacks.AddRange(packs);
        await appDb.SaveChangesAsync();

        // Add pack items
        var packItems = new List<IngredientPackItem>();

        // Extract ingredient IDs
        allIngredients.TryGetValue("Yumurta", out var eggId);
        allIngredients.TryGetValue("S�t", out var milkId);
        allIngredients.TryGetValue("Yo�urt", out var yogurtId);
        allIngredients.TryGetValue("Yulaf", out var oatsId);
        allIngredients.TryGetValue("Muz", out var bananaId);
        allIngredients.TryGetValue("Tuz", out var saltId);
        allIngredients.TryGetValue("Karabiber", out var pepperId);
        allIngredients.TryGetValue("Tavuk", out var chickenId);

        // Kahvalt�l�klar: Yumurta, S�t, Yo�urt, Yulaf, Muz
        if (eggId != Guid.Empty && milkId != Guid.Empty && yogurtId != Guid.Empty && oatsId != Guid.Empty && bananaId != Guid.Empty)
        {
            packItems.AddRange(new[]
            {
                new IngredientPackItem(packs[0].Id, eggId),
                new IngredientPackItem(packs[0].Id, milkId),
                new IngredientPackItem(packs[0].Id, yogurtId),
                new IngredientPackItem(packs[0].Id, oatsId),
                new IngredientPackItem(packs[0].Id, bananaId)
            });
        }

        // Temel Baharatlar: Tuz, Karabiber
        if (saltId != Guid.Empty && pepperId != Guid.Empty)
        {
            packItems.AddRange(new[]
            {
                new IngredientPackItem(packs[1].Id, saltId),
                new IngredientPackItem(packs[1].Id, pepperId)
            });
        }

        // Fitness Temelleri: Tavuk, Yulaf, Muz, Yo�urt
        if (chickenId != Guid.Empty && oatsId != Guid.Empty && bananaId != Guid.Empty && yogurtId != Guid.Empty)
        {
            packItems.AddRange(new[]
            {
                new IngredientPackItem(packs[2].Id, chickenId),
                new IngredientPackItem(packs[2].Id, oatsId),
                new IngredientPackItem(packs[2].Id, bananaId),
                new IngredientPackItem(packs[2].Id, yogurtId)
            });
        }

        if (packItems.Any())
        {
            appDb.IngredientPackItems.AddRange(packItems);
            await appDb.SaveChangesAsync();
        }
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
app.UseStaticFiles(); // Serve static files from wwwroot (branding logos, etc.)
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<GlobalExceptionMiddleware>();

// ====================
// MAP CONTROLLERS
// ====================
app.MapControllers();

// ====================
// DEBUG ENDPOINTS (DEV/TEST ONLY)
// ====================
if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing"))
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
                requiresAuth = e.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>() != null,
                roles = e.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>()?.Roles,
                policy = e.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>()?.Policy,
                rateLimitPolicy = e.Metadata.GetMetadata<Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute>()?.PolicyName
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

// ====================
// SEED DATABASE (Development only)
// ====================
using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
    await seeder.SeedAsync();
}

app.Run();
