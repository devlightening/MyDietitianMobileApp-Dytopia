namespace MyDietitianMobileApp.Domain.Entities;

public class ClientMealLog
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public DateOnly Date { get; private set; }
    public string MealType { get; private set; } = null!;
    public string? Notes { get; private set; }
    public string? PhotoUrl { get; private set; }
    public string? FoodName { get; private set; }
    public int? CaloriesKcal { get; private set; }
    public decimal? ProteinGrams { get; private set; }
    public decimal? CarbsGrams { get; private set; }
    public decimal? FatGrams { get; private set; }
    public decimal PortionCount { get; private set; } = 1m;
    public decimal? AiConfidence { get; private set; }
    public string? AnalysisJson { get; private set; }
    public string Source { get; private set; } = "manual";
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation
    public Client Client { get; private set; } = null!;

    private ClientMealLog() { } // EF Core

    public ClientMealLog(
        Guid clientId,
        DateOnly date,
        string mealType,
        string? notes,
        string? photoUrl,
        string? foodName = null,
        int? caloriesKcal = null,
        decimal? proteinGrams = null,
        decimal? carbsGrams = null,
        decimal? fatGrams = null,
        decimal portionCount = 1m,
        decimal? aiConfidence = null,
        string? analysisJson = null,
        string source = "manual")
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        Date = date;
        MealType = mealType.Trim();
        Notes = notes?.Trim();
        PhotoUrl = photoUrl?.Trim();
        FoodName = string.IsNullOrWhiteSpace(foodName) ? null : foodName.Trim();
        CaloriesKcal = caloriesKcal is > 0 ? caloriesKcal : null;
        ProteinGrams = NormalizeMacro(proteinGrams);
        CarbsGrams = NormalizeMacro(carbsGrams);
        FatGrams = NormalizeMacro(fatGrams);
        PortionCount = portionCount > 0 ? portionCount : 1m;
        AiConfidence = aiConfidence is >= 0m and <= 1m ? aiConfidence : null;
        AnalysisJson = string.IsNullOrWhiteSpace(analysisJson) ? null : analysisJson.Trim();
        Source = string.IsNullOrWhiteSpace(source) ? "manual" : source.Trim();
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Update(string? notes, string? photoUrl)
    {
        Notes = notes?.Trim();
        PhotoUrl = photoUrl?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    private static decimal? NormalizeMacro(decimal? value)
    {
        return value is > 0m ? decimal.Round(value.Value, 2) : null;
    }
}
