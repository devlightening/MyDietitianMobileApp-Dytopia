using System.Security.Cryptography;

namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Generates unique 6-8 digit access codes for client premium activation
/// </summary>
public class AccessCodeGenerator
{
    private const string AllowedChars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Exclude I, O to avoid confusion
    private const int DefaultCodeLength = 6;
    private const int MaxRetries = 3;

    /// <summary>
    /// Generate a unique access code
    /// </summary>
    /// <param name="length">Code length (default: 6)</param>
    /// <returns>Generated code (e.g., "A3B7K9")</returns>
    public string GenerateCode(int length = DefaultCodeLength)
    {
        if (length < 4 || length > 12)
            throw new ArgumentException("Code length must be between 4 and 12", nameof(length));

        var code = new char[length];
        var randomBytes = new byte[length];

        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(randomBytes);
        }

        for (int i = 0; i < length; i++)
        {
            code[i] = AllowedChars[randomBytes[i] % AllowedChars.Length];
        }

        return new string(code);
    }

    /// <summary>
    /// Generate a unique code with collision detection
    /// </summary>
    /// <param name="existsCheck">Function to check if code already exists</param>
    /// <param name="length">Code length</param>
    /// <returns>Unique code</returns>
    public async Task<string> GenerateUniqueCodeAsync(
        Func<string, Task<bool>> existsCheck,
        int length = DefaultCodeLength)
    {
        for (int attempt = 0; attempt < MaxRetries; attempt++)
        {
            var code = GenerateCode(length);
            
            if (!await existsCheck(code))
                return code;
        }

        // If all retries failed, try with longer code
        var longerCode = GenerateCode(length + 1);
        if (!await existsCheck(longerCode))
            return longerCode;

        throw new InvalidOperationException(
            $"Failed to generate unique code after {MaxRetries} attempts");
    }

    /// <summary>
    /// Validate code format
    /// </summary>
    public bool IsValidCodeFormat(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return false;

        if (code.Length < 4 || code.Length > 12)
            return false;

        return code.All(c => AllowedChars.Contains(c));
    }
}
