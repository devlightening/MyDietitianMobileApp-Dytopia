    using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Options;
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
using MyDietitianMobileApp.Api.Realtime;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = Directory.GetCurrentDirectory(),
    WebRootPath = "wwwroot"
});

// Load appsettings.Local.json if present — gitignored, safe for local secrets (API keys, etc.)
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);

// Use explicit providers to avoid Windows EventLog permission failures in local/dev runs.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// ====================
// NETWORK CONFIGURATION
// ====================
builder.WebHost.UseUrls("http://0.0.0.0:5000", "https://0.0.0.0:7154");

// ====================
// CONTROLLERS & API
// ====================
// AG-DASH-FIX-15: Ensure all controllers are discovered
builder.Services.AddControllers()
    .AddApplicationPart(typeof(MyDietitianMobileApp.Api.Controllers.DashboardController).Assembly)
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Encoder =
            System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All);
        // Accept both string ("Male") and numeric (0) enum values from clients
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
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
builder.Services.Configure<PremiumKitchenMatchOptions>(
    builder.Configuration.GetSection(PremiumKitchenMatchOptions.SectionName));
builder.Services.AddScoped<IPremiumStatusService, PremiumStatusService>();
builder.Services.AddScoped<IAlternativeMealDecisionService, AlternativeMealDecisionService>();
builder.Services.AddScoped<IRecipeRecommendationEngine, RecipeRecommendationEngine>();
builder.Services.AddScoped<IIngredientNormalizationService, IngredientNormalizationService>();
builder.Services.AddScoped<IIngredientTaxonomyService, IngredientTaxonomyService>();
builder.Services.AddScoped<IIngredientDetectionResolver, IngredientDetectionResolver>();

// ── OpenAI API key resolution (config > env var, never logged) ─────────────
// Priority: appsettings.Local.json → user-secrets → appsettings.*.json → OPENAI_API_KEY env var
static string? ResolveOpenAiKey(IConfiguration cfg, string envVarName)
{
    var fromConfig = cfg["OpenAI:ApiKey"];
    if (!string.IsNullOrWhiteSpace(fromConfig)) return fromConfig;
    return Environment.GetEnvironmentVariable(envVarName);
}

// ── Safe BaseAddress builder — handles null/empty/"null" strings from config ──
static Uri SafeOpenAiBaseAddress(string? configuredUrl, string fallback = "https://api.openai.com/")
{
    if (string.IsNullOrWhiteSpace(configuredUrl))
        return new Uri(fallback);

    var raw = configuredUrl.Trim().TrimEnd('/') + "/";
    if (Uri.TryCreate(raw, UriKind.Absolute, out var uri) &&
        (uri.Scheme == "https" || uri.Scheme == "http"))
        return uri;

    return new Uri(fallback);
}

static bool WantsHtml(HttpContext context)
    => context.Request.Headers.Accept.ToString().Contains("text/html", StringComparison.OrdinalIgnoreCase);

static string BuildOpenAiPingHtml(
    bool apiKeyConfigured,
    bool llmEnabled,
    bool visionEnabled,
    string model,
    string baseUrl,
    string timestamp)
{
    var overall = apiKeyConfigured && (llmEnabled || visionEnabled);
    var statusText = overall ? "Hazır" : apiKeyConfigured ? "Anahtar var · özellik kapalı" : "API key eksik";
    var statusClass = overall ? "ok" : apiKeyConfigured ? "warn" : "bad";
    var llmClass = llmEnabled ? "ok" : "muted";
    var visionClass = visionEnabled ? "ok" : "muted";
    var keyClass = apiKeyConfigured ? "ok" : "bad";

    return $$"""
    <!doctype html>
    <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Dytopia · OpenAI Durumu</title>
      <style>
        :root {
          --bg: #f3fbf6;
          --card: rgba(255,255,255,.88);
          --text: #123829;
          --muted: #6f8179;
          --green: #2fbf71;
          --green-dark: #16844b;
          --gold: #d8b33f;
          --red: #e86f61;
          --line: rgba(47,191,113,.22);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: var(--text);
          background:
            radial-gradient(circle at 82% 12%, rgba(47,191,113,.18), transparent 28rem),
            radial-gradient(circle at 8% 86%, rgba(108,211,162,.18), transparent 24rem),
            var(--bg);
          padding: 28px;
        }
        .shell {
          width: min(880px, 100%);
          border: 1px solid var(--line);
          border-radius: 34px;
          background: var(--card);
          box-shadow: 0 24px 70px rgba(18,56,41,.12);
          overflow: hidden;
        }
        .hero {
          padding: 34px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 24px;
          align-items: start;
          border-bottom: 1px solid var(--line);
        }
        .eyebrow { color: var(--green); letter-spacing: .18em; font-weight: 900; font-size: 13px; }
        h1 { margin: 8px 0 10px; font-size: clamp(34px, 7vw, 64px); line-height: .96; letter-spacing: -.05em; }
        p { margin: 0; color: var(--muted); font-size: 17px; line-height: 1.55; max-width: 620px; }
        .status {
          min-width: 146px;
          border-radius: 26px;
          padding: 18px 20px;
          text-align: center;
          border: 1px solid var(--line);
          background: rgba(47,191,113,.08);
        }
        .status strong { display:block; font-size: 28px; line-height: 1; }
        .status span { display:block; margin-top: 6px; color: var(--muted); font-weight: 800; }
        .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 24px 34px 8px; }
        .tile {
          border: 1px solid var(--line);
          border-radius: 24px;
          background: rgba(255,255,255,.72);
          padding: 18px;
          min-height: 126px;
        }
        .label { color: var(--muted); font-weight: 900; letter-spacing:.08em; font-size: 12px; text-transform: uppercase; }
        .value { margin-top: 12px; font-size: 24px; font-weight: 950; word-break: break-word; }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 12px;
          margin-top: 10px;
          font-weight: 900;
          border: 1px solid currentColor;
          background: rgba(47,191,113,.08);
        }
        .ok { color: var(--green-dark); }
        .warn { color: var(--gold); }
        .bad { color: var(--red); }
        .muted { color: var(--muted); }
        .footer {
          display:flex;
          justify-content: space-between;
          gap: 14px;
          padding: 24px 34px 34px;
          color: var(--muted);
          font-weight: 800;
          flex-wrap: wrap;
        }
        code {
          border-radius: 12px;
          background: rgba(18,56,41,.06);
          padding: 6px 9px;
          color: var(--text);
        }
        @media (max-width: 720px) {
          body { padding: 16px; place-items: start center; }
          .hero { grid-template-columns: 1fr; padding: 24px; }
          .grid { grid-template-columns: 1fr; padding: 18px 24px 6px; }
          .footer { padding: 20px 24px 28px; }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="hero">
          <div>
            <div class="eyebrow">DYTOPIA · OPENAI</div>
            <h1>AI bağlantı durumu</h1>
            <p>Bu sayfa API anahtarını asla göstermez; sadece Dytopia'nın OpenAI destekli oyun, barkod/malzeme eşleştirme ve görsel tanıma akışlarına hazır olup olmadığını kontrol eder.</p>
          </div>
          <div class="status {{statusClass}}">
            <strong>{{statusText}}</strong>
            <span>genel durum</span>
          </div>
        </section>
        <section class="grid">
          <article class="tile">
            <div class="label">API Key</div>
            <div class="value {{keyClass}}">{{(apiKeyConfigured ? "Tanımlı" : "Eksik")}}</div>
            <div class="pill {{keyClass}}">● {{(apiKeyConfigured ? "Gizli şekilde yüklendi" : "OpenAI:ApiKey gerekli")}}</div>
          </article>
          <article class="tile">
            <div class="label">Oyun & Barkod LLM</div>
            <div class="value {{llmClass}}">{{(llmEnabled ? "Aktif" : "Kapalı")}}</div>
            <div class="pill {{llmClass}}">● IngredientLlm</div>
          </article>
          <article class="tile">
            <div class="label">Vision</div>
            <div class="value {{visionClass}}">{{(visionEnabled ? "Aktif" : "Kapalı")}}</div>
            <div class="pill {{visionClass}}">● Görsel tanıma</div>
          </article>
          <article class="tile">
            <div class="label">Model</div>
            <div class="value">{{System.Net.WebUtility.HtmlEncode(model)}}</div>
          </article>
          <article class="tile">
            <div class="label">Base URL</div>
            <div class="value">{{System.Net.WebUtility.HtmlEncode(baseUrl)}}</div>
          </article>
          <article class="tile">
            <div class="label">Saat</div>
            <div class="value">{{System.Net.WebUtility.HtmlEncode(timestamp)}}</div>
          </article>
        </section>
        <footer class="footer">
          <span>JSON için: <code>Accept: application/json</code></span>
          <span>Key değeri bilinçli olarak maskelenir.</span>
        </footer>
      </main>
    </body>
    </html>
    """;
}

// ── LLM Normalization Layer (opt-in, disabled by default) ──────────────────
var llmOptions = builder.Configuration.GetSection("IngredientLlm").Get<LlmNormalizationOptions>()
                 ?? new LlmNormalizationOptions();
llmOptions.ApiKey = ResolveOpenAiKey(builder.Configuration, llmOptions.ApiKeyEnvVar);
var llmProvider = llmOptions.ResolveProvider();
builder.Services.AddSingleton(llmOptions);
builder.Services.AddScoped<IngredientLlmCandidateBuilder>();
builder.Services.AddHttpClient("openai-games", c =>
{
    c.BaseAddress = SafeOpenAiBaseAddress(llmOptions.BaseUrl);
    c.Timeout = TimeSpan.FromSeconds(25);
});
if (llmProvider == IngredientLlmProvider.OpenAi)
{
    // Timeout: 35s covers both LLM (15s) and Vision (gpt-4o up to 30s + buffer)
    builder.Services.AddHttpClient("openai", c =>
    {
        c.BaseAddress = SafeOpenAiBaseAddress(llmOptions.BaseUrl);
        c.Timeout = TimeSpan.FromSeconds(35);
    });
    builder.Services.AddScoped<IIngredientLlmClient, OpenAiIngredientLlmClient>();
}
else if (llmProvider == IngredientLlmProvider.Ollama)
{
    builder.Services.AddHttpClient("ollama", c =>
    {
        c.BaseAddress = SafeOpenAiBaseAddress(llmOptions.BaseUrl, "http://localhost:11434/");
        c.Timeout = TimeSpan.FromSeconds(15);
    });
    builder.Services.AddScoped<IIngredientLlmClient, OllamaIngredientLlmClient>();
}
else
{
    builder.Services.AddScoped<IIngredientLlmClient, NullIngredientLlmClient>();
}

// ── Vision Ingredient Detection (opt-in, disabled by default) ──────────────
var visionOptions = builder.Configuration.GetSection("VisionIngredient").Get<VisionIngredientOptions>()
                    ?? new VisionIngredientOptions();
visionOptions.ApiKey = ResolveOpenAiKey(builder.Configuration, visionOptions.ApiKeyEnvVar);
builder.Services.AddSingleton(visionOptions);
if (visionOptions.Enabled)
{
    // Register "openai" HttpClient only if not already registered by the LLM block above
    if (llmProvider != IngredientLlmProvider.OpenAi)
    {
        builder.Services.AddHttpClient("openai", c =>
        {
            c.BaseAddress = SafeOpenAiBaseAddress(null); // always https://api.openai.com/
            c.Timeout = TimeSpan.FromSeconds(visionOptions.TimeoutSeconds + 5);
        });
    }
    builder.Services.AddScoped<IVisionIngredientService, VisionIngredientService>();
}
else
{
    builder.Services.AddScoped<IVisionIngredientService, NullVisionIngredientService>();
}

var openFoodFactsOptions = builder.Configuration.GetSection("OpenFoodFacts").Get<OpenFoodFactsOptions>()
                          ?? new OpenFoodFactsOptions();
builder.Services.AddSingleton(openFoodFactsOptions);
builder.Services.AddHttpClient("openfoodfacts", client =>
{
    client.BaseAddress = new Uri((openFoodFactsOptions.BaseUrl?.TrimEnd('/') ?? "https://world.openfoodfacts.org") + "/");
    client.Timeout = TimeSpan.FromSeconds(Math.Max(1, openFoodFactsOptions.TimeoutSeconds));
    client.DefaultRequestHeaders.UserAgent.ParseAdd("DytopiaBarcodeResolver/1.0");
    client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("tr-TR,tr;q=0.9,en;q=0.8");
});

builder.Services.AddScoped<IBarcodeIngredientResolutionService, BarcodeIngredientResolutionService>();
builder.Services.AddScoped<IIngredientAcquisitionService, IngredientAcquisitionService>();

builder.Services.AddScoped<IBenchmarkRunner, BenchmarkRunner>();
builder.Services.AddScoped<IComplianceCalculationService, ComplianceCalculationService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IIngredientRepository, IngredientRepository>();
builder.Services.AddScoped<IRecipeRepository, RecipeRepository>();
builder.Services.AddScoped<IDietitianRepository, DietitianRepository>();
builder.Services.AddScoped<IClientRepository, ClientRepository>();
builder.Services.AddScoped<DatabaseAuditService>();
builder.Services.AddScoped<ILoginLockoutService, LoginLockoutService>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IKitchenNarrator, MyDietitianMobileApp.Application.Services.KitchenNarrator>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IClientIdentityResolver, MyDietitianMobileApp.Application.Services.ClientIdentityResolver>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IClientActivityWriter, MyDietitianMobileApp.Application.Services.ClientActivityWriter>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IClientGamificationService, MyDietitianMobileApp.Application.Services.ClientGamificationService>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IDailyGameContentGenerator, MyDietitianMobileApp.Application.Services.DailyGameContentGenerator>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IClientGameService, MyDietitianMobileApp.Application.Services.ClientGameService>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.IComplianceService, MyDietitianMobileApp.Application.Services.ComplianceService>();
builder.Services.AddScoped<MyDietitianMobileApp.Infrastructure.Services.Import.RecipeImportOrchestrator>();
builder.Services.AddSignalR();
builder.Services.AddScoped<ISyncEventPublisher, SyncEventPublisher>();
builder.Services.AddScoped<MyDietitianMobileApp.Application.Services.MealPlanTemplateService>();

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
        policy.WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3001")
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

    // Vision image analysis: per-client, conservative — each call hits OpenAI Vision API
    options.AddPolicy("kitchen-vision", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"kitchen-vision:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,                    // 10 image scans
                Window = TimeSpan.FromMinutes(5),    // per 5 minutes per user
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

    // Contact form: IP-based strict throttling (5 submissions / 10 min)
    options.AddPolicy("contact", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"contact:{ip}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(10),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });

    // Progress/tracking write operations: per-client throttling (water, steps, notes)
    options.AddPolicy("progress-write", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                     ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"progress-write:{userId}",
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
            .TooManyRequests("RATE_LIMITED", "�ok fazla istek g�nderdiniz. L�tfen daha sonra tekrar deneyin.");

        await context.HttpContext.Response.WriteAsJsonAsync(problem, cancellationToken: token);
    };
});

// ====================
// JWT AUTHENTICATION
// ====================
var jwtSecret = builder.Configuration["Jwt:SecretKey"] ?? builder.Configuration["Jwt:Secret"];

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
                {
                    context.Token = token;
                    return Task.CompletedTask;
                }

                var isHubRequest = context.HttpContext.Request.Path.StartsWithSegments("/hubs/sync");
                if (isHubRequest && context.Request.Query.TryGetValue("access_token", out var hubToken))
                {
                    context.Token = hubToken;
                }

                return Task.CompletedTask;
            },
            OnTokenValidated = async context =>
            {
                var userId = context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)
                    ?? context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var tokenSecurityStamp = context.Principal?.FindFirstValue("sst");

                if (!Guid.TryParse(userId, out var parsedUserId))
                {
                    context.Fail("Invalid token subject.");
                    return;
                }

                var authDb = context.HttpContext.RequestServices.GetRequiredService<AuthDbContext>();
                var userAccount = await authDb.UserAccounts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == parsedUserId);

                if (userAccount == null)
                {
                    context.Fail("User account not found.");
                    return;
                }

                if (string.IsNullOrWhiteSpace(userAccount.SecurityStamp))
                {
                    context.Fail("Security stamp missing.");
                    return;
                }

                if (!string.Equals(tokenSecurityStamp, userAccount.SecurityStamp, StringComparison.Ordinal))
                {
                    context.Fail("Session is no longer valid.");
                }
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

    if (appDb.Database.IsNpgsql())
    {
        await appDb.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ClientNotificationPreferences" (
                "ClientId" uuid NOT NULL PRIMARY KEY,
                "NotificationsEnabled" boolean NOT NULL DEFAULT TRUE,
                "InAppCoachNotificationsEnabled" boolean NOT NULL DEFAULT TRUE,
                "AchievementNotificationsEnabled" boolean NOT NULL DEFAULT TRUE,
                "PantryActivityNotificationsEnabled" boolean NOT NULL DEFAULT TRUE,
                "HydrationRemindersEnabled" boolean NOT NULL DEFAULT TRUE,
                "HydrationIntervalMinutes" integer NOT NULL DEFAULT 120,
                "HydrationStartLocalTime" time without time zone NOT NULL DEFAULT TIME '09:00',
                "HydrationEndLocalTime" time without time zone NOT NULL DEFAULT TIME '21:00',
                "MealPlanRemindersEnabled" boolean NOT NULL DEFAULT TRUE,
                "MealReminderLeadMinutes" integer NOT NULL DEFAULT 20,
                "MeasurementRemindersEnabled" boolean NOT NULL DEFAULT TRUE,
                "MeasurementReminderDayOfWeek" integer NOT NULL DEFAULT 1,
                "MeasurementReminderLocalTime" time without time zone NOT NULL DEFAULT TIME '20:00',
                "ReengagementRemindersEnabled" boolean NOT NULL DEFAULT TRUE,
                "ReengagementDelayHours" integer NOT NULL DEFAULT 48,
                "TimeZoneId" character varying(64) NOT NULL DEFAULT 'Europe/Istanbul',
                "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                "LastAppOpenAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                "LastNotificationSyncAtUtc" timestamp with time zone NULL,
                CONSTRAINT "FK_ClientNotificationPreferences_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS "IX_ClientNotificationPreferences_UpdatedAtUtc"
                ON "ClientNotificationPreferences" ("UpdatedAtUtc");

            CREATE INDEX IF NOT EXISTS "IX_ClientNotificationPreferences_LastAppOpenAtUtc"
                ON "ClientNotificationPreferences" ("LastAppOpenAtUtc");

            ALTER TABLE "ClientNotificationPreferences"
                ADD COLUMN IF NOT EXISTS "InAppCoachNotificationsEnabled" boolean NOT NULL DEFAULT TRUE;

            ALTER TABLE "ClientNotificationPreferences"
                ADD COLUMN IF NOT EXISTS "AchievementNotificationsEnabled" boolean NOT NULL DEFAULT TRUE;

            ALTER TABLE "ClientNotificationPreferences"
                ADD COLUMN IF NOT EXISTS "PantryActivityNotificationsEnabled" boolean NOT NULL DEFAULT TRUE;

            CREATE TABLE IF NOT EXISTS "ClientGoalPreferences" (
                "ClientId" uuid NOT NULL PRIMARY KEY,
                "PrimaryGoal" character varying(64) NOT NULL DEFAULT 'Balance',
                "DietStyle" character varying(64) NOT NULL DEFAULT 'Flexible',
                "CookingTimePreference" character varying(64) NOT NULL DEFAULT 'Quick',
                "ReminderTone" character varying(64) NOT NULL DEFAULT 'Supportive',
                "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "FK_ClientGoalPreferences_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS "IX_ClientGoalPreferences_UpdatedAtUtc"
                ON "ClientGoalPreferences" ("UpdatedAtUtc");

            CREATE TABLE IF NOT EXISTS "ClientShoppingListItems" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "ClientId" uuid NOT NULL,
                "IngredientId" uuid NULL,
                "Title" character varying(180) NOT NULL,
                "Quantity" numeric(10,2) NULL,
                "Unit" character varying(50) NULL,
                "IsChecked" boolean NOT NULL DEFAULT FALSE,
                "SourceType" character varying(32) NOT NULL DEFAULT 'Manual',
                "SourceReferenceId" character varying(128) NULL,
                "Note" character varying(240) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "FK_ClientShoppingListItems_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ClientShoppingListItems_Ingredients_IngredientId"
                    FOREIGN KEY ("IngredientId") REFERENCES "Ingredients" ("Id") ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS "IX_ClientShoppingListItems_ClientId_IsChecked_UpdatedAtUtc"
                ON "ClientShoppingListItems" ("ClientId", "IsChecked", "UpdatedAtUtc");

            CREATE INDEX IF NOT EXISTS "IX_ClientShoppingListItems_ClientId_IngredientId"
                ON "ClientShoppingListItems" ("ClientId", "IngredientId");

            ALTER TABLE IF EXISTS "ClientShoppingListItems"
                ADD COLUMN IF NOT EXISTS "SourceMealsJson" text NULL;

            ALTER TABLE IF EXISTS "ClientShoppingListItems"
                ADD COLUMN IF NOT EXISTS "IngredientRoleSummaryJson" text NULL;

            ALTER TABLE IF EXISTS "ClientShoppingListItems"
                ADD COLUMN IF NOT EXISTS "PrimaryMealTitle" character varying(160) NULL;

            ALTER TABLE IF EXISTS "ClientShoppingListItems"
                ADD COLUMN IF NOT EXISTS "PrimaryMealTime" character varying(16) NULL;

            ALTER TABLE IF EXISTS "ClientShoppingListItems"
                ADD COLUMN IF NOT EXISTS "GeneratedFromSelectedRecipe" boolean NOT NULL DEFAULT FALSE;

            ALTER TABLE IF EXISTS "PlanMealItems"
                ADD COLUMN IF NOT EXISTS "SelectedRecipeId" uuid NULL;

            ALTER TABLE IF EXISTS "PlanMealItems"
                ADD COLUMN IF NOT EXISTS "SelectedRecipeSource" character varying(24) NOT NULL DEFAULT 'Original';

            CREATE INDEX IF NOT EXISTS "IX_PlanMealItems_SelectedRecipeId"
                ON "PlanMealItems" ("SelectedRecipeId");

            CREATE TABLE IF NOT EXISTS "ClientCareMessages" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "ClientId" uuid NOT NULL,
                "DietitianId" uuid NULL,
                "SenderRole" character varying(32) NOT NULL DEFAULT 'Client',
                "Text" character varying(2000) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                "ReadAtUtc" timestamp with time zone NULL,
                CONSTRAINT "FK_ClientCareMessages_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ClientCareMessages_Dietitians_DietitianId"
                    FOREIGN KEY ("DietitianId") REFERENCES "Dietitians" ("Id") ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS "IX_ClientCareMessages_ClientId_CreatedAtUtc"
                ON "ClientCareMessages" ("ClientId", "CreatedAtUtc");

            CREATE INDEX IF NOT EXISTS "IX_ClientCareMessages_DietitianId_CreatedAtUtc"
                ON "ClientCareMessages" ("DietitianId", "CreatedAtUtc");

            ALTER TABLE "ClientCareMessages"
                ADD COLUMN IF NOT EXISTS "ReplyToId" uuid NULL;

            ALTER TABLE "ClientCareMessages"
                ADD COLUMN IF NOT EXISTS "ReplyToSnippet" character varying(140) NULL;

            CREATE TABLE IF NOT EXISTS "ClientAppointmentSummaries" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "ClientId" uuid NOT NULL,
                "DietitianId" uuid NULL,
                "Title" character varying(160) NOT NULL,
                "ScheduledAtUtc" timestamp with time zone NOT NULL,
                "Mode" character varying(32) NOT NULL DEFAULT 'online',
                "Location" character varying(180) NULL,
                "Note" character varying(300) NULL,
                "IsCancelled" boolean NOT NULL DEFAULT FALSE,
                "AttendanceStatus" character varying(24) NOT NULL DEFAULT 'pending',
                "AttendanceMarkedAtUtc" timestamp with time zone NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "FK_ClientAppointmentSummaries_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ClientAppointmentSummaries_Dietitians_DietitianId"
                    FOREIGN KEY ("DietitianId") REFERENCES "Dietitians" ("Id") ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS "IX_ClientAppointmentSummaries_ClientId_ScheduledAtUtc"
                ON "ClientAppointmentSummaries" ("ClientId", "ScheduledAtUtc");

            CREATE INDEX IF NOT EXISTS "IX_ClientAppointmentSummaries_ClientId_IsCancelled"
                ON "ClientAppointmentSummaries" ("ClientId", "IsCancelled");

            ALTER TABLE "ClientAppointmentSummaries"
                ADD COLUMN IF NOT EXISTS "AttendanceStatus" character varying(24) NOT NULL DEFAULT 'pending';

            ALTER TABLE "ClientAppointmentSummaries"
                ADD COLUMN IF NOT EXISTS "AttendanceMarkedAtUtc" timestamp with time zone NULL;

            CREATE TABLE IF NOT EXISTS "ClientEngagementEvents" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "ClientId" uuid NOT NULL,
                "DietitianId" uuid NULL,
                "EventType" character varying(64) NOT NULL,
                "EventDate" date NOT NULL,
                "OccurredAtUtc" timestamp with time zone NOT NULL,
                "MetaJson" jsonb NULL,
                CONSTRAINT "FK_ClientEngagementEvents_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ClientEngagementEvents_Dietitians_DietitianId"
                    FOREIGN KEY ("DietitianId") REFERENCES "Dietitians" ("Id") ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS "IX_ClientEngagementEvents_ClientId_EventDate_EventType"
                ON "ClientEngagementEvents" ("ClientId", "EventDate", "EventType");

            CREATE INDEX IF NOT EXISTS "IX_ClientEngagementEvents_DietitianId_EventDate"
                ON "ClientEngagementEvents" ("DietitianId", "EventDate");

            CREATE TABLE IF NOT EXISTS "ClientAchievementUnlocks" (
                "ClientId" uuid NOT NULL,
                "BadgeId" character varying(64) NOT NULL,
                "CurrentLevel" integer NOT NULL DEFAULT 1,
                "UnlockedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                "LastSeenAtUtc" timestamp with time zone NULL,
                "LastNotifiedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "PK_ClientAchievementUnlocks" PRIMARY KEY ("ClientId", "BadgeId"),
                CONSTRAINT "FK_ClientAchievementUnlocks_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS "IX_ClientAchievementUnlocks_UnlockedAtUtc"
                ON "ClientAchievementUnlocks" ("UnlockedAtUtc");

            CREATE TABLE IF NOT EXISTS "ClientGamificationSnapshots" (
                "ClientId" uuid NOT NULL,
                "Date" date NOT NULL,
                "PrimaryTrack" character varying(32) NOT NULL DEFAULT 'daily_rhythm',
                "PrimaryScore" numeric(5,2) NOT NULL DEFAULT 0,
                "AdherenceScore" numeric(5,2) NOT NULL DEFAULT 0,
                "EngagementScore" numeric(5,2) NOT NULL DEFAULT 0,
                "QualifiedForStreak" boolean NOT NULL DEFAULT FALSE,
                "CurrentStreak" integer NOT NULL DEFAULT 0,
                "BestStreak" integer NOT NULL DEFAULT 0,
                "PlannedMeals" integer NOT NULL DEFAULT 0,
                "DoneMeals" integer NOT NULL DEFAULT 0,
                "AlternativeMeals" integer NOT NULL DEFAULT 0,
                "SkippedMeals" integer NOT NULL DEFAULT 0,
                "WaterGlasses" integer NOT NULL DEFAULT 0,
                "WaterGoalHit" boolean NOT NULL DEFAULT FALSE,
                "KitchenEvents" integer NOT NULL DEFAULT 0,
                "MeasurementLogged" boolean NOT NULL DEFAULT FALSE,
                "CareMessageSent" boolean NOT NULL DEFAULT FALSE,
                "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_ClientGamificationSnapshots" PRIMARY KEY ("ClientId", "Date"),
                CONSTRAINT "FK_ClientGamificationSnapshots_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS "IX_ClientGamificationSnapshots_ClientId_Date"
                ON "ClientGamificationSnapshots" ("ClientId", "Date");

            CREATE INDEX IF NOT EXISTS "IX_ClientGamificationSnapshots_Date_QualifiedForStreak"
                ON "ClientGamificationSnapshots" ("Date", "QualifiedForStreak");

            CREATE TABLE IF NOT EXISTS "DailyGameChallenges" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "Date" date NOT NULL,
                "Language" character varying(10) NOT NULL DEFAULT 'tr',
                "GameType" character varying(32) NOT NULL,
                "Title" character varying(160) NOT NULL,
                "Subtitle" character varying(240) NOT NULL DEFAULT '',
                "Difficulty" character varying(24) NOT NULL DEFAULT 'easy',
                "EstimatedSeconds" integer NOT NULL DEFAULT 60,
                "PayloadJson" jsonb NOT NULL,
                "AnswerKeyJson" jsonb NOT NULL,
                "SourceProvider" character varying(32) NOT NULL DEFAULT 'fallback',
                "IsFallback" boolean NOT NULL DEFAULT TRUE,
                "GeneratedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW()
            );

            DROP INDEX IF EXISTS "IX_DailyGameChallenges_Date_Language_GameType";

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_DailyGameChallenges_Date_Language_GameType_Difficulty"
                ON "DailyGameChallenges" ("Date", "Language", "GameType", "Difficulty");

            CREATE TABLE IF NOT EXISTS "ClientGameSessions" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "ClientId" uuid NOT NULL,
                "ChallengeId" uuid NOT NULL,
                "GameDate" date NOT NULL,
                "GameType" character varying(32) NOT NULL,
                "CompletedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW(),
                "Score" integer NOT NULL DEFAULT 0,
                "MaxScore" integer NOT NULL DEFAULT 100,
                "DurationSeconds" integer NOT NULL DEFAULT 0,
                "Moves" integer NOT NULL DEFAULT 0,
                "CorrectCount" integer NOT NULL DEFAULT 0,
                "Perfect" boolean NOT NULL DEFAULT FALSE,
                "ResultJson" jsonb NOT NULL DEFAULT '{{}}'::jsonb,
                CONSTRAINT "FK_ClientGameSessions_Clients_ClientId"
                    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ClientGameSessions_DailyGameChallenges_ChallengeId"
                    FOREIGN KEY ("ChallengeId") REFERENCES "DailyGameChallenges" ("Id") ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ClientGameSessions_ClientId_ChallengeId"
                ON "ClientGameSessions" ("ClientId", "ChallengeId");

            CREATE INDEX IF NOT EXISTS "IX_ClientGameSessions_ClientId_GameDate_GameType"
                ON "ClientGameSessions" ("ClientId", "GameDate", "GameType");

            CREATE INDEX IF NOT EXISTS "IX_ClientGameSessions_CompletedAtUtc"
                ON "ClientGameSessions" ("CompletedAtUtc");
            """);
    }

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

// NOTE: UseHttpsRedirection is intentionally absent. Mobile clients (Android emulator)
// connect via plain HTTP (http://10.0.2.2:5000). Adding HTTPS redirect here would
// cause ERR_NETWORK on the emulator because it cannot validate the dev certificate.

// ====================
// MAP CONTROLLERS
// ====================
app.MapControllers();
app.MapHub<SyncHub>("/hubs/sync").RequireCors("Frontend");

// ── OpenAI startup status log ──────────────────────────────────────────────
var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
var hasVisionKey = !string.IsNullOrWhiteSpace(visionOptions.ApiKey);
var resolvedBaseUrl = SafeOpenAiBaseAddress(llmOptions.BaseUrl).ToString();

if (visionOptions.Enabled && hasVisionKey)
{
    startupLogger.LogInformation(
        "✓ OpenAI Vision ENABLED | model={Model} | baseUrl={BaseUrl} | apiKey=configured",
        visionOptions.ModelName, resolvedBaseUrl);
}
else if (visionOptions.Enabled && !hasVisionKey)
{
    startupLogger.LogWarning(
        "✗ OpenAI Vision ENABLED but API key MISSING | model={Model} | baseUrl={BaseUrl} | " +
        "Fix: add OpenAI:ApiKey to appsettings.Local.json",
        visionOptions.ModelName, resolvedBaseUrl);
}
else
{
    startupLogger.LogInformation(
        "○ OpenAI Vision DISABLED (VisionIngredient:Enabled=false) | model={Model}",
        visionOptions.ModelName);
}

startupLogger.LogInformation(
    "○ IngredientLlm: enabled={Enabled} | provider={Provider} | model={Model} | apiKey={HasKey}",
    llmOptions.Enabled, llmOptions.Provider, llmOptions.ModelName,
    !string.IsNullOrWhiteSpace(llmOptions.ApiKey) ? "configured" : "MISSING");

// ====================
// HEALTH CHECK (all environments)
// Unauthenticated, no rate limit — safe for monitoring and mobile dev diagnostics.
// Android emulator: GET http://10.0.2.2:5000/health
// ====================
app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
    environment = app.Environment.EnvironmentName,
    version = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "dev"
}))
.AllowAnonymous()
.DisableRateLimiting()
.WithMetadata(new ApiExplorerSettingsAttribute { IgnoreApi = true });

// ====================
// OPENAI PING — key ve config kontrolü (key değerini asla döndürmez)
// GET /api/openai/ping  |  GET /api/openai/vision/ping
// ====================
app.MapGet("/api/openai/ping", (HttpContext http, VisionIngredientOptions vopts, LlmNormalizationOptions llmopts) =>
{
    var key     = vopts.ApiKey ?? llmopts.ApiKey ?? Environment.GetEnvironmentVariable(vopts.ApiKeyEnvVar);
    var keySet  = !string.IsNullOrWhiteSpace(key);
    var baseUrl = SafeOpenAiBaseAddress(llmopts.BaseUrl).ToString();
    var timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
    if (WantsHtml(http))
    {
        return Results.Content(
            BuildOpenAiPingHtml(keySet, llmopts.Enabled, vopts.Enabled, vopts.ModelName, baseUrl, timestamp),
            "text/html; charset=utf-8");
    }

    return Results.Ok(new
    {
        visionEnabled    = vopts.Enabled,
        llmEnabled       = llmopts.Enabled,
        apiKeyConfigured = keySet,
        model            = vopts.ModelName,
        baseUrl,
        timestamp,
    });
})
.AllowAnonymous()
.DisableRateLimiting()
.WithMetadata(new ApiExplorerSettingsAttribute { IgnoreApi = true });

// /api/openai/vision/ping — detaylı vision diagnostik (doc requirement)
app.MapGet("/api/openai/vision/ping", (HttpContext http, VisionIngredientOptions vopts, LlmNormalizationOptions llmopts) =>
{
    var key     = vopts.ApiKey ?? llmopts.ApiKey ?? Environment.GetEnvironmentVariable(vopts.ApiKeyEnvVar);
    var keySet  = !string.IsNullOrWhiteSpace(key);
    var baseUrl = SafeOpenAiBaseAddress(llmopts.BaseUrl).ToString();
    if (WantsHtml(http))
    {
        return Results.Content(
            BuildOpenAiPingHtml(keySet, llmopts.Enabled, vopts.Enabled, vopts.ModelName, baseUrl, DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")),
            "text/html; charset=utf-8");
    }

    if (!vopts.Enabled)
        return Results.Ok(new { enabled = false, apiKeyConfigured = keySet, model = vopts.ModelName, baseUrl,
            status = "VisionIngredient:Enabled is false — enable it in appsettings.Local.json" });

    if (!keySet)
        return Results.Ok(new { enabled = true, apiKeyConfigured = false, model = vopts.ModelName, baseUrl,
            status = "API key missing — add OpenAI:ApiKey to appsettings.Local.json" });

    return Results.Ok(new { enabled = true, apiKeyConfigured = true, model = vopts.ModelName, baseUrl,
        closedSetCount = vopts.ClosedSetCanonicalNames.Count,
        status = "ready" });
})
.AllowAnonymous()
.DisableRateLimiting()
.WithMetadata(new ApiExplorerSettingsAttribute { IgnoreApi = true });

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

app.Run();
