namespace MyDietitianMobileApp.Infrastructure.Services;

public sealed record PasswordValidationResult(bool IsValid, string? ErrorMessage = null);

public static class PasswordPolicy
{
    public const int MinimumLength = 8;

    public static PasswordValidationResult Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            return new PasswordValidationResult(false, "Şifre zorunludur.");
        }

        if (password.Length < MinimumLength)
        {
            return new PasswordValidationResult(false, "Şifre en az 8 karakter olmalıdır.");
        }

        if (!password.Any(char.IsUpper))
        {
            return new PasswordValidationResult(false, "Şifre en az bir büyük harf içermelidir.");
        }

        if (!password.Any(char.IsLower))
        {
            return new PasswordValidationResult(false, "Şifre en az bir küçük harf içermelidir.");
        }

        if (!password.Any(char.IsDigit))
        {
            return new PasswordValidationResult(false, "Şifre en az bir rakam içermelidir.");
        }

        return new PasswordValidationResult(true);
    }
}
