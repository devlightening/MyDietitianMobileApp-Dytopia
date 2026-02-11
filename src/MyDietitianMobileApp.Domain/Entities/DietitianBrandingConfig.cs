namespace MyDietitianMobileApp.Domain.Entities;

public class DietitianBrandingConfig
{
    public Guid DietitianId { get; private set; }
    public string ClinicName { get; private set; }
    public string? LogoUrl { get; private set; }
    public string PrimaryColorHex { get; private set; }
    public string AccentColorHex { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public Dietitian Dietitian { get; private set; } = null!;

    private DietitianBrandingConfig() { } // EF Core

    public DietitianBrandingConfig(Guid dietitianId, string clinicName, string? logoUrl = null, string primaryColorHex = "#111111", string accentColorHex = "#22C55E")
    {
        DietitianId = dietitianId;
        ClinicName = clinicName;
        LogoUrl = logoUrl;
        PrimaryColorHex = primaryColorHex;
        AccentColorHex = accentColorHex;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(string clinicName, string? logoUrl, string primaryColorHex, string accentColorHex)
    {
        ClinicName = clinicName;
        LogoUrl = logoUrl;
        PrimaryColorHex = primaryColorHex;
        AccentColorHex = accentColorHex;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
