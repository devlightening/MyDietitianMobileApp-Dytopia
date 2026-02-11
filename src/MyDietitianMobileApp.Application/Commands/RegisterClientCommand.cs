using MediatR;
using MyDietitianMobileApp.Domain.Enums;

namespace MyDietitianMobileApp.Application.Commands;

public class RegisterClientCommand : IRequest<RegisterClientResult>
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Gender Gender { get; set; }
    public DateOnly BirthDate { get; set; }
}

public class RegisterClientResult
{
    public bool Success { get; set; }
    public string Token { get; set; } = string.Empty;
    public string PublicUserId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    /// <summary>
    /// Optional machine-readable error code (e.g. EMAIL_DOMAIN_NOT_ALLOWED)
    /// </summary>
    public string? ErrorCode { get; set; }
    public Guid? ClientId { get; set; }
    public bool IsPremium { get; set; }
}
