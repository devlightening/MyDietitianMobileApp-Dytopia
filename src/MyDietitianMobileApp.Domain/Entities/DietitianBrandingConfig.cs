namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Stores branding and theme customization settings for a dietitian's clinic
/// </summary>
public class DietitianBrandingConfig
{
    public Guid DietitianId { get; private set; }
    public string? ClinicName { get; private set; }
    public string? LogoUrl { get; private set; }
    public string PrimaryColorHex { get; private set; }
    public string AccentColorHex { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public Dietitian Dietitian { get; private set; } = null!;

    private DietitianBrandingConfig() { } // EF Core

    public DietitianBrandingConfig(Guid dietitianId, string? clinicName = null, string? logoUrl = null, string primaryColorHex = "#4A7C59", string accentColorHex = "#FF8C61")
    {
        DietitianId = dietitianId;
        ClinicName = clinicName;
        LogoUrl = logoUrl;
        PrimaryColorHex = primaryColorHex;
        AccentColorHex = accentColorHex;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(string? clinicName, string? logoUrl, string primaryColorHex, string accentColorHex)
    {
        ClinicName = clinicName;
        LogoUrl = logoUrl;
        PrimaryColorHex = primaryColorHex;
        AccentColorHex = accentColorHex;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
