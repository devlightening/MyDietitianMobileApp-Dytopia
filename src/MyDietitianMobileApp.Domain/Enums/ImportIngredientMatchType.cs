namespace MyDietitianMobileApp.Domain.Enums;

public enum ImportIngredientMatchType
{
    Exact,
    Alias,
    Normalized,
    Fuzzy,
    Ambiguous,
    Manual,
    None
}
