using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using MyDietitianMobileApp.Api.Problems;

namespace MyDietitianMobileApp.Api.Middleware;

/// <summary>
/// Produces standardized ProblemDetails responses for authorization failures (401/403).
/// </summary>
public class ProblemDetailsAuthorizationMiddlewareResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _defaultHandler = new();
    private readonly ILogger<ProblemDetailsAuthorizationMiddlewareResultHandler> _logger;

    public ProblemDetailsAuthorizationMiddlewareResultHandler(
        ILogger<ProblemDetailsAuthorizationMiddlewareResultHandler> logger)
    {
        _logger = logger;
    }

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        // If authorization succeeded, continue pipeline
        if (authorizeResult.Succeeded)
        {
            await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
            return;
        }

        // If response was already started, fall back to default behavior
        if (context.Response.HasStarted)
        {
            _logger.LogWarning("Authorization failed but response has already started.");
            await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
            return;
        }

        context.Response.ContentType = "application/problem+json";

        if (!context.User?.Identity?.IsAuthenticated ?? true)
        {
            // 401 - unauthenticated
            var problem = new
            {
                type = "about:blank",
                title = "Authentication required",
                status = StatusCodes.Status401Unauthorized,
                detail = "Bu kaynağa erişmek için oturum açmanız gerekir.",
                code = "AUTH_REQUIRED"
            };

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
            return;
        }

        // 403 - forbidden (generic). Premium-specific 403'ler controller içinde ApiProblems.PremiumRequired ile üretiliyor.
        var forbidden = new
        {
            type = "about:blank",
            title = "Forbidden",
            status = StatusCodes.Status403Forbidden,
            detail = "Bu kaynağa erişim yetkiniz yok.",
            code = "FORBIDDEN"
        };

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsync(JsonSerializer.Serialize(forbidden));
    }
}

