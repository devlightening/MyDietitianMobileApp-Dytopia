using Microsoft.Extensions.Configuration;

namespace MyDietitianMobileApp.Application.Services;

public static class EmailPolicy
{
    private static readonly string[] DefaultAllowedDomains = new[]
    {
        "gmail.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "icloud.com",
        "yahoo.com"
    };

    public static (bool IsAllowed, string NormalizedEmail, string? ErrorCode, string? ErrorMessage) ValidateAllowedDomain(
        string email,
        IConfiguration config)
    {
        var normalizedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();

        var atIndex = normalizedEmail.LastIndexOf('@');
        if (atIndex <= 0 || atIndex == normalizedEmail.Length - 1)
        {
            return (false, normalizedEmail, "INVALID_EMAIL", "Geçerli bir email adresi giriniz.");
        }

        var domain = normalizedEmail[(atIndex + 1)..].Trim().ToLowerInvariant();

        // Read allowlist from configuration, with sensible defaults
        var configSection = config.GetSection("AuthSecurity:AllowedEmailDomains");
        var fromConfig = configSection.GetChildren().Select(c => c.Value).Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v!).ToArray();
        var allowed = (fromConfig is { Length: > 0 } ? fromConfig : DefaultAllowedDomains)
            .Select(d => d.Trim().ToLowerInvariant())
            .Where(d => !string.IsNullOrWhiteSpace(d))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!allowed.Contains(domain))
        {
            return (false, normalizedEmail, "EMAIL_DOMAIN_NOT_ALLOWED", "Bu email uzantısı desteklenmiyor.");
        }

        return (true, normalizedEmail, null, null);
    }
}

