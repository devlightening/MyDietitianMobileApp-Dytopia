namespace MyDietitianMobileApp.Api.DTOs.Settings;

/// <summary>
/// DTO for dietitian settings (branding + profile)
/// </summary>
public class DietitianSettingsDto
{
    public string ClinicName { get; set; } = string.Empty;
    public string DietitianDisplayName { get; set; } = string.Empty;
    public string PrimaryColorHex { get; set; } = "#4A7C59";
    public string AccentColorHex { get; set; } = "#8FBC8F";
    public string? ThemePresetKey { get; set; }
    public string? LogoUrl { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Bio { get; set; }
    public string? WebsiteUrl { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// DTO for updating dietitian settings
/// </summary>
public class UpdateDietitianSettingsDto
{
    public string ClinicName { get; set; } = string.Empty;
    public string DietitianDisplayName { get; set; } = string.Empty;
    public string PrimaryColorHex { get; set; } = "#4A7C59";
    public string AccentColorHex { get; set; } = "#8FBC8F";
    public string? ThemePresetKey { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Bio { get; set; }
    public string? WebsiteUrl { get; set; }
}
