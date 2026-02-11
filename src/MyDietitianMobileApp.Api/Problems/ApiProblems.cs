using Microsoft.AspNetCore.Mvc;

namespace MyDietitianMobileApp.Api.Problems;

public static class ApiProblems
{
    public static ProblemDetails Unprocessable(string code, string message)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status422UnprocessableEntity,
            Title = "Unprocessable request",
            Detail = message
        };
        problem.Extensions["code"] = code;
        return problem;
    }

    public static ProblemDetails TooManyRequests(string code, string message)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too many requests",
            Detail = message
        };
        problem.Extensions["code"] = code;
        return problem;
    }

    public static ProblemDetails PremiumRequired(string? detail = null)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status403Forbidden,
            Title = "Premium membership required",
            Detail = detail ?? "Bu özellik premium üyelik gerektirir."
        };
        problem.Extensions["code"] = "PREMIUM_REQUIRED";
        return problem;
    }

    public static ProblemDetails NotFound(string code, string message)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Title = "Resource not found",
            Detail = message
        };
        problem.Extensions["code"] = code;
        return problem;
    }

    public static ProblemDetails Validation(string code, string message)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Validation error",
            Detail = message
        };
        problem.Extensions["code"] = code;
        return problem;
    }

    public static ProblemDetails Unauthorized(string code, string message)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status401Unauthorized,
            Title = "Authentication required",
            Detail = message
        };
        problem.Extensions["code"] = code;
        return problem;
    }

    public static ProblemDetails InternalServerError(string code, string message)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Internal server error",
            Detail = message
        };
        problem.Extensions["code"] = code;
        return problem;
    }
}

