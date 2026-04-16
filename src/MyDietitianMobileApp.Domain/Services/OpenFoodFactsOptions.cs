namespace MyDietitianMobileApp.Domain.Services;

/// <summary>
/// Runtime configuration for the lightweight Open Food Facts barcode lookup fallback.
/// </summary>
public class OpenFoodFactsOptions
{
    public bool Enabled { get; set; } = true;
    public string BaseUrl { get; set; } = "https://world.openfoodfacts.org";
    public int TimeoutSeconds { get; set; } = 6;
}
