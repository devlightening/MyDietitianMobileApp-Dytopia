namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Stores branding and theme customization settings for a dietitian's clinic
/// </summary>
public class DietitianBrandingSettings
{
    /// <summary>
    /// Dietitian ID (Primary Key)
    /// </summary>
    public Guid DietitianId { get; set; }

    /// <summary>
    /// Custom clinic display name (max 120 characters)
    /// </summary>
    public string? ClinicName { get; set; }

    /// <summary>
    /// URL to uploaded clinic logo
    /// </summary>
    public string? LogoUrl { get; set; }

    /// <summary>
    /// Primary brand color in hex format (#RRGGBB)
    /// </summary>
    public string? PrimaryColor { get; set; }

    /// <summary>
    /// Accent brand color in hex format (#RRGGBB)
    /// </summary>
    public string? AccentColor { get; set; }

    /// <summary>
    /// Last update timestamp (UTC)
    /// </summary>
    public DateTime UpdatedAtUtc { get; set; }

    // Navigation property
    public Dietitian? Dietitian { get; set; }
}
