namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Settings for a dietitian's clinic branding and profile
/// </summary>
public class DietitianSettings
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Foreign key to Dietitian (1:1 relationship)
    /// </summary>
    public Guid DietitianId { get; set; }
    
    /// <summary>
    /// Clinic name displayed in UI
    /// </summary>
    public string ClinicName { get; set; } = string.Empty;
    
    /// <summary>
    /// Dietitian's display name
    /// </summary>
    public string DietitianDisplayName { get; set; } = string.Empty;
    
    /// <summary>
    /// Primary brand color in hex format (#RRGGBB)
    /// </summary>
    public string PrimaryColorHex { get; set; } = "#4A7C59"; // Default: Sage
    
    /// <summary>
    /// Accent brand color in hex format (#RRGGBB)
    /// </summary>
    public string AccentColorHex { get; set; } = "#8FBC8F"; // Default: Forest
    
    /// <summary>
    /// Preset theme key (nullable for custom themes)
    /// </summary>
    public string? ThemePresetKey { get; set; }
    
    /// <summary>
    /// URL/path to clinic logo (nullable if no logo uploaded)
    /// </summary>
    public string? LogoUrl { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // Navigation property
    public Dietitian? Dietitian { get; set; }
}
