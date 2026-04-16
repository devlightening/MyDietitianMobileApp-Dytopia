using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using MyDietitianMobileApp.Domain.Exceptions;

namespace MyDietitianMobileApp.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IWebHostEnvironment _env;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IWebHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            try
            {
                _logger.LogError(ex, "An unhandled exception occurred: {Message}", ex.Message);
            }
            catch
            {
                // Logging should never prevent the API from returning an error response.
            }
            await HandleExceptionAsync(context, ex);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        
        // Determine status code and error code based on exception type
        var (statusCode, errorCode, message, detail) = exception switch
        {
            DomainException de => (
                HttpStatusCode.BadRequest,
                de.Code,
                de.Message,
                (string?)null
            ),
            DbUpdateException dbEx => (
                HttpStatusCode.InternalServerError,
                "DB_SAVE_FAILED",
                "Veritabanı kayıt hatası. Lütfen tekrar deneyin.",
                _env.IsDevelopment() ? (dbEx.InnerException?.Message ?? dbEx.Message) : null
            ),
            UnauthorizedAccessException => (
                HttpStatusCode.Unauthorized,
                "UNAUTHORIZED",
                "Unauthorized access",
                (string?)null
            ),
            InvalidOperationException => (
                HttpStatusCode.BadRequest,
                "INVALID_OPERATION",
                exception.Message,
                (string?)null
            ),
            ArgumentException => (
                HttpStatusCode.BadRequest,
                "INVALID_ARGUMENT",
                exception.Message,
                (string?)null
            ),
            KeyNotFoundException => (
                HttpStatusCode.NotFound,
                "NOT_FOUND",
                exception.Message,
                (string?)null
            ),
            _ => (
                HttpStatusCode.InternalServerError,
                "INTERNAL_SERVER_ERROR",
                "An unexpected error occurred",
                (string?)null
            )
        };

        context.Response.StatusCode = (int)statusCode;

        var response = new
        {
            code = errorCode,
            message = message,
            detail = detail,
            // Only include stack trace in development
            stackTrace = _env.IsDevelopment() ? exception.StackTrace : null
        };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        return context.Response.WriteAsync(json);
    }
}
